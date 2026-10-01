import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Shell, { Body } from '../../components/layout/Shell'
import Topbar from '../../components/layout/Topbar'
import BottomTabs from '../../components/layout/BottomTabs'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Field, { Input } from '../../components/ui/Field'
import Route from '../../components/ui/Route'
import { formatNroPedido, formatFecha, formatNum } from '../../utils/format'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function HistorialTransp() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.rpc('historial_transportista', {
      p_desde: desde || null,
      p_hasta: hasta || null,
    })
    setItems(data || [])
    setLoading(false)
  }

  const descargar = async () => {
    const XLSX = await import('xlsx')

    // ── Hoja 1: Detalle por viaje ─────────────────────────
    const filasDetalle = items.map(r => ({
      'Nro. Pedido':        formatNroPedido(r.numero),
      'Tipo de carga':      r.tipo_carga,
      'Productor':          r.productor,
      'Origen':             `${r.origen_localidad}, ${r.origen_provincia}`,
      'Destino':            `${r.destino_localidad}, ${r.destino_provincia}`,
      'Fecha publicación':  r.fecha_publicacion,
      'Fecha carga':        r.fecha_carga,
      'Fecha descarga':     r.fecha_descarga,
      'Dominio chasis':     r.dominio_chasis,
      'Dominio remolque':   r.dominio_remolque,
      'Chofer':             r.chofer,
      'Camiones aceptados': r.camiones_aceptados,
      'Kilos asignados':    r.kilos_asignados,
      'Precio acordado':    r.precio_acordado,
      'Forma de pago':      r.forma_pago,
      'Monto final':        r.monto_final,
      'Estado':             r.estado,
      'Calif. recibida':    r.calif_recibida,
      'Calif. dada':        r.calif_dada,
      'Mis notas':          r.mis_notas,
    }))

    // ── Hoja 2: Resumen financiero por mes ────────────────
    const porMes = {}
    items.forEach(r => {
      const fecha = r.fecha_publicacion || r.fecha_carga
      if (!fecha) return
      const d = new Date(fecha)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = `${MESES[d.getMonth()]} ${d.getFullYear()}`
      if (!porMes[key]) porMes[key] = { label, realizados: 0, cancelados: 0, kilos: 0, monto: 0, califs: [] }
      if (r.estado === 'completado') {
        porMes[key].realizados++
        porMes[key].kilos += Number(r.kilos_asignados || 0)
        porMes[key].monto += Number(r.monto_final || 0)
        if (r.calif_recibida) porMes[key].califs.push(Number(r.calif_recibida))
      } else {
        porMes[key].cancelados++
      }
    })

    const filasResumen = Object.keys(porMes).sort().map(key => {
      const m = porMes[key]
      const promCalif = m.califs.length ? (m.califs.reduce((a, b) => a + b, 0) / m.califs.length).toFixed(1) : '—'
      const promViaje = m.realizados ? Math.round(m.monto / m.realizados) : 0
      return {
        'Mes':                    m.label,
        'Viajes realizados':      m.realizados,
        'Viajes cancelados':      m.cancelados,
        'Kilos totales':          m.kilos || '—',
        'Monto total cobrado':    m.monto || '—',
        'Promedio por viaje':     promViaje || '—',
        'Calificación promedio':  promCalif,
      }
    })

    // Fila totales
    const totalReal = filasResumen.reduce((a, r) => a + (r['Viajes realizados'] || 0), 0)
    const totalCanc = filasResumen.reduce((a, r) => a + (r['Viajes cancelados'] || 0), 0)
    const totalKilos = filasResumen.reduce((a, r) => a + (typeof r['Kilos totales'] === 'number' ? r['Kilos totales'] : 0), 0)
    const totalMonto = filasResumen.reduce((a, r) => a + (typeof r['Monto total cobrado'] === 'number' ? r['Monto total cobrado'] : 0), 0)

    filasResumen.push({
      'Mes': 'TOTAL',
      'Viajes realizados': totalReal,
      'Viajes cancelados': totalCanc,
      'Kilos totales': totalKilos || '—',
      'Monto total cobrado': totalMonto || '—',
      'Promedio por viaje': totalReal ? Math.round(totalMonto / totalReal) : '—',
      'Calificación promedio': '—',
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasDetalle), 'Detalle por viaje')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasResumen), 'Resumen financiero')

    const suffix = desde || hasta ? `_${desde || ''}_${hasta || ''}` : '_completo'
    XLSX.writeFile(wb, `carreta_historial_transportista${suffix}.xlsx`)
  }

  return (
    <Shell>
      <Topbar accent="azul" />
      <Body>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base font-bold text-gray-900">Historial</h1>
          <Button size="sm" variant="secondary" full={false} onClick={descargar} disabled={!items.length}>
            ⬇ Excel
          </Button>
        </div>

        <Card className="mb-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Desde"><Input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></Field>
            <Field label="Hasta"><Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></Field>
          </div>
          <Button size="sm" onClick={cargar} className="mt-1">Buscar</Button>
        </Card>

        {loading ? (
          <p className="text-xs text-gray-400 text-center py-8">Cargando…</p>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-4xl mb-3 opacity-50">📋</div>
            <div className="text-sm font-semibold text-gray-700 mb-1">Sin historial</div>
            <div className="text-xs">Los viajes finalizados o cancelados aparecen acá.</div>
          </div>
        ) : (
          items.map((r, i) => (
            <Card key={i} className="mb-2" onClick={() => r.pedido_id && navigate(`/transportista/pedido/${r.pedido_id}`)}>
              <div className="flex items-start justify-between mb-1">
                <div className="text-sm font-semibold text-gray-900">{r.tipo_carga} — {formatNroPedido(r.numero)}</div>
                <Badge color={r.estado === 'completado' ? 'green' : 'red'}>
                  {r.estado === 'completado' ? 'Finalizado' : 'Cancelado'}
                </Badge>
              </div>
              {r.productor && <div className="text-xs text-gray-500 mb-0.5">👤 {r.productor}</div>}
              <Route origen={`${r.origen_localidad}, ${r.origen_provincia}`}
                destino={`${r.destino_localidad}, ${r.destino_provincia}`} />
              <div className="text-xs text-gray-400 mt-1">
                {r.fecha_carga && `Carga: ${formatFecha(r.fecha_carga)}`}
                {r.fecha_carga && r.fecha_descarga && ' · '}
                {r.fecha_descarga && `Descarga: ${formatFecha(r.fecha_descarga)}`}
              </div>
              {(r.dominio_chasis || r.chofer) && (
                <div className="text-xs text-gray-500 mt-0.5">
                  🚛 {r.dominio_chasis}{r.dominio_remolque ? ` + ${r.dominio_remolque}` : ''}{r.chofer ? ` · ${r.chofer}` : ''}
                </div>
              )}
              {r.monto_final && <div className="text-xs text-verde-700 font-semibold mt-0.5">💵 Monto final: ${formatNum(r.monto_final)}</div>}
              {r.calif_recibida && <div className="text-xs text-yellow-600 mt-0.5">⭐ Recibida: {r.calif_recibida} · Dada: {r.calif_dada || '—'}</div>}
              {r.mis_notas && <div className="text-xs text-gray-400 mt-0.5 italic">📝 {r.mis_notas}</div>}
            </Card>
          ))
        )}
      </Body>
      <BottomTabs rol="transportista" />
    </Shell>
  )
}
