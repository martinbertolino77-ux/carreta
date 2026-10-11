import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { puede } from '../../utils/permisos'
import Shell, { Body } from '../../components/layout/Shell'
import Topbar from '../../components/layout/Topbar'
import BottomTabs from '../../components/layout/BottomTabs'
import Button from '../../components/ui/Button'
import Field, { Input, Select, Textarea } from '../../components/ui/Field'
import Card from '../../components/ui/Card'
import Banner from '../../components/ui/Banner'
import { CEREALES, CATEGORIAS_HACIENDA, PROVINCIAS, TIPOS_CARGA, PRODUCTOS_GRANEL } from '../../utils/constants'
import LocalidadInput from '../../components/ui/LocalidadInput'
import MapPicker from '../../components/ui/MapPicker'
import { localidadesDelDepartamento, normalizar } from '../../utils/georef'
import { formatNum } from '../../utils/format'
import Contador from '../../components/ui/Contador'
import CalifDisplay from '../../components/ui/CalifDisplay'

const INIT_HACIENDA = Object.fromEntries(
  CATEGORIAS_HACIENDA.map(c => [c.id, { cantidad: '', kg_por_cabeza: '' }])
)

export default function CrearPedido() {
  const { usuario, cuenta } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const repetir = location.state?.repetir || null      // "Repetir pedido": datos del pedido anterior
  const pendVecinas = useRef(repetir?.localidades_vecinas?.length ? repetir.localidades_vecinas : null)
  const [tipo, setTipo]       = useState(repetir?.tipo_actividad || 'agricola')
  const [modo, setModo]       = useState('general')
  const [establecimientos, setEstablecimientos] = useState([])
  const [busquedaTransp, setBusquedaTransp] = useState('')
  const [transportistas, setTransportistas] = useState([])
  const [errors, setErrors]   = useState({})
  const [saving, setSaving]   = useState(false)
  const [showMapDestino, setShowMapDestino] = useState(false)

  // Campos comunes
  const [form, setForm] = useState({
    establecimiento_id: repetir?.establecimiento_id || '',
    destino_localidad: repetir?.destino_localidad || '',
    destino_provincia: repetir?.destino_provincia || '',
    destino_link_maps: repetir?.destino_link_maps || '',
    destino_direccion: repetir?.destino_direccion || '',
    destino_lat: null,
    destino_lng: null,
    camiones_necesarios: repetir?.camiones_necesarios ? String(repetir.camiones_necesarios) : '',
    fecha_entrega: '',
    observaciones: '',
    // Agrícola
    tipo_cereal: repetir?.tipo_cereal || 'soja',
    kilos_estimados: repetir?.kilos_estimados ? String(repetir.kilos_estimados) : '',
    // Otras cargas
    producto_granel: repetir?.producto_granel || 'fertilizante',
    producto_detalle: repetir?.producto_detalle || '',
    // Directo
    transportista_directo: '',
  })
  const [hacienda, setHacienda] = useState(() => {
    if (!repetir?.hacienda?.length) return INIT_HACIENDA
    const h = { ...INIT_HACIENDA }
    repetir.hacienda.forEach(x => { if (h[x.categoria]) h[x.categoria] = { cantidad: String(x.cantidad || ''), kg_por_cabeza: String(x.kg_por_cabeza || '') } })
    return h
  })
  const [vecinas, setVecinas] = useState([])          // sugeridas (mismo departamento)
  const [vecinasSel, setVecinasSel] = useState([])    // tildadas por el productor
  const [verVecinas, setVerVecinas] = useState(false)

  useEffect(() => {
    if (!usuario) return
    ;(async () => {
      // Solo establecimientos de ESTE productor
      const { data: prod } = await supabase.from('productores').select('id').eq('cuenta_id', cuenta?.id).maybeSingle()
      if (!prod) return
      const { data } = await supabase
        .from('establecimientos')
        .select('id, nombre, localidad, departamento, provincia')
        .eq('productor_id', prod.id)
        .eq('activo', true)
      setEstablecimientos(data || [])
    })()
  }, [usuario])

  // Al elegir establecimiento: sugerir localidades vecinas (mismo departamento)
  useEffect(() => {
    setVecinas([]); setVecinasSel([])
    const est = establecimientos.find(e => e.id === form.establecimiento_id)
    if (!est) return
    localidadesDelDepartamento(est.provincia, est.departamento).then(lista => {
      const l = lista.filter(n => normalizar(n) !== normalizar(est.localidad))
      setVecinas(l)
      if (pendVecinas.current) {
        const set = new Set(pendVecinas.current.map(normalizar))
        setVecinasSel(l.filter(n => set.has(normalizar(n))))
        pendVecinas.current = null
      }
    })
  }, [form.establecimiento_id, establecimientos])

  const toggleVecina = (n) =>
    setVecinasSel(v => v.includes(n) ? v.filter(x => x !== n) : [...v, n])

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (busquedaTransp.length < 3) { setTransportistas([]); return }
    const q = busquedaTransp.trim()
    supabase
      .from('usuarios')
      .select('id, nombre, apellido, razon_social, cuit, localidad, provincia')
      .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,razon_social.ilike.%${q}%,cuit.ilike.%${q}%`)
      .limit(20)
      .then(async ({ data: usuarios }) => {
        if (!usuarios?.length) { setTransportistas([]); return }
        const ids = usuarios.map(u => u.id)
        const { data: transp } = await supabase
          .from('transportistas')
          .select('id, usuario_id')
          .in('usuario_id', ids)
        if (!transp?.length) { setTransportistas([]); return }
        const merged = transp.map(t => ({
          ...t,
          usuarios: usuarios.find(u => u.id === t.usuario_id)
        }))
        setTransportistas(merged)
      })
  }, [busquedaTransp])
  const setH = (cat, field, val) => setHacienda(h => ({ ...h, [cat]: { ...h[cat], [field]: val } }))

  const totalHacienda = Object.entries(hacienda).reduce((acc, [, v]) => {
    return acc + (Number(v.cantidad) || 0) * (Number(v.kg_por_cabeza) || 0)
  }, 0)

  const validate = () => {
    const e = {}
    if (!form.establecimiento_id) e.establecimiento_id = 'Seleccioná un establecimiento'
    if (!form.destino_localidad)  e.destino_localidad  = 'Ingresá la localidad de destino'
    if (!form.destino_provincia)  e.destino_provincia  = 'Seleccioná la provincia'
    if (!form.camiones_necesarios || Number(form.camiones_necesarios) < 1)
      e.camiones_necesarios = 'Ingresá la cantidad de camiones'
    if (modo === 'directo' && !form.transportista_directo)
      e.transportista_directo = 'Seleccioná un transportista'
    if (!form.fecha_entrega)
      e.fecha_entrega = tipo === 'agricola' ? 'Ingresá la fecha de entrega a puerto (cupo ARCA)'
        : tipo === 'ganadero' ? 'Ingresá la fecha de descarga (SENASA)' : 'Ingresá la fecha de carga'
    if (tipo === 'granel' && form.producto_granel === 'otro' && !form.producto_detalle.trim())
      e.producto_detalle = 'Indicá qué producto es'
    if (tipo === 'ganadero') {
      const totalCab = Object.values(hacienda).reduce((a, v) => a + (Number(v.cantidad) || 0), 0)
      if (totalCab === 0) e.hacienda = 'Ingresá al menos una categoría de hacienda'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const guardar = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const { data: prod } = await supabase.from('productores').select('id').eq('cuenta_id', cuenta?.id).single()
      if (!prod) throw new Error('No se encontró el perfil de productor')

      const { data: pedido, error } = await supabase.from('pedidos').insert({
        productor_id: prod.id,
        tipo_actividad: tipo,
        tipo_cereal: tipo === 'agricola' ? form.tipo_cereal : null,
        establecimiento_id: form.establecimiento_id,
        destino_localidad: form.destino_localidad,
        destino_provincia: form.destino_provincia,
        destino_link_maps: form.destino_link_maps || null,
        destino_direccion: form.destino_direccion || null,
        camiones_necesarios: Number(form.camiones_necesarios),
        kilos_estimados: tipo !== 'ganadero' && form.kilos_estimados ? Number(form.kilos_estimados.replace(/\./g,'')) : null,
        producto_granel: tipo === 'granel' ? form.producto_granel : null,
        producto_detalle: tipo === 'granel' && form.producto_granel === 'otro' ? form.producto_detalle.trim() : null,
        fecha_entrega: form.fecha_entrega,
        modo_publicacion: modo,
        transportista_directo: modo === 'directo' && form.transportista_directo ? form.transportista_directo : null,
        observaciones: form.observaciones || null,
        localidades_vecinas: modo === 'general' ? vecinasSel : [],
      }).select().single()

      if (error) throw error

      // Insertar categorías de hacienda
      if (tipo === 'ganadero') {
        const cats = Object.entries(hacienda)
          .filter(([, v]) => Number(v.cantidad) > 0)
          .map(([id, v]) => ({
            pedido_id: pedido.id,
            categoria: id,
            cantidad: Number(v.cantidad),
            kg_por_cabeza: Number(v.kg_por_cabeza),
          }))
        if (cats.length) await supabase.from('pedidos_hacienda').insert(cats)
      }

      navigate('/productor/pedidos')
    } catch (e) {
      setErrors({ _: e.message })
    } finally {
      setSaving(false)
    }
  }

  if (!puede(cuenta, 'crear_pedidos')) return (
    <Shell>
      <Topbar title="Nuevo pedido" showBack backTo="/productor/pedidos" accent="verde" />
      <Body>
        <Banner color="orange" title="Sin permiso para crear pedidos">
          Tu usuario no puede crear pedidos en esta empresa. Pedíselo al master desde "Mi equipo".
        </Banner>
      </Body>
      <BottomTabs rol="productor" />
    </Shell>
  )

  return (
    <Shell>
      <Topbar title="Nuevo pedido" showBack backTo="/productor/pedidos" accent="verde" />
      <Body>
        {/* Tipo de carga */}
        <div className="flex bg-gray-100 rounded-[10px] p-1 mb-4 gap-1">
          {TIPOS_CARGA.map(({ id: t, corto }) => (
            <button key={t} onClick={() => setTipo(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                ${tipo === t ? 'bg-white text-verde-700 shadow-sm' : 'text-gray-400'}`}
            >
              {corto}
            </button>
          ))}
        </div>

        {repetir && (
          <Banner color="blue" title={`🔁 Repitiendo pedido #${String(repetir.numero).padStart(4, '0')}`} className="mb-3">
            Revisá los datos y elegí la fecha nueva.
          </Banner>
        )}

        <Card className="mb-3">
          {/* Establecimiento */}
          <Field label="Establecimiento de origen" error={errors.establecimiento_id}>
            <Select value={form.establecimiento_id} onChange={e => setF('establecimiento_id', e.target.value)} error={errors.establecimiento_id}>
              <option value="">Seleccioná un establecimiento</option>
              {establecimientos.map(e => (
                <option key={e.id} value={e.id}>{e.nombre} — {e.localidad}, {e.provincia}</option>
              ))}
            </Select>
          </Field>

          {/* Alcance: localidades vecinas (solo modo general) */}
          {modo === 'general' && form.establecimiento_id && (
            <div className="mb-3">
              <button type="button" onClick={() => setVerVecinas(v => !v)}
                className="w-full text-left text-xs font-semibold text-azul-600 bg-azul-50 border border-azul-100 rounded-[10px] px-3 py-2">
                📍 Llega a transportistas de {establecimientos.find(e => e.id === form.establecimiento_id)?.localidad}
                {vecinasSel.length > 0 && ` + ${vecinasSel.length} vecina${vecinasSel.length > 1 ? 's' : ''}`}
                <span className="float-right">{verVecinas ? '▲' : 'Sumar vecinas ▼'}</span>
              </button>
              {verVecinas && (
                <div className="border border-gray-100 rounded-[10px] mt-1 p-2 max-h-56 overflow-y-auto">
                  {vecinas.length === 0 ? (
                    <div className="text-xs text-gray-400 p-1">
                      No se encontraron localidades del mismo departamento. Revisá el departamento del establecimiento en tu Perfil.
                    </div>
                  ) : vecinas.map(n => (
                    <label key={n} className="flex items-center gap-2 py-1 text-sm text-gray-700">
                      <input type="checkbox" checked={vecinasSel.includes(n)} onChange={() => toggleVecina(n)} />
                      {n}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tipo cereal — solo agrícola */}
          {tipo === 'agricola' && (
            <Field label="Tipo de cereal">
              <Select value={form.tipo_cereal} onChange={e => setF('tipo_cereal', e.target.value)}>
                {CEREALES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </Field>
          )}

          {/* Producto — otras cargas */}
          {tipo === 'granel' && (
            <>
              <Field label="Producto">
                <Select value={form.producto_granel} onChange={e => setF('producto_granel', e.target.value)}>
                  {PRODUCTOS_GRANEL.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </Select>
              </Field>
              {form.producto_granel === 'otro' && (
                <Field label="¿Qué producto?" error={errors.producto_detalle}>
                  <Input placeholder="Ej: conchilla" value={form.producto_detalle}
                    onChange={e => setF('producto_detalle', e.target.value)} error={errors.producto_detalle} />
                </Field>
              )}
            </>
          )}

                    {/* Destino */}
          <Field label="Destino" error={errors.destino_localidad}>
            <button type="button" onClick={() => setShowMapDestino(true)}
              className={`w-full border rounded-[10px] px-3 py-2.5 text-sm text-left transition-colors ${errors.destino_localidad ? 'border-red-400 bg-red-50' : form.destino_localidad ? 'border-verde-400 bg-verde-50' : 'border-gray-200 bg-gray-50 hover:border-gray-400'}`}>
              {form.destino_localidad
                ? <span className="text-gray-900">📍 {form.destino_localidad}{form.destino_provincia ? `, ${form.destino_provincia}` : ''}</span>
                : <span className="text-gray-400">🗺 Seleccionar en el mapa…</span>}
            </button>
            {form.destino_direccion && (
              <div className="text-[10px] text-gray-400 mt-1 truncate">{form.destino_direccion}</div>
            )}
          </Field>
          {showMapDestino && (
            <MapPicker
              onClose={() => setShowMapDestino(false)}
              onConfirm={o => {
                setForm(f => ({
                  ...f,
                  destino_direccion: o.direccion,
                  destino_localidad: o.localidad || o.direccion.split(',')[0],
                  destino_provincia: o.provincia,
                  destino_lat: o.lat,
                  destino_lng: o.lng,
                  destino_link_maps: o.maps_url,
                }))
                setShowMapDestino(false)
              }}
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label="Camiones necesarios" error={errors.camiones_necesarios}>
              <Input type="number" min="1" placeholder="Ej: 3" value={form.camiones_necesarios}
                onChange={e => setF('camiones_necesarios', e.target.value)} error={errors.camiones_necesarios} />
            </Field>
            {tipo !== 'ganadero' && (
              <Field label="Kilos aprox. (informativo)">
                <Input placeholder="Ej: 90.000" value={form.kilos_estimados}
                  onChange={e => setF('kilos_estimados', e.target.value)} />
              </Field>
            )}
          </div>
        </Card>

        {/* Tabla hacienda */}
        {tipo === 'ganadero' && (
          <Card className="mb-3">
            <div className="text-xs font-semibold text-azul-600 mb-3">Categorías y cantidades</div>
            {errors.hacienda && <p className="text-xs text-red-600 mb-2">{errors.hacienda}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400 font-semibold uppercase tracking-wide">
                    <th className="pb-2">Categoría</th>
                    <th className="pb-2">Cabezas</th>
                    <th className="pb-2">Kg/cab.</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIAS_HACIENDA.map(cat => (
                    <tr key={cat.id} className="border-t border-gray-100">
                      <td className="py-1.5 pr-2 text-gray-700">{cat.label}</td>
                      <td className="py-1.5 pr-2">
                        <input type="number" min="0" placeholder="0"
                          value={hacienda[cat.id].cantidad}
                          onChange={e => setH(cat.id,'cantidad',e.target.value)}
                          className="w-16 border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-verde-600" />
                      </td>
                      <td className="py-1.5">
                        <input type="number" min="0" placeholder="kg"
                          value={hacienda[cat.id].kg_por_cabeza}
                          onChange={e => setH(cat.id,'kg_por_cabeza',e.target.value)}
                          className="w-16 border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-verde-600" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalHacienda > 0 && (
              <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
                Total estimado: <strong>{formatNum(totalHacienda)} kg</strong>
              </div>
            )}
          </Card>
        )}

        {/* Modo de publicación */}
        <div className="mb-3">
          <div className="text-xs font-semibold text-gray-700 mb-2">¿Cómo querés publicar?</div>
          {[
            { id:'general', icon:'🌐', label:'Publicación general', desc:'Todos los transportistas de tu zona reciben notificación y pueden ofertar' },
            { id:'directo', icon:'🎯', label:'Directo a transportista', desc:'Elegís vos a quién le mandás el pedido' },
          ].map(m => (
            <button key={m.id} onClick={() => setModo(m.id)} type="button"
              className={`w-full text-left border-[1.5px] rounded-[10px] px-3.5 py-2.5 mb-2 transition-all
                ${modo === m.id ? 'border-verde-600 bg-verde-50' : 'border-gray-200 bg-white'}`}
            >
              <div className="text-sm font-semibold text-gray-900">{m.icon} {m.label}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{m.desc}</div>
            </button>
          ))}
        </div>

        {/* Transportista directo */}
        {modo === 'directo' && (
          <Card className="mb-3">
            <Field label="Buscar transportista" error={errors.transportista_directo}>
              <Input
                placeholder="Nombre, razón social o CUIT (mín. 3 caracteres)"
                value={busquedaTransp}
                onChange={e => { setBusquedaTransp(e.target.value); setF('transportista_directo', '') }}
                error={errors.transportista_directo}
              />
            </Field>
            {transportistas.length > 0 && !form.transportista_directo && (
              <div className="border border-gray-200 rounded-[10px] overflow-hidden mt-1">
                {transportistas.filter(t => t.usuarios).map(t => {
                  const u = t.usuarios
                  const label = u.razon_social || `${u.nombre || ''} ${u.apellido || ''}`.trim()
                  return (
                    <button key={t.id} type="button"
                      onClick={() => { setF('transportista_directo', t.id); setBusquedaTransp(label) }}
                      className="w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 last:border-0 hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">{label}</div>
                      {u.cuit && <div className="text-xs text-gray-400">CUIT: {u.cuit}</div>}
                      {u.localidad && <div className="text-xs text-gray-400">📍 {u.localidad}, {u.provincia}</div>}
                      <Contador usuarioId={t.usuario_id} rol="transportista" className="mt-0.5" />
                      <CalifDisplay transportistaId={t.id} className="mt-0.5" />
                    </button>
                  )
                })}
              </div>
            )}
            {form.transportista_directo && (
              <div className="mt-1 flex items-center justify-between bg-verde-50 border border-verde-200 rounded-[10px] px-3 py-2">
                <span className="text-sm text-verde-800 font-medium">✓ {busquedaTransp}</span>
                <button type="button" onClick={() => { setF('transportista_directo', ''); setBusquedaTransp('') }}
                  className="text-xs text-gray-400 hover:text-red-500">Cambiar</button>
              </div>
            )}
          </Card>
        )}

        {/* Observaciones */}
        <Card className="mb-4">
          <Field label='Fecha de descarga' error={errors.fecha_entrega}>
            <Input type="date" value={form.fecha_entrega}
              onChange={e => setF('fecha_entrega', e.target.value)} error={errors.fecha_entrega} />

          </Field>

          <Field label="Observaciones (opcional)">
            <Textarea rows={2} placeholder="Información adicional para el transportista..."
              value={form.observaciones} onChange={e => setF('observaciones', e.target.value)} />
          </Field>
        </Card>

        {errors._ && <Banner color="red" className="mb-3">{errors._}</Banner>}

        <Button onClick={guardar} disabled={saving}>
          {saving ? 'Publicando…' : 'Publicar pedido'}
        </Button>
        <Button variant="ghost" onClick={() => navigate('/productor/pedidos')} className="mt-2">
          Cancelar
        </Button>
      </Body>
      <BottomTabs rol="productor" />
    </Shell>
  )
}
