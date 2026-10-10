import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export const CLAVE_INVITACION = 'carreta-invitacion'

// Pantalla para un usuario que todavía no forma parte de ninguna empresa:
// pedido de acceso pendiente, rechazado, o quitado del equipo.
export default function SinCuenta() {
  const { usuario, signOut, cargarUsuario } = useAuth()
  const [sol, setSol] = useState(undefined)       // undefined = cargando, null = sin pedido
  const [inv, setInv] = useState(null)            // invitación guardada en este navegador
  const [error, setError] = useState('')
  const [aceptando, setAceptando] = useState(false)

  async function cargar() {
    const { data } = await supabase.rpc('mi_solicitud')
    setSol(data?.[0] || null)
    // ¿Lo aprobaron? recargar usuario + cuenta
    if (data?.[0]?.estado === 'aprobada' && usuario) cargarUsuario(usuario.id)
  }

  useEffect(() => {
    cargar()
    let token = null
    try { token = localStorage.getItem(CLAVE_INVITACION) } catch { /* sin storage */ }
    if (token) {
      supabase.rpc('ver_invitacion', { p_token: token }).then(({ data }) => {
        const i = data?.[0]
        if (i?.vigente && i.email?.toLowerCase() === usuario?.email?.toLowerCase()) setInv({ ...i, token })
      })
    }
    const t = setInterval(cargar, 15000)   // se entera solo cuando el master aprueba
    return () => clearInterval(t)
  }, [])

  async function aceptar() {
    setAceptando(true); setError('')
    const { error } = await supabase.rpc('aceptar_invitacion', { p_token: inv.token })
    if (error) { setError(error.message); setAceptando(false); return }
    try { localStorage.removeItem(CLAVE_INVITACION) } catch { /* nada */ }
    await cargarUsuario(usuario.id)
  }

  let icono = '⏳', titulo = 'Esperando aprobación', texto = ''
  if (sol === undefined) { icono = ''; titulo = 'Cargando…' }
  else if (sol?.estado === 'pendiente') {
    texto = `Tu pedido para sumarte a ${sol.razon_social} está pendiente. Cuando el titular lo apruebe vas a poder operar (te avisamos).`
  } else if (sol?.estado === 'rechazada') {
    icono = '🚫'; titulo = 'Pedido rechazado'
    texto = `El titular de ${sol.razon_social} rechazó tu pedido de acceso. Si es un error, pedile que te invite desde "Mi equipo".`
  } else {
    icono = '👥'; titulo = 'Sin empresa asociada'
    texto = 'Tu usuario no forma parte de ninguna empresa en Carreta. Pedile al titular de la cuenta que te invite desde "Mi equipo".'
  }

  return (
    <div className="min-h-screen bg-verde-800 flex flex-col items-center justify-center px-6 py-10">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
        {icono && <div className="text-4xl mb-3">{icono}</div>}
        <h2 className="text-base font-bold text-gray-900 mb-2">{titulo}</h2>
        {texto && <p className="text-sm text-gray-500 mb-4">{texto}</p>}

        {inv && (
          <div className="bg-verde-50 border border-verde-100 rounded-[10px] p-3 mb-4 text-left">
            <div className="text-xs text-gray-600 mb-2">
              Tenés una invitación de <strong>{inv.razon_social}</strong>.
            </div>
            <button onClick={aceptar} disabled={aceptando}
              className="w-full bg-verde-700 text-white rounded-[10px] py-2 text-sm font-bold disabled:opacity-60">
              {aceptando ? 'Aceptando…' : 'Aceptar invitación'}
            </button>
          </div>
        )}

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <button onClick={cargar}
          className="w-full border border-gray-200 text-gray-600 rounded-[10px] py-2 text-sm font-semibold mb-2">
          Actualizar
        </button>
        <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600">
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
