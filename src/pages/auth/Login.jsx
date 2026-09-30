import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const doLogin = async (e) => {
    e.preventDefault()
    if (!email || !pass) { setError('Completá email y contraseña'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (err) setError('Email o contraseña incorrectos')
    else navigate('/roles')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-verde-800 flex flex-col items-center justify-center px-6">
      <div className="flex items-center gap-3 mb-2">
        <img src="/logo_carreta.png" alt="Carreta" className="w-14 h-14 object-contain bg-white rounded-[14px] p-1" />
        <span className="text-3xl font-bold text-white tracking-tight">Carreta</span>
      </div>
      <p className="text-white/60 text-sm text-center mb-8">Conectando la actividad agropecuaria</p>

      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        <h1 className="text-base font-bold text-gray-900 mb-4">Ingresá a tu cuenta</h1>
        <form onSubmit={doLogin} autoComplete="on">
          <input
            type="email"
            placeholder="Email"
            value={email}
            autoComplete="username"
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm mb-3 bg-gray-50
              focus:outline-none focus:border-verde-600 font-[Inter]"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={pass}
            autoComplete="current-password"
            onChange={e => setPass(e.target.value)}
            className="w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm mb-1 bg-gray-50
              focus:outline-none focus:border-verde-600 font-[Inter]"
          />
          <div className="text-right mb-3">
            <span className="text-xs text-azul-600 cursor-pointer">Olvidé mi contraseña</span>
          </div>
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-verde-700 text-white rounded-[10px] py-2.5 text-sm font-bold
              hover:bg-verde-800 transition-colors disabled:opacity-60 mb-3"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-500">
          ¿No tenés cuenta?{' '}
          <Link to="/registro" className="text-verde-700 font-semibold">Registrate</Link>
        </p>
      </div>

      <div className="mt-8 flex items-center gap-2 opacity-40">
        <div className="w-px h-3.5 bg-white" />
        <span className="text-[10px] text-white">Validación de identidad RENAPER</span>
        <div className="w-px h-3.5 bg-white" />
      </div>
    </div>
  )
}
