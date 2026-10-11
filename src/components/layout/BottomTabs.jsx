import { useNavigate, useLocation } from 'react-router-dom'

const TABS_PRODUCTOR = [
  { path: '/productor/pedidos', icon: '📋', label: 'Pedidos' },
  { path: '/productor/crear',   icon: '➕', label: 'Nuevo' },
  { path: '/productor/historial', icon: '📊', label: 'Historial' },
  { path: '/productor/perfil',  icon: '👤', label: 'Perfil' },
]

const TABS_TRANSPORTISTA = [
  { path: '/transportista/disponibles', icon: '🔍', label: 'Disponibles' },
  { path: '/transportista/pedidos',     icon: '📋', label: 'Mis pedidos' },
  { path: '/transportista/historial',   icon: '📊', label: 'Historial' },
  { path: '/transportista/perfil',      icon: '👤', label: 'Perfil' },
]

export default function BottomTabs({ rol }) {
  const navigate  = useNavigate()
  const { pathname } = useLocation()
  const tabs = rol === 'transportista' ? TABS_TRANSPORTISTA : TABS_PRODUCTOR
  const activeColor = rol === 'transportista' ? 'border-azul-500 text-azul-600' : 'border-verde-600 text-verde-700'

  return (
    <div className="nav-tabs bg-white border-t border-gray-200 flex flex-shrink-0" style={{ paddingBottom:'env(safe-area-inset-bottom,0px)' }}>
      {tabs.map(tab => {
        const act = pathname.startsWith(tab.path)
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`nav-tab flex-1 flex flex-col items-center py-2 gap-0.5 border-t-2 transition-all
              ${act ? `${activeColor} activo` : 'border-transparent text-gray-400'}`}
          >
            <span className="text-[19px]">{tab.icon}</span>
            <span className="nav-label text-[10px] font-medium">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
