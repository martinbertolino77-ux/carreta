import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Shell, { Body } from '../../components/layout/Shell'
import Topbar from '../../components/layout/Topbar'
import BottomTabs from '../../components/layout/BottomTabs'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Route from '../../components/ui/Route'
import Button from '../../components/ui/Button'
import { ESTADOS_PEDIDO } from '../../utils/constants'
import { formatNroPedido, formatFecha } from '../../utils/format'
import { tituloPedido, iconoPedido, bgPedido } from '../../utils/pedido'

export default function MisPedidos() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => {
    if (!usuario) return
    cargar()
  }, [usuario])

  useAutoRefresh(cargar, 30000, !!usuario)

  async function cargar(silencioso = false) {
    if (!silencioso) setLoading(true)
    // Solo pedidos de ESTE productor (el usuario puede tener también rol transportista)
    const { data: prod } = await supabase
      .from('productores').select('id').eq('usuario_id', usuario.id).maybeSingle()
    if (!prod) { setPedidos([]); setLoading(false); return }

    const { data } = await supabase
      .from('pedidos')
      .select(`
        id, numero, tipo_actividad, tipo_cereal, producto_granel, producto_detalle, estado, modo_publicacion,
        destino_localidad, destino_provincia, camiones_necesarios,
        kilos_estimados, created_at,
        establecimientos(nombre, localidad, provincia),
        ofertas(id, estado, camiones_aceptados)
      `)
      .eq('productor_id', prod.id)
      .order('created_at', { ascending: false })
    setPedidos(data || [])
    setLoading(false)
  }

  const activos = ['esperando_ofertas','con_ofertas','confirmado',
    'datos_operativos_enviados','esperando_documentacion','en_camino','entrega_informada']

  const filtrados = pedidos.filter(p => {
    if (filtro === 'activos') return activos.includes(p.estado)
    if (filtro === 'completados') return p.estado === 'completado'
    if (filtro === 'cancelados') return p.estado === 'cancelado'
    return true
  })

  const iconTipo = (p) => iconoPedido(p)

  return (
    <Shell>
      <Topbar accent="verde" />
      <Body>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base font-bold text-gray-900">Mis pedidos</h1>
          <Button variant="primary" size="sm" full={false} onClick={() => navigate('/productor/crear')}>
            + Nuevo pedido
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth:'none' }}>
          {[
            { id:'todos', label:'Todos' },
            { id:'activos', label:'Activos' },
            { id:'completados', label:'Finalizados' },
            { id:'cancelados', label:'Cancelados' },
          ].map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all
                ${filtro === f.id
                  ? 'bg-verde-50 text-verde-700 border-verde-100'
                  : 'bg-white text-gray-500 border-gray-200'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-xs text-gray-400 text-center py-8">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-4xl mb-3 opacity-50">📭</div>
            <div className="text-sm font-semibold text-gray-700 mb-1">No tenés pedidos</div>
            <div className="text-xs">Creá tu primer pedido de transporte</div>
          </div>
        ) : (
          filtrados.map(p => {
            const est = ESTADOS_PEDIDO[p.estado] || { label: p.estado, color:'gray' }
            const nOfertas = p.ofertas?.filter(o => o.estado === 'enviada').length || 0
            const cubierto = p.ofertas?.filter(o => o.estado === 'seleccionada')
              .reduce((a, o) => a + (o.camiones_aceptados || 0), 0) || 0
            return (
              <Card key={p.id} onClick={() => navigate(`/productor/pedido/${p.id}`)}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center text-xl flex-shrink-0
                    ${bgPedido(p)}`}>
                    {iconTipo(p)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        {tituloPedido(p)} — {formatNroPedido(p.numero)}
                      </span>
                      <Badge color={est.color}>{est.label}</Badge>
                    </div>
                    <Route
                      origen={`${p.establecimientos?.nombre}, ${p.establecimientos?.provincia}`}
                      destino={`${p.destino_localidad}, ${p.destino_provincia}`}
                    />
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {p.modo_publicacion === 'directo' && (
                        <Badge color="blue">🎯 Directo</Badge>
                      )}
                      <Badge color={cubierto > 0 ? 'green' : 'gray'}>
                        {cubierto > 0 ? `${cubierto} / ${p.camiones_necesarios}` : p.camiones_necesarios} camión{p.camiones_necesarios > 1 ? 'es' : ''}
                      </Badge>
                      {nOfertas > 0 && ['esperando_ofertas','con_ofertas'].includes(p.estado) && (
                        <Badge color="orange">🔔 {nOfertas} oferta{nOfertas > 1 ? 's' : ''}</Badge>
                      )}
                      <Badge color="gray">{formatFecha(p.created_at)}</Badge>
                    </div>
                  </div>
                  <span className="text-gray-300 text-lg flex-shrink-0 mt-1">›</span>
                </div>
              </Card>
            )
          })
        )}
      </Body>
      <BottomTabs rol="productor" />
    </Shell>
  )
}
