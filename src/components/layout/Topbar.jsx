import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function Topbar({ title, showBack, backTo, accent = 'verde' }) {
  const navigate = useNavigate()
  const { usuario, cuenta, cuentas } = useAuth()
  const varias = (cuentas?.length || 0) > 1
  const [noLeidas, setNoLeidas] = useState(0)
  const [notifs, setNotifs] = useState([])
  const [showPanel, setShowPanel] = useState(false)

  const initials = usuario
    ? `${usuario.nombre?.[0] || ''}${usuario.apellido?.[0] || ''}`.toUpperCase()
    : '?'

  const bg = accent === 'azul' ? 'bg-azul-600' : 'bg-verde-800'
  const rolActual = accent === 'azul' ? 'transportista' : 'productor'

  useEffect(() => {
    if (!usuario) return
    cargarNotifs()
    // Tiempo real: llega un aviso nuevo → se actualiza la campanita
    const sub = supabase.channel(`notifs-${usuario.id}-${rolActual}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notificaciones',
        filter: `usuario_id=eq.${usuario.id}`
      }, () => cargarNotifs())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [usuario, rolActual, cuenta?.id])

  async function cargarNotifs() {
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', usuario.id)
      .or(`rol.eq.${rolActual},rol.is.null`)   // solo avisos del rol actual
      .order('created_at', { ascending: false })
      .limit(60)
    // solo los de la empresa activa (o personales, sin empresa)
    const mias = (data || []).filter(n => !n.cuenta_id || !cuenta || n.cuenta_id === cuenta.id).slice(0, 20)
    setNotifs(mias)
    setNoLeidas(mias.filter(n => !n.leida).length)
  }

  async function marcarLeidas() {
    const ids = notifs.filter(n => !n.leida).map(n => n.id)
    if (ids.length) await supabase.from('notificaciones').update({ leida: true }).in('id', ids)
    setNoLeidas(0)
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
  }

  const abrirPanel = () => {
    setShowPanel(true)
    if (noLeidas > 0) marcarLeidas()
  }

  return (
    <div className={`${bg} px-4 py-3 flex items-center justify-between flex-shrink-0 relative`}>
      <div className="flex items-center gap-2.5">
        {showBack ? (
          <button
            onClick={() => backTo ? navigate(backTo) : navigate(-1)}
            className="text-white/70 hover:text-white"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
        ) : (
          <img src="/logo_carreta.png" alt="Carreta" className="w-8 h-8 object-contain bg-white rounded-[9px] p-0.5" />
        )}
        <div>
          <div className="text-white text-sm font-semibold leading-tight">
            {title || 'Carreta'}
          </div>
          {varias ? (
            <button onClick={() => navigate('/roles')} className="block text-left text-white/80 text-[10px] font-semibold max-w-[180px] truncate">
              🏢 {cuenta?.razon_social} ▾{cuenta?.permiso === 'lectura' && <span className="text-yellow-200"> · 👁 Solo lectura</span>}
            </button>
          ) : cuenta?.permiso === 'lectura' ? (
            <div className="text-yellow-200 text-[10px] font-semibold">👁 Solo lectura</div>
          ) : !title && (
            <div className="text-white/60 text-[10px]">Conectando la actividad agropecuaria</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <button onClick={abrirPanel} className="relative">
          <span className="text-white/70 text-lg">🔔</span>
          {noLeidas > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              {noLeidas > 9 ? '9+' : noLeidas}
            </span>
          )}
        </button>
        <div
          onClick={() => navigate(accent === 'azul' ? '/transportista/perfil' : '/productor/perfil')}
          className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center
            text-[11px] font-semibold text-white cursor-pointer"
        >
          {initials}
        </div>
      </div>

      {/* Panel notificaciones */}
      {showPanel && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPanel(false)} />
          <div className="absolute top-14 right-3 w-72 bg-white rounded-[14px] shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Notificaciones</span>
              <button onClick={() => setShowPanel(false)} className="text-gray-400 text-xs">✕</button>
            </div>
            {notifs.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-gray-400">Sin notificaciones</div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifs.map(n => (
                  <div key={n.id}
                    onClick={() => {
                      setShowPanel(false)
                      if (['solicitud_acceso', 'equipo_alta'].includes(n.tipo)) { navigate('/equipo'); return }
                      if (!n.pedido_id) return
                      if (rolActual === 'transportista' && ['pedido_nuevo', 'oferta_reactivada'].includes(n.tipo))
                        navigate(`/transportista/disponible/${n.pedido_id}`)
                      else navigate(`/${rolActual}/pedido/${n.pedido_id}`)
                    }}
                    className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${!n.leida ? 'bg-azul-50' : ''}`}>
                    <div className="text-xs font-semibold text-gray-900">{n.titulo}</div>
                    {n.mensaje && <div className="text-xs text-gray-500 mt-0.5">{n.mensaje}</div>}
                    <div className="text-[10px] text-gray-300 mt-0.5">
                      {new Date(n.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
