import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CLAVE_INVITACION } from '../pages/auth/SinCuenta'

// Invitación guardada en este navegador (vino por link) para un usuario que
// ya opera en Carreta: puede sumarse a otra empresa sin dejar la suya.
export default function InvitacionPendiente() {
  const { usuario, cargarUsuario } = useAuth()
  const [inv, setInv] = useState(null)
  const [error, setError] = useState('')
  const [aceptando, setAceptando] = useState(false)

  const olvidar = () => { try { localStorage.removeItem(CLAVE_INVITACION) } catch { /* nada */ }; setInv(null) }

  useEffect(() => {
    if (!usuario) return
    let token = null
    try { token = localStorage.getItem(CLAVE_INVITACION) } catch { /* sin storage */ }
    if (!token) return
    supabase.rpc('ver_invitacion', { p_token: token }).then(({ data }) => {
      const i = data?.[0]
      if (!i?.vigente) { olvidar(); return }
      setInv({ ...i, token, otroMail: i.email?.toLowerCase() !== usuario.email?.toLowerCase() })
    })
  }, [usuario?.id])

  async function aceptar() {
    setAceptando(true); setError('')
    const { data, error } = await supabase.rpc('aceptar_invitacion', { p_token: inv.token })
    if (error) {
      setAceptando(false)
      if (error.message.includes('Ya formás parte')) { olvidar(); return }
      setError(error.message); return
    }
    olvidar()
    await cargarUsuario(usuario.id, data)
  }

  if (!inv) return null
  return (
    <div className="bg-verde-50 border border-verde-100 rounded-[14px] p-4 mb-4">
      <div className="text-sm text-gray-800 mb-1">👥 <strong>{inv.razon_social}</strong> te invitó a sumarte a su equipo.</div>
      {inv.otroMail ? (
        <div className="text-xs text-orange-700 mb-2">
          La invitación es para <strong>{inv.email}</strong> y entraste con {usuario.email}. Ingresá con ese mail para aceptarla.
        </div>
      ) : (
        <div className="text-xs text-gray-500 mb-3">Seguís en tus empresas actuales y sumás esta. Después elegís con cuál operar.</div>
      )}
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      <div className="flex gap-2">
        {!inv.otroMail && (
          <button onClick={aceptar} disabled={aceptando}
            className="flex-1 bg-verde-700 text-white rounded-[10px] py-2 text-sm font-bold disabled:opacity-60">
            {aceptando ? 'Aceptando…' : 'Aceptar invitación'}
          </button>
        )}
        <button onClick={olvidar} className="px-3 text-xs text-gray-500 border border-gray-200 rounded-[10px] py-2">
          Ignorar
        </button>
      </div>
    </div>
  )
}
