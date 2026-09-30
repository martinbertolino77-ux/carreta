import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Shell, { Body } from '../components/layout/Shell'
import Topbar from '../components/layout/Topbar'
import Card from '../components/ui/Card'
import Contacto from '../components/pedidos/Contacto'
import CalifDisplay from '../components/ui/CalifDisplay'
import Contador from '../components/ui/Contador'
import Estrellas from '../components/ui/Estrellas'
import { useAuth } from '../context/AuthContext'

export default function PerfilPublico() {
  const { rol, id } = useParams()   // rol = 'transportista' | 'productor'
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [perfil, setPerfil] = useState(null)
  const [telefono, setTelefono] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [id, rol])

  async function cargar() {
    setLoading(true)
    const fn = rol === 'transportista' ? 'perfil_transportista' : 'perfil_productor'
    const param = rol === 'transportista' ? 'p_transportista_id' : 'p_productor_id'
    const { data } = await supabase.rpc(fn, { [param]: id })
    const p = Array.isArray(data) ? data[0] : data
    setPerfil(p)

    // Teléfono solo si hay relación activa
    if (p?.usuario_id) {
      const { data: tel } = await supabase.rpc('telefono_si_relacion', { p_otro_usuario_id: p.usuario_id })
      setTelefono(tel)
    }
    setLoading(false)
  }

  const accent = rol === 'transportista' ? 'azul' : 'verde'

  if (loading) return (
    <Shell>
      <Topbar title="Perfil" showBack accent={accent} />
      <Body><p className="text-xs text-gray-400 text-center py-10">Cargando…</p></Body>
    </Shell>
  )

  if (!perfil) return (
    <Shell>
      <Topbar title="Perfil" showBack accent={accent} />
      <Body><p className="text-xs text-gray-400 text-center py-10">Perfil no encontrado.</p></Body>
    </Shell>
  )

  const comentarios = Array.isArray(perfil.comentarios) ? perfil.comentarios : []

  return (
    <Shell>
      <Topbar title="Perfil" showBack accent={accent} />
      <Body>

        {/* Cabecera */}
        <Card className="mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0
              ${rol === 'transportista' ? 'bg-azul-50' : 'bg-verde-50'}`}>
              {rol === 'transportista' ? '🚛' : '🌱'}
            </div>
            <div className="flex-1">
              <div className="text-base font-bold text-gray-900">{perfil.nombre}</div>
              {perfil.localidad && (
                <div className="text-xs text-gray-500">📍 {perfil.localidad}, {perfil.provincia}</div>
              )}
              <div className="text-xs text-gray-400 mt-0.5">
                {rol === 'transportista' ? 'Transportista' : 'Productor'}
              </div>
            </div>
          </div>

          {/* Teléfono si hay relación activa */}
          {telefono && <Contacto telefono={telefono} className="mt-3" />}
          {!telefono && (
            <div className="mt-2 text-[10px] text-gray-300 text-center">
              El teléfono es visible cuando tenés un pedido activo en común
            </div>
          )}
        </Card>

        {/* Estadísticas */}
        <Card className="mb-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-gray-900">{perfil.total_viajes ?? perfil.total_pedidos ?? 0}</div>
              <div className="text-[10px] text-gray-400">{rol === 'transportista' ? 'Viajes' : 'Pedidos'}</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{perfil.calif_promedio ?? '—'}</div>
              <div className="text-[10px] text-gray-400">Calificación</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{perfil.cancelaciones ?? 0}</div>
              <div className="text-[10px] text-gray-400">Cancelaciones</div>
            </div>
          </div>
          {perfil.calif_promedio && (
            <div className="flex justify-center mt-2">
              <Estrellas valor={Math.round(perfil.calif_promedio)} readonly size="sm" />
            </div>
          )}
        </Card>

        {/* Equipos (solo transportista) */}
        {rol === 'transportista' && perfil.equipos?.length > 0 && (
          <Card className="mb-3">
            <div className="text-xs font-semibold text-gray-600 mb-2">Equipos activos</div>
            <div className="flex gap-2 flex-wrap">
              {perfil.equipos.map((e, i) => (
                <span key={i} className="text-xs bg-azul-50 text-azul-700 border border-azul-100 rounded-full px-2.5 py-1">
                  {e}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Comentarios */}
        {comentarios.length > 0 && (
          <Card className="mb-3">
            <div className="text-xs font-semibold text-gray-600 mb-2">Últimas opiniones</div>
            {comentarios.map((c, i) => (
              <div key={i} className="py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Estrellas valor={Math.round(c.puntaje)} readonly size="sm" />
                  <span className="text-[10px] text-gray-400">{c.puntaje}</span>
                </div>
                <div className="text-xs text-gray-600 italic">"{c.texto}"</div>
              </div>
            ))}
          </Card>
        )}

        {comentarios.length === 0 && (
          <div className="text-center py-6 text-gray-400">
            <div className="text-xs">Sin opiniones todavía.</div>
          </div>
        )}

      </Body>
    </Shell>
  )
}
