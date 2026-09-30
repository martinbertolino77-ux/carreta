import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getMiTransportista } from '../../lib/supabase'
import Shell, { Body } from '../../components/layout/Shell'
import Topbar from '../../components/layout/Topbar'
import BottomTabs from '../../components/layout/BottomTabs'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Route from '../../components/ui/Route'
import { ESTADOS_OFERTA, ETAPAS_TRANSPORTISTA } from '../../utils/constants'
import { formatNroPedido, formatFecha } from '../../utils/format'
import { tituloPedido, iconoPedido, bgPedido } from '../../utils/pedido'

const FILTROS = [
  { id:'activos',     label:'Activos' },
  { id:'directos',    label:'Directos' },
  { id:'ofertas',     label:'Mis ofertas' },
  { id:'finalizados', label:'Finalizados' },
  { id:'todos',       label:'Todos' },
]

export default function MisPedidosTransp() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('activos')  // se actualiza al cargar

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const t = await getMiTransportista()
    if (!t) { setLoading(false); return }

    // Pedidos directos pendientes
    const { data: directos } = t ? await supabase
      .from('pedidos')
      .select('id, numero, tipo_actividad, tipo_cereal, producto_granel, producto_detalle, estado, destino_localidad, destino_provincia, camiones_necesarios, fecha_entrega, created_at, establecimientos(nombre, localidad, provincia), productores(id, usuarios(nombre, apellido, razon_social))')
      .eq('transportista_directo', t.id)
      .eq('estado', 'esperando_respuesta') : { data: [] }

    // Todas mis ofertas, con su pedido
    const { data } = await supabase
      .from('ofertas')
      .select(`
        id, estado, etapa, camiones_ofrecidos, camiones_aceptados, created_at,
        pedidos(
          id, numero, tipo_actividad, tipo_cereal, producto_granel, producto_detalle, estado,
          destino_localidad, destino_provincia, camiones_necesarios,
          fecha_entrega, created_at,
          establecimientos(nombre, localidad, provincia)
        )
      `)
      .eq('transportista_id', t.id)
      .order('created_at', { ascending: false })
    const directoItems = (directos || []).map(p => ({ _directo: true, pedidos: p, id: 'directo-' + p.id }))
    setItems([...directoItems, ...(data || []).filter(o => o.pedidos)])
    // Si hay directos pendientes, mostrar esa pestaña primero
    if (directoItems.length > 0) setFiltro('directos')
    setLoading(false)
  }

  const tipo = (o) => {
    if (o._directo) return 'directos'
    if (o.estado === 'seleccionada') return (o.etapa === 'finalizado' || o.pedidos?.estado === 'completado') ? 'finalizados' : 'activos'
    if (['enviada','en_pausa'].includes(o.estado)) return 'ofertas'
    return 'cerradas' // rechazada, cancelada, cerrada
  }

  const filtrados = items.filter(o => {
    if (filtro === 'todos') return true
    if (filtro === 'directos') return o._directo
    if (filtro === 'ofertas') return tipo(o) === 'ofertas'
    return tipo(o) === filtro
  })

  const badgeDe = (o) => {
    if (o._directo) return { label: '🎯 Directo', color: 'blue' }
    if (o.estado === 'seleccionada') {
      if (o.etapa === 'finalizado' || o.pedidos.estado === 'completado') return { label:'Finalizado', color:'green' }
      return ETAPAS_TRANSPORTISTA[o.etapa] || { label: o.etapa, color:'gray' }
    }
    return ESTADOS_OFERTA[o.estado] || { label: o.estado, color:'gray' }
  }

  const abrir = (o) => {
    if (o._directo) navigate(`/transportista/pedido-directo/${o.pedidos.id}`)
    else if (o.estado === 'seleccionada' || ['cancelada','cerrada'].includes(o.estado)) navigate(`/transportista/pedido/${o.pedidos.id}`)
    else navigate(`/transportista/disponible/${o.pedidos.id}`)
  }

  return (
    <Shell>
      <Topbar accent="azul" />
      <Body>
        <h1 className="text-base font-bold text-gray-900 mb-3">Mis pedidos</h1>

        <div className="flex gap-2 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth:'none' }}>
          {FILTROS.map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all
                ${filtro === f.id ? 'bg-azul-50 text-azul-600 border-azul-100' : 'bg-white text-gray-500 border-gray-200'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-xs text-gray-400 text-center py-8">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-4xl mb-3 opacity-50">📭</div>
            <div className="text-sm font-semibold text-gray-700 mb-1">
              {filtro === 'ofertas' ? 'Sin ofertas pendientes' : 'Sin pedidos'}
            </div>
            <div className="text-xs">
              {filtro === 'ofertas'
                ? 'Tus ofertas pendientes o en pausa aparecen acá'
                : 'Cuando un productor acepte tu oferta aparecerá aquí'}
            </div>
          </div>
        ) : (
          filtrados.map(o => {
            const p = o.pedidos
            const b = badgeDe(o)
            return (
              <Card key={o.id} onClick={() => abrir(o)}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center text-xl flex-shrink-0
                    ${bgPedido(p)}`}>
                    {iconoPedido(p)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        {tituloPedido(p)} — {formatNroPedido(p.numero)}
                      </span>
                      <Badge color={b.color}>{b.label}</Badge>
                    </div>
                    {o._directo && p.productores && (
                      <div className="text-xs text-azul-600 font-medium cursor-pointer hover:underline mb-0.5"
                        onClick={e => { e.stopPropagation(); navigate(`/perfil/productor/${p.productores.id}`) }}>
                        👤 {p.productores.usuarios?.razon_social || `${p.productores.usuarios?.nombre || ''} ${p.productores.usuarios?.apellido || ''}`.trim()}
                      </div>
                    )}
                    <Route
                      origen={`${p.establecimientos?.localidad}, ${p.establecimientos?.provincia}`}
                      destino={`${p.destino_localidad}, ${p.destino_provincia}`}
                    />
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <Badge color="gray">
                        🚛 {o._directo
                          ? `${p.camiones_necesarios} camión${p.camiones_necesarios > 1 ? 'es' : ''}`
                          : o.estado === 'seleccionada'
                            ? `${o.camiones_aceptados} de ${p.camiones_necesarios}`
                            : `Ofrecí ${o.camiones_ofrecidos} de ${p.camiones_necesarios}`}
                      </Badge>
                      <Badge color="gray">📅 {formatFecha(p.fecha_entrega)}</Badge>
                    </div>
                  </div>
                  <span className="text-gray-300 text-lg flex-shrink-0 mt-1">›</span>
                </div>
              </Card>
            )
          })
        )}
      </Body>
      <BottomTabs rol="transportista" />
    </Shell>
  )
}
