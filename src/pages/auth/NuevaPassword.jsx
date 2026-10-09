import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase, linkRecuperacion } from '../../lib/supabase'

export default function NuevaPassword() {
  const navigate = useNavigate()
  const [pass, setPass]       = useState('')
  const [pass2, setPass2]     = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [listo, setListo]     = useState(false)
  // 'verificando' | 'confirmar' | 'ok' | 'invalido'
  const [estado, setEstado]   = useState('verificando')

  useEffect(() => {
    let vivo = true
    const marcar = (e) => { if (vivo) setEstado(e) }

    // 1) Error devuelto por Supabase (link vencido / ya usado)
    if (linkRecuperacion.error) { marcar('invalido'); return }

    // 2) Link nuevo con token_hash: pedir click (Outlook/Hotmail escanean
    //    los links y gastan el token si se verifica solo al abrir)
    if (linkRecuperacion.tokenHash) { marcar('confirmar'); return }

    // 3) Link clásico (#access_token…type=recovery): el cliente ya procesó
    //    la URL antes de montar esta página → revisar flag + sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) marcar('ok')
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && linkRecuperacion.esRecovery) marcar('ok')
    })
    const t = setTimeout(() => {
      setEstado(e => (e === 'verificando' ? 'invalido' : e))
    }, 8000)

    return () => { vivo = false; clearTimeout(t); subscription.unsubscribe() }
  }, [])

  const confirmarLink = async () => {
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.verifyOtp({
      token_hash: linkRecuperacion.tokenHash,
      type: 'recovery',
    })
    setLoading(false)
    if (err) { setEstado('invalido'); return }
    linkRecuperacion.esRecovery = true
    window.history.replaceState(null, '', '/nueva-password')
    setEstado('ok')
  }

  const doUpdate = async (e) => {
    e.preventDefault()
    if (!pass || !pass2) { setError('Completá ambos campos'); return }
    if (pass.length < 6)  { setError('Mínimo 6 caracteres'); return }
    if (pass !== pass2)   { setError('Las contraseñas no coinciden'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password: pass })
    if (err) {
      setError(err.message?.includes('different from the old')
        ? 'La contraseña nueva debe ser distinta a la anterior.'
        : 'No se pudo actualizar. Pedí un nuevo link.')
      setLoading(false)
      return
    }
    linkRecuperacion.esRecovery = false
    await supabase.auth.signOut()
    setListo(true)
    setLoading(false)
    setTimeout(() => navigate('/login'), 2500)
  }

  const Caja = ({ children }) => (
    <div className="min-h-screen bg-verde-800 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">{children}</div>
    </div>
  )

  if (estado === 'verificando') return (
    <Caja><p className="text-sm text-gray-500">Verificando link…</p></Caja>
  )

  if (estado === 'confirmar') return (
    <Caja>
      <h1 className="text-base font-bold text-gray-900 mb-2">Recuperar contraseña</h1>
      <p className="text-xs text-gray-500 mb-4">Tocá el botón para continuar y elegir tu nueva contraseña.</p>
      <button
        onClick={confirmarLink}
        disabled={loading}
        className="w-full bg-verde-700 text-white rounded-[10px] py-2.5 text-sm font-bold
          hover:bg-verde-800 transition-colors disabled:opacity-60"
      >
        {loading ? 'Verificando…' : 'Continuar'}
      </button>
    </Caja>
  )

  if (estado === 'invalido') return (
    <Caja>
      <h1 className="text-base font-bold text-gray-900 mb-2">Link vencido o ya usado</h1>
      <p className="text-xs text-gray-500 mb-4">Pedí un link nuevo. Usá siempre el último email que te llegó.</p>
      <Link to="/olvide-password"
        className="block w-full bg-verde-700 text-white rounded-[10px] py-2.5 text-sm font-bold hover:bg-verde-800">
        Pedir nuevo link
      </Link>
    </Caja>
  )

  return (
    <div className="min-h-screen bg-verde-800 flex flex-col items-center justify-center px-6">
      <div className="flex items-center gap-3 mb-2">
        <img src="/logo_carreta.png" alt="Carreta" className="w-14 h-14 object-contain bg-white rounded-[14px] p-1" />
        <span className="text-3xl font-bold text-white tracking-tight">Carreta</span>
      </div>
      <p className="text-white/60 text-sm text-center mb-8">Conectando la actividad agropecuaria</p>

      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        {!listo ? (
          <>
            <h1 className="text-base font-bold text-gray-900 mb-1">Nueva contraseña</h1>
            <p className="text-xs text-gray-500 mb-4">Elegí una contraseña nueva para tu cuenta.</p>
            <form onSubmit={doUpdate}>
              <input
                type="password"
                placeholder="Nueva contraseña"
                value={pass}
                autoComplete="new-password"
                onChange={e => setPass(e.target.value)}
                className="w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm mb-3 bg-gray-50
                  focus:outline-none focus:border-verde-600 font-[Inter]"
              />
              <input
                type="password"
                placeholder="Repetí la contraseña"
                value={pass2}
                autoComplete="new-password"
                onChange={e => setPass2(e.target.value)}
                className="w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm mb-3 bg-gray-50
                  focus:outline-none focus:border-verde-600 font-[Inter]"
              />
              {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-verde-700 text-white rounded-[10px] py-2.5 text-sm font-bold
                  hover:bg-verde-800 transition-colors disabled:opacity-60"
              >
                {loading ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-verde-100 mx-auto mb-4">
              <svg className="w-6 h-6 text-verde-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-base font-bold text-gray-900 text-center mb-2">¡Listo!</h1>
            <p className="text-xs text-gray-500 text-center">Contraseña actualizada. Redirigiendo…</p>
          </>
        )}
      </div>
    </div>
  )
}
