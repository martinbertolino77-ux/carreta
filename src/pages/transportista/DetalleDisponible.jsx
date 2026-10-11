import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MapRuta from '../../components/ui/MapRuta'
import { supabase, getMiTransportista, getMiTransportistaConNombre } from '../../lib/supabase'
import Shell, { Body } from '../../components/layout/Shell'
import Topbar from '../../components/layout/Topbar'
import BottomTabs from '../../components/layout/BottomTabs'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Banner from '../../components/ui/Banner'
import Modal from '../../components/ui/Modal'
import Field, { Input, Textarea } from '../../components/ui/Field'
import Route from '../../components/ui/Route'
import { CATEGORIAS_HACIENDA } from '../../utils/constants'
import { formatNroPedido, formatFecha, formatNum } from '../../utils/format'
import { tituloPedido, iconoPedido, bgPedido } from '../../utils/pedido'
import Contador from '../../components/ui/Contador'
import { EQUIPOS, EQUIPOS_POR_ACTIVIDAD } from '../../utils/constants'
import { useAuth } from '../../context/AuthContext'
import { puede } from '../../utils/permisos'

export default function DetalleDisponible() {
  const { cuenta } = useAuth()
  const puedeOfertar = puede(cuenta, 'ofertar')
  const { id } = useParams()
  const navigate = useNavigate()
  const [pedido, setPedido] = useState(null)
  const [hacienda, setHacienda] = useState([])
  const [loading, setLoading] = useState(true)
  const [miOferta, setMiOferta] = useState(null)
  const [modalOfertar, setModalOfertar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    camiones_ofrecidos: '',
    precio_tn: '',
    precio_km: '',
    km_estimados: '',
    observaciones: '',
    equipos: [],
  })

  useEffect(() => { cargar() }, [id])

  async function cargar(silencioso = false) {
    if (!silencioso) setLoading(true)
    const { data: p } = await supabase
      .from('pedidos')
      .select(`*, establecimientos(nombre, localidad, provincia, departamento, link_maps, lat, lng), productores(id, usuario_id, usuarios(nombre, apellido, razon_social))`)
      .eq('id', id)
      .single()
    setPedido(p)

    if (p?.tipo_actividad === 'ganadero') {
      const { data: h } = await supabase.from('pedidos_hacienda').select('*').eq('pedido_id', id)
      setHacienda(h || [])
    }

    const t = await getMiTransportista('id, usuarios(razon_social, nombre, apellido)')
    if (t) {
      const { data: o } = await supabase.from('ofertas')
        .select('*').eq('pedido_id', id).eq('transportista_id', t.id).maybeSingle()
      setMiOferta(o || null)
    }
    setLoading(false)
  }

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const retirarOferta = async () => {
    if (!confirm('¿Retirar tu oferta de este pedido?')) return
    const { error } = await supabase.rpc('retirar_oferta', { p_oferta_id: miOferta.id })
    if (error) { alert(error.message); return }
    await cargar(true)
  }

  const enviarOferta = async () => {
    const n = Number(form.camiones_ofrecidos)
    if (!n || n < 1) { setError('Ingresá la cantidad de camiones'); return }
    if (n > pedido.camiones_necesarios) { setError(`El pedido necesita ${pedido.camiones_necesarios} camión(es)`); return }
    if (form.equipos.length === 0) { setError('Elegí el tipo de equipo que mandás'); return }
    const permitidos = EQUIPOS_POR_ACTIVIDAD[pedido.tipo_actividad] || Object.keys(EQUIPOS)
    if (form.equipos.some(e => !permitidos.includes(e))) { setError('Equipo no válido para este tipo de carga'); return }

    setSaving(true); setError('')
    try {
      const t = await getMiTransportistaConNombre()
      const { error: insErr } = await supabase.from('ofertas').insert({
        pedido_id: id,
        transportista_id: t.id,
        camiones_ofrecidos: n,
        equipos: form.equipos,
        observaciones: form.observaciones || null,
      })
      if (insErr) throw insErr
      // El estado del pedido y el aviso al productor los resuelve la base (trigger de nueva oferta)

      setModalOfertar(false)
      await cargar(true)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return (
    <Shell>
      <Topbar title="Pedido" showBack backTo="/transportista/disponibles" accent="azul" />
      <Body><p className="text-xs text-gray-400 text-center py-10">Cargando…</p></Body>
      <BottomTabs rol="transportista" />
    </Shell>
  )

  if (!pedido) return (
    <Shell>
      <Topbar title="Pedido" showBack backTo="/transportista/disponibles" accent="azul" />
      <Body><Banner color="red">No se encontró el pedido.</Banner></Body>
      <BottomTabs rol="transportista" />
    </Shell>
  )

  const esAgricola = pedido.tipo_actividad !== 'ganadero'
  const totalHacienda = hacienda.reduce((a, h) => a + h.cantidad * h.kg_por_cabeza, 0)

  return (
    <Shell>
      <Topbar title={`Pedido ${formatNroPedido(pedido.numero)}`} showBack backTo="/transportista/disponibles" accent="azul" />
      <Body>
        <Card className="mb-3">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-[10px] flex items-center justify-center text-2xl flex-shrink-0 ${bgPedido(pedido)}`}>
              {iconoPedido(pedido)}
            </div>
            <div className="flex-1">
              <div className="text-base font-bold text-gray-900 mb-1">{tituloPedido(pedido)}</div>
              <Route
                origen={`${pedido.establecimientos?.localidad}, ${pedido.establecimientos?.provincia}`}
                destino={`${pedido.destino_localidad}, ${pedido.destino_provincia}`}
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge color="gray">🚛 {pedido.camiones_necesarios} camión{pedido.camiones_necesarios > 1 ? 'es' : ''}</Badge>
                <Badge color="gray">📅 {formatFecha(pedido.fecha_entrega)}</Badge>
              </div>
              {(pedido.productores?.usuarios?.razon_social || pedido.productores?.usuarios?.nombre) && (
                <div className="text-xs text-azul-600 font-medium cursor-pointer hover:underline mt-1"
                  onClick={() => navigate(`/perfil/productor/${pedido.productores?.id}`)}>
                  👤 {pedido.productores?.usuarios?.razon_social || `${pedido.productores?.usuarios?.nombre || ''} ${pedido.productores?.usuarios?.apellido || ''}`.trim()}
                </div>
              )}
              <Contador pedidoId={pedido.id} rol="productor" className="mt-1.5" />
            </div>
          </div>
        </Card>

        {esAgricola && pedido.kilos_estimados && (
          <Card className="mb-3">
            <div className="text-xs font-semibold text-azul-600 mb-2">Detalle de carga</div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Kilos estimados</span>
              <span className="font-semibold">{formatNum(pedido.kilos_estimados)} kg</span>
            </div>
          </Card>
        )}

        {!esAgricola && hacienda.length > 0 && (
          <Card className="mb-3">
            <div className="text-xs font-semibold text-azul-600 mb-2">Detalle de hacienda</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="pb-1">Categoría</th>
                  <th className="pb-1">Cabezas</th>
                  <th className="pb-1">Kg/cab.</th>
                  <th className="pb-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {hacienda.map(h => (
                  <tr key={h.id} className="border-t border-gray-50">
                    <td className="py-1.5 text-gray-700">{CATEGORIAS_HACIENDA.find(c => c.id === h.categoria)?.label || h.categoria}</td>
                    <td className="py-1.5 font-medium">{h.cantidad}</td>
                    <td className="py-1.5">{h.kg_por_cabeza} kg</td>
                    <td className="py-1.5 font-medium">{formatNum(h.cantidad * h.kg_por_cabeza)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 bg-gray-50 rounded-lg px-3 py-1.5 text-xs text-gray-600">
              Total: <strong>{formatNum(totalHacienda)} kg</strong>
            </div>
          </Card>
        )}

        <Card className="mb-3">
          <div className="text-xs font-semibold text-azul-600 mb-2">Origen</div>
          <div className="text-sm font-semibold text-gray-900">{pedido.establecimientos?.nombre}</div>
          <div className="text-xs text-gray-500 mt-0.5">📍 {pedido.establecimientos?.localidad}, {pedido.establecimientos?.departamento}, {pedido.establecimientos?.provincia}</div>
          {pedido.establecimientos?.link_maps && (
            <a href={pedido.establecimientos.link_maps} target="_blank" rel="noreferrer" className="text-xs text-azul-600 mt-0.5 block">Ver en Maps</a>
          )}
        </Card>

        <Card className="mb-3">
          <div className="text-xs font-semibold text-azul-600 mb-2">Destino</div>
          <div className="text-sm font-semibold text-gray-900">{pedido.destino_localidad}, {pedido.destino_provincia}</div>
          {pedido.destino_link_maps && (
            <a href={pedido.destino_link_maps} target="_blank" rel="noreferrer" className="text-xs text-azul-600 mt-0.5 block">Ver en Maps</a>
          )}
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

        {pedido.observaciones && (
          <Card className="mb-3">
            <div className="text-xs font-semibold text-azul-600 mb-1">Observaciones del productor</div>
            <div className="text-sm text-gray-700">{pedido.observaciones}</div>
          </Card>
        )}

        {miOferta ? (
          (() => {
            const info = {
              enviada:      { color:'blue',   title:'⏳ Oferta enviada',      text:'Tu oferta fue enviada. El productor la está evaluando.' },
              seleccionada: { color:'green',  title:'✅ Oferta aceptada',     text:'Enviá los datos operativos desde el viaje.' },
              en_pausa:     { color:'orange', title:'⏸️ Oferta en pausa',     text:'El productor eligió otra oferta. Podés ser elegido si se libera.' },
              rechazada:    { color:'red',    title:'❌ Oferta rechazada',    text:'Tu oferta no fue seleccionada para este pedido.' },
              cancelada:    { color:'red',    title:'Oferta cancelada',       text:'Este viaje fue cancelado.' },
              cerrada:      { color:'gray',   title:'Oferta cerrada',         text:'No fue elegida esta vez. Será tenida en cuenta para próximos envíos.' },
            }[miOferta.estado] || { color:'blue', title:'Oferta', text:'' }
            return (
              <>
                <Banner color={info.color === 'gray' ? 'blue' : info.color} title={info.title}>
                  {info.text}
                  {miOferta.estado === 'seleccionada' && ` Aceptaron ${miOferta.camiones_aceptados} de tus ${miOferta.camiones_ofrecidos} camiones.`}
                </Banner>
                {miOferta.estado === 'seleccionada' && (
                  <Button variant="azul" onClick={() => navigate(`/transportista/pedido/${id}`)} className="mb-2">
                    Ir al viaje →
                  </Button>
                )}
                {['enviada','en_pausa'].includes(miOferta.estado) && puedeOfertar && (
                  <Button variant="ghost" onClick={retirarOferta} className="mb-2">
                    Retirar oferta
                  </Button>
                )}
              </>
            )
          })()
        ) : ['esperando_ofertas','con_ofertas'].includes(pedido.estado) && puedeOfertar && (
          <Button variant="azul" onClick={() => setModalOfertar(true)} className="mb-2">
            🙋 Postularme para este pedido
          </Button>
        )}

        <Button variant="whatsapp" onClick={() => window.open(`https://wa.me/?text=Hola, vi el pedido ${formatNroPedido(pedido.numero)} en Carreta`)}>
          💬 Consultar por WhatsApp
        </Button>
      </Body>

      <Modal open={modalOfertar} onClose={() => setModalOfertar(false)} title="Postularme">
        <Field label="Camiones que ofrecés">
          <Input type="number" min="1" max={pedido.camiones_necesarios}
            placeholder={`Máx. ${pedido.camiones_necesarios}`}
            value={form.camiones_ofrecidos} onChange={e => setF('camiones_ofrecidos', e.target.value)} />
        </Field>

        <Field label="Equipo que mandás" hint="Podés elegir más de uno si mandás equipos distintos">
          <div className="flex gap-2 flex-wrap">
            {Object.entries(EQUIPOS).filter(([k]) =>
              (EQUIPOS_POR_ACTIVIDAD[pedido.tipo_actividad] || Object.keys(EQUIPOS)).includes(k)
            ).map(([k, v]) => {
              const on = form.equipos.includes(k)
              return (
                <button key={k} type="button"
                  onClick={() => setF('equipos', on ? form.equipos.filter(x => x !== k) : [...form.equipos, k])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                    ${on ? 'border-azul-500 bg-azul-50 text-azul-700' : 'border-gray-200 bg-white text-gray-500'}`}>
                  {on ? '✓ ' : ''}{v}
                </button>
              )
            })}
          </div>
        </Field>

        <Banner color="blue" className="mb-3">
          📞 El productor va a ver tu teléfono para llamarte y acordar precio y condiciones.
        </Banner>

        <Field label="Observaciones (opcional)">
          <Textarea rows={2} placeholder="Condiciones, disponibilidad, etc."
            value={form.observaciones} onChange={e => setF('observaciones', e.target.value)} />
        </Field>

        {error && <Banner color="red" className="mb-3">{error}</Banner>}
        <Button onClick={enviarOferta} disabled={saving} variant="azul">
          {saving ? 'Enviando…' : 'Postularme'}
        </Button>
        <Button variant="ghost" onClick={() => setModalOfertar(false)} className="mt-2">Cancelar</Button>
      </Modal>

      <BottomTabs rol="transportista" />
    </Shell>
  )
}
