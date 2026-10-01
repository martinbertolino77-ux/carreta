import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Shell, { Body } from '../../components/layout/Shell'
import Topbar from '../../components/layout/Topbar'
import BottomTabs from '../../components/layout/BottomTabs'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Field, { Input } from '../../components/ui/Field'
import Route from '../../components/ui/Route'
import { formatNroPedido, formatFecha, formatNum } from '../../utils/format'

const COL_WIDTHS_DETALLE = [12, 14, 20, 24, 24, 16, 14, 22, 20, 14, 16, 14, 15, 16, 14, 13, 14, 12]
const COL_WIDTHS_RESUMEN = [12, 14, 20, 24, 24, 16, 16, 16, 14, 30, 15, 16, 14, 13, 14, 14, 12, 20]

function aplicarFormato(ws, headers, colWidths) {
  // Ancho de columnas
  ws['!cols'] = colWidths.map(w => ({ wch: w }))
  // Freeze primera fila
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
}

export default function Historial() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.rpc('historial_productor', {
      p_desde: desde || null,
      p_hasta: hasta || null,
    })
    setItems(data || [])
    setLoading(false)
  }

  const descargar = async () => {
    const XLSX = await import('xlsx')

    const { data: detalle } = await supabase.rpc('historial_productor_detalle', {
      p_desde: desde || null,
      p_hasta: hasta || null,
    })

    const headersDetalle = ['Nro. Pedido','Tipo de carga','Establecimiento','Origen','Destino','Fecha publicación','Fecha descarga','Transportista','Chofer','Dominio chasis','Dominio remolque','Kilos asignados','Precio acordado','Forma de pago','Monto final','Estado','Calif. recibida','Calif. dada']

    const filasDetalle = (detalle || []).map(r => [
      formatNroPedido(r.numero), r.tipo_carga, r.establecimiento,
      `${r.origen_localidad}, ${r.origen_provincia}`, `${r.destino_localidad}, ${r.destino_provincia}`,
      r.fecha_publicacion, r.fecha_descarga,
      r.transportista, r.chofer, r.dominio_chasis, r.dominio_remolque,
      r.kilos_asignados, r.precio_acordado, r.forma_pago, r.monto_final,
      r.estado, r.calif_recibida, r.calif_dada
    ])

    const headersResumen = ['Nro. Pedido','Tipo de carga','Establecimiento','Origen','Destino','Fecha publicación','Camiones necesarios','Camiones cubiertos','Kilos estimados','Transportistas','Precio acordado','Forma de pago','Monto total','Estado','Fecha descarga','Calif. recibida','Calif. dada','Mis notas']

    const filasResumen = items.map(r => [
      formatNroPedido(r.numero), r.tipo_carga, r.establecimiento,
      `${r.origen_localidad}, ${r.origen_provincia}`, `${r.destino_localidad}, ${r.destino_provincia}`,
      r.fecha_publicacion, r.camiones_necesarios, r.camiones_cubiertos, r.kilos_estimados,
      r.transportistas, r.precio_acordado, r.forma_pago, r.monto_final,
      r.estado, r.fecha_descarga, r.calif_recibida, r.calif_dada, r.mis_notas
    ])

    const wb = XLSX.utils.book_new()

    // Hoja 1
    const ws1 = XLSX.utils.aoa_to_sheet([headersDetalle, ...filasDetalle])
    ws1['!cols'] = COL_WIDTHS_DETALLE.map(w => ({ wch: w }))
    ws1['!freeze'] = { xSplit: 0, ySplit: 1 }
    XLSX.utils.book_append_sheet(wb, ws1, 'Detalle por camión')

    // Hoja 2
    const ws2 = XLSX.utils.aoa_to_sheet([headersResumen, ...filasResumen])
    ws2['!cols'] = COL_WIDTHS_RESUMEN.map(w => ({ wch: w }))
    ws2['!freeze'] = { xSplit: 0, ySplit: 1 }
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen por pedido')

    const suffix = desde || hasta ? `_${desde || ''}_${hasta || ''}` : '_completo'
    XLSX.writeFile(wb, `carreta_historial_productor${suffix}.xlsx`)
  }

  return (
    <Shell>
      <Topbar accent="verde" />
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
            <div className="text-xs">Los pedidos finalizados o cancelados aparecen acá.</div>
          </div>
        ) : (
          items.map((r, i) => (
            <Card key={i} onClick={() => navigate(`/productor/pedido/${r.pedido_id || ''}`)} className="mb-2">
              <div className="flex items-start justify-between mb-1">
                <div className="text-sm font-semibold text-gray-900">{r.tipo_carga} — {formatNroPedido(r.numero)}</div>
                <Badge color={r.estado === 'completado' ? 'green' : 'red'}>
                  {r.estado === 'completado' ? 'Finalizado' : 'Cancelado'}
                </Badge>
              </div>
              <Route origen={`${r.origen_localidad}, ${r.origen_provincia}`}
                destino={`${r.destino_localidad}, ${r.destino_provincia}`} />
              <div className="text-xs text-gray-400 mt-1">
                {r.fecha_descarga && `Descarga: ${formatFecha(r.fecha_descarga)}`}
              </div>
              {r.transportistas && <div className="text-xs text-gray-500 mt-0.5">🚛 {r.transportistas}</div>}
              {r.monto_final && <div className="text-xs text-verde-700 font-semibold mt-0.5">💵 Monto final: ${formatNum(r.monto_final)}</div>}
              {r.calif_recibida && <div className="text-xs text-yellow-600 mt-0.5">⭐ Recibida: {r.calif_recibida} · Dada: {r.calif_dada || '—'}</div>}
              {r.mis_notas && <div className="text-xs text-gray-400 mt-0.5 italic">📝 {r.mis_notas}</div>}
            </Card>
          ))
        )}
      </Body>
      <BottomTabs rol="productor" />
    </Shell>
  )
}
