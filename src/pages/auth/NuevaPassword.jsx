import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function NuevaPassword() {
  const navigate = useNavigate()
  const [pass, setPass]       = useState('')
  const [pass2, setPass2]     = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [listo, setListo]     = useState(false)
  const [sesionOk, setSesionOk] = useState(false)

  // Supabase maneja el token del link automáticamente vía onAuthStateChange
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSesionOk(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const doUpdate = async (e) => {
    e.preventDefault()
    if (!pass || !pass2) { setError('Completá ambos campos'); return }
    if (pass.length < 6)  { setError('Mínimo 6 caracteres'); return }
    if (pass !== pass2)   { setError('Las contraseñas no coinciden'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password: pass })
    if (err) setError('No se pudo actualizar. Pedí un nuevo link.')
    else { setListo(true); setTimeout(() => navigate('/login'), 2500) }
    setLoading(false)
  }

  if (!sesionOk) return (
    <div className="min-h-screen bg-verde-800 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
        <p className="text-sm text-gray-500">Verificando link…</p>
      </div>
    </div>
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
