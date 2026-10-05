import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminRoute({ children }) {
  const [estado, setEstado] = useState('cargando')

  useEffect(() => {
    async function verificar() {
      // 🔒 Paso 1: sesión válida
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setEstado('nologin'); return }

      // 🔒 Paso 2: verificar token activo con Supabase (no solo local)
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { setEstado('nologin'); return }

      // 🔒 Paso 3: verificar is_admin en base de datos
      const { data: u, error: dbError } = await supabase
        .from('usuarios')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (dbError || !u?.is_admin) { setEstado('noadmin'); return }

      setEstado('ok')
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
