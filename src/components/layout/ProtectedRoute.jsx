import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import SinCuenta from '../../pages/auth/SinCuenta'

export default function ProtectedRoute({ children, rolRequerido }) {
  const { session, usuario, cuenta, rol, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen bg-verde-800 flex items-center justify-center">
      <div className="text-white text-sm">Cargando…</div>
    </div>
  )

  if (!session) return <Navigate to="/login" replace />
  // Usuario sin empresa (pedido de acceso pendiente, rechazado o quitado)
  if (usuario && !cuenta && !usuario.is_admin) return <SinCuenta />
  if (rolRequerido && rol !== rolRequerido) return <Navigate to="/roles" replace />

  return children
}
