import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdminShell from './Shell'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const Metric = ({ label, value, sub, color = 'gray' }) => {
  const colors = {
    gray: 'bg-gray-50 border-gray-200',
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    orange: 'bg-orange-50 border-orange-200'
  }
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold text-gray-900">{value ?? '—'}</div>
      <div className="text-xs font-semibold text-gray-700 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

const BarChart = ({ datos }) => {
  if (!datos.length) return null
  const max = Math.max(...datos.map(d => d.total), 1)

  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="text-sm font-semibold text-gray-900 mb-4">Pedidos por mes</div>
      <div className="flex items-end gap-1.5 h-32">
        {datos.map((d, i) => {
          const altura = Math.max((d.total / max) * 100, 4)
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-gray-500">{d.total || ''}</span>
              <div
                className="w-full bg-gray-900 rounded-t-sm transition-all"
                style={{ height: `${altura}%` }}
              />
              <span className="text-[9px] text-gray-400">{d.mes}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [grafico, setGrafico] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)

    // Totales
    const { data: d } = await supabase.rpc('admin_dashboard')
    setData(Array.isArray(d) ? d[0] : d)

    // Pedidos por mes — últimos 8 meses
    const desde = new Date()
    desde.setMonth(desde.getMonth() - 7)
    desde.setDate(1)

    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('created_at')
      .gte('created_at', desde.toISOString())
      .order('created_at', { ascending: true })

    // Agrupar por mes
    const mapa = {}
    for (let i = 7; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      mapa[key] = { mes: MESES[d.getMonth()], total: 0 }
    }
    ;(pedidos || []).forEach(p => {
      const key = p.created_at?.slice(0, 7)
      if (mapa[key]) mapa[key].total++
    })

    setGrafico(Object.values(mapa))
    setLoading(false)
  }

  return (
    <AdminShell seccion="dashboard">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Dashboard</h2>
      {loading ? <p className="text-sm text-gray-400">Cargando…</p> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Usuarios totales" value={data?.usuarios_total} sub={`+${data?.usuarios_nuevos_mes} este mes`} color="blue" />
            <Metric label="Pedidos activos" value={data?.pedidos_activos} color="green" />
            <Metric label="En camino" value={data?.pedidos_en_camino} color="orange" />
            <Metric label="Finalizados este mes" value={data?.viajes_finalizados_mes} sub={`${data?.pedidos_total} total histórico`} color="gray" />
          </div>
          <BarChart datos={grafico} />
        </div>
      )}
    </AdminShell>
  )
}
