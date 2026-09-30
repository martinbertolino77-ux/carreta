import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminRoute({ children }) {
  const [estado, setEstado] = useState('cargando') // cargando | ok | nologin | noadmin

  useEffect(() => {
    async function verificar() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setEstado('nologin'); return }
      const { data: u } = await supabase.from('usuarios').select('is_admin').eq('id', session.user.id).single()
      setEstado(u?.is_admin ? 'ok' : 'noadmin')
    }
    verificar()
  }, [])

  if (estado === 'cargando') return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white text-sm">Verificando acceso…</div>
    </div>
  )
  if (estado === 'nologin' || estado === 'noadmin') return <Navigate to="/admin/login" replace />
  return children
}
