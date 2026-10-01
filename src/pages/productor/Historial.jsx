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

    // ── Datos detalle por camión ──────────────────────────
    const { data: detalle } = await supabase.rpc('historial_productor_detalle', {
      p_desde: desde || null,
      p_hasta: hasta || null,
    })

    const filasDetalle = (detalle || []).map(r => ({
      'Nro. Pedido':        formatNroPedido(r.numero),
      'Tipo de carga':      r.tipo_carga,
      'Establecimiento':    r.establecimiento,
      'Origen':             `${r.origen_localidad}, ${r.origen_provincia}`,
      'Destino':            `${r.destino_localidad}, ${r.destino_provincia}`,
      'Fecha publicación':  r.fecha_publicacion,
      'Fecha carga':        r.fecha_carga,
      'Fecha descarga':     r.fecha_descarga,
      'Transportista':      r.transportista,
      'Chofer':             r.chofer,
      'Dominio chasis':     r.dominio_chasis,
      'Dominio remolque':   r.dominio_remolque,
      'Kilos asignados':    r.kilos_asignados,
      'Precio acordado':    r.precio_acordado,
      'Forma de pago':      r.forma_pago,
      'Monto final':        r.monto_final,
      'Estado':             r.estado,
      'Calif. recibida':    r.calif_recibida,
      'Calif. dada':        r.calif_dada,
    }))

    // ── Datos resumen por pedido ──────────────────────────
    const filasResumen = items.map(r => ({
      'Nro. Pedido':          formatNroPedido(r.numero),
      'Tipo de carga':        r.tipo_carga,
      'Establecimiento':      r.establecimiento,
      'Origen':               `${r.origen_localidad}, ${r.origen_provincia}`,
      'Destino':              `${r.destino_localidad}, ${r.destino_provincia}`,
      'Fecha publicación':    r.fecha_publicacion,
      'Camiones necesarios':  r.camiones_necesarios,
      'Camiones cubiertos':   r.camiones_cubiertos,
      'Kilos estimados':      r.kilos_estimados,
      'Transportistas':       r.transportistas,
      'Precio acordado':      r.precio_acordado,
      'Forma de pago':        r.forma_pago,
      'Monto total':          r.monto_final,
      'Estado':               r.estado,
      'Fecha carga':          r.fecha_carga,
      'Fecha descarga':       r.fecha_descarga,
      'Calif. recibida':      r.calif_recibida,
      'Calif. dada':          r.calif_dada,
      'Mis notas':            r.mis_notas,
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasDetalle), 'Detalle por camión')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasResumen), 'Resumen por pedido')

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
                {r.fecha_carga && `Carga: ${formatFecha(r.fecha_carga)}`}
                {r.fecha_carga && r.fecha_descarga && ' · '}
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
