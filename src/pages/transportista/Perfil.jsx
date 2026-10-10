import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Shell, { Body } from '../../components/layout/Shell'
import Topbar from '../../components/layout/Topbar'
import BottomTabs from '../../components/layout/BottomTabs'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Toggle from '../../components/ui/Toggle'
import Modal from '../../components/ui/Modal'
import Field, { Input, Select } from '../../components/ui/Field'
import Banner from '../../components/ui/Banner'
import { PROVINCIAS, VEHICULOS, TIPOS_CHASIS, TIPOS_REMOLQUE } from '../../utils/constants'
import LocalidadInput from '../../components/ui/LocalidadInput'
import { formatCuit } from '../../utils/format'
import Contador from '../../components/ui/Contador'
import { validarCuit, validarDni } from '../../utils/validaciones'
import Flota from '../../components/transportista/Flota'

const INIT_CHASIS   = { dominio: '', tipo: 'solo_chasis', tara_kg: '' }
const INIT_ACOPLADO = { dominio: '', tipo: '', tara_kg: '', capacidad_kg: '', seguro_poliza: '' }
const INIT_CHOFER   = { nombre: '', apellido: '', dni: '', cuit: '', carnet: '' }

export default function PerfilTransp() {
  const { usuario, cuenta, setRol, signOut, cargarUsuario } = useAuth()
  const navigate = useNavigate()
  const esMaster = cuenta?.permiso === 'master'
  const [transp, setTransp]           = useState(null)
  const [chasis, setChasis]           = useState([])
  const [acoplados, setAcoplados]     = useState([])
  const [choferes, setChoferes]       = useState([])
  const [notifEmail, setNotifEmail]   = useState(true)
  const [notifWA, setNotifWA]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [editPerfil, setEditPerfil]   = useState(false)
  const [formPerfil, setFormPerfil]   = useState({})

  // Modales
  const [modalChasis,   setModalChasis]   = useState(false)
  const [modalAcoplado, setModalAcoplado] = useState(false)
  const [modalChofer,   setModalChofer]   = useState(false)
  const [editandoId,    setEditandoId]    = useState(null)
  const [formChasis,    setFormChasis]    = useState(INIT_CHASIS)
  const [formAcoplado,  setFormAcoplado]  = useState(INIT_ACOPLADO)
  const [formChofer,    setFormChofer]    = useState(INIT_CHOFER)

  useEffect(() => {
    if (!usuario) return
    cargarTodo()
    setFormPerfil({
      nombre: usuario.nombre || '', apellido: usuario.apellido || '',
      razon_social: cuenta?.razon_social || '', telefono: usuario.telefono || '', domicilio: cuenta?.domicilio || '',
      localidad: cuenta?.localidad || '', provincia: cuenta?.provincia || '',
    })
  }, [usuario])

  async function cargarTodo() {
    const { data: t } = await supabase.from('transportistas').select('*').eq('cuenta_id', cuenta?.id).single()
    setTransp(t)
    if (t) {
      setNotifEmail(t.notif_email)
      setNotifWA(t.notif_whatsapp)
      const [{ data: ch }, { data: ac }, { data: cho }] = await Promise.all([
        supabase.from('chasis').select('*').eq('transportista_id', t.id).order('dominio'),
        supabase.from('acoplados').select('*').eq('transportista_id', t.id).order('dominio'),
        supabase.from('choferes').select('*').eq('transportista_id', t.id).order('apellido'),
      ])
      setChasis(ch || [])
      setAcoplados(ac || [])
      setChoferes(cho || [])
    }
  }

  async function guardarNotif(campo, v) {
    await supabase.from('transportistas').update({ [campo]: v }).eq('cuenta_id', cuenta?.id)
  }

  const guardarPerfil = async () => {
    setSaving(true)
    const { nombre, apellido, telefono } = formPerfil
    await supabase.from('usuarios').update({ nombre, apellido, telefono }).eq('id', usuario.id)
    if (esMaster) {
      const { error } = await supabase.rpc('actualizar_empresa', {
        p_cuenta: cuenta.id, p_razon_social: formPerfil.razon_social, p_domicilio: formPerfil.domicilio,
        p_localidad: formPerfil.localidad, p_provincia: formPerfil.provincia,
      })
      if (error) alert(error.message)
    }
    await cargarUsuario(usuario.id)
    setSaving(false); setEditPerfil(false)
  }

  // Chasis
  const abrirChasis = (c = null) => {
    setEditandoId(c?.id || null)
    setFormChasis(c ? { dominio: c.dominio, tipo: c.tipo || 'solo_chasis', tara_kg: c.tara_kg || '' } : INIT_CHASIS)
    setError(''); setModalChasis(true)
  }
  const guardarChasis = async () => {
    if (!formChasis.dominio) { setError('Ingresá el dominio'); return }
    if (!formChasis.tara_kg) { setError('Ingresá la tara (la necesita el productor para la CPE / DT-e)'); return }
    setSaving(true)
    const data = { dominio: formChasis.dominio, tipo: formChasis.tipo, tara_kg: Number(formChasis.tara_kg) }
    if (editandoId) await supabase.from('chasis').update(data).eq('id', editandoId)
    else await supabase.from('chasis').insert({ ...data, transportista_id: transp.id })
    await cargarTodo(); setModalChasis(false); setSaving(false)
  }

  // Acoplados
  const abrirAcoplado = (a = null) => {
    setEditandoId(a?.id || null)
    setFormAcoplado(a ? { dominio: a.dominio, tipo: a.tipo || '', tara_kg: a.tara_kg || '', capacidad_kg: a.capacidad_kg || '', seguro_poliza: a.seguro_poliza || '' } : INIT_ACOPLADO)
    setError(''); setModalAcoplado(true)
  }
  const guardarAcoplado = async () => {
    if (!formAcoplado.dominio) { setError('Ingresá el dominio'); return }
    if (!formAcoplado.tipo) { setError('Elegí el tipo'); return }
    if (!formAcoplado.tara_kg) { setError('Ingresá la tara (la necesita el productor para la CPE / DT-e)'); return }
    setSaving(true)
    const data = { ...formAcoplado, transportista_id: transp.id,
      tara_kg: formAcoplado.tara_kg ? Number(formAcoplado.tara_kg) : null,
      capacidad_kg: formAcoplado.capacidad_kg ? Number(formAcoplado.capacidad_kg) : null,
      tipo: formAcoplado.tipo || null,
    }
    if (editandoId) await supabase.from('acoplados').update(data).eq('id', editandoId)
    else await supabase.from('acoplados').insert(data)
    await cargarTodo(); setModalAcoplado(false); setSaving(false)
  }

  // Choferes
  const abrirChofer = (c = null) => {
    setEditandoId(c?.id || null)
    setFormChofer(c ? { nombre: c.nombre, apellido: c.apellido, dni: c.dni, cuit: c.cuit, carnet: c.carnet } : INIT_CHOFER)
    setError(''); setModalChofer(true)
  }
  const guardarChofer = async () => {
    const errDni = validarDni(formChofer.dni)
    if (errDni) { setError(errDni); return }
    const errCuit = validarCuit(formChofer.cuit)
    if (errCuit) { setError(errCuit); return }
    if (!formChofer.nombre || !formChofer.apellido || !formChofer.dni || !formChofer.cuit || !formChofer.carnet)
      { setError('Completá todos los campos'); return }
    setSaving(true)
    if (editandoId) await supabase.from('choferes').update(formChofer).eq('id', editandoId)
    else await supabase.from('choferes').insert({ ...formChofer, transportista_id: transp.id })
    await cargarTodo(); setModalChofer(false); setSaving(false)
  }

  const toggleItem = async (tabla, id, activo) => {
    await supabase.from(tabla).update({ activo: !activo }).eq('id', id)
    await cargarTodo()
  }

  const initials = usuario ? `${usuario.nombre?.[0] || ''}${usuario.apellido?.[0] || ''}`.toUpperCase() : '?'

  return (
    <Shell>
      <Topbar accent="azul" />
      <Body>
        {/* Avatar */}
        <div className="text-center py-4 mb-2">
          <div className="w-16 h-16 rounded-full bg-azul-50 border-[3px] border-azul-600 flex items-center justify-center text-xl font-bold text-azul-800 mx-auto mb-2">{initials}</div>
          <div className="text-base font-bold text-gray-900">{usuario?.nombre} {usuario?.apellido}</div>
          <div className="text-xs text-gray-400">CUIT: {formatCuit(cuenta?.cuit || '')}</div>
          <div className="flex justify-center gap-2 mt-2">
            <span className="bg-azul-50 text-azul-600 border border-azul-100 text-[10px] font-semibold px-2 py-0.5 rounded-full">🚛 Transportista</span>
            <button onClick={() => { setRol(null); navigate('/roles') }} className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-0.5 rounded-full">Cambiar rol</button>
          </div>
          <Contador usuarioId={usuario?.id} rol="transportista" className="mt-2" />
        </div>

        {/* Localidad base (define "Mi zona") */}
        <Card className="mb-3">
          <div className="text-sm font-semibold text-gray-900 mb-1">📍 Localidad base</div>
          <div className="text-xs text-gray-500 mb-2">
            Define los pedidos que ves en <b>Mi zona</b> y los avisos que recibís. Para otras zonas usá <b>Buscar</b> en Disponibles.
          </div>
          <div className="text-sm font-semibold text-azul-700">
            {usuario?.localidad ? `${usuario.localidad}, ${usuario.provincia}` : 'Sin cargar — tocá Editar en Mis datos'}
          </div>
        </Card>

        {/* Mis datos */}
        <Card className="mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-900">Mis datos</div>
            <button onClick={() => setEditPerfil(e => !e)} className="text-xs text-azul-600 font-semibold">{editPerfil ? 'Cancelar' : 'Editar'}</button>
          </div>
          {editPerfil ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Nombre"><Input value={formPerfil.nombre} onChange={e => setFormPerfil(f => ({...f, nombre: e.target.value}))} /></Field>
                <Field label="Apellido"><Input value={formPerfil.apellido} onChange={e => setFormPerfil(f => ({...f, apellido: e.target.value}))} /></Field>
              </div>
              <Field label="Teléfono"><Input value={formPerfil.telefono} onChange={e => setFormPerfil(f => ({...f, telefono: e.target.value}))} /></Field>
              {esMaster ? <>
              <div className="text-[11px] font-semibold text-gray-400 mt-2 mb-1">DATOS DE LA EMPRESA</div>
              <Field label="Razón social"><Input value={formPerfil.razon_social || ''} onChange={e => setFormPerfil(f => ({...f, razon_social: e.target.value}))} /></Field>
              <Field label="Domicilio"><Input value={formPerfil.domicilio} onChange={e => setFormPerfil(f => ({...f, domicilio: e.target.value}))} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Localidad base">
                  <LocalidadInput value={formPerfil.localidad}
                    onChange={v => setFormPerfil(f => ({...f, localidad: v}))}
                    onSelect={o => setFormPerfil(f => ({...f, localidad: o.localidad, provincia: o.provincia}))} />
                </Field>
                <Field label="Provincia"><Select value={formPerfil.provincia} onChange={e => setFormPerfil(f => ({...f, provincia: e.target.value}))}>{PROVINCIAS.map(p => <option key={p}>{p}</option>)}</Select></Field>
              </div>
              </> : (
                <p className="text-[11px] text-gray-400 mb-2">Los datos de la empresa los edita un usuario master.</p>
              )}
              <Button onClick={guardarPerfil} disabled={saving} className="mt-1">{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
            </>
          ) : (
            [['Teléfono', usuario?.telefono], ['Email', usuario?.email], ['Domicilio', cuenta?.domicilio], ['Localidad', cuenta?.localidad], ['Provincia', cuenta?.provincia]].map(([label, val]) => val ? (
              <div key={label} className="flex items-start py-2 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
                <span className="text-xs font-medium text-gray-800 flex-1">{val}</span>
                {label === 'Teléfono' && (
                  <a href={`https://wa.me/54${val.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                    className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
                    💬 WA
                  </a>
                )}
              </div>
            ) : null)
          )}
        </Card>

        {/* Flota: chasis, remolques y choferes agrupados */}
        <Flota chasis={chasis} acoplados={acoplados} choferes={choferes}
          onAgregar={(t) => t === 'chasis' ? abrirChasis() : t === 'acoplados' ? abrirAcoplado() : abrirChofer()}
          onEditar={(t, x) => t === 'chasis' ? abrirChasis(x) : t === 'acoplados' ? abrirAcoplado(x) : abrirChofer(x)}
          onToggleActivo={toggleItem} />

        {/* Notificaciones */}
        <Card className="mb-3">
          <div className="text-sm font-semibold text-gray-900 mb-3">Notificaciones</div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <div><div className="text-sm font-medium text-gray-800">📧 Email</div><div className="text-xs text-gray-400">Nuevos pedidos disponibles</div></div>
            <Toggle value={notifEmail} onChange={v => { setNotifEmail(v); guardarNotif('notif_email', v) }} />
          </div>
          <div className="flex items-center justify-between py-2">
            <div><div className="text-sm font-medium text-gray-800">💬 WhatsApp</div><div className="text-xs text-gray-400">Alertas inmediatas</div></div>
            <Toggle value={notifWA} onChange={v => { setNotifWA(v); guardarNotif('notif_whatsapp', v) }} />
          </div>
        </Card>

        <Button variant="secondary" onClick={() => navigate('/equipo')} className="mb-2">👥 Mi equipo</Button>
        <Button variant="ghost" onClick={signOut}>Cerrar sesión</Button>
      </Body>

      {/* Modal Chasis */}
      <Modal open={modalChasis} onClose={() => setModalChasis(false)} title={editandoId ? 'Editar chasis' : 'Nuevo chasis'}>
        <Field label="Dominio del chasis"><Input placeholder="Ej: AB123CD" value={formChasis.dominio} onChange={e => setFormChasis(f => ({...f, dominio: e.target.value.toUpperCase()}))} /></Field>
        <Field label="Tipo">
          <Select value={formChasis.tipo} onChange={e => setFormChasis(f => ({...f, tipo: e.target.value}))}>
            {Object.entries(TIPOS_CHASIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Tara (kg)"><Input type="number" placeholder="Ej: 9500" value={formChasis.tara_kg} onChange={e => setFormChasis(f => ({...f, tara_kg: e.target.value}))} /></Field>
        {error && <Banner color="red" className="mb-3">{error}</Banner>}
        <Button onClick={guardarChasis} disabled={saving}>{saving ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Agregar chasis'}</Button>
        <Button variant="ghost" onClick={() => setModalChasis(false)} className="mt-2">Cancelar</Button>
      </Modal>

      {/* Modal Acoplado */}
      <Modal open={modalAcoplado} onClose={() => setModalAcoplado(false)} title={editandoId ? 'Editar remolque' : 'Nuevo remolque'}>
        <Field label="Dominio"><Input placeholder="Ej: AB123CD" value={formAcoplado.dominio} onChange={e => setFormAcoplado(f => ({...f, dominio: e.target.value.toUpperCase()}))} /></Field>
        <Field label="Tipo">
          <Select value={formAcoplado.tipo} onChange={e => setFormAcoplado(f => ({...f, tipo: e.target.value}))}>
            <option value="">Seleccioná</option>
            {Object.entries(TIPOS_REMOLQUE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tara (kg)"><Input type="number" placeholder="Ej: 8000" value={formAcoplado.tara_kg} onChange={e => setFormAcoplado(f => ({...f, tara_kg: e.target.value}))} /></Field>
          <Field label="Capacidad (kg)"><Input type="number" placeholder="Ej: 28000" value={formAcoplado.capacidad_kg} onChange={e => setFormAcoplado(f => ({...f, capacidad_kg: e.target.value}))} /></Field>
        </div>
        <Field label="Póliza de seguro"><Input placeholder="Nro. de póliza" value={formAcoplado.seguro_poliza} onChange={e => setFormAcoplado(f => ({...f, seguro_poliza: e.target.value}))} /></Field>
        {error && <Banner color="red" className="mb-3">{error}</Banner>}
        <Button onClick={guardarAcoplado} disabled={saving}>{saving ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Agregar acoplado'}</Button>
        <Button variant="ghost" onClick={() => setModalAcoplado(false)} className="mt-2">Cancelar</Button>
      </Modal>

      {/* Modal Chofer */}
      <Modal open={modalChofer} onClose={() => setModalChofer(false)} title={editandoId ? 'Editar chofer' : 'Nuevo chofer'}>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nombre"><Input placeholder="Ej: Juan" value={formChofer.nombre} onChange={e => setFormChofer(f => ({...f, nombre: e.target.value}))} /></Field>
          <Field label="Apellido"><Input placeholder="Ej: Pérez" value={formChofer.apellido} onChange={e => setFormChofer(f => ({...f, apellido: e.target.value}))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="DNI"><Input placeholder="12345678" value={formChofer.dni} onChange={e => setFormChofer(f => ({...f, dni: e.target.value.replace(/\D/g,'')}))} /></Field>
          <Field label="CUIT"><Input placeholder="20123456789" value={formChofer.cuit} onChange={e => setFormChofer(f => ({...f, cuit: e.target.value.replace(/\D/g,'')}))} /></Field>
        </div>
        <Field label="Nro. carnet habilitante"><Input placeholder="Ej: 12345678" value={formChofer.carnet} onChange={e => setFormChofer(f => ({...f, carnet: e.target.value}))} /></Field>
        {error && <Banner color="red" className="mb-3">{error}</Banner>}
        <Button onClick={guardarChofer} disabled={saving}>{saving ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Agregar chofer'}</Button>
        <Button variant="ghost" onClick={() => setModalChofer(false)} className="mt-2">Cancelar</Button>
      </Modal>

      <BottomTabs rol="transportista" />
    </Shell>
  )
}
