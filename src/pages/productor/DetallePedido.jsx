import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { puede } from '../../utils/permisos'
import Shell, { Body } from '../../components/layout/Shell'
import Topbar from '../../components/layout/Topbar'
import BottomTabs from '../../components/layout/BottomTabs'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Banner from '../../components/ui/Banner'
import Modal from '../../components/ui/Modal'
import Field, { Input, Select, Textarea } from '../../components/ui/Field'
import Route from '../../components/ui/Route'
import { ESTADOS_PEDIDO, ESTADOS_OFERTA, ETAPAS_TRANSPORTISTA, CATEGORIAS_HACIENDA } from '../../utils/constants'
import ModalCancelar from '../../components/pedidos/ModalCancelar'
import { formatNroPedido, formatFecha, formatNum } from '../../utils/format'
import { tituloPedido, iconoPedido, bgPedido, documentoDe } from '../../utils/pedido'
import Contador from '../../components/ui/Contador'
import { TIPOS_CHASIS, VEHICULOS, FORMAS_PAGO } from '../../utils/constants'
import Contacto from '../../components/pedidos/Contacto'
import Condiciones from '../../components/pedidos/Condiciones'
import NotasPedido from '../../components/pedidos/NotasPedido'
import CalifDisplay from '../../components/ui/CalifDisplay'
import ModalCalificar from '../../components/pedidos/ModalCalificar'
import MapRuta from '../../components/ui/MapRuta'
import IncidenciaCard from '../../components/pedidos/IncidenciaCard'

export default function DetallePedido() {
  const { usuario, cuenta, cambiarCuenta } = useAuth()
  const ok = (a) => puede(cuenta, a)
  const { id } = useParams()
  const navigate = useNavigate()
  const [pedido, setPedido] = useState(null)
  const [hacienda, setHacienda] = useState([])
  const [ofertas, setOfertas] = useState([])
  const [datosOps, setDatosOps] = useState([])
  const [aceptando, setAceptando] = useState(null)   // { oferta, max }
  const [formAcuerdo, setFormAcuerdo] = useState({ cantidad: '', precio: '', forma_pago: '', monto: '', condiciones: '' })
  const [errAcuerdo, setErrAcuerdo] = useState('')
  const [savingAcuerdo, setSavingAcuerdo] = useState(false)
  const [camionesViaje, setCamionesViaje] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalDoc, setModalDoc] = useState(false)
  const [camionSeleccionado, setCamionSeleccionado] = useState(null)
  const [kilosInput, setKilosInput] = useState('')
  const [savingDoc, setSavingDoc] = useState(false)
  const [modalCancelar, setModalCancelar] = useState(false)
  const [documentos, setDocumentos] = useState([])
  const [incidencias, setIncidencias] = useState([])
  const [modalAviso, setModalAviso] = useState(null)   // camionViaje id
  const [textoAviso, setTextoAviso] = useState('')
  const [savingAviso, setSavingAviso] = useState(false)
  const [notasOferta, setNotasOferta] = useState({})
  const [guardandoNota, setGuardandoNota] = useState({})
  const [archivoDoc, setArchivoDoc] = useState(null)
  const [confirmando, setConfirmando] = useState(false)
  const [modalCalif, setModalCalif] = useState(null)
  // Plegado: lo terminado se repliega solo; lo que pide acción queda abierto. Se puede abrir/cerrar a mano.
  const [abierto, setAbierto] = useState({})
  const estaAbierto = (k, porDefecto) => abierto[k] ?? porDefecto
  const alternar = (k, porDefecto) => setAbierto(a => ({ ...a, [k]: !(a[k] ?? porDefecto) }))

  useEffect(() => { cargar() }, [id, cuenta?.id])

  useEffect(() => {
    const channel = supabase
      .channel(`detalle-prod-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ofertas', filter: `pedido_id=eq.${id}` }, () => cargar(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `id=eq.${id}` }, () => cargar(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'camiones_viaje' }, () => cargar(true))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id])

  const resolverAviso = async (incId) => {
    const { error } = await supabase.rpc('resolver_aviso', { p_incidencia_id: incId })
    if (error) alert(error.message)
    await cargar(true)
  }

  const enviarAviso = async () => {
    setSavingAviso(true)
    const { error } = await supabase.rpc('avisar_problema_camion', { p_camion_viaje_id: modalAviso, p_descripcion: textoAviso })
    setSavingAviso(false)
    if (error) { alert(error.message); return }
    setModalAviso(null)
    await cargar(true)
  }

  const abrirDoc = (cv) => {
    setCamionSeleccionado(cv)
    setKilosInput(cv.kilos_asignados || '')
    setModalDoc(true)
  }

  const guardarKilos = async () => {
    if (!kilosInput) return
    setSavingDoc(true)

    try {
      const { error: errKilos } = await supabase.from('camiones_viaje')
        .update({ kilos_asignados: Number(kilosInput) })
        .eq('id', camionSeleccionado.id)
      if (errKilos) throw errKilos

      if (archivoDoc) {
        const fd = new FormData()
        fd.append('file', archivoDoc)
        fd.append('pedido_id', id)
        fd.append('camion_id', camionSeleccionado.id)
        fd.append('tipo', documentoDe(pedido).tipo)
        fd.append('kilos', kilosInput)

        // Refrescar sesión antes de subir (evita "Sesión inválida" por token vencido)
        await supabase.auth.refreshSession()
        const { error } = await supabase.functions.invoke('upload-documento', {
          body: fd,
        })

        if (error) {
          let msg = error.message
          try { msg = (await error.context.json()).error || msg } catch {}
          throw new Error(msg)
        }
      }

      // Paso 5: si todos los camiones tienen documento → En camino
      const { error: errCamino } = await supabase.rpc('marcar_en_camino', { p_pedido_id: id })
      // Si había incidencia activa en algún camión, marcarla resuelta
      // El documento nuevo resuelve las incidencias de ESTE camión que lo pedían
      const idsConInc = [camionSeleccionado.id]
      if (idsConInc.length) {
        await supabase.from('incidencias').update({ resuelta: true }).in('camion_viaje_id', idsConInc).eq('resuelta', false)
          .in('accion', ['cambio', 'transbordo_propio', 'transbordo_otro'])
      }
      if (errCamino) throw errCamino

      setModalDoc(false)
      setArchivoDoc(null)
      await cargar(true)
    } catch (e) {
      alert(e.message)
    } finally {
      setSavingDoc(false)
    }
  }

  async function cargar(silencioso = false) {
    if (!silencioso) setLoading(true)
    const { data: p } = await supabase
      .from('pedidos')
      .select(`
        *,
        establecimientos(nombre, localidad, provincia, departamento, link_maps, telefono),
        productores(usuario_id, cuenta_id),
        transportista_directo_info:transportistas!pedidos_transportista_directo_fkey(id, usuario_id, usuarios(nombre, apellido, razon_social, telefono, cuit))
      `)
      .eq('id', id)
      .single()

    // Pedido de otra de mis empresas (por ej. desde un aviso): paso a esa empresa
    if (p && cuenta && p.productores?.cuenta_id !== cuenta.id && cambiarCuenta(p.productores?.cuenta_id, true)) return

    // Solo la cuenta dueña del pedido puede ver este detalle
    if (!p || !cuenta || p.productores?.cuenta_id !== cuenta.id) {
      setPedido(null)
      setLoading(false)
      return
    }
    setPedido(p)

    if (p?.tipo_actividad === 'ganadero') {
      const { data: h } = await supabase
        .from('pedidos_hacienda')
        .select('*')
        .eq('pedido_id', id)
      setHacienda(h || [])
    }

    const { data: dops } = await supabase
      .from('datos_operativos')
      .select('*')
      .eq('pedido_id', id)
    setDatosOps(dops || [])

    let cv = []
    if (dops?.length) {
      const { data } = await supabase
        .from('camiones_viaje')
        .select('*, chasis(dominio, tipo, tara_kg), acoplados(dominio, tipo, tara_kg), choferes(nombre, apellido, dni, cuit)')
        .in('datos_operativos_id', dops.map(d => d.id))
      cv = data || []
    }
    setCamionesViaje(cv)

    if (cv.length) {
      const { data: docs } = await supabase
        .from('documentos').select('*')
        .in('camion_viaje_id', cv.map(c => c.id))
      setDocumentos(docs || [])
      // Cargar incidencias activas
      const { data: incs } = await supabase
        .from('incidencias').select('*')
        .in('camion_viaje_id', cv.map(c => c.id))
        .eq('resuelta', false)
      setIncidencias(incs || [])
    } else {
      setDocumentos([])
      setIncidencias([])
    }

    const { data: o } = await supabase
      .from('ofertas')
      .select('*, transportistas(usuario_id, usuarios(nombre, apellido, razon_social, cuit, telefono))')
      .eq('pedido_id', id)
      .order('created_at', { ascending: false })
    // Marcar ofertas ya calificadas por el productor (todas, sin filtrar por etapa)
    let o2 = o || []
    let ya = new Set()
    if (o2.length) {
      const ids = o2.map(x => x.id)
      const { data: mis } = await supabase.from('calificaciones').select('oferta_id')
        .in('oferta_id', ids).eq('calificador_rol', 'productor')
      ya = new Set((mis || []).map(x => x.oferta_id))
      o2 = o2.map(x => ({ ...x, calif_prod: ya.has(x.id) }))
    }
    setOfertas(o2)
    // Cargar notas
    const notasObj = {}
    for (const of2 of (o2 || [])) { if (of2.nota_productor) notasObj[of2.id] = of2.nota_productor }
    setNotasOferta(notasObj)
    // Auto-abrir calificación si hay oferta finalizada sin calificar
    const pendiente = o2.find(x => x.etapa === 'finalizado' && !ya.has(x.id))
    if (pendiente) setModalCalif({ ofertaId: pendiente.id, numero: pedido?.numero || 0 })

    setLoading(false)
  }

  // Paso 3: elegir transportista con las condiciones acordadas por teléfono
  const guardarNotaOferta = async (ofertaId, texto) => {
    setGuardandoNota(g => ({ ...g, [ofertaId]: true }))
    await supabase.from('ofertas').update({ nota_productor: texto || null }).eq('id', ofertaId)
    setGuardandoNota(g => ({ ...g, [ofertaId]: false }))
  }

  const abrirAceptar = (oferta, max) => {
    setAceptando({ oferta, max })
    setFormAcuerdo({ cantidad: String(max), precio: '', forma_pago: '', monto: '', condiciones: '' })
    setErrAcuerdo('')
  }

  const confirmarOferta = async () => {
    const { oferta, max } = aceptando
    const cant = Number(formAcuerdo.cantidad)
    if (!cant || cant < 1 || cant > max) { setErrAcuerdo(`Podés aceptar entre 1 y ${max} camión(es)`); return }
    if (!formAcuerdo.precio.trim()) { setErrAcuerdo('Ingresá el precio acordado'); return }
    if (!formAcuerdo.forma_pago) { setErrAcuerdo('Elegí la forma de pago'); return }
    setSavingAcuerdo(true)
    const { error } = await supabase.rpc('confirmar_oferta', {
      p_oferta_id: oferta.id,
      p_cantidad: cant,
      p_precio: formAcuerdo.precio.trim(),
      p_forma_pago: formAcuerdo.forma_pago,
      p_monto: formAcuerdo.monto ? Number(formAcuerdo.monto) : null,
      p_condiciones: formAcuerdo.condiciones.trim() || null,
    })
    setSavingAcuerdo(false)
    if (error) { setErrAcuerdo(error.message); return }
    setAceptando(null)
    await cargar(true)
  }

  const cerrarCupo = async () => {
    if (!confirm('¿Cerrar cupo con los camiones aceptados hasta ahora? Las demás ofertas quedan en pausa.')) return
    const { error } = await supabase.rpc('cerrar_cupo', { p_pedido_id: id })
    if (error) { alert(error.message); return }
    await cargar(true)
  }

  // Paso 7: productor confirma descarga de un transportista → su viaje Finalizado
  const confirmarDescarga = async (ofertaId) => {
    const o = ofertas.find(x => x.id === ofertaId)
    if (!confirm(`¿Confirmás la descarga de ${o ? nombreT(o) : 'este transportista'}?\n\nSu viaje queda Finalizado y no se puede deshacer.`)) return
    setConfirmando(ofertaId)
    const { error } = await supabase.rpc('confirmar_descarga_transportista', { p_oferta_id: ofertaId })
    setConfirmando(false)
    if (error) { alert(error.message); return }
    await cargar(true)
  }

  if (loading) return (
    <Shell>
      <Topbar title="Pedido" showBack backTo="/productor/pedidos" accent="verde" />
      <Body><p className="text-xs text-gray-400 text-center py-10">Cargando…</p></Body>
      <BottomTabs rol="productor" />
    </Shell>
  )

  if (!pedido) return (
    <Shell>
      <Topbar title="Pedido" showBack backTo="/productor/pedidos" accent="verde" />
      <Body><Banner color="red">No se encontró el pedido.</Banner></Body>
      <BottomTabs rol="productor" />
    </Shell>
  )

  const est = ESTADOS_PEDIDO[pedido.estado] || { label: pedido.estado, color: 'gray' }
  const esAgricola = pedido.tipo_actividad === 'agricola'
  // Estado de un camión para ordenar y plegar (necesita = pide acción del productor)
  const estadoCamion = (cv, o) => {
    const doc = documentos.find(d => d.camion_viaje_id === cv.id && !d.anulado)
    const pendInc = incidencias.some(x => x.camion_viaje_id === cv.id && !x.resuelta)
    const faltaDoc = cv.estado === 'activo' && !cv.fecha_descarga && !doc && ['datos_enviados', 'en_camino'].includes(o.etapa)
    const necesita = faltaDoc || pendInc
    const orden = necesita ? 0 : (cv.estado === 'baja' || cv.fecha_descarga) ? 2 : 1
    return { necesita, orden }
  }
  const badgeCamion = (cv, o, doc) => cv.estado === 'baja'
    ? <Badge color="gray">Baja por incidencia</Badge>
    : cv.fecha_descarga
      ? <Badge color={cv.con_incidencia ? 'orange' : 'green'}>{cv.con_incidencia ? '⚠️ Cerrado con incidencia' : '✅ Descargado'}</Badge>
      : !doc
        ? <Badge color="orange">Falta documento</Badge>
        : cv.fecha_carga
          ? <Badge color="blue">🚛 Cargado, en viaje</Badge>
          : o.etapa === 'en_camino'
            ? <Badge color="blue">En camino a cargar</Badge>
            : <Badge color="gray">Documento OK</Badge>

  const nombreT = (o) => o.transportistas?.usuarios?.razon_social ||
    `${o.transportistas?.usuarios?.nombre || ''} ${o.transportistas?.usuarios?.apellido || ''}`.trim()
  const aceptadas = ofertas.filter(o => o.estado === 'seleccionada')
  const cubierto = aceptadas.reduce((a, o) => a + (o.camiones_aceptados || 0), 0)
  const restante = Math.max(0, pedido.camiones_necesarios - cubierto)
  const pedidoAbierto = !['cancelado','completado'].includes(pedido.estado)
  const cupoAbierto = pedidoAbierto && !pedido.cupo_cerrado
  const puedeCancelar = pedidoAbierto && (
    aceptadas.length === 0 || aceptadas.some(o => ['confirmado','datos_enviados'].includes(o.etapa))
  )
  const docLabel = documentoDe(pedido).label
  const totalHacienda = hacienda.reduce((a, h) => a + h.cantidad * h.kg_por_cabeza, 0)

  return (
    <Shell>
      <Topbar title={`Pedido ${formatNroPedido(pedido.numero)}`} showBack backTo="/productor/pedidos" accent="verde" />
      <Body>

        {/* Encabezado */}
        <Card className="mb-3">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-[10px] flex items-center justify-center text-2xl flex-shrink-0 ${bgPedido(pedido)}`}>
              {iconoPedido(pedido)}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-base font-bold text-gray-900">
                  {tituloPedido(pedido)}
                </span>
                <Badge color={est.color}>{est.label}</Badge>
              </div>
              <Route
                origen={`${pedido.establecimientos?.nombre}, ${pedido.establecimientos?.provincia}`}
                destino={`${pedido.destino_localidad}, ${pedido.destino_provincia}`}
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge color="gray">🚛 {pedido.camiones_necesarios} camión{pedido.camiones_necesarios > 1 ? 'es' : ''}</Badge>
                <Badge color={pedido.modo_publicacion === 'directo' ? 'blue' : 'gray'}>
                  {pedido.modo_publicacion === 'directo' ? '🎯 Directo' : '🌐 General'}
                </Badge>
                <Badge color="gray">📅 {formatFecha(pedido.fecha_entrega)}</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Detalle agrícola */}

        {pedido.tipo_actividad !== 'ganadero' && pedido.kilos_estimados && (
          <Card className="mb-3">
            <div className="text-xs font-semibold text-azul-600 mb-2">Detalle de carga</div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Kilos estimados</span>
              <span className="font-semibold">{formatNum(pedido.kilos_estimados)} kg</span>
            </div>
          </Card>
        )}

        {/* Detalle hacienda */}
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

        {/* Establecimiento */}
        <Card className="mb-3">
          <div className="text-xs font-semibold text-azul-600 mb-2">Establecimiento de origen</div>
          <div className="text-sm font-semibold text-gray-900">{pedido.establecimientos?.nombre}</div>
          <div className="text-xs text-gray-500 mt-0.5">📍 {pedido.establecimientos?.localidad}, {pedido.establecimientos?.departamento}, {pedido.establecimientos?.provincia}</div>
          {pedido.establecimientos?.telefono && <div className="text-xs text-gray-400 mt-0.5">📞 {pedido.establecimientos.telefono}</div>}
          {pedido.establecimientos?.link_maps && (
            <a href={pedido.establecimientos.link_maps} target="_blank" rel="noreferrer" className="text-xs text-azul-600 mt-0.5 block">Ver en Maps</a>
          )}
        </Card>

        {/* Destino */}
        <Card className="mb-3">
          <div className="text-xs font-semibold text-azul-600 mb-2">Destino</div>
          <div className="text-sm font-semibold text-gray-900">{pedido.destino_localidad}, {pedido.destino_provincia}</div>
          {pedido.destino_link_maps && (
            <a href={pedido.destino_link_maps} target="_blank" rel="noreferrer" className="text-xs text-azul-600 mt-0.5 block">Ver en Maps</a>
          )}
        </Card>

        {/* Mapa de ruta */}
        {pedido.establecimientos?.localidad && pedido.destino_localidad && (
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

        {/* Observaciones */}
        {pedido.observaciones && (
          <Card className="mb-3">
            <div className="text-xs font-semibold text-azul-600 mb-1">Observaciones</div>
            <div className="text-sm text-gray-700">{pedido.observaciones}</div>
          </Card>
        )}

        {/* Cupo */}
        {pedidoAbierto && (
          <Card className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs font-semibold text-azul-600">Camiones cubiertos</div>
              <div className="text-sm font-bold text-gray-900">{cubierto} / {pedido.camiones_necesarios}</div>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-verde-600 transition-all"
                style={{ width: `${Math.min(100, (cubierto / pedido.camiones_necesarios) * 100)}%` }} />
            </div>
            {pedido.cupo_cerrado ? (
              <div className="text-[11px] text-gray-500 mt-1.5">🔒 Cupo cerrado{cubierto < pedido.camiones_necesarios ? ' (incompleto)' : ''}</div>
            ) : cubierto > 0 && ok('aceptar_ofertas') && (
              <Button size="sm" variant="secondary" onClick={cerrarCupo} className="mt-2">
                🔒 Cerrar cupo en {cubierto} camión{cubierto > 1 ? 'es' : ''}
              </Button>
            )}
          </Card>
        )}

        {/* Ofertas: con el pedido en marcha se repliegan; las cerradas van aparte */}
        {(() => { const abiertaOf = estaAbierto('ofertas', pedidoAbierto); return (
        <Card className="mb-3">
          <button onClick={() => alternar('ofertas', pedidoAbierto)} className="w-full flex items-center justify-between text-left mb-2">
            <span className="text-xs font-semibold text-azul-600">{abiertaOf ? '▾' : '▸'} Ofertas recibidas ({ofertas.length})</span>
            {!abiertaOf && ofertas.some(o => o.estado === 'enviada') && <Badge color="orange">{ofertas.filter(o => o.estado === 'enviada').length} pendiente(s)</Badge>}
          </button>
          {!abiertaOf ? null : ofertas.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-2xl mb-1 opacity-40">⏳</div>
              <div className="text-xs text-gray-400">Esperando ofertas de transportistas</div>
            </div>
          ) : (
            [...ofertas.filter(o => ['enviada','seleccionada'].includes(o.estado)),
             ...(estaAbierto('ofertas-otras', false) ? ofertas.filter(o => !['enviada','seleccionada'].includes(o.estado)) : [])].map(o => {
              const eo = ESTADOS_OFERTA[o.estado] || { label: o.estado, color: 'gray' }
              const maxAceptable = Math.min(o.camiones_ofrecidos || 1, restante)
              return (
                <div key={o.id} className="border border-gray-100 rounded-[10px] p-3 mb-2">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 cursor-pointer text-azul-700 underline"
                        onClick={() => navigate(`/perfil/transportista/${o.transportista_id}`)}>
                        {nombreT(o)}
                      </div>
                      {o.transportistas?.usuarios?.cuit && (
                        <div className="text-xs text-gray-400">CUIT: {o.transportistas.usuarios.cuit}</div>
                      )}
                      <Contador usuarioId={o.transportistas?.usuario_id} rol="transportista" className="mt-0.5" />
                      <CalifDisplay transportistaId={o.transportista_id} className="mt-0.5" />
                      {o.fuera_de_zona && (
                        <div className="mt-0.5">
                          <Badge color="orange">Fuera de zona{o.base_transportista ? ` — Base: ${o.base_transportista}` : ''}</Badge>
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-0.5">
                        {o.camiones_ofrecidos} camión{o.camiones_ofrecidos > 1 ? 'es' : ''} ofrecido{o.camiones_ofrecidos > 1 ? 's' : ''}
                        {o.equipos?.length > 0 && ` · ${o.equipos.map(e => VEHICULOS[e] || e).join(', ')}`}
                        {ok('ver_precios') && o.precio_tn && ` · $${formatNum(o.precio_tn)}/tn`}
                        {ok('ver_precios') && o.precio_km && ` · $${formatNum(o.precio_km)}/km`}
                        {o.km_estimados && ` · ${formatNum(o.km_estimados)} km`}
                        {ok('ver_precios') && o.precio_km && o.km_estimados && (
                          <span className="font-semibold text-gray-700"> · Total: ${formatNum(o.precio_km * o.km_estimados)}</span>
                        )}
                      </div>
                      {o.estado === 'seleccionada' && (
                        <div className="text-xs text-verde-700 font-semibold mt-0.5">
                          ✓ {o.camiones_aceptados} aceptado{o.camiones_aceptados > 1 ? 's' : ''}
                        </div>
                      )}

                    </div>
                    <Badge color={eo.color}>{eo.label}</Badge>
                  </div>
                  {o.observaciones && <div className="text-xs text-gray-500 mb-2">{o.observaciones}</div>}
                  {['enviada','en_pausa'].includes(o.estado) && (
                    <Contacto telefono={o.transportistas?.usuarios?.telefono} className="mb-2"
                      mensaje={`Hola, te contacto por tu postulación al pedido #${String(pedido.numero).padStart(4, '0')} en Carreta.`} />
                  )}
                  <div className="mt-1 mb-2">
                    <textarea rows={2}
                      placeholder="📝 Mis notas sobre este transportista (solo vos las ves)…"
                      value={notasOferta[o.id] || ''}
                      onChange={e => setNotasOferta(n => ({ ...n, [o.id]: e.target.value }))}
                      onBlur={() => guardarNotaOferta(o.id, notasOferta[o.id])}
                      className="w-full text-xs border border-gray-100 rounded-[8px] px-2.5 py-1.5 bg-amber-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:border-amber-300 resize-none" />
                    {guardandoNota[o.id] && <span className="text-[10px] text-gray-400">Guardando…</span>}
                  </div>
                  {o.estado === 'enviada' && cupoAbierto && restante > 0 && ok('aceptar_ofertas') && (
                    <div className="flex gap-2 items-center">
                      <Button size="sm" full={false} onClick={() => abrirAceptar(o, maxAceptable)}>
                        ✓ Elegir
                      </Button>
                      <Button size="sm" variant="ghost" full={false}
                        onClick={async () => {
                          await supabase.from('ofertas').update({ estado: 'rechazada' }).eq('id', o.id)
                          await cargar(true)
                        }}>
                        Rechazar
                      </Button>
                    </div>
                  )}
                </div>
              )
            })
          )}
          {abiertaOf && ofertas.some(o => !['enviada','seleccionada'].includes(o.estado)) && (
            <button onClick={() => alternar('ofertas-otras', false)} className="text-xs text-gray-500 font-semibold">
              {estaAbierto('ofertas-otras', false) ? '▾ Ocultar' : '▸ Ver'} otras ofertas ({ofertas.filter(o => !['enviada','seleccionada'].includes(o.estado)).length}: en pausa, rechazadas o canceladas)
            </button>
          )}
        </Card>
        ) })()}

        {/* Transportistas aceptados: uno por tarjeta, con su etapa y camiones */}
        {aceptadas.map(o => {
          const et = ETAPAS_TRANSPORTISTA[o.etapa] || { label: o.etapa, color: 'gray' }
          const dop = datosOps.find(d => d.transportista_id === o.transportista_id)
          const cvs = dop ? camionesViaje.filter(c => c.datos_operativos_id === dop.id) : []
          const abiertaT = estaAbierto(`t-${o.id}`, o.etapa !== 'finalizado')
          const nDesc = cvs.filter(c => c.fecha_descarga).length
          return (
            <Card key={o.id} className="mb-3">
              <div className="flex items-start justify-between mb-2 cursor-pointer" onClick={() => alternar(`t-${o.id}`, o.etapa !== 'finalizado')}>
                <div>
                  <div className="text-xs font-semibold text-verde-600">🚛 Transportista</div>
                  <div className="text-sm font-semibold text-gray-900">{nombreT(o)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {o.camiones_aceptados} camión{o.camiones_aceptados > 1 ? 'es' : ''}
                    {o.equipos?.length > 0 && ` · ${o.equipos.map(e => VEHICULOS[e] || e).join(', ')}`}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge color={et.color}>{et.label}</Badge>
                  <span className="text-[10px] text-gray-400">{abiertaT ? '▾ ocultar' : `▸ ver${cvs.length ? ` · ${nDesc}/${cvs.length} descargados` : ''}`}</span>
                </div>
              </div>
              {abiertaT && (<>
              <Contacto telefono={o.transportistas?.usuarios?.telefono} className="mb-2" />
              <Condiciones oferta={o} />

              {!dop && (
                <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                  Esperando datos operativos del transportista.
                </div>
              )}

              {dop && o.etapa === 'confirmado' && (
                <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-2">
                  ⚠️ {cvs.length < o.camiones_aceptados
                    ? `Faltan ${o.camiones_aceptados - cvs.length} camión(es): uno salió en otro viaje. Esperando reemplazo del transportista.`
                    : 'El transportista está revisando sus camiones.'}
                </div>
              )}

              {/* Pedidos viejos: condiciones cargadas por el transportista */}
              {dop && !o.forma_pago && dop.forma_pago && (
                <Condiciones oferta={dop} />
              )}

              {cvs.map((cv, i) => ({ cv, i, ...estadoCamion(cv, o) }))
                .sort((a, b) => a.orden - b.orden || a.i - b.i)
                .map(({ cv, i, necesita }) => {
                const doc = documentos.find(d => d.camion_viaje_id === cv.id && !d.anulado)
                const enCurso = cv.estado === 'activo' && !cv.fecha_descarga
                const abiertoCv = estaAbierto(cv.id, necesita)
                if (!abiertoCv) return (
                  <button key={cv.id} onClick={() => alternar(cv.id, necesita)}
                    className="w-full flex items-center justify-between gap-2 border border-gray-100 rounded-[10px] px-3 py-2 mb-1.5 text-left">
                    <span className="text-xs text-gray-700 truncate">▸ <b>Camión {i + 1}</b> · {cv.chasis?.dominio}{cv.choferes?.apellido ? ` · ${cv.choferes.apellido}` : ''}</span>
                    {badgeCamion(cv, o, doc)}
                  </button>
                )
                return (
                  <div key={cv.id} className="border border-gray-100 rounded-[10px] p-3 mb-2">
                    {incidencias.filter(inc => inc.camion_viaje_id === cv.id).map(inc => (
                      <IncidenciaCard key={inc.id} inc={inc} cv={cv} rol="productor"
                        tieneDocumento={!!doc} docLabel={docLabel}
                        onResolver={['aviso_productor', 'reparacion'].includes(inc.accion) ? resolverAviso : null} />
                    ))}
                    <div className="flex items-center justify-between mb-1 cursor-pointer" onClick={() => alternar(cv.id, necesita)}>
                      <span className="text-xs font-semibold text-gray-900">▾ Camión {i + 1}</span>
                      {badgeCamion(cv, o, doc)}
                    </div>
                    <div className="text-xs text-gray-600">
                      🚛 {cv.chasis?.dominio} <span className="text-gray-400">({TIPOS_CHASIS[cv.chasis?.tipo] || 'Chasis'}{cv.chasis?.tara_kg ? ` · tara ${formatNum(cv.chasis.tara_kg)} kg` : ''})</span>
                    </div>
                    {cv.acoplados && (
                      <div className="text-xs text-gray-600">
                        🔗 {cv.acoplados.dominio} <span className="text-gray-400">({VEHICULOS[cv.acoplados.tipo] || 'Remolque'}{cv.acoplados.tara_kg ? ` · tara ${formatNum(cv.acoplados.tara_kg)} kg` : ''})</span>
                      </div>
                    )}
                    {(cv.chasis?.tara_kg || cv.acoplados?.tara_kg) && (
                      <div className="text-xs font-semibold text-gray-800 mt-0.5">
                        ⚖️ Tara total: {formatNum(Number(cv.chasis?.tara_kg || 0) + Number(cv.acoplados?.tara_kg || 0))} kg
                      </div>
                    )}
                    <div className="text-xs text-gray-600 mt-0.5">👤 {cv.choferes?.nombre} {cv.choferes?.apellido}</div>
                    <div className="text-xs text-gray-400 mt-0.5">CUIT: {cv.choferes?.cuit}</div>
                    {cv.kilos_asignados && (
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="text-xs text-verde-600">⚖️ {formatNum(cv.kilos_asignados)} kg asignados</div>
                        {!cv.fecha_descarga && ok('documentos') && (
                          <button onClick={() => abrirDoc(cv)} className="text-xs text-azul-600 font-semibold">Editar</button>
                        )}
                      </div>
                    )}
                    {doc ? (
                      <div className="mt-1.5 bg-verde-50 border border-verde-200 rounded-lg px-2.5 py-1.5 text-xs text-verde-700 font-medium">
                        ✅ {docLabel} enviado al transportista — {doc.nombre_original}
                      </div>
                    ) : enCurso && ['datos_enviados', 'en_camino'].includes(o.etapa) && ok('documentos') && (
                      <button onClick={() => abrirDoc(cv)}
                        className="mt-1.5 w-full text-xs text-azul-600 font-semibold border border-azul-200 rounded-lg px-2 py-1.5 bg-azul-50 text-left">
                        📄 Asignar kilos / {docLabel}
                      </button>
                    )}
                    {cv.fecha_carga && !cv.fecha_descarga && (
                      <div className="text-xs text-azul-600 mt-1">🚛 Cargado: {formatFecha(cv.fecha_carga)}{cv.kilos_cargados ? ` · ${formatNum(cv.kilos_cargados)} kg` : ''}</div>
                    )}
                    {cv.transporte_externo && (
                      <div className="text-xs text-gray-500 mt-0.5">Transbordo a: CUIT {cv.transporte_externo}</div>
                    )}
                    {enCurso && ['datos_enviados', 'en_camino'].includes(o.etapa) && (
                      <button onClick={() => { setModalAviso(cv.id); setTextoAviso('') }}
                        className="mt-1.5 text-[11px] text-orange-700 font-semibold">
                        ⚠ Avisar un problema con este camión
                      </button>
                    )}
                    {cv.fecha_descarga && <div className="text-xs text-verde-600 mt-1">{cv.con_incidencia ? '⚠️ Cerrado' : '✅ Descarga'}: {formatFecha(cv.fecha_descarga)}</div>}
                    {cv.kilos_descargados && (
                      <div className="text-xs text-gray-700 mt-1 bg-gray-50 rounded-lg px-2 py-1.5 space-y-0.5">
                        <div>⚖️ <b>Kilos descargados:</b> {formatNum(cv.kilos_descargados)} kg</div>
                        {cv.humedad != null && <div>💧 Humedad: {cv.humedad}%</div>}
                        {cv['cuerpos_extraños'] != null && <div>🪨 Cuerpos extraños: {cv['cuerpos_extraños']}%</div>}
                        {cv['granos_dañados'] != null && <div>⚠️ Granos dañados: {cv['granos_dañados']}%</div>}
                      </div>
                    )}
                  </div>
                )
              })}

              {o.etapa === 'descargado' && (
                <>
                  <Banner color="purple" title="📦 Descarga informada">
                    Este transportista informó la descarga de todos sus camiones.
                  </Banner>
                  <Button onClick={() => confirmarDescarga(o.id)} disabled={confirmando === o.id}>
                    {confirmando === o.id ? 'Confirmando…' : '✓ Confirmar descarga'}
                  </Button>
                </>
              )}
              {o.etapa === 'finalizado' && o.calif_prod && (
                <div className="text-[11px] text-verde-600 font-medium">✔ {nombreT(o)} calificado</div>
              )}
              </>)}
            </Card>
          )
        })}

        {/* Paso 7: resumen — solo si hay más de un transportista */}
        {pedido.estado === 'entrega_informada' && aceptadas.length > 1 && (
          <Banner color="purple" title="📦 Descarga informada">
            Confirmá la descarga en la tarjeta de cada transportista.
          </Banner>
        )}

        {pedido.estado === 'completado' && (
          <Banner color="green" title="✅ Pedido finalizado">
            Descarga confirmada. ¡Gracias por usar Carreta!
          </Banner>
        )}

        {/* Repetir pedido (mismos datos, nueva fecha) */}
        {ok('crear_pedidos') && (
          <Button variant="secondary" className="mb-2" onClick={() => navigate('/productor/crear', {
            state: { repetir: { ...pedido, hacienda } }
          })}>
            🔁 Repetir pedido
          </Button>
        )}

        {/* Modo directo: esperando respuesta */}
        {pedido.estado === 'esperando_respuesta' && (
          <Card className="mb-3">
            <div className="text-xs font-semibold text-azul-600 mb-1">🎯 Pedido directo</div>
            <div className="text-sm font-semibold text-gray-900">
              {pedido.transportista_directo_info?.usuarios?.razon_social ||
               `${pedido.transportista_directo_info?.usuarios?.nombre || ''} ${pedido.transportista_directo_info?.usuarios?.apellido || ''}`.trim() ||
               'Transportista'}
            </div>
            <div className="text-xs text-gray-500 mb-2">Esperando que acepte o rechace.</div>
            <Contacto telefono={pedido.transportista_directo_info?.usuarios?.telefono} className="mb-2" />
            {ok('cancelar') && <Button variant="danger" onClick={async () => {
              if (!confirm('¿Retirás el pedido? El transportista recibirá un aviso.')) return
              const { error } = await supabase.rpc('retirar_pedido_directo', { p_pedido_id: id })
              if (error) alert(error.message); else await cargar(true)
            }}>
              Retirar pedido
            </Button>}
          </Card>
        )}

        {/* Modo directo: rechazado */}
        {pedido.estado === 'rechazado_directo' && (
          <Card className="mb-3">
            <Banner color="red" title="❌ Pedido rechazado" className="mb-3">
              {pedido.transportista_directo_info?.usuarios?.razon_social ||
               `${pedido.transportista_directo_info?.usuarios?.nombre || ''} ${pedido.transportista_directo_info?.usuarios?.apellido || ''}`.trim()}
              {pedido.motivo_rechazo ? ` rechazó el pedido. Motivo: ${pedido.motivo_rechazo}` : ' rechazó el pedido.'}
            </Banner>
            {ok('crear_pedidos') && <div className="flex gap-2">
              <Button variant="secondary" full={false} onClick={() => navigate('/productor/crear', {
                state: { repetir: { ...pedido, hacienda, _modoDirecto: true } }
              })}>
                🎯 Otro directo
              </Button>
              <Button variant="secondary" full={false} onClick={async () => {
                if (!confirm('¿Publicás este pedido a todos los transportistas de tu zona?')) return
                const { error } = await supabase.rpc('publicar_a_zona', { p_pedido_id: id })
                if (error) alert(error.message); else await cargar(true)
              }}>
                📢 Publicar a la zona
              </Button>
            </div>}
          </Card>
        )}

        {pedido.estado === 'cancelado' && (
          <Banner color="red" title="Pedido cancelado">
            Este pedido fue cancelado.
          </Banner>
        )}

        {/* Cancelar (solo lo que todavía no salió) */}
        {puedeCancelar && ok('cancelar') && (
          <Button variant="danger" onClick={() => setModalCancelar(true)} className="mt-2">
            {aceptadas.some(o => ['en_camino','descargado','finalizado'].includes(o.etapa))
              ? 'Cancelar camiones que no salieron'
              : 'Cancelar pedido'}
          </Button>
        )}
      </Body>

      {/* Modal cancelar */}
      <Modal open={!!modalAviso} onClose={() => setModalAviso(null)} title="Avisar un problema">
        <div className="text-xs text-gray-500 mb-3">
          El transportista recibe el aviso. Es informativo: no da de baja el camión.
        </div>
        <Field label="¿Qué pasó?">
          <Textarea rows={3} placeholder="Ej: el camión no se presentó a cargar"
            value={textoAviso} onChange={e => setTextoAviso(e.target.value)} />
        </Field>
        <Button onClick={enviarAviso} disabled={savingAviso || !textoAviso.trim()}>
          {savingAviso ? 'Enviando…' : 'Enviar aviso'}
        </Button>
        <Button variant="ghost" onClick={() => setModalAviso(null)} className="mt-2">Cancelar</Button>
      </Modal>

      <ModalCancelar
        open={modalCancelar}
        onClose={() => setModalCancelar(false)}
        pedidoId={id}
        rol="productor"
        onCancelado={async () => { setModalCancelar(false); await cargar(true) }}
      />

      {/* Modal elegir transportista con condiciones acordadas */}
      <Modal open={!!aceptando} onClose={() => setAceptando(null)} title="Elegir transportista">
        {aceptando && (
          <>
            <div className="text-sm font-semibold text-gray-900 mb-0.5">{nombreT(aceptando.oferta)}</div>
            <div className="text-xs text-gray-500 mb-3">
              Cargá lo que acordaron por teléfono. Queda fijo y le llega al transportista.
            </div>
            {aceptando.max > 1 && (
              <Field label={`Camiones que tomás (máx. ${aceptando.max})`}>
                <Input type="number" min="1" max={aceptando.max} value={formAcuerdo.cantidad}
                  onChange={e => setFormAcuerdo(f => ({ ...f, cantidad: e.target.value }))} />
              </Field>
            )}
            <Field label="Precio acordado">
              <Input placeholder={pedido?.tipo_actividad === 'ganadero' ? 'Ej: $1.200/km' : 'Ej: $15.000/tn'}
                value={formAcuerdo.precio} onChange={e => setFormAcuerdo(f => ({ ...f, precio: e.target.value }))} />
            </Field>
            <Field label="Forma de pago">
              <Select value={formAcuerdo.forma_pago} onChange={e => setFormAcuerdo(f => ({ ...f, forma_pago: e.target.value }))}>
                <option value="">Seleccioná</option>
                {FORMAS_PAGO.map(fp => <option key={fp}>{fp}</option>)}
              </Select>
            </Field>
            <Field label="Monto total (opcional)">
              <Input type="number" placeholder="Ej: 450000" value={formAcuerdo.monto}
                onChange={e => setFormAcuerdo(f => ({ ...f, monto: e.target.value }))} />
            </Field>
            <Field label="Otras condiciones (opcional)">
              <Textarea rows={2} placeholder="Ej: 50% al cargar, resto a 30 días"
                value={formAcuerdo.condiciones} onChange={e => setFormAcuerdo(f => ({ ...f, condiciones: e.target.value }))} />
            </Field>
            {errAcuerdo && <Banner color="red" className="mb-3">{errAcuerdo}</Banner>}
            <Button onClick={confirmarOferta} disabled={savingAcuerdo}>
              {savingAcuerdo ? 'Enviando…' : '✓ Confirmar y enviar al transportista'}
            </Button>
            <Button variant="ghost" onClick={() => setAceptando(null)} className="mt-2">Cancelar</Button>
          </>
        )}
      </Modal>


      {/* Notas privadas */}
      {(pedido.estado === 'completado' || pedido.estado === 'cancelado') && usuario && (
        <NotasPedido pedidoId={id} rol="productor" usuarioId={usuario?.id} />
      )}

      {/* Modal calificar transportista */}
      <ModalCalificar
        open={!!modalCalif}
        onClose={() => setModalCalif(null)}
        ofertaId={modalCalif?.ofertaId}
        rol="productor"
        pedidoNumero={pedido?.numero}
        obligatorio
        onCalificado={() => { setModalCalif(null); cargar(true) }}
      />

      {/* Modal kilos / doc */}
      <Modal open={modalDoc} onClose={() => setModalDoc(false)}
        title={`${documentoDe(pedido).label} — Kilos asignados`}>
        <Banner color="orange" className="mb-3">
          Ingresá los kilos de este camión {documentoDe(pedido).ayuda}.
        </Banner>
        <div className="text-xs text-gray-500 mb-3">
          🚛 {camionSeleccionado?.chasis?.dominio} / {camionSeleccionado?.acoplados?.dominio}<br/>
          👤 {camionSeleccionado?.choferes?.nombre} {camionSeleccionado?.choferes?.apellido}
        </div>
        <Field label="Kilos asignados a este camión">
          <Input type="number" placeholder="Ej: 28000"
            value={kilosInput} onChange={e => setKilosInput(e.target.value)} />
        </Field>
        <Field label={`Adjuntar ${documentoDe(pedido).label} (PDF)`}>
          <input type="file" accept=".pdf"
            onChange={e => setArchivoDoc(e.target.files?.[0] || null)}
            className="w-full text-xs text-gray-600 border border-gray-200 rounded-[10px] px-3 py-2 bg-gray-50 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-verde-50 file:text-verde-700 cursor-pointer" />
          {archivoDoc && <p className="text-[10px] text-verde-600 mt-1">📎 {archivoDoc.name}</p>}
        </Field>
        <Button onClick={guardarKilos} disabled={savingDoc || !kilosInput}>
          {savingDoc ? 'Guardando…' : 'Confirmar'}
        </Button>
        <Button variant="ghost" onClick={() => setModalDoc(false)} className="mt-2">Cancelar</Button>
      </Modal>
      <BottomTabs rol="productor" />
    </Shell>
  )
}
