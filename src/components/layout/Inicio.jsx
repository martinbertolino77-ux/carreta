import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

// "/" → con sesión va a elegir rol; sin sesión, al login
export default function Inicio() {
  const { session, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-verde-800 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  )
  return <Navigate to={session ? '/roles' : '/login'} replace />
}
