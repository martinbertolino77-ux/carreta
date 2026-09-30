import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MENU = [
  { id: 'dashboard', label: '📊 Dashboard', path: '/admin' },
  { id: 'usuarios', label: '👥 Usuarios', path: '/admin/usuarios' },
  { id: 'pedidos', label: '📋 Pedidos', path: '/admin/pedidos' },
  { id: 'calificaciones', label: '⭐ Calificaciones', path: '/admin/calificaciones' },
  { id: 'reportes', label: '⬇ Reportes', path: '/admin/reportes' },
]

export default function AdminShell({ children, seccion }) {
  const navigate = useNavigate()
  const cerrar = async () => { await supabase.auth.signOut(); navigate('/admin/login') }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-gray-900 min-h-screen">
        <div className="px-5 py-5 border-b border-gray-700">
          <img src="/logo_carreta.png" alt="Carreta" className="w-10 h-10 object-contain bg-white rounded-lg p-0.5 mb-2" />
          <div className="text-white font-bold text-sm">Carreta Admin</div>
        </div>
        <nav className="flex-1 py-4">
          {MENU.map(m => (
            <button key={m.id} onClick={() => navigate(m.path)}
              className={`w-full text-left px-5 py-2.5 text-sm transition-colors ${seccion === m.id ? 'bg-white/10 text-white font-semibold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              {m.label}
            </button>
          ))}
        </nav>
        <button onClick={cerrar} className="px-5 py-4 text-xs text-gray-500 hover:text-white text-left border-t border-gray-700">
          Cerrar sesión
        </button>
      </aside>

      {/* Topbar mobile */}
      <div className="md:hidden bg-gray-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo_carreta.png" alt="Carreta" className="w-7 h-7 object-contain bg-white rounded-lg p-0.5" />
          <span className="text-white font-bold text-sm">Admin</span>
        </div>
        <select onChange={e => navigate(e.target.value)} value={MENU.find(m => m.id === seccion)?.path || '/admin'}
          className="bg-gray-700 text-white text-xs rounded px-2 py-1 border-0 outline-none">
          {MENU.map(m => <option key={m.id} value={m.path}>{m.label}</option>)}
        </select>
        <button onClick={cerrar} className="text-gray-400 text-xs hover:text-white">Salir</button>
      </div>

      {/* Contenido */}
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
