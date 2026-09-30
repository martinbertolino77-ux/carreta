import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/admin' },
  { id: 'usuarios', label: 'Usuarios', icon: '👥', path: '/admin/usuarios' },
  { id: 'pedidos', label: 'Pedidos', icon: '📋', path: '/admin/pedidos' },
  { id: 'calificaciones', label: 'Calific.', icon: '⭐', path: '/admin/calificaciones' },
  { id: 'reportes', label: 'Reportes', icon: '⬇', path: '/admin/reportes' },
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
              {m.icon} {m.label}
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
        <button onClick={cerrar} className="text-gray-400 text-xs hover:text-white">Salir</button>
      </div>

      {/* Contenido */}
      <main className="flex-1 p-4 md:p-6 overflow-auto pb-24 md:pb-6">
        {children}
      </main>

      {/* Bottom tabs mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {MENU.map(m => (
          <button key={m.id} onClick={() => navigate(m.path)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${seccion === m.id ? 'text-gray-900' : 'text-gray-400'}`}>
            <span className="text-lg leading-none">{m.icon}</span>
            <span className="text-[9px] font-medium">{m.label}</span>
            {seccion === m.id && <span className="absolute bottom-0 w-8 h-0.5 bg-gray-900 rounded-full" />}
          </button>
        ))}
      </nav>

    </div>
  )
}
