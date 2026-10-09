import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { supabase, getMiTransportista } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Shell, { Body } from '../../components/layout/Shell'
import Topbar from '../../components/layout/Topbar'
import BottomTabs from '../../components/layout/BottomTabs'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Banner from '../../components/ui/Banner'
import Route from '../../components/ui/Route'
import Button from '../../components/ui/Button'
import Field, { Input, Select } from '../../components/ui/Field'
import LocalidadInput from '../../components/ui/LocalidadInput'
import { CEREALES, CATEGORIAS_HACIENDA, TIPOS_CARGA, PRODUCTOS_GRANEL } from '../../utils/constants'
import { tituloPedido, iconoPedido, bgPedido } from '../../utils/pedido'
import { formatNroPedido, formatFecha } from '../../utils/format'
import { normalizar, mismaProvincia, localidadesDelDepartamento, buscarLocalidades } from '../../utils/georef'

const INIT_BUSQ = {
  lugar: null,             // { localidad, departamento, provincia }
  tipo: 'todos',
  cereal: '',
  categoria: '',
  producto: '',
  camiones: '',
  fecha_hasta: '',
}

export default function Disponibles() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('zona')           // 'zona' | 'buscar'
  const [busq, setBusq] = useState(INIT_BUSQ)
  const [resultado, setResultado] = useState(null) // null = sin buscar todavía
  const [buscando, setBuscando] = useState(false)
  const [misDestinos, setMisDestinos] = useState([]) // destinos de mis viajes activos
  const [vecinasDisp, setVecinasDisp] = useState([])  // localidades del mismo departamento
  const [vecinasSel, setVecinasSel] = useState([])    // tildadas por el transportista
  const [verVecinas, setVerVecinas] = useState(false)
  const [guardadas, setGuardadas] = useState([])      // búsquedas fijas del transportista
  const [miTranspId, setMiTranspId] = useState(null)
  const [sumarAZona, setSumarAZona] = useState(true)   // al guardar: ¿también amplía Mi zona?
  const setB = (k, v) => setBusq(b => ({ ...b, [k]: v }))

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    getMiTransportista('id, busquedas_guardadas').then(t => {
      if (!t) return
      setMiTranspId(t.id)
      setGuardadas(Array.isArray(t.busquedas_guardadas) ? t.busquedas_guardadas : [])
    })
  }, [])

  // Al elegir la localidad: traer las vecinas (mismo departamento/partido) para tildar
  async function elegirLugar(lugar, preseleccion = []) {
    setB('lugar', lugar)
    setVecinasDisp([]); setVecinasSel([])
    if (!lugar) return []
    const lista = (await localidadesDelDepartamento(lugar.provincia, lugar.departamento))
      .filter(n => normalizar(n) !== normalizar(lugar.localidad))
    setVecinasDisp(lista)
    const set = new Set(preseleccion.map(normalizar))
    const sel = lista.filter(n => set.has(normalizar(n)))
    setVecinasSel(sel)
    return sel
  }

  const toggleVecina = (n) =>
    setVecinasSel(v => v.includes(n) ? v.filter(x => x !== n) : [...v, n])

  async function guardarGuardadas(lista) {
    setGuardadas(lista)
    if (!miTranspId) return
    const { error } = await supabase.from('transportistas')
      .update({ busquedas_guardadas: lista }).eq('id', miTranspId)
    if (error) console.error('[Búsquedas guardadas]', error)
  }

  const guardarBusqueda = () => {
    const l = busq.lugar
    if (!l) return
    const nueva = { localidad: l.localidad, departamento: l.departamento, provincia: l.provincia, vecinas: vecinasSel, zona: sumarAZona }
    const resto = guardadas.filter(g => !(normalizar(g.localidad) === normalizar(l.localidad) && mismaProvincia(g.provincia, l.provincia)))
    guardarGuardadas([nueva, ...resto].slice(0, 6))
  }

  const toggleZona = (g) =>
    guardarGuardadas(guardadas.map(x => x === g ? { ...x, zona: !x.zona } : x))

  const quitarBusqueda = (g) =>
    guardarGuardadas(guardadas.filter(x => x !== g))

  const usarGuardada = async (g) => {
    const lugar = { localidad: g.localidad, departamento: g.departamento, provincia: g.provincia }
    const sel = await elegirLugar(lugar, g.vecinas || [])
    await buscar(lugar, sel)
  }

  const yaGuardada = !!busq.lugar && guardadas.some(g =>
    normalizar(g.localidad) === normalizar(busq.lugar.localidad) && mismaProvincia(g.provincia, busq.lugar.provincia) &&
    (g.vecinas || []).length === vecinasSel.length &&
    (g.vecinas || []).every(v => vecinasSel.some(x => normalizar(x) === normalizar(v))))

  useAutoRefresh(cargar, 30000)

  async function cargar(silencioso = false) {
    if (!silencioso) setLoading(true)
    const t = await getMiTransportista()

    let query = supabase
      .from('pedidos')
      .select(`
        id, numero, tipo_actividad, tipo_cereal, producto_granel, producto_detalle, vehiculos, estado,
        destino_localidad, destino_provincia, camiones_necesarios,
        fecha_entrega, created_at, modo_publicacion, localidades_vecinas,
        establecimientos(nombre, localidad, departamento, provincia),
        productores(id, usuarios(nombre, apellido, razon_social)),
        pedidos_hacienda(categoria)
      `)
      .in('estado', ['esperando_ofertas', 'con_ofertas'])
      .order('created_at', { ascending: false })

    if (t) {
      query = query.or(`modo_publicacion.eq.general,and(modo_publicacion.eq.directo,transportista_directo.eq.${t.id})`)
    } else {
      query = query.eq('modo_publicacion', 'general')
    }

    const { data } = await query
    setPedidos(data || [])

    // Destinos de mis viajes activos → sugerir carga de vuelta desde ahí
    if (t) {
      const { data: activos } = await supabase
        .from('ofertas')
        .select('etapa, pedidos(numero, destino_localidad, destino_provincia)')
        .eq('transportista_id', t.id)
        .eq('estado', 'seleccionada')
        .in('etapa', ['confirmado', 'datos_enviados', 'en_camino'])
      const vistos = new Set()
      setMisDestinos((activos || []).map(a => a.pedidos).filter(p => {
        if (!p?.destino_localidad) return false
        const k = normalizar(p.destino_localidad) + '|' + normalizar(p.destino_provincia)
        if (vistos.has(k)) return false
        vistos.add(k); return true
      }))
    }
    setLoading(false)
  }

  // ¿El pedido llega a mi localidad base? (origen o vecina elegida por el productor)
  const baseLoc = usuario?.localidad || ''
  const baseProv = usuario?.provincia || ''
  const enMiZona = (p) => {
    if (p.modo_publicacion === 'directo') return true
    if (!baseLoc) return false
    const est = p.establecimientos || {}
    if (!mismaProvincia(est.provincia, baseProv)) return false
    const mia = normalizar(baseLoc)
    if (normalizar(est.localidad) === mia) return true
    return (p.localidades_vecinas || []).some(v => normalizar(v) === mia)
  }

  // Zona ampliada: búsquedas fijas marcadas "en mi zona" (localidad + vecinas elegidas)
  const zonaExtra = guardadas.filter(g => g.zona)
  const enZonaExtra = (p) => {
    const est = p.establecimientos || {}
    const loc = normalizar(est.localidad)
    return zonaExtra.some(g => mismaProvincia(g.provincia, est.provincia) &&
      (normalizar(g.localidad) === loc || (g.vecinas || []).some(v => normalizar(v) === loc)))
  }
  const enMiZonaAmpliada = (p) => enMiZona(p) || enZonaExtra(p)

  const pasaFiltros = (p) => {
    if (busq.tipo !== 'todos' && p.tipo_actividad !== busq.tipo) return false
    if (busq.cereal && p.tipo_cereal !== busq.cereal) return false
    if (busq.categoria && !(p.pedidos_hacienda || []).some(h => h.categoria === busq.categoria)) return false
    if (busq.producto && p.producto_granel !== busq.producto) return false
    if (busq.camiones) {
      const n = p.camiones_necesarios
      if (busq.camiones === '1' && n !== 1) return false
      if (busq.camiones === '2-3' && (n < 2 || n > 3)) return false
      if (busq.camiones === '4-5' && (n < 4 || n > 5)) return false
      if (busq.camiones === '+5' && n <= 5) return false
    }
    if (busq.fecha_hasta && p.fecha_entrega > busq.fecha_hasta) return false
    return true
  }

  // Buscar carga saliendo del destino de uno de mis viajes
  const buscarDesdeDestino = async (d) => {
    const r = await buscarLocalidades(d.destino_localidad, d.destino_provincia)
    const lugar = r.find(o => normalizar(o.localidad) === normalizar(d.destino_localidad)) ||
      { localidad: d.destino_localidad, departamento: '', provincia: d.destino_provincia }
    const sel = await elegirLugar(lugar)
    await buscar(lugar, sel)
  }

  const buscar = async (lugarForzado, vecinasForzadas) => {
    const lugar = lugarForzado?.localidad ? lugarForzado : busq.lugar
    if (!lugar) return
    setBuscando(true)
    const { localidad, provincia } = lugar
    const vec = Array.isArray(vecinasForzadas) ? vecinasForzadas : vecinasSel
    const set = new Set([localidad, ...vec].map(normalizar))

    // Pedidos que CARGAN en esa localidad (o vecinas), vayan a donde vayan
    const r = pedidos.filter(p =>
      set.has(normalizar(p.establecimientos?.localidad)) &&
      mismaProvincia(p.establecimientos?.provincia, provincia) &&
      pasaFiltros(p)
    )
    setResultado(r)
    setBuscando(false)
  }

  const lista = tab === 'zona' ? pedidos.filter(enMiZonaAmpliada) : (resultado || [])

  const Tarjeta = ({ p }) => (
    <Card onClick={() => navigate(`/transportista/disponible/${p.id}`)}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center text-xl flex-shrink-0 ${bgPedido(p)}`}>
          {iconoPedido(p)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">
              {tituloPedido(p)} — {formatNroPedido(p.numero)}
            </span>
            <Badge color={p.estado === 'con_ofertas' ? 'orange' : 'gray'}>
              {p.estado === 'con_ofertas' ? 'Con ofertas' : 'Disponible'}
            </Badge>
          </div>
          {(p.productores?.usuarios?.razon_social || p.productores?.usuarios?.nombre) && (
              <div className="text-xs text-azul-600 mb-0.5">
                👤 {p.productores?.usuarios?.razon_social || `${p.productores?.usuarios?.nombre || ''} ${p.productores?.usuarios?.apellido || ''}`.trim()}
              </div>
            )}
          <Route origen={`${p.establecimientos?.localidad}, ${p.establecimientos?.provincia}`}
            destino={`${p.destino_localidad}, ${p.destino_provincia}`}
          />
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge color="gray">🚛 {p.camiones_necesarios} camión{p.camiones_necesarios > 1 ? 'es' : ''}</Badge>
            <Badge color="gray">📅 {formatFecha(p.fecha_entrega)}</Badge>
            {p.modo_publicacion === 'directo' && <Badge color="blue">🎯 Directo</Badge>}
            {tab === 'buscar' && !enMiZona(p) && <Badge color="orange">Fuera de zona</Badge>}
            {tab === 'zona' && !enMiZona(p) && enZonaExtra(p) && <Badge color="blue">Zona ampliada</Badge>}
          </div>
        </div>
        <span className="text-gray-300 text-lg flex-shrink-0 mt-1">›</span>
      </div>
    </Card>
  )

  return (
    <Shell>
      <Topbar accent="azul" />
      <Body>
        <h1 className="text-base font-bold text-gray-900 mb-3">Pedidos disponibles</h1>

        {/* Pestañas */}
        <div className="flex bg-gray-100 rounded-[10px] p-1 mb-3">
          {[{ id:'zona', label:'📍 Mi zona' }, { id:'buscar', label:'🔍 Buscar' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === t.id ? 'bg-white text-azul-700 shadow-sm' : 'text-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'zona' && (
          baseLoc ? (
            <div className="text-xs text-gray-500 mb-3">
              Pedidos que cargan en <b>{baseLoc}</b> o que el productor extendió a tu localidad
              {zonaExtra.length > 0 && <>, más tu zona ampliada: <b>{zonaExtra.map(g => g.localidad + (g.vecinas?.length ? ` +${g.vecinas.length}` : '')).join(', ')}</b></>}.
              {zonaExtra.length === 0 && <> Podés ampliarla desde Buscar → ☆ Dejar fija.</>}
            </div>
          ) : (
            <Banner color="orange" title="Falta tu localidad base" className="mb-3">
              Cargala en Perfil → Mis datos para ver los pedidos de tu zona.
            </Banner>
          )
        )}

        {tab === 'buscar' && (
          <Card className="mb-3">
            {misDestinos.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] font-semibold text-azul-600 mb-1">🔁 Carga de vuelta desde tus descargas</div>
                <div className="flex gap-2 flex-wrap">
                  {misDestinos.map(d => (
                    <button key={d.numero} onClick={() => buscarDesdeDestino(d)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border border-azul-200 bg-azul-50 text-azul-700">
                      📍 {d.destino_localidad} <span className="text-azul-400">(#{String(d.numero).padStart(4, '0')})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {guardadas.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] font-semibold text-azul-600 mb-1">⭐ Mis búsquedas fijas <span className="font-normal text-gray-400">· 🔔 = en Mi zona, con avisos</span></div>
                <div className="flex gap-2 flex-wrap">
                  {guardadas.map((g, i) => (
                    <span key={i} className="inline-flex items-center rounded-full border border-azul-200 bg-azul-50 text-azul-700 text-xs font-medium">
                      <button onClick={() => usarGuardada(g)} className="pl-3 pr-1 py-1.5">
                        📍 {g.localidad}{g.vecinas?.length ? ` +${g.vecinas.length}` : ''}
                      </button>
                      <button onClick={() => toggleZona(g)} className="px-1 py-1.5" title={g.zona ? 'En Mi zona: te avisamos los pedidos nuevos' : 'Fuera de Mi zona: sin avisos'}>
                        {g.zona ? '🔔' : '🔕'}
                      </button>
                      <button onClick={() => quitarBusqueda(g)} className="pr-2.5 pl-1 py-1.5 text-azul-400" title="Quitar">✕</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Field label="¿Dónde querés cargar?" hint="Ej: donde vas a descargar, para volver cargado">
              <LocalidadInput value={busq.lugar?.localidad || ''} placeholder="Ej: Rosario"
                onChange={() => { setB('lugar', null); setVecinasDisp([]); setVecinasSel([]) }}
                onSelect={o => elegirLugar(o)} />
            </Field>

            {busq.lugar && (
              <div className="mb-3 border border-gray-200 rounded-[10px]">
                <button type="button" onClick={() => setVerVecinas(v => !v)}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700">
                  <b>{busq.lugar.localidad}</b>
                  {vecinasSel.length > 0 && ` + ${vecinasSel.length} vecina${vecinasSel.length > 1 ? 's' : ''}`}
                  <span className="float-right text-azul-600">{verVecinas ? '▲' : 'Sumar vecinas ▼'}</span>
                </button>
                {verVecinas && (
                  <div className="px-3 pb-3">
                    {vecinasDisp.length === 0 ? (
                      <p className="text-xs text-gray-400">No se encontraron otras localidades de {busq.lugar.departamento || 'ese departamento'}.</p>
                    ) : (
                      <>
                        <div className="flex gap-3 mb-2 text-[11px]">
                          <button type="button" className="text-azul-600" onClick={() => setVecinasSel(vecinasDisp)}>Todas</button>
                          <button type="button" className="text-gray-400" onClick={() => setVecinasSel([])}>Ninguna</button>
                          <span className="text-gray-400 ml-auto">{busq.lugar.departamento}</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-x-3 gap-y-1">
                          {vecinasDisp.map(n => (
                            <label key={n} className="flex items-center gap-2 text-xs text-gray-600">
                              <input type="checkbox" checked={vecinasSel.includes(n)} onChange={() => toggleVecina(n)} />
                              {n}
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="px-3 pb-2 flex items-center gap-3 flex-wrap">
                  {!yaGuardada && (
                    <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
                      <input type="checkbox" checked={sumarAZona} onChange={e => setSumarAZona(e.target.checked)} />
                      Sumar a Mi zona y avisarme
                    </label>
                  )}
                  <button type="button" onClick={guardarBusqueda} disabled={yaGuardada}
                    className="text-[11px] font-semibold text-azul-600 disabled:text-gray-400">
                    {yaGuardada ? '⭐ Guardada como búsqueda fija' : '☆ Dejar fija para próximas búsquedas'}
                  </button>
                </div>
              </div>
            )}

            <Field label="Tipo de carga">
              <div className="flex gap-2">
                {[{ id:'todos', corto:'Todos' }, ...TIPOS_CARGA].map(({ id: t, corto }) => (
                  <button key={t} onClick={() => setBusq(b => ({ ...b, tipo: t, cereal: '', categoria: '', producto: '' }))}
                    className={`flex-1 py-2 rounded-[8px] text-xs font-medium border transition-all
                      ${busq.tipo === t ? 'border-azul-500 bg-azul-50 text-azul-600' : 'border-gray-200 bg-white text-gray-500'}`}>
                    {corto}
                  </button>
                ))}
              </div>
            </Field>

            {busq.tipo === 'agricola' && (
              <Field label="Cereal">
                <Select value={busq.cereal} onChange={e => setB('cereal', e.target.value)}>
                  <option value="">Todos</option>
                  {CEREALES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </Field>
            )}
            {busq.tipo === 'ganadero' && (
              <Field label="Categoría">
                <Select value={busq.categoria} onChange={e => setB('categoria', e.target.value)}>
                  <option value="">Todas</option>
                  {CATEGORIAS_HACIENDA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              </Field>
            )}

            {busq.tipo === 'granel' && (
              <Field label="Producto">
                <Select value={busq.producto} onChange={e => setB('producto', e.target.value)}>
                  <option value="">Todos</option>
                  {PRODUCTOS_GRANEL.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </Select>
              </Field>
            )}


            <div className="grid grid-cols-2 gap-2">
              <Field label="Camiones">
                <Select value={busq.camiones} onChange={e => setB('camiones', e.target.value)}>
                  <option value="">Cualquiera</option>
                  <option value="1">1</option>
                  <option value="2-3">2 a 3</option>
                  <option value="4-5">4 a 5</option>
                  <option value="+5">Más de 5</option>
                </Select>
              </Field>
              <Field label="Fecha hasta">
                <Input type="date" value={busq.fecha_hasta} onChange={e => setB('fecha_hasta', e.target.value)} />
              </Field>
            </div>

            <Button variant="azul" onClick={() => buscar()} disabled={!busq.lugar || buscando}>
              {buscando ? 'Buscando…' : busq.lugar ? `Buscar en ${busq.lugar.localidad}` : 'Elegí una localidad de la lista'}
            </Button>
          </Card>
        )}

        {loading ? (
          <p className="text-xs text-gray-400 text-center py-8">Cargando…</p>
        ) : tab === 'buscar' && resultado === null ? null : lista.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-4xl mb-3 opacity-50">🔍</div>
            <div className="text-sm font-semibold text-gray-700 mb-1">Sin pedidos</div>
            <div className="text-xs">
              {tab === 'zona' ? 'No hay pedidos en tu zona ahora. Probá en Buscar.' : 'No hay pedidos con esos datos.'}
            </div>
          </div>
        ) : (
          lista.map(p => <Tarjeta key={p.id} p={p} />)
        )}
      </Body>
      <BottomTabs rol="transportista" />
    </Shell>
  )
}
