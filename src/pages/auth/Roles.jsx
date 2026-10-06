import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Roles() {
  const { usuario, setRol, signOut } = useAuth()
  const navigate = useNavigate()

  const pickRol = (rol) => {
    setRol(rol)
    navigate(rol === 'productor' ? '/productor/pedidos' : '/transportista/disponibles')
  }

  const roles = usuario?.roles || []
  const nombre = usuario?.nombre || ''

  return (
    <div className="min-h-screen bg-[#F4F6F4] flex flex-col px-5 py-10">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">Hola, {nombre}</h1>
        <p className="text-sm text-gray-500 mt-1">¿Con qué rol querés operar hoy?</p>
      </div>

      {roles.includes('productor') && (
        <div
          onClick={() => pickRol('productor')}
          className="bg-white border-[1.5px] border-gray-200 rounded-[14px] p-4 mb-3 cursor-pointer
            hover:border-verde-600 hover:bg-verde-50 transition-all flex items-center gap-3.5"
        >
          <div className="w-12 h-12 bg-verde-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🌱</div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900">Productor</div>
            <div className="text-xs text-gray-500 mt-0.5">Publicá pedidos de transporte y gestioná tus traslados</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      )}

      {roles.includes('transportista') && (
        <div
          onClick={() => pickRol('transportista')}
          className="bg-white border-[1.5px] border-gray-200 rounded-[14px] p-4 mb-3 cursor-pointer
            hover:border-azul-500 hover:bg-azul-50 transition-all flex items-center gap-3.5"
        >
          <div className="w-12 h-12 bg-azul-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🚛</div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900">Transportista</div>
            <div className="text-xs text-gray-500 mt-0.5">Explorá pedidos disponibles y gestioná tus viajes</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      )}

      {roles.includes('admin') && (
        <div
          onClick={() => { setRol('admin'); navigate('/admin/dashboard') }}
          className="bg-white border-[1.5px] border-gray-200 rounded-[14px] p-4 mb-3 cursor-pointer
            hover:border-yellow-500 hover:bg-yellow-50 transition-all flex items-center gap-3.5"
        >
          <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🛡️</div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900">Administrador</div>
            <div className="text-xs text-gray-500 mt-0.5">Gestioná usuarios, pedidos y configuración</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      )}

      <div className="mt-auto pt-8 text-center">
        <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600">
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
