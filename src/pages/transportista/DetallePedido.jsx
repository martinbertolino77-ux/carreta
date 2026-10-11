import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, getMiTransportista } from '../../lib/supabase'
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
import { ESTADOS_OFERTA, ETAPAS_TRANSPORTISTA, CATEGORIAS_HACIENDA } from '../../utils/constants'
import ModalCancelar from '../../components/pedidos/ModalCancelar'
import { formatNroPedido, formatFecha, formatNum } from '../../utils/format'
import { tituloPedido, iconoPedido, bgPedido, documentoDe } from '../../utils/pedido'
import { TIPOS_CHASIS, VEHICULOS, equipoDe } from '../../utils/constants'
import Condiciones from '../../components/pedidos/Condiciones'
import NotasPedido from '../../components/pedidos/NotasPedido'
import IncidenciaCard, { pideDocumento } from '../../components/pedidos/IncidenciaCard'
import MapRuta from '../../components/ui/MapRuta'
import CalifDisplay from '../../components/ui/CalifDisplay'
import ModalCalificar from '../../components/pedidos/ModalCalificar'
import { useAuth } from '../../context/AuthContext'
import { puede } from '../../utils/permisos'

export default function DetallePedidoTransp() {
  const { usuario, cuenta, cuentas, cambiarCuenta } = useAuth()
  const ok = (a) => puede(cuenta, a)
  const { id } = useParams()
  const navigate = useNavigate()
  const [pedido, setPedido] = useState(null)
  const [hacienda, setHacienda] = useState([])
  const [datosOp, setDatosOp] = useState(null)
  const [miOferta, setMiOferta] = useState(null)
  const [camionesViaje, setCamionesViaje] = useState([])
  const [transportista, setTransportista] = useState(null)
  const [chasis, setChasis] = useState([])
  const [acoplados, setAcoplados] = useState([])
  const [choferes, setChoferes] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [productor, setProductor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalDatosOp, setModalDatosOp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [modalCancelar, setModalCancelar] = useState(false)
  const [yaCalifique, setYaCalifique] = useState(false)

  const [formDatosOp, setFormDatosOp] = useState({
    condiciones_acordadas: '',
    forma_pago: '',
    monto_acordado: '',
  })
  const [formCamiones, setFormCamiones] = useState([])
  const [modoReemplazo, setModoReemplazo] = useState(false)
  const [modalCalif, setModalCalif] = useState(false)
  const [montoFinal, setMontoFinal] = useState('')
  const [modalMonto, setModalMonto] = useState(false)
  const [modalDescarga, setModalDescarga] = useState(false)
  const [camionDescargando, setCamionDescargando] = useState(null)
  const [formDescarga, setFormDescarga] = useState({ kilos_descargados: '', humedad: '', cuerpos_extraños: '', granos_dañados: '' })
  const [modalIncidencia, setModalIncidencia] = useState(null) // camionViaje id
  const INC_VACIA = { accion:'', tipo:'rotura', descripcion:'', chasisId:'', chasisDom:'', chasisTara:'', acopladoId:'', acopladoDom:'', acopladoTara:'', choferId:'', choferNombre:'', choferCuit:'', transpCuit:'', transpNombre:'', demora:'', kilosLlegados:'' }
  const [formInc, setFormInc] = useState(INC_VACIA)
  const [modalCargado, setModalCargado] = useState(null)   // camionViaje id
  const [kilosCargados, setKilosCargados] = useState('')
  const [savingCargado, setSavingCargado] = useState(false)
  const [savingInc, setSavingInc] = useState(false)
  const [misIncidencias, setMisIncidencias] = useState([])
  const [ocupados, setOcupados] = useState([])

  useEffect(() => { cargar() }, [id, cuenta?.id])

  // Tiempo real: recargar cuando cambia el pedido o la oferta
  useEffect(() => {
    if (!id) return
    const canal = supabase.channel(`detalle-transp-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `id=eq.${id}` }, () => cargar(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ofertas', filter: `pedido_id=eq.${id}` }, () => cargar(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'camiones_viaje' }, () => cargar(true))
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [id])

  async function cargar(silencioso = false) {
    if (!silencioso) setLoading(true)

    const t = await getMiTransportista()
    setTransportista(t)

    const { data: p } = await supabase
      .from('pedidos')
      .select(`*, establecimientos(nombre, localidad, provincia, departamento, link_maps, lat, lng)`)
      .eq('id', id)
      .single()
    setPedido(p)

    // Buscar productor por separado
    if (p?.productor_id) {
      const { data: prod } = await supabase
        .from('productores')
        .select('usuario_id')
        .eq('id', p.productor_id)
        .single()
      if (prod?.usuario_id) {
        const { data: u } = await supabase
          .from('usuarios')
          .select('nombre, apellido, telefono')
          .eq('id', prod.usuario_id)
          .single()
        setProductor(u || null)
      }
    }

    if (p?.tipo_actividad === 'ganadero') {
      const { data: h } = await supabase.from('pedidos_hacienda').select('*').eq('pedido_id', id)
      setHacienda(h || [])
    }

    // Mi oferta en este pedido (etapa propia)
    let o = null
    if (t) {
      const { data } = await supabase.from('ofertas')
        .select('*').eq('pedido_id', id).eq('transportista_id', t.id).maybeSingle()
      o = data || null
    }
    // Sin oferta en esta empresa: ¿la tiene otra de mis empresas? (por ej. desde un aviso)
    if (!o && cuentas.length > 1) {
      const otras = cuentas.filter(c => c.id !== cuenta?.id).map(c => c.id)
      const { data: ot } = await supabase.from('ofertas')
        .select('id, transportistas!inner(cuenta_id)').eq('pedido_id', id)
        .in('transportistas.cuenta_id', otras).limit(1)
      if (ot?.[0] && cambiarCuenta(ot[0].transportistas.cuenta_id, true)) return
    }
    setMiOferta(o)

    let dop = null
    if (t) {
      const { data } = await supabase
        .from('datos_operativos')
        .select('*')
        .eq('pedido_id', id)
        .eq('transportista_id', t.id)
        .maybeSingle()
      dop = data || null
    }
    setDatosOp(dop)
    if (!dop) { setCamionesViaje([]); setDocumentos([]) }

    if (dop) {
      const { data: cv } = await supabase
        .from('camiones_viaje')
        .select('*, chasis(dominio, tipo, tara_kg), acoplados(dominio, tipo, tara_kg), choferes(nombre, apellido)')
        .eq('datos_operativos_id', dop.id)
      setCamionesViaje(cv || [])

      if (cv?.length) {
        const cvIds = cv.map(c => c.id)
        const { data: docs } = await supabase
          .from('documentos')
          .select('*')
          .in('camion_viaje_id', cvIds)
        setDocumentos(docs || [])
      }
    }

    if (t) {
      const [{ data: ch }, { data: ac }, { data: cho }] = await Promise.all([
        supabase.from('chasis').select('id, dominio, tipo, tara_kg').eq('transportista_id', t.id).eq('activo', true),
        supabase.from('acoplados').select('id, dominio, tipo, tara_kg').eq('transportista_id', t.id).eq('activo', true),
        supabase.from('choferes').select('id, nombre, apellido').eq('transportista_id', t.id).eq('activo', true),
      ])
      setChasis(ch || [])
      setAcoplados(ac || [])
      setChoferes(cho || [])

      // ¿Ya califiqué este viaje? (usar 'o' local, no el estado que aún no se actualizó)
    if (t && o?.id) {
      const { data: ya } = await supabase.from('calificaciones').select('id')
        .eq('oferta_id', o.id).eq('calificador_rol', 'transportista').maybeSingle()
      const calificado = !!ya
      setYaCalifique(calificado)
      // Abrir modal automáticamente si no calificó
      if (!calificado && o?.etapa === 'finalizado') setModalCalif(true)
    }

    // Incidencias activas de este pedido
    if (id) {
      const { data: incs } = await supabase.from('incidencias').select('*')
        .eq('pedido_id', id).eq('resuelta', false)
      setMisIncidencias(incs || [])
    }

    // Camiones / choferes que están En camino en otro viaje
      const { data: oc } = await supabase.rpc('recursos_ocupados')
      setOcupados(oc || [])
    }

    setLoading(false)
  }

  const descargarDoc = async (doc) => {
    // storage_path ya incluye 'documentos/' al inicio — quitarlo para el signed URL
    const path = doc.storage_path.replace(/^documentos\//, '')
    const { data } = await supabase.storage.from('documentos').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // reemplazo = true: solo agrega los camiones que faltan (datos de pago ya enviados)
  const abrirModalDatosOp = (reemplazo = false) => {
    const total = miOferta?.camiones_aceptados || 1
    const n = reemplazo ? Math.max(1, total - camionesViaje.length) : total
    setModoReemplazo(reemplazo)
    setFormCamiones(Array.from({ length: n }, () => ({ chasis_id: '', acoplado_id: '', chofer_id: '' })))
    setError('')
    setModalDatosOp(true)
  }

  const quitarCamion = async (cvId) => {
    if (!confirm('¿Quitar este camión del viaje?')) return
    const { error } = await supabase.from('camiones_viaje').delete().eq('id', cvId)
    if (error) { alert(error.message); return }
    await cargar(true)
  }

  // Motivo por el que una opción no se puede elegir
  const enViaje = (campo, valor) => {
    const o = ocupados.find(x => x[campo] === valor)
    return o ? ` (en viaje #${String(o.pedido_numero).padStart(4, '0')})` : ''
  }
  const yaUsado = (campo, valor, idx) =>
    camionesViaje.some(c => c[campo] === valor) ||
    formCamiones.some((c, i) => i !== idx && c[campo] === valor)

  const setFC = (i, k, v) => setFormCamiones(arr => arr.map((c, idx) => idx === i ? { ...c, [k]: v } : c))

  // Equipo que carga un camión del formulario (remolque, o carrocería del chasis)
  const equipoForm = (c) => {
    const ch = chasis.find(x => x.id === c.chasis_id)
    const ac = acoplados.find(x => x.id === c.acoplado_id)
    return equipoDe(ch?.tipo, ac?.tipo)
  }

  const enviarDatosOp = async () => {
    for (let i = 0; i < formCamiones.length; i++) {
      const c = formCamiones[i]
      if (!c.chasis_id || !c.acoplado_id || !c.chofer_id) { setError(`Camión ${i + 1}: completá chasis, remolque y chofer`); return }
      const eq = equipoForm(c)
      if (miOferta?.equipos?.length && !miOferta.equipos.includes(eq)) {
        setError(`Camión ${i + 1}: el equipo (${VEHICULOS[eq] || 'sin tipo'}) no coincide con lo que ofreciste (${miOferta.equipos.map(e => VEHICULOS[e] || e).join(', ')})`)
        return
      }
    }

    setSaving(true); setError('')
    try {
      let dop = datosOp
      if (!modoReemplazo) {
        // Pago y condiciones los cargó el productor al elegir: la base los completa
        const { data, error: dopErr } = await supabase.from('datos_operativos').insert({
          pedido_id: id,
          transportista_id: transportista.id,
        }).select().single()
        if (dopErr) throw dopErr
        dop = data
      }

      const camionesData = formCamiones.map(c => ({
        datos_operativos_id: dop.id,
        chasis_id: c.chasis_id,
        acoplado_id: c.acoplado_id || null,
        chofer_id: c.chofer_id,
      }))
      const { error: cvErr } = await supabase.from('camiones_viaje').insert(camionesData)
      if (cvErr) throw cvErr

      // Paso 4: pedido → Datos enviados
      const { error: rpcErr } = await supabase.rpc('marcar_datos_enviados', { p_pedido_id: id })
      if (rpcErr) throw rpcErr

      setModalDatosOp(false)
      await cargar(true)
    } catch (e) { setError(e.message); await cargar(true) }
    finally { setSaving(false) }
  }

  // Paso 6: informar descarga
  // Documento vigente del camión (los anulados por una incidencia no cuentan)
  const docVigente = (cvId) => documentos.find(d => d.camion_viaje_id === cvId && !d.anulado)
  const docLabel = documentoDe(pedido).label

  const resolverAviso = async (incId) => {
    const { error } = await supabase.rpc('resolver_aviso', { p_incidencia_id: incId })
    if (error) alert(error.message)
    await cargar(true)
  }

  const confirmarCargado = async () => {
    setSavingCargado(true)
    const { error } = await supabase.rpc('marcar_cargado', {
      p_camion_viaje_id: modalCargado,
      p_kilos: kilosCargados ? Number(kilosCargados) : null,
    })
    setSavingCargado(false)
    if (error) { alert(error.message); return }
    setModalCargado(null)
    await cargar(true)
  }

  const abrirModalDescarga = (camionId) => {
    setCamionDescargando(camionId)
    setFormDescarga({ kilos_descargados: '', humedad: '', cuerpos_extraños: '', granos_dañados: '' })
    setModalDescarga(true)
  }

  const confirmarDescarga = async () => {
    if (!formDescarga.kilos_descargados) { alert('Ingresá los kilos descargados'); return }
    const esGanadero = pedido?.tipo_actividad === 'ganadero'

    // Guardar datos de descarga
    const updateData = { kilos_descargados: Number(formDescarga.kilos_descargados) }
    if (!esGanadero) {
      if (formDescarga.humedad) updateData.humedad = Number(formDescarga.humedad)
      if (formDescarga.cuerpos_extraños) updateData.cuerpos_extraños = Number(formDescarga.cuerpos_extraños)
      if (formDescarga.granos_dañados) updateData.granos_dañados = Number(formDescarga.granos_dañados)
    }
    await supabase.from('camiones_viaje').update(updateData).eq('id', camionDescargando)

    // Informar descarga
    const { error } = await supabase.rpc('informar_descarga', { p_camion_viaje_id: camionDescargando })
    if (error) { alert(error.message); return }
    setModalDescarga(false)

    // Si todos descargaron → pedir monto final
    const doIds = (await supabase.from('datos_operativos').select('id')
      .eq('pedido_id', id).eq('transportista_id', transportista?.id)).data?.map(d => d.id) || []
    const { data: pend } = await supabase.from('camiones_viaje').select('id')
      .in('datos_operativos_id', doIds).is('fecha_descarga', null).eq('estado', 'activo')
    if (!pend?.length && ok('ver_precios')) setModalMonto(true)
    else await cargar(true)
  }

  if (loading) return (
    <Shell>
      <Topbar title="Pedido" showBack backTo="/transportista/pedidos" accent="azul" />
      <Body><p className="text-xs text-gray-400 text-center py-10">Cargando…</p></Body>
      <BottomTabs rol="transportista" />
    </Shell>
  )

  if (!pedido) return (
    <Shell>
      <Topbar title="Pedido" showBack backTo="/transportista/pedidos" accent="azul" />
      <Body><Banner color="red">No se encontró el pedido.</Banner></Body>
      <BottomTabs rol="transportista" />
    </Shell>
  )

  const etapa = miOferta?.estado === 'seleccionada' ? miOferta.etapa : null
  const est = etapa
    ? (ETAPAS_TRANSPORTISTA[etapa] || { label: etapa, color: 'gray' })
    : (ESTADOS_OFERTA[miOferta?.estado] || { label: 'Sin oferta', color: 'gray' })
  const finalizado = pedido.estado === 'completado' || etapa === 'finalizado'
  const esAgricola = pedido.tipo_actividad === 'agricola'
  const totalHacienda = hacienda.reduce((a, h) => a + h.cantidad * h.kg_por_cabeza, 0)

  return (
    <Shell>
      <Topbar title={`Pedido ${formatNroPedido(pedido.numero)}`} showBack backTo="/transportista/pedidos" accent="azul" />
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
                <Badge color={finalizado && etapa ? 'green' : est.color}>{finalizado && etapa ? 'Finalizado' : est.label}</Badge>
              </div>
              <Route
                origen={`${pedido.establecimientos?.localidad}, ${pedido.establecimientos?.provincia}`}
                destino={`${pedido.destino_localidad}, ${pedido.destino_provincia}`}
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge color="gray">🚛 {etapa ? `${miOferta.camiones_aceptados} de ${pedido.camiones_necesarios}` : pedido.camiones_necesarios} camión{pedido.camiones_necesarios > 1 ? 'es' : ''}</Badge>
                <Badge color="gray">📅 {formatFecha(pedido.fecha_entrega)}</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Oferta no activa */}
        {!etapa && miOferta && (
          <Banner color={miOferta.estado === 'en_pausa' ? 'orange' : 'red'} title={`Tu oferta: ${est.label}`} className="mb-3">
            {miOferta.estado === 'en_pausa' && 'El productor eligió otra oferta. Podés ser elegido si se libera.'}
            {miOferta.estado === 'cancelada' && 'Este viaje fue cancelado.'}
            {miOferta.estado === 'cerrada' && 'No fue elegida esta vez. Será tenida en cuenta para próximos envíos.'}
            {miOferta.estado === 'rechazada' && 'Tu oferta no fue seleccionada.'}
            {miOferta.estado === 'enviada' && 'Tu oferta está pendiente de respuesta.'}
          </Banner>
        )}

        {/* Productor */}
        {productor && (
          <Card className="mb-3">
            <div className="text-xs font-semibold text-azul-600 mb-2">Productor</div>
            <div className="text-sm font-semibold text-gray-900">
              {productor.nombre} {productor.apellido}
            </div>
            {productor.telefono && (
              <div className="text-xs text-gray-500 mt-0.5">📞 {productor.telefono}</div>
            )}
        </Card>
        )}

        {/* Origen y destino */}
        <Card className="mb-3">
          <div className="text-xs font-semibold text-azul-600 mb-2">Origen</div>
          <div className="text-sm font-semibold text-gray-900">{pedido.establecimientos?.nombre}</div>
          <div className="text-xs text-gray-500 mt-0.5">📍 {pedido.establecimientos?.localidad}, {pedido.establecimientos?.departamento}, {pedido.establecimientos?.provincia}</div>
          {pedido.establecimientos?.link_maps && (
            <a href={pedido.establecimientos.link_maps} target="_blank" rel="noreferrer" className="text-xs text-azul-600 mt-0.5 block">Ver en Maps →</a>
          )}
          <div className="border-t border-gray-100 mt-2 pt-2">
            <div className="text-xs font-semibold text-azul-600 mb-1">Destino</div>
            <div className="text-sm font-semibold text-gray-900">{pedido.destino_localidad}, {pedido.destino_provincia}</div>
            {pedido.destino_link_maps && (
              <a href={pedido.destino_link_maps} target="_blank" rel="noreferrer" className="text-xs text-azul-600 mt-0.5 block">Ver en Maps →</a>
            )}
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

        {/* Hacienda */}
        {!esAgricola && hacienda.length > 0 && (
          <Card className="mb-3">
            <div className="text-xs font-semibold text-azul-600 mb-2">Hacienda</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-left"><th className="pb-1">Categoría</th><th className="pb-1">Cabezas</th><th className="pb-1">Kg/cab.</th></tr>
              </thead>
              <tbody>
                {hacienda.map(h => (
                  <tr key={h.id} className="border-t border-gray-50">
                    <td className="py-1.5">{CATEGORIAS_HACIENDA.find(c => c.id === h.categoria)?.label}</td>
                    <td className="py-1.5 font-medium">{h.cantidad}</td>
                    <td className="py-1.5">{h.kg_por_cabeza} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 bg-gray-50 rounded-lg px-3 py-1.5 text-xs">Total: <strong>{formatNum(totalHacienda)} kg</strong></div>
          </Card>
        )}

        {/* Datos operativos */}
        {etapa === 'confirmado' && !datosOp && (
          <Banner color="orange" title="⏳ Acción requerida" className="mb-3">
            El productor aceptó {miOferta.camiones_aceptados} camión{miOferta.camiones_aceptados > 1 ? 'es' : ''} de tu oferta. Enviá los datos operativos para continuar.
          </Banner>
        )}

        {etapa === 'confirmado' && !datosOp && ok('camiones') && (
          <Button variant="azul" onClick={() => abrirModalDatosOp(false)} className="mb-3">
            📋 Enviar datos operativos
          </Button>
        )}

        {/* Faltan camiones (uno salió en otro viaje o se quitó) */}
        {etapa === 'confirmado' && datosOp && ok('camiones') && (
          <>
            <Banner color="orange" title="⚠️ Completá los camiones" className="mb-3">
              {camionesViaje.length < (miOferta?.camiones_aceptados || 1)
                ? `Faltan ${(miOferta?.camiones_aceptados || 1) - camionesViaje.length} de ${miOferta?.camiones_aceptados} camión(es). Puede que uno haya salido en otro viaje.`
                : 'Revisá los camiones y reenviá los datos.'}
            </Banner>
            {camionesViaje.length < (miOferta?.camiones_aceptados || 1) ? (
              <Button variant="azul" onClick={() => abrirModalDatosOp(true)} className="mb-3">
                🚛 Agregar camión
              </Button>
            ) : (
              <Button variant="azul" className="mb-3" onClick={async () => {
                const { error } = await supabase.rpc('marcar_datos_enviados', { p_pedido_id: id })
                if (error) alert(error.message)
                await cargar(true)
              }}>
                📋 Reenviar datos operativos
              </Button>
            )}
          </>
        )}

        {/* Condiciones acordadas (las cargó el productor al elegirte) */}
        {etapa && (miOferta?.forma_pago
          ? <Condiciones oferta={miOferta} />
          : datosOp?.forma_pago && <Condiciones oferta={datosOp} />)}

        {/* Camiones asignados */}
        {camionesViaje.length > 0 && (
          <Card className="mb-3">
            <div className="text-xs font-semibold text-azul-600 mb-2">Camiones asignados</div>
            {camionesViaje.map((cv, i) => (
              <div key={cv.id} className="border border-gray-100 rounded-[10px] p-3 mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-900">Camión {i + 1}</span>
                  {cv.estado === 'baja' ? (
                    <Badge color="gray">Baja por incidencia</Badge>
                  ) : cv.fecha_descarga ? (
                    <Badge color={cv.con_incidencia ? 'orange' : 'green'}>{cv.con_incidencia ? '⚠️ Cerrado con incidencia' : '✅ Descarga informada'}</Badge>
                  ) : !docVigente(cv.id) ? (
                    <Badge color="orange">Esperando documento</Badge>
                  ) : cv.fecha_carga ? (
                    <Badge color="blue">🚛 Cargado, en viaje</Badge>
                  ) : etapa === 'en_camino' ? (
                    <Badge color="blue">En camino a cargar</Badge>
                  ) : (
                    <Badge color="green">📄 Documento recibido</Badge>
                  )}
                </div>
                {misIncidencias.filter(inc => inc.camion_viaje_id === cv.id).map(inc => (
                  <IncidenciaCard key={inc.id} inc={inc} cv={cv} rol="transportista"
                    tieneDocumento={!!docVigente(cv.id)} docLabel={docLabel}
                    onResolver={['aviso_productor', 'reparacion', 'aviso_chofer'].includes(inc.accion) ? resolverAviso : null} />
                ))}
                <div className="text-xs text-gray-500">
                  🚛 {cv.chasis?.dominio}{cv.acoplados ? ` + ${cv.acoplados.dominio}` : ''}
                  {' · '}{VEHICULOS[equipoDe(cv.chasis?.tipo, cv.acoplados?.tipo)] || ''}
                  {(cv.chasis?.tara_kg || cv.acoplados?.tara_kg) ? ` · tara ${Number(cv.chasis?.tara_kg || 0) + Number(cv.acoplados?.tara_kg || 0)} kg` : ''}
                </div>
                {etapa === 'confirmado' && ok('camiones') && (
                  <button onClick={() => quitarCamion(cv.id)} className="text-[11px] text-red-600 font-semibold mt-0.5">
                    Quitar camión
                  </button>
                )}
                <div className="text-xs text-gray-500 mt-0.5">👤 {cv.choferes?.nombre} {cv.choferes?.apellido}</div>
                {cv.kilos_asignados && <div className="text-xs text-gray-400 mt-0.5">⚖️ {formatNum(cv.kilos_asignados)} kg</div>}
                {(() => {
                  const doc = docVigente(cv.id)
                  return doc ? (
                    <button onClick={() => descargarDoc(doc)}
                      className="mt-1.5 w-full text-xs text-azul-600 font-semibold border border-azul-200 rounded-lg px-2 py-1.5 bg-azul-50 text-left">
                      📄 Descargar {doc.tipo?.toUpperCase()} — {doc.nombre_original}
                    </button>
                  ) : null
                })()}
                {cv.estado === 'activo' && !cv.fecha_descarga && etapa === 'en_camino' && ok('camiones') && (
                  <>
                  {docVigente(cv.id) && !cv.fecha_carga && (
                    <Button size="sm" variant="azul" onClick={() => { setModalCargado(cv.id); setKilosCargados(cv.kilos_asignados || '') }} className="mt-2">
                      🚛 Cargado, salgo a destino
                    </Button>
                  )}
                  {docVigente(cv.id) && cv.fecha_carga && (
                    <Button size="sm" variant="secondary" onClick={() => abrirModalDescarga(cv.id)} className="mt-2">
                      Informar descarga
                    </Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => {
                    setFormInc({ ...INC_VACIA, accion: cv.fecha_carga ? 'transbordo_propio' : 'cambio' })
                    setModalIncidencia(cv.id)
                  }} className="mt-1">
                    ⚠ Reportar incidencia
                  </Button>
                  </>
                )}
                {cv.fecha_carga && !cv.fecha_descarga && (
                  <div className="text-xs text-azul-600 mt-1">
                    Cargado: {formatFecha(cv.fecha_carga)}{cv.kilos_cargados ? ` · ${formatNum(cv.kilos_cargados)} kg` : ''}
                  </div>
                )}
                {cv.transporte_externo && (
                  <div className="text-xs text-gray-500 mt-0.5">Transbordo a: CUIT {cv.transporte_externo}</div>
                )}
                {cv.fecha_descarga && (
                  <div className="text-xs text-verde-600 mt-1">Descargado: {formatFecha(cv.fecha_descarga)}</div>
                )}
              </div>
            ))}
          </Card>
        )}

        {etapa === 'descargado' && !finalizado && (
          <Banner color="purple" title="📦 Descarga informada">
            Esperando que el productor confirme la descarga.
          </Banner>
        )}

        {etapa && finalizado && (
          <>
            <Banner color="green" title="✅ Pedido finalizado">
              El productor confirmó la descarga. ¡Gracias por usar Carreta!
            </Banner>
            {yaCalifique && (
              <div className="text-[11px] text-verde-600 font-medium mb-2">✓ Productor calificado</div>
            )}
            <CalifDisplay pedidoId={id} className="mb-2" />
          </>
        )}

        {/* Cancelar viaje (solo Confirmado / Datos enviados) */}
        {['confirmado','datos_enviados'].includes(etapa) && !finalizado && pedido.estado !== 'cancelado' && ok('cancelar_viajes') && (
          <Button variant="danger" onClick={() => setModalCancelar(true)} className="mt-2">
            Cancelar viaje
          </Button>
        )}
      </Body>

      {/* Modal datos operativos */}
      <Modal open={modalDatosOp} onClose={() => setModalDatosOp(false)} title={modoReemplazo ? 'Agregar camión' : 'Datos operativos'}>
        {miOferta?.equipos?.length > 0 && (
          <Banner color="blue" className="mb-3">
            Ofreciste: <b>{miOferta.equipos.map(e => VEHICULOS[e] || e).join(', ')}</b>. Cada camión tiene que coincidir.
          </Banner>
        )}

        <div className="text-xs font-semibold text-azul-600 mb-2 mt-1">Camiones asignados</div>
        {chasis.length === 0 ? (
          <Banner color="orange">
            No tenés chasis cargados en tu perfil. Agregá vehículos primero.
          </Banner>
        ) : (
          formCamiones.map((c, i) => (
            <div key={i} className="border border-gray-100 rounded-[10px] p-3 mb-2">
              <div className="text-xs font-semibold text-gray-700 mb-2">Camión {i + 1}</div>
              <Field label="Chasis">
                <Select value={c.chasis_id} onChange={e => setFC(i, 'chasis_id', e.target.value)}>
                  <option value="">Seleccioná</option>
                  {chasis.map(ch => (
                    <option key={ch.id} value={ch.id} disabled={!!enViaje('chasis_id', ch.id) || yaUsado('chasis_id', ch.id, i)}>
                      {ch.dominio} · {TIPOS_CHASIS[ch.tipo] || 'Solo chasis'}{ch.tara_kg ? ` · ${ch.tara_kg} kg` : ''}{enViaje('chasis_id', ch.id)}{yaUsado('chasis_id', ch.id, i) ? ' (ya elegido)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Remolque">
                <Select value={c.acoplado_id} onChange={e => setFC(i, 'acoplado_id', e.target.value)}>
                  <option value="">Seleccioná</option>
                  {acoplados.map(a => (
                    <option key={a.id} value={a.id} disabled={!!enViaje('acoplado_id', a.id) || yaUsado('acoplado_id', a.id, i)}>
                      {a.dominio} · {VEHICULOS[a.tipo] || 'sin tipo'}{a.tara_kg ? ` · ${a.tara_kg} kg` : ''}{enViaje('acoplado_id', a.id)}{yaUsado('acoplado_id', a.id, i) ? ' (ya elegido)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Chofer">
                <Select value={c.chofer_id} onChange={e => setFC(i, 'chofer_id', e.target.value)}>
                  <option value="">Seleccioná</option>
                  {choferes.map(ch => (
                    <option key={ch.id} value={ch.id} disabled={!!enViaje('chofer_id', ch.id) || yaUsado('chofer_id', ch.id, i)}>
                      {ch.nombre} {ch.apellido}{enViaje('chofer_id', ch.id)}{yaUsado('chofer_id', ch.id, i) ? ' (ya elegido)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ))
        )}

        {error && <Banner color="red" className="mb-3">{error}</Banner>}
        <Button onClick={enviarDatosOp} disabled={saving} variant="azul">
          {saving ? 'Enviando…' : modoReemplazo ? 'Agregar y reenviar' : 'Enviar datos operativos'}
        </Button>
        <Button variant="ghost" onClick={() => setModalDatosOp(false)} className="mt-2">Cancelar</Button>
      </Modal>

      {/* Modal cancelar */}
      {/* Notas privadas */}
      {(etapa === 'finalizado' || pedido?.estado === 'cancelado') && usuario && (
        <NotasPedido pedidoId={pedido?.id} rol="transportista" usuarioId={usuario?.id} />
      )}

      <ModalCalificar
        open={modalCalif}
        onClose={() => setModalCalif(false)}
        ofertaId={miOferta?.id}
        rol="transportista"
        pedidoNumero={pedido?.numero}
        obligatorio
        onCalificado={() => { setModalCalif(false); setYaCalifique(true); cargar(true) }}
      />

      <ModalCancelar
        open={modalCancelar}
        onClose={() => setModalCancelar(false)}
        pedidoId={id}
        rol="transportista"
        onCancelado={() => { setModalCancelar(false); navigate('/transportista/pedidos') }}
      />

      {/* Modal monto final */}
      <Modal open={modalMonto} onClose={() => { setModalMonto(false); cargar(true) }} title="Monto final del viaje">
        <div className="text-xs text-gray-500 mb-3">Monto final acordado con el productor. Podés omitirlo y cargarlo después.</div>
        <Field label="Monto final ($)">
          <Input type="number" placeholder="Ej: 450000" value={montoFinal}
            onChange={e => setMontoFinal(e.target.value)} />
        </Field>
        <Button onClick={async () => {
          if (miOferta?.id && montoFinal) {
            await supabase.from('ofertas').update({ monto_final: Number(montoFinal) }).eq('id', miOferta.id)
          }
          setModalMonto(false); await cargar(true)
        }}>
          {montoFinal ? 'Guardar monto' : 'Omitir por ahora'}
        </Button>
      </Modal>

      {/* Modal incidencia */}
      {(() => {
        const cvInc = camionesViaje.find(c => c.id === modalIncidencia)
        const cargado = !!cvInc?.fecha_carga
        const acc = formInc.accion
        const set = (k, v) => setFormInc(f => ({ ...f, [k]: v }))
        const esGanadero = pedido?.tipo_actividad === 'ganadero'
        const OPCIONES = cargado
          ? [['transbordo_propio', 'Transbordo a otro camión mío'], ['transbordo_otro', 'Transbordo a otro transporte'],
             ['reparacion', 'Se repara y sigue (demora)'], ['siniestro', 'Siniestro / pérdida de carga']]
          : [['cambio', 'Mando otro camión o chofer'], ['baja', 'No tengo reemplazo: dar de baja el camión']]
        const pideEquipoFlota = acc === 'cambio' || acc === 'transbordo_propio'

        const enviar = async () => {
          if (acc === 'baja' && !window.confirm('El camión queda dado de baja y se reabre 1 lugar en el pedido para otro transportista. ¿Confirmás?')) return
          setSavingInc(true)
          const manualChasis = !formInc.chasisId
          const { error } = await supabase.rpc('reportar_incidencia', {
            p_camion_viaje_id:     modalIncidencia,
            p_accion:              acc,
            p_tipo:                formInc.tipo,
            p_descripcion:         formInc.descripcion || null,
            p_nuevo_chasis_id:     pideEquipoFlota ? (formInc.chasisId || null) : null,
            p_nuevo_chasis_dom:    (acc === 'transbordo_otro' || (pideEquipoFlota && manualChasis)) ? (formInc.chasisDom || null) : null,
            p_nuevo_chasis_tara:   (acc === 'transbordo_otro' || (pideEquipoFlota && manualChasis)) && formInc.chasisTara ? Number(formInc.chasisTara) : null,
            p_nuevo_acoplado_id:   pideEquipoFlota ? (formInc.acopladoId || null) : null,
            p_nuevo_acoplado_dom:  (acc === 'transbordo_otro' || (pideEquipoFlota && !formInc.acopladoId)) ? (formInc.acopladoDom || null) : null,
            p_nuevo_acoplado_tara: (acc === 'transbordo_otro' || (pideEquipoFlota && !formInc.acopladoId)) && formInc.acopladoTara ? Number(formInc.acopladoTara) : null,
            p_nuevo_chofer_id:     pideEquipoFlota ? (formInc.choferId || null) : null,
            p_nuevo_chofer_nombre: (acc === 'transbordo_otro' || (pideEquipoFlota && !formInc.choferId)) ? (formInc.choferNombre || null) : null,
            p_nuevo_chofer_cuit:   (acc === 'transbordo_otro' || (pideEquipoFlota && !formInc.choferId)) ? (formInc.choferCuit || null) : null,
            p_transporte_cuit:     acc === 'transbordo_otro' ? formInc.transpCuit : null,
            p_transporte_nombre:   acc === 'transbordo_otro' ? (formInc.transpNombre || null) : null,
            p_demora:              acc === 'reparacion' ? (formInc.demora || null) : null,
            p_kilos_llegados:      acc === 'siniestro' && formInc.kilosLlegados !== '' ? Number(formInc.kilosLlegados) : null,
          })
          setSavingInc(false)
          if (error) { alert(error.message); return }
          setModalIncidencia(null)
          await cargar(true)
        }

        return (
          <Modal open={!!modalIncidencia} onClose={() => setModalIncidencia(null)} title="Reportar incidencia">
            <div className="text-xs text-gray-500 mb-3">
              {cargado
                ? 'El camión ya está cargado. Elegí qué pasa con la carga.'
                : 'El camión todavía no cargó. Podés mandar otro equipo o dejar el lugar para otro transportista.'}
            </div>

            <Field label="¿Qué pasa?">
              <Select value={acc} onChange={e => set('accion', e.target.value)}>
                {OPCIONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>

            <Field label="Motivo">
              <Select value={formInc.tipo} onChange={e => set('tipo', e.target.value)}>
                <option value="rotura">Rotura mecánica</option>
                <option value="accidente">Accidente</option>
                <option value="otro">Otro</option>
              </Select>
            </Field>

            <Field label={acc === 'siniestro' || acc === 'baja' ? 'Descripción' : 'Descripción (opcional)'}>
              <Textarea rows={2} placeholder="Detallá qué ocurrió…"
                value={formInc.descripcion} onChange={e => set('descripcion', e.target.value)} />
            </Field>

            {/* Equipo propio de reemplazo */}
            {pideEquipoFlota && (<>
              {!esGanadero || acc === 'transbordo_propio' ? (<>
                <div className="text-xs font-semibold text-gray-700 mb-2 mt-2">Chasis de reemplazo</div>
                <Field label="Chasis de tu flota">
                  <Select value={formInc.chasisId} onChange={e => setFormInc(f => ({...f, chasisId: e.target.value, chasisDom:'', chasisTara:''}))}>
                    <option value="">{acc === 'cambio' ? 'Sin cambio / otro dominio (manual)' : 'Otro dominio (ingresar manualmente)'}</option>
                    {chasis.filter(c => !enViaje('chasis_id', c.id)).map(c => (
                      <option key={c.id} value={c.id}>{c.dominio} · {TIPOS_CHASIS[c.tipo] || ''}{c.tara_kg ? ` · ${c.tara_kg}kg` : ''}</option>
                    ))}
                  </Select>
                </Field>
                {!formInc.chasisId && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <Field label="Dominio"><Input placeholder="Ej: AB123CD" value={formInc.chasisDom} onChange={e => set('chasisDom', e.target.value.toUpperCase())} /></Field>
                    <Field label="Tara (kg)"><Input type="number" placeholder="Ej: 9500" value={formInc.chasisTara} onChange={e => set('chasisTara', e.target.value)} /></Field>
                  </div>
                )}
                <div className="text-xs font-semibold text-gray-700 mb-2 mt-2">Remolque de reemplazo</div>
                <Field label="Remolque de tu flota">
                  <Select value={formInc.acopladoId} onChange={e => setFormInc(f => ({...f, acopladoId: e.target.value, acopladoDom:'', acopladoTara:''}))}>
                    <option value="">Sin cambio / otro dominio (manual)</option>
                    {acoplados.filter(a => !enViaje('acoplado_id', a.id)).map(a => (
                      <option key={a.id} value={a.id}>{a.dominio} · {VEHICULOS[a.tipo] || ''}{a.tara_kg ? ` · ${a.tara_kg}kg` : ''}</option>
                    ))}
                  </Select>
                </Field>
                {!formInc.acopladoId && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <Field label="Dominio"><Input placeholder="Ej: AC456EF" value={formInc.acopladoDom} onChange={e => set('acopladoDom', e.target.value.toUpperCase())} /></Field>
                    <Field label="Tara (kg)"><Input type="number" placeholder="Ej: 7000" value={formInc.acopladoTara} onChange={e => set('acopladoTara', e.target.value)} /></Field>
                  </div>
                )}
              </>) : null}
              <div className="text-xs font-semibold text-gray-700 mb-2 mt-2">Chofer de reemplazo</div>
              <Field label="Chofer de tu flota">
                <Select value={formInc.choferId} onChange={e => setFormInc(f => ({...f, choferId: e.target.value, choferNombre:'', choferCuit:''}))}>
                  <option value="">Sin cambio / otro chofer (manual)</option>
                  {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
                </Select>
              </Field>
              {!formInc.choferId && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Field label="Nombre y apellido"><Input placeholder="Ej: Juan Pérez" value={formInc.choferNombre} onChange={e => set('choferNombre', e.target.value)} /></Field>
                  <Field label="CUIT/CUIL *"><Input placeholder="11 dígitos" maxLength={13} value={formInc.choferCuit} onChange={e => set('choferCuit', e.target.value.replace(/[^\d-]/g,''))} /></Field>
                </div>
              )}
            </>)}

            {/* Transbordo a otro transporte: todo a mano (lo pide la CPE) */}
            {acc === 'transbordo_otro' && (<>
              <div className="text-xs font-semibold text-gray-700 mb-2 mt-2">Transporte que termina el viaje</div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="CUIT *"><Input placeholder="11 dígitos" maxLength={13} value={formInc.transpCuit} onChange={e => set('transpCuit', e.target.value.replace(/[^\d-]/g,''))} /></Field>
                <Field label="Razón social"><Input placeholder="Ej: Transportes SRL" value={formInc.transpNombre} onChange={e => set('transpNombre', e.target.value)} /></Field>
                <Field label="Dominio chasis *"><Input placeholder="Ej: AB123CD" value={formInc.chasisDom} onChange={e => set('chasisDom', e.target.value.toUpperCase())} /></Field>
                <Field label="Dominio remolque"><Input placeholder="Ej: AC456EF" value={formInc.acopladoDom} onChange={e => set('acopladoDom', e.target.value.toUpperCase())} /></Field>
                <Field label="Chofer *"><Input placeholder="Nombre y apellido" value={formInc.choferNombre} onChange={e => set('choferNombre', e.target.value)} /></Field>
                <Field label="CUIT/CUIL chofer *"><Input placeholder="11 dígitos" maxLength={13} value={formInc.choferCuit} onChange={e => set('choferCuit', e.target.value.replace(/[^\d-]/g,''))} /></Field>
              </div>
              <p className="text-[11px] text-gray-400 mb-2">Vos seguís como responsable del viaje en Carreta.</p>
            </>)}

            {acc === 'reparacion' && (
              <Field label="Demora estimada">
                <Input placeholder="Ej: 4 horas, mañana a la mañana" value={formInc.demora} onChange={e => set('demora', e.target.value)} />
              </Field>
            )}

            {acc === 'siniestro' && (
              <Field label="Kilos que llegaron a destino *" hint="0 si no llegó nada. El camión queda cerrado con incidencia.">
                <Input type="number" placeholder="Ej: 0" value={formInc.kilosLlegados} onChange={e => set('kilosLlegados', e.target.value)} />
              </Field>
            )}

            {acc === 'baja' && (
              <Banner color="orange" className="mb-3">
                El camión queda dado de baja y se reabre 1 lugar en el pedido para que oferte otro transportista. Tus otros camiones siguen igual.
              </Banner>
            )}

            {pideDocumento({ accion: acc }) && (
              <p className="text-[11px] text-gray-500 mb-2">El productor va a recibir un aviso para emitir el {docLabel} nuevo.</p>
            )}

            <Button onClick={enviar} disabled={savingInc || !acc}>
              {savingInc ? 'Enviando…' : 'Enviar incidencia'}
            </Button>
            <Button variant="ghost" onClick={() => setModalIncidencia(null)} className="mt-2">Cancelar</Button>
          </Modal>
        )
      })()}

      {/* Modal cargado */}
      <Modal open={!!modalCargado} onClose={() => setModalCargado(null)} title="Cargado, salgo a destino">
        <div className="text-xs text-gray-500 mb-3">
          Avisale al productor que el camión ya cargó y sale a destino.
        </div>
        <Field label="Kilos cargados (opcional)">
          <Input type="number" placeholder="Ej: 30000" value={kilosCargados} onChange={e => setKilosCargados(e.target.value)} />
        </Field>
        <Button onClick={confirmarCargado} disabled={savingCargado}>
          {savingCargado ? 'Guardando…' : '✓ Confirmar'}
        </Button>
        <Button variant="ghost" onClick={() => setModalCargado(null)} className="mt-2">Cancelar</Button>
      </Modal>

      <BottomTabs rol="transportista" />

      {/* Modal informar descarga */}
      <Modal open={modalDescarga} onClose={() => setModalDescarga(false)} title="Informar descarga">
        <div className="text-xs text-gray-500 mb-4">
          Completá los datos de la descarga. Los kilos son obligatorios.
        </div>
        <Field label="Kilos descargados *">
          <Input type="number" placeholder="Ej: 29500"
            value={formDescarga.kilos_descargados}
            onChange={e => setFormDescarga(f => ({ ...f, kilos_descargados: e.target.value }))} />
        </Field>
        {pedido?.tipo_actividad !== 'ganadero' && (
          <>
            <Field label="Humedad % (opcional)">
              <Input type="number" step="0.1" placeholder="Ej: 13.5"
                value={formDescarga.humedad}
                onChange={e => setFormDescarga(f => ({ ...f, humedad: e.target.value }))} />
            </Field>
            <Field label="Cuerpos extraños % (opcional)">
              <Input type="number" step="0.1" placeholder="Ej: 0.5"
                value={formDescarga.cuerpos_extraños}
                onChange={e => setFormDescarga(f => ({ ...f, cuerpos_extraños: e.target.value }))} />
            </Field>
            <Field label="Granos dañados % (opcional)">
              <Input type="number" step="0.1" placeholder="Ej: 1.2"
                value={formDescarga.granos_dañados}
                onChange={e => setFormDescarga(f => ({ ...f, granos_dañados: e.target.value }))} />
            </Field>
          </>
        )}
        <Button onClick={confirmarDescarga}>Confirmar descarga</Button>
        <Button variant="ghost" onClick={() => setModalDescarga(false)} className="mt-2">Cancelar</Button>
      </Modal>

    </Shell>
  )
}
