import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ children, rolRequerido }) {
  const { session, rol, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen bg-verde-800 flex items-center justify-center">
      <div className="text-white text-sm">Cargando…</div>
    </div>
  )

  if (!session) return <Navigate to="/login" replace />
  if (rolRequerido && rol !== rolRequerido) return <Navigate to="/roles" replace />

  return children
}
