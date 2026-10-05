import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const ingresar = async () => {
    setError(''); setLoading(true)
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (authErr) { setError('Email o contraseña incorrectos'); setLoading(false); return }
    const { data: u } = await supabase.from('usuarios').select('is_admin').eq('id', (await supabase.auth.getUser()).data.user.id).single()
    if (!u?.is_admin) { await supabase.auth.signOut(); setError('No tenés acceso al panel admin'); setLoading(false); return }
    navigate('/admin')
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-6">
          <img src="/logo_carreta.png" alt="Carreta" className="w-16 h-16 object-contain mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900">Panel Admin</h1>
          <p className="text-xs text-gray-500 mt-1">Carreta — Acceso restringido</p>
        </div>
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          autoComplete="username"
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm mb-3 bg-gray-50 focus:outline-none focus:border-gray-500" />
        <input
          type="password"
          placeholder="Contraseña"
          value={form.password}
          autoComplete="current-password"
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && ingresar()}
          className="w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm mb-1 bg-gray-50 focus:outline-none focus:border-gray-500" />
        <div className="text-right mb-4">
          <Link to="/olvide-password" className="text-xs text-gray-500 hover:text-gray-700">
            Olvidé mi contraseña
          </Link>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <button onClick={ingresar} disabled={loading}
          className="w-full bg-gray-900 text-white rounded-[10px] py-2.5 text-sm font-bold hover:bg-gray-700 disabled:opacity-60">
          {loading ? 'Verificando…' : 'Ingresar'}
        </button>
      </div>
    </div>
  )
}
