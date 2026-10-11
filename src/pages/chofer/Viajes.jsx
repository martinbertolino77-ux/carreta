import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Shell, { Body } from '../../components/layout/Shell'
import Topbar from '../../components/layout/Topbar'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Banner from '../../components/ui/Banner'
import Modal from '../../components/ui/Modal'
import Field, { Input, Textarea } from '../../components/ui/Field'
import Contacto from '../../components/pedidos/Contacto'
import { formatNroPedido, formatFecha, formatNum } from '../../utils/format'
import { tituloPedido, documentoDe } from '../../utils/pedido'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

// Pantalla del chofer: solo sus viajes, y tres acciones (cargado, problema, descarga)
const PROBLEMAS = [
  { id: 'demora',    label: '⏱ Demora' },
  { id: 'rotura',    label: '🔧 Rotura' },
  { id: 'accidente', label: '🚨 Accidente' },
  { id: 'otro',      label: '❓ Otro' },
]

function estadoViaje(v) {
  if (v.fecha_descarga) return { label: 'Descargado', color: 'green' }
  if (v.fecha_carga)    return { label: 'En viaje', color: 'blue' }
  if (v.etapa === 'en_camino' && v.documento) return { label: 'Listo para cargar', color: 'orange' }
  return { label: 'Esperando CPE', color: 'gray' }
}

export default function ViajesChofer() {
  const { cuenta, signOut } = useAuth()
  const [viajes, setViajes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cargado, setCargado] = useState(null)      // viaje para "Cargado"
  const [kilos, setKilos] = useState('')
  const [problema, setProblema] = useState(null)    // viaje para "Avisar problema"
  const [tipoProb, setTipoProb] = useState('demora')
  const [textoProb, setTextoProb] = useState('')
  const [descarga, setDescarga] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [okMsg, setOkMsg] = useState('')

  async function cargar(silencioso = false) {
    if (!silencioso) setLoading(true)
    const { data, error } = await supabase.rpc('mis_viajes_chofer')
    if (error) setError(error.message)
    setViajes(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  useEffect(() => { cargar() }, [cuenta?.id])
  useAutoRefresh(cargar, 30000)

  async function hacer(fn, msg) {
    setGuardando(true); setError(''); setOkMsg('')
    const { error } = await fn()
    setGuardando(false)
    if (error) { setError(error.message); return false }
    setOkMsg(msg)
    await cargar(true)
    return true
  }

  const descargarDoc = async (doc) => {
    const path = doc.storage_path.replace(/^documentos\//, '')
    const { data } = await supabase.storage.from('documentos').createSignedUrl(path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else setError('No se pudo abrir el documento')
  }

  const activos = viajes.filter(v => !v.fecha_descarga)
  const terminados = viajes.filter(v => v.fecha_descarga)

  const tarjeta = (v) => {
    const est = estadoViaje(v)
    const o = v.origen || {}
    const doc = documentoDe(v).label
    const maps = o.link_maps || (o.lat && o.lng ? `https://www.google.com/maps?q=${o.lat},${o.lng}` : null)
    return (
      <Card key={v.camion_viaje_id} className="mb-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div>
            <div className="text-sm font-bold text-gray-900">{tituloPedido(v)} · Pedido {formatNroPedido(v.numero)}</div>
            <div className="text-xs text-gray-500">🚛 {v.chasis}{v.acoplado ? ` + ${v.acoplado}` : ''}</div>
          </div>
          <Badge color={est.color}>{est.label}</Badge>
        </div>

        <div className="bg-gray-50 rounded-[10px] p-2.5 mb-2">
          <div className="text-[11px] text-gray-400">CARGA EN</div>
          <div className="text-sm font-semibold text-gray-900">{o.nombre || 'Establecimiento'}</div>
          <div className="text-xs text-gray-600">📍 {o.localidad}{o.provincia ? `, ${o.provincia}` : ''}</div>
          {maps && <a href={maps} target="_blank" rel="noreferrer" className="text-xs text-azul-600 font-semibold">🗺 Abrir en Maps</a>}
          <div className="text-[11px] text-gray-400 mt-2">DESCARGA EN</div>
          <div className="text-sm font-semibold text-gray-900">{v.destino_localidad}{v.destino_provincia ? `, ${v.destino_provincia}` : ''}</div>
          {v.destino_localidad && (
            <a href={`https://www.google.com/maps/search/${encodeURIComponent(`${v.destino_localidad}, ${v.destino_provincia || ''}`)}`}
              target="_blank" rel="noreferrer" className="text-xs text-azul-600 font-semibold">🗺 Abrir en Maps</a>
          )}
        </div>

        <div className="text-xs text-gray-600 mb-1">
          {v.kilos_asignados ? `⚖️ ${formatNum(v.kilos_asignados)} kg asignados` : '⚖️ Kilos a confirmar'}
          {v.fecha_entrega && ` · 📅 ${formatFecha(v.fecha_entrega)}`}
        </div>
        {v.fecha_carga && <div className="text-xs text-azul-600">🚛 Cargado: {formatFecha(v.fecha_carga)}{v.kilos_cargados ? ` · ${formatNum(v.kilos_cargados)} kg` : ''}</div>}
        {v.fecha_descarga && <div className="text-xs text-verde-700">✅ Descargado: {formatFecha(v.fecha_descarga)}</div>}

        {v.documento ? (
          <button onClick={() => descargarDoc(v.documento)}
            className="mt-2 w-full text-xs text-azul-600 font-semibold border border-azul-200 rounded-lg px-2 py-2 bg-azul-50 text-left">
            📄 Descargar {doc} — {v.documento.nombre_original}
          </button>
        ) : !v.fecha_descarga && (
          <div className="mt-2 text-xs text-gray-500">📄 Todavía no está la {doc}. Te avisamos cuando la carguen.</div>
        )}

        {(v.productor?.telefono || o.telefono) && !v.fecha_descarga && (
          <div className="mt-2">
            <div className="text-[11px] text-gray-400">Contacto para la carga · {v.productor?.nombre || v.productor?.empresa}</div>
            <Contacto telefono={o.telefono || v.productor?.telefono}
              mensaje={`Hola, soy el chofer del camión ${v.chasis} para el pedido ${formatNroPedido(v.numero)} (Carreta).`} />
          </div>
        )}

        {!v.fecha_descarga && (
          <div className="mt-3 flex flex-col gap-2">
            {v.etapa === 'en_camino' && v.documento && !v.fecha_carga && (
              <Button variant="azul" onClick={() => { setCargado(v); setKilos(v.kilos_asignados || '') }}>
                🚛 Cargado, salgo a destino
              </Button>
            )}
            {v.fecha_carga && (
              <Button variant="azul" onClick={() => setDescarga(v)}>✅ Descargué</Button>
            )}
            <Button variant="secondary" onClick={() => { setProblema(v); setTipoProb('demora'); setTextoProb('') }}>
              ⚠ Avisar un problema
            </Button>
          </div>
        )}
      </Card>
    )
  }

  return (
    <Shell>
      <Topbar title="Mis viajes" accent="azul" rol="chofer" />
      <Body>
        {cuenta?.razon_social && <div className="text-xs text-gray-400 mb-2">Chofer de {cuenta.razon_social}</div>}
        {error && <div className="bg-red-50 border border-red-200 rounded-[10px] p-2.5 text-xs text-red-700 mb-2.5">{error}</div>}
        {okMsg && <div className="bg-verde-50 border border-verde-200 rounded-[10px] p-2.5 text-xs text-verde-700 mb-2.5">{okMsg}</div>}

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-10">Cargando…</div>
        ) : activos.length === 0 && terminados.length === 0 ? (
          <Banner color="blue" title="Sin viajes asignados">
            Cuando te asignen a un camión, el viaje aparece acá y te llega un aviso.
          </Banner>
        ) : (
          <>
            {activos.map(tarjeta)}
            {terminados.length > 0 && (
              <>
                <div className="text-[11px] font-semibold text-gray-400 tracking-wide mb-1.5 mt-2">ÚLTIMOS DESCARGADOS</div>
                {terminados.map(tarjeta)}
              </>
            )}
          </>
        )}

        <button onClick={signOut} className="w-full text-xs text-gray-400 mt-4">Cerrar sesión</button>
      </Body>

      <Modal open={!!cargado} onClose={() => setCargado(null)} title="Cargado, salgo a destino">
        <Field label="Kilos cargados (opcional)">
          <Input type="number" placeholder="Ej: 30000" value={kilos} onChange={e => setKilos(e.target.value)} />
        </Field>
        <Button variant="azul" disabled={guardando} onClick={async () => {
          const ok = await hacer(() => supabase.rpc('chofer_cargado', {
            p_camion_viaje_id: cargado.camion_viaje_id, p_kilos: kilos ? Number(kilos) : null,
          }), '🚛 Listo, avisamos que saliste cargado.')
          if (ok) setCargado(null)
        }}>{guardando ? 'Guardando…' : 'Confirmar'}</Button>
        <Button variant="ghost" onClick={() => setCargado(null)} className="mt-2">Cancelar</Button>
      </Modal>

      <Modal open={!!descarga} onClose={() => setDescarga(null)} title="Informar descarga">
        <p className="text-sm text-gray-600 mb-4">¿Confirmás que el camión {descarga?.chasis} ya descargó en {descarga?.destino_localidad}?</p>
        <Button variant="azul" disabled={guardando} onClick={async () => {
          const ok = await hacer(() => supabase.rpc('chofer_descarga', { p_camion_viaje_id: descarga.camion_viaje_id }),
            '✅ Descarga informada. ¡Buen viaje de vuelta!')
          if (ok) setDescarga(null)
        }}>{guardando ? 'Guardando…' : 'Sí, descargué'}</Button>
        <Button variant="ghost" onClick={() => setDescarga(null)} className="mt-2">Cancelar</Button>
      </Modal>

      <Modal open={!!problema} onClose={() => setProblema(null)} title="Avisar un problema">
        <p className="text-xs text-gray-500 mb-2">Le avisamos a tu empresa y al productor. La oficina decide qué hacer.</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {PROBLEMAS.map(p => (
            <button key={p.id} onClick={() => setTipoProb(p.id)}
              className={`text-sm rounded-[10px] py-2 border ${tipoProb === p.id ? 'border-azul-600 bg-azul-50 text-azul-700 font-semibold' : 'border-gray-200 text-gray-600'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <Field label="¿Qué pasó?">
          <Textarea rows={3} placeholder={tipoProb === 'demora' ? 'Ej: cola en el puerto, calculo 3 horas' : 'Contá brevemente qué pasó y dónde estás'}
            value={textoProb} onChange={e => setTextoProb(e.target.value)} />
        </Field>
        <Button variant="danger" disabled={guardando || !textoProb.trim()} onClick={async () => {
          const ok = await hacer(() => supabase.rpc('chofer_avisar', {
            p_camion_viaje_id: problema.camion_viaje_id, p_tipo: tipoProb, p_descripcion: textoProb,
          }), '⚠ Aviso enviado a tu empresa y al productor.')
          if (ok) setProblema(null)
        }}>{guardando ? 'Enviando…' : 'Enviar aviso'}</Button>
        <Button variant="ghost" onClick={() => setProblema(null)} className="mt-2">Cancelar</Button>
      </Modal>
    </Shell>
  )
}
