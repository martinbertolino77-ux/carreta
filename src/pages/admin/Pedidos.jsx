import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdminShell from './Shell'

import { formatNroPedido } from '../../utils/format'
import { ESTADOS_PEDIDO } from '../../utils/constants'

const ESTADOS = ['todos','esperando_ofertas','con_ofertas','confirmado','en_camino','entrega_informada','completado','cancelado']

const PROVINCIAS = [
  'todas','Buenos Aires','Córdoba','Santa Fe','Entre Ríos','La Pampa',
  'Mendoza','San Luis','Santiago del Estero','Chaco','Tucumán','Salta','Otras'
]

export default function AdminPedidos() {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [provincia, setProvincia] = useState('todas')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [expandido, setExpandido] = useState(null)
  const [ofertas, setOfertas] = useState({})
  const [cancelando, setCancelando] = useState(null)
  const [motivo, setMotivo] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('pedidos')
      .select(`id, numero, estado, tipo_actividad, tipo_cereal, producto_granel, modo_publicacion,
        destino_localidad, destino_provincia, camiones_necesarios, created_at, updated_at,
        establecimiento_id(localidad, provincia),
        productores(usuarios(nombre, apellido, razon_social, email))`)
      .order('created_at', { ascending: false })
      .limit(500)
    setPedidos(data || [])
    setLoading(false)
  }

  async function cargarOfertas(pedidoId) {
    if (ofertas[pedidoId]) return
    const { data } = await supabase.from('ofertas')
      .select('id, estado, precio, created_at, transportistas(usuarios(razon_social, nombre, apellido, telefono))')
      .eq('pedido_id', pedidoId)
      .order('created_at', { ascending: false })
    setOfertas(o => ({ ...o, [pedidoId]: data || [] }))
  }

  const toggleExpandido = async (p) => {
    if (expandido === p.id) { setExpandido(null); return }
    setExpandido(p.id)
    await cargarOfertas(p.id)
  }

  const cancelar = async () => {
    if (!motivo.trim()) { alert('Ingresá un motivo'); return }
    await supabase.rpc('admin_cancelar_pedido', { p_pedido_id: cancelando, p_motivo: motivo })
    setCancelando(null); setMotivo(''); cargar()
  }

  const nombreProd = (p) => p.productores?.usuarios?.razon_social || `${p.productores?.usuarios?.nombre || ''} ${p.productores?.usuarios?.apellido || ''}`.trim()
  const tipoCarga = (p) => p.tipo_actividad === 'agricola' ? p.tipo_cereal : p.tipo_actividad === 'ganadero' ? 'Ganadero' : p.producto_granel || 'Otras'

  const filtrados = pedidos.filter(p => {
    if (filtro !== 'todos' && p.estado !== filtro) return false
    if (provincia !== 'todas' && p.establecimiento_id?.provincia?.trim() !== provincia.trim()) return false
    if (desde && p.created_at < desde) return false
    if (hasta && p.created_at > hasta + 'T23:59:59') return false
    const q = busqueda.toLowerCase()
    return !q || String(p.numero).includes(q) || nombreProd(p).toLowerCase().includes(q)
  })

  const exportar = async () => {
    const XLSX = await import('xlsx')
    const filas = filtrados.map(p => ({
      'Nro': formatNroPedido(p.numero), 'Estado': p.estado,
      'Tipo': tipoCarga(p),
      'Origen': `${p.establecimiento_id?.localidad}, ${p.establecimiento_id?.provincia}`,
      'Destino': `${p.destino_localidad}, ${p.destino_provincia}`,
      'Camiones': p.camiones_necesarios,
      'Productor': nombreProd(p),
      'Email': p.productores?.usuarios?.email,
      'Modo': p.modo_publicacion, 'Fecha': p.created_at?.slice(0, 10),
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Pedidos')
    XLSX.writeFile(wb, 'carreta_pedidos.xlsx')
  }

  const colorEstado = {
    esperando_ofertas: 'gray', con_ofertas: 'orange', confirmado: 'green',
    en_camino: 'purple', entrega_informada: 'orange', completado: 'green',
    cancelado: 'red', esperando_respuesta: 'blue', rechazado_directo: 'red'
  }

  const colorOferta = { pendiente: 'gray', aceptada: 'green', rechazada: 'red', cancelada: 'red' }

  return (
    <AdminShell seccion="pedidos">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Pedidos ({filtrados.length})</h2>
        <button onClick={exportar} className="text-xs bg-gray-900 text-white rounded-lg px-3 py-1.5 hover:bg-gray-700">⬇ Excel</button>
      </div>

      {/* Filtros estado */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {ESTADOS.map(e => (
          <button key={e} onClick={() => setFiltro(e)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${filtro === e ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
            {e === 'todos' ? 'Todos' : ESTADOS_PEDIDO[e]?.label || e}
          </button>
        ))}
      </div>

      {/* Filtros provincia + fecha */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <select value={provincia} onChange={e => setProvincia(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none col-span-2 md:col-span-1">
          {PROVINCIAS.map(p => <option key={p} value={p}>{p === 'todas' ? 'Todas las provincias' : p}</option>)}
        </select>
        <div className="flex flex-col">
          <label className="text-[10px] text-gray-400 mb-0.5 px-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none" />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] text-gray-400 mb-0.5 px-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none" />
        </div>
        {(provincia !== 'todas' || desde || hasta) && (
          <button onClick={() => { setProvincia('todas'); setDesde(''); setHasta('') }}
            className="text-xs text-gray-400 hover:text-gray-700 px-2">
            ✕ Limpiar
          </button>
        )}
      </div>

      <input placeholder="Buscar por número o productor…" value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:border-gray-400" />

      {loading ? <p className="text-sm text-gray-400">Cargando…</p> : (
        <div className="space-y-2">
          {filtrados.map(p => (
            <div key={p.id} className="bg-white rounded-xl border">
              <div className="flex items-start justify-between gap-3 p-4 cursor-pointer"
                onClick={() => toggleExpandido(p)}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-sm text-gray-900">{formatNroPedido(p.numero)}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full bg-${colorEstado[p.estado] || 'gray'}-100 text-${colorEstado[p.estado] || 'gray'}-700`}>
                      {ESTADOS_PEDIDO[p.estado]?.label || p.estado}
                    </span>
                  </div>
                  <div className="text-xs text-gray-700">{tipoCarga(p)} · {p.camiones_necesarios} camión{p.camiones_necesarios > 1 ? 'es' : ''}</div>
                  <div className="text-xs text-gray-500">{p.establecimiento_id?.localidad} → {p.destino_localidad}</div>
                  <div className="text-xs text-gray-400">👤 {nombreProd(p)} · {p.created_at?.slice(0, 10)}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-gray-300 text-xs">{expandido === p.id ? '▲' : '▼'}</span>
                  {!['cancelado', 'completado'].includes(p.estado) && (
                    <button onClick={e => { e.stopPropagation(); setCancelando(p.id) }}
                      className="text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded-lg px-3 py-1 flex-shrink-0">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {expandido === p.id && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-xl">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
                    <div>
                      <div className="text-[10px] text-gray-400">Provincia origen</div>
                      <div className="text-xs text-gray-700">{p.establecimiento_id?.provincia || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">Provincia destino</div>
                      <div className="text-xs text-gray-700">{p.destino_provincia || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">Modo publicación</div>
                      <div className="text-xs text-gray-700">{p.modo_publicacion || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">Email productor</div>
                      <div className="text-xs text-gray-700">{p.productores?.usuarios?.email || '—'}</div>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-gray-700 mb-2">
                    Ofertas {ofertas[p.id] ? `(${ofertas[p.id].length})` : '…'}
                  </div>
                  {!ofertas[p.id] ? (
                    <p className="text-xs text-gray-400">Cargando ofertas…</p>
                  ) : ofertas[p.id].length === 0 ? (
                    <p className="text-xs text-gray-400">Sin ofertas aún</p>
                  ) : (
                    <div className="space-y-1.5">
                      {ofertas[p.id].map(o => {
                        const transp = o.transportistas?.usuarios
                        const nombre = transp?.razon_social || `${transp?.nombre || ''} ${transp?.apellido || ''}`.trim()
                        return (
                          <div key={o.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2 flex items-center justify-between">
                            <div>
                              <div className="text-xs font-medium text-gray-800">🚛 {nombre || '—'}</div>
                              <div className="text-[10px] text-gray-400">{transp?.telefono || ''} · {o.created_at?.slice(0, 10)}</div>
                            </div>
                            <div className="text-right">
                              {o.precio && <div className="text-xs font-bold text-gray-900">${o.precio}</div>}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full bg-${colorOferta[o.estado] || 'gray'}-100 text-${colorOferta[o.estado] || 'gray'}-700`}>
                                {o.estado}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {filtrados.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Sin resultados</p>
          )}
        </div>
      )}

      {cancelando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 mb-3">Cancelar pedido</h3>
            <textarea rows={3} placeholder="Motivo de la cancelación…" value={motivo}
              onChange={e => setMotivo(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none resize-none" />
            <div className="flex gap-2">
              <button onClick={cancelar} className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-bold">Confirmar</button>
              <button onClick={() => setCancelando(null)} className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2 text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
