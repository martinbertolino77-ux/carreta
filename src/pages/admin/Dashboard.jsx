import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdminShell from './Shell'

const Metric = ({ label, value, sub, color = 'gray' }) => {
  const colors = { gray: 'bg-gray-50 border-gray-200', green: 'bg-verde-50 border-verde-200', blue: 'bg-azul-50 border-azul-200', orange: 'bg-orange-50 border-orange-200' }
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold text-gray-900">{value ?? '—'}</div>
      <div className="text-xs font-semibold text-gray-700 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('admin_dashboard').then(({ data: d }) => {
      setData(Array.isArray(d) ? d[0] : d)
      setLoading(false)
    })
  }, [])

  return (
    <AdminShell seccion="dashboard">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Dashboard</h2>
      {loading ? <p className="text-sm text-gray-400">Cargando…</p> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Usuarios totales" value={data?.usuarios_total} sub={`+${data?.usuarios_nuevos_mes} este mes`} color="blue" />
          <Metric label="Pedidos activos" value={data?.pedidos_activos} color="green" />
          <Metric label="En camino" value={data?.pedidos_en_camino} color="orange" />
          <Metric label="Finalizados este mes" value={data?.viajes_finalizados_mes} sub={`${data?.pedidos_total} total histórico`} color="gray" />
        </div>
      )}
    </AdminShell>
  )
}
