import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Shell, { Body } from '../../components/layout/Shell'
import Topbar from '../../components/layout/Topbar'
import BottomTabs from '../../components/layout/BottomTabs'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Banner from '../../components/ui/Banner'
import Modal from '../../components/ui/Modal'
import Field, { Textarea } from '../../components/ui/Field'
import MapRuta from '../../components/ui/MapRuta'
import { FORMAS_PAGO } from '../../utils/constants'
import Route from '../../components/ui/Route'
import { tituloPedido, iconoPedido, bgPedido } from '../../utils/pedido'
import { formatNroPedido, formatFecha, formatNum } from '../../utils/format'

export default function PedidoDirecto() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pedido, setPedido] = useState(null)
  const [hacienda, setHacienda] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalRechazar, setModalRechazar] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [modalAceptar, setModalAceptar] = useState(false)
  const [formAcuerdo, setFormAcuerdo] = useState({ forma_pago: '', monto: '' })

  useEffect(() => { cargar() }, [id])

  async function cargar(silencioso = false) {
    if (!silencioso) setLoading(true)
    const { data: p } = await supabase.from('pedidos').select(`
      *, establecimientos(nombre, localidad, provincia, link_maps, telefono, lat, lng),
      productores(usuario_id, usuarios(nombre, apellido, razon_social, telefono))
    `).eq('id', id).single()
    setPedido(p)
    if (p?.tipo_actividad === 'ganadero') {
      const { data: h } = await supabase.from('pedidos_hacienda').select('*').eq('pedido_id', id)
      setHacienda(h || [])
    }
    setLoading(false)
  }

  // El aviso al productor lo manda la base (notificación + push)
  const notificarProductor = () => {}

  const aceptar = async () => {
    setSaving(true)
    const { error } = await supabase.rpc('responder_pedido_directo', { p_pedido_id: id, p_acepta: true })
    if (error) { setSaving(false); alert(error.message); return }
    if (formAcuerdo.forma_pago || formAcuerdo.monto) {
      const { data: oferta } = await supabase.from('ofertas')
        .select('id').eq('pedido_id', id).eq('estado', 'seleccionada').maybeSingle()
      if (oferta?.id) {
        await supabase.from('ofertas').update({
          forma_pago: formAcuerdo.forma_pago || null,
          monto_acordado: formAcuerdo.monto ? Number(formAcuerdo.monto) : null,
        }).eq('id', oferta.id)
      }
    }
    const prod = pedido.productores?.usuarios
    const nombreProd = prod?.razon_social || `${prod?.nombre || ''} ${prod?.apellido || ''}`.trim()
    notificarProductor(
      '✅ Pedido directo aceptado',
      `${nombreProd ? 'Tu transportista aceptó' : 'Aceptaron'} el pedido ${formatNroPedido(pedido.numero)}`
    )
    setSaving(false)
    navigate(`/transportista/pedido/${id}`)
  }

  const rechazar = async () => {
    setSaving(true)
    const { error } = await supabase.rpc('responder_pedido_directo', {
      p_pedido_id: id, p_acepta: false, p_motivo: motivo.trim() || null
    })
    if (!error) {
      notificarProductor(
        '❌ Pedido directo rechazado',
        `El transportista rechazó el pedido ${formatNroPedido(pedido.numero)}${motivo.trim() ? `: ${motivo.trim()}` : ''}`
      )
    }
    setSaving(false)
    if (error) { alert(error.message); return }
    navigate('/transportista/pedidos')
  }

  if (loading) return <Shell><Topbar title="Pedido directo" showBack backTo="/transportista/pedidos" accent="azul" /><Body><p className="text-xs text-gray-400 text-center py-10">Cargando…</p></Body><BottomTabs rol="transportista" /></Shell>
  if (!pedido) return <Shell><Topbar title="Pedido directo" showBack backTo="/transportista/pedidos" accent="azul" /><Body><Banner color="red">No se encontró el pedido.</Banner></Body><BottomTabs rol="transportista" /></Shell>

  const prod = pedido.productores?.usuarios
  const nombreProd = prod?.razon_social || `${prod?.nombre || ''} ${prod?.apellido || ''}`.trim()

  return (
    <Shell>
      <Topbar title={`Pedido ${formatNroPedido(pedido.numero)}`} showBack backTo="/transportista/pedidos" accent="azul" />
      <Body>
        <Banner color="blue" title="🎯 Pedido directo para vos" className="mb-3">
          <b>{nombreProd}</b> te envió este pedido. Aceptalo o rechazalo.
        </Banner>

        <Card className="mb-3">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-[10px] flex items-center justify-center text-2xl flex-shrink-0 ${bgPedido(pedido)}`}>
              {iconoPedido(pedido)}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{tituloPedido(pedido)} — {formatNroPedido(pedido.numero)}</div>
              <Route origen={`${pedido.establecimientos?.localidad}, ${pedido.establecimientos?.provincia}`}
                destino={`${pedido.destino_localidad}, ${pedido.destino_provincia}`} />
              <div className="flex gap-2 mt-1.5 flex-wrap">
                <Badge color="gray">🚛 {pedido.camiones_necesarios} camión{pedido.camiones_necesarios > 1 ? 'es' : ''}</Badge>
                <Badge color="gray">📅 {formatFecha(pedido.fecha_entrega)}</Badge>
              </div>
            </div>
          </div>
        </Card>

        {pedido?.establecimientos?.localidad && pedido?.destino_localidad && (
          <MapRuta
            origen={pedido.establecimientos.lat
              ? { lat: Number(pedido.establecimientos.lat), lng: Number(pedido.establecimientos.lng) }
              : `${pedido.establecimientos.localidad}, ${pedido.establecimientos.provincia}, Argentina`}
            destino={pedido.destino_lat
              ? { lat: Number(pedido.destino_lat), lng: Number(pedido.destino_lng) }
              : `${pedido.destino_localidad}, ${pedido.destino_provincia}, Argentina`}
            origenLabel={pedido.establecimientos.localidad}
            destinoLabel={pedido.destino_localidad}
          />
        )}

        {pedido.kilos_estimados && (
          <Card className="mb-3">
            <div className="text-xs text-gray-400">Kilos estimados</div>
            <div className="text-sm font-semibold">{formatNum(pedido.kilos_estimados)} kg</div>
          </Card>
        )}

        {hacienda.length > 0 && (
          <Card className="mb-3">
            <div className="text-xs font-semibold text-azul-600 mb-2">Detalle hacienda</div>
            {hacienda.map(h => (
              <div key={h.id} className="flex justify-between py-1 border-b border-gray-50 last:border-0 text-xs">
                <span className="text-gray-700">{h.categoria}</span>
                <span className="text-gray-500">{h.cantidad} cab · {formatNum(h.cantidad * h.kg_por_cabeza)} kg</span>
              </div>
            ))}
          </Card>
        )}

        {pedido.observaciones && (
          <Card className="mb-3">
            <div className="text-xs text-gray-400 mb-0.5">Observaciones</div>
            <div className="text-sm text-gray-700">{pedido.observaciones}</div>
          </Card>
        )}

        <div className="flex gap-2 mb-3">
          <Button onClick={() => setModalAceptar(true)} disabled={saving} className="flex-1">
            ✓ Aceptar pedido
          </Button>
          <Button variant="danger" full={false} onClick={() => setModalRechazar(true)} disabled={saving}>
            Rechazar
          </Button>
        </div>

        <Modal open={modalAceptar} onClose={() => setModalAceptar(false)} title="Aceptar pedido">
          <div className="text-xs text-gray-500 mb-4">
            Si ya acordaste las condiciones con el productor, podés registrarlas acá. Es opcional.
          </div>
          <Field label="Forma de pago (opcional)">
            <select value={formAcuerdo.forma_pago}
              onChange={e => setFormAcuerdo(f => ({ ...f, forma_pago: e.target.value }))}
              className="w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:border-verde-600">
              <option value="">Sin especificar</option>
              {FORMAS_PAGO.map(fp => <option key={fp}>{fp}</option>)}
            </select>
          </Field>
          <Field label="Monto acordado (opcional)">
            <input type="number" placeholder="Ej: 450000"
              value={formAcuerdo.monto}
              onChange={e => setFormAcuerdo(f => ({ ...f, monto: e.target.value }))}
              className="w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:border-verde-600" />
          </Field>
          <Button onClick={aceptar} disabled={saving}>
            {saving ? 'Procesando…' : '✓ Confirmar aceptación'}
          </Button>
          <Button variant="ghost" onClick={() => setModalAceptar(false)} className="mt-2">Cancelar</Button>
        </Modal>

        <Modal open={modalRechazar} onClose={() => setModalRechazar(false)} title="Rechazar pedido">
          <div className="text-xs text-gray-500 mb-3">El productor recibe un aviso. El motivo es opcional.</div>
          <Field label="Motivo (opcional)">
            <Textarea rows={2} placeholder="Ej: sin disponibilidad en esa fecha"
              value={motivo} onChange={e => setMotivo(e.target.value)} />
          </Field>
          <Button variant="danger" onClick={rechazar} disabled={saving}>
            {saving ? 'Procesando…' : 'Confirmar rechazo'}
          </Button>
          <Button variant="ghost" onClick={() => setModalRechazar(false)} className="mt-2">Cancelar</Button>
        </Modal>
      </Body>
      <BottomTabs rol="transportista" />
    </Shell>
  )
}
