import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import MapPicker from '../../components/ui/MapPicker'
import { useAuth } from '../../context/AuthContext'
import Shell, { Body } from '../../components/layout/Shell'
import Topbar from '../../components/layout/Topbar'
import BottomTabs from '../../components/layout/BottomTabs'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Toggle from '../../components/ui/Toggle'
import Modal from '../../components/ui/Modal'
import Field, { Input, Select } from '../../components/ui/Field'
import LocalidadInput from '../../components/ui/LocalidadInput'
import Banner from '../../components/ui/Banner'
import { PROVINCIAS } from '../../utils/constants'
import { formatCuit } from '../../utils/format'
import Contador from '../../components/ui/Contador'

const INIT_ESTAB = {
  nombre: '', domicilio: '', localidad: '',
  departamento: '', provincia: '', link_maps: '', telefono: '', whatsapp: '', lat: null, lng: null,
}

export default function Perfil() {
  const { usuario, cuenta, setRol, signOut, cargarUsuario } = useAuth()
  const navigate = useNavigate()
  const esMaster = cuenta?.permiso === 'master'
  const [establecimientos, setEstablecimientos] = useState([])
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifWA, setNotifWA] = useState(true)
  const [modalEstab, setModalEstab] = useState(false)
  const [showMapEstab, setShowMapEstab] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(INIT_ESTAB)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editPerfil, setEditPerfil] = useState(false)
  const [formPerfil, setFormPerfil] = useState({})
  const [savingPerfil, setSavingPerfil] = useState(false)

  useEffect(() => {
    if (!usuario) return
    cargarEstablecimientos()
    cargarNotif()
    setFormPerfil({
      nombre: usuario.nombre || '',
      apellido: usuario.apellido || '',
      razon_social: cuenta?.razon_social || '',
      telefono: usuario.telefono || '',
      domicilio: cuenta?.domicilio || '',
      localidad: cuenta?.localidad || '',
      provincia: cuenta?.provincia || '',
    })
  }, [usuario])

  async function cargarEstablecimientos() {
    // Solo establecimientos de ESTE productor
    const { data: prod } = await supabase.from('productores').select('id').eq('cuenta_id', cuenta?.id).maybeSingle()
    if (!prod) { setEstablecimientos([]); return }
    const { data } = await supabase
      .from('establecimientos')
      .select('*')
      .eq('productor_id', prod.id)
      .order('nombre')
    setEstablecimientos(data || [])
  }

  async function cargarNotif() {
    const { data } = await supabase
      .from('productores')
      .select('notif_email, notif_whatsapp')
      .eq('cuenta_id', cuenta?.id)
      .single()
    if (data) { setNotifEmail(data.notif_email); setNotifWA(data.notif_whatsapp) }
  }

  async function guardarNotif(campo, valor) {
    await supabase.from('productores').update({ [campo]: valor }).eq('cuenta_id', cuenta?.id)
  }

  const abrirNuevo = () => { setEditando(null); setForm(INIT_ESTAB); setError(''); setModalEstab(true) }
  const abrirEditar = (e) => {
    setEditando(e.id)
    setForm({ nombre: e.nombre, domicilio: e.domicilio, localidad: e.localidad, departamento: e.departamento, provincia: e.provincia, link_maps: e.link_maps || '', telefono: e.telefono || '', whatsapp: e.whatsapp || '', lat: e.lat || null, lng: e.lng || null })
    setError(''); setModalEstab(true)
  }
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validar = () => {
    if (!form.nombre) return 'Ingresá el nombre del establecimiento'
    if (!form.domicilio) return 'Ingresá el domicilio'
    if (!form.localidad) return 'Ingresá la localidad'
    if (!form.departamento) return 'Ingresá el departamento/partido'
    if (!form.provincia) return 'Seleccioná la provincia'
    return null
  }

  const guardarEstab = async () => {
    const err = validar(); if (err) { setError(err); return }
    setSaving(true)
    try {
      if (editando) {
        await supabase.from('establecimientos').update(form).eq('id', editando)
      } else {
        const { data: prod } = await supabase.from('productores').select('id').eq('cuenta_id', cuenta?.id).single()
        await supabase.from('establecimientos').insert({ ...form, productor_id: prod.id })
      }
      await cargarEstablecimientos(); setModalEstab(false)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const toggleActivo = async (id, activo) => {
    await supabase.from('establecimientos').update({ activo: !activo }).eq('id', id)
    await cargarEstablecimientos()
  }

  const guardarPerfil = async () => {
    setSavingPerfil(true)
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
    setSavingPerfil(false); setEditPerfil(false)
  }

  const initials = usuario ? `${usuario.nombre?.[0] || ''}${usuario.apellido?.[0] || ''}`.toUpperCase() : '?'

  return (
    <Shell>
      <Topbar accent="verde" />
      <Body>
        <div className="text-center py-4 mb-2">
          <div className="w-16 h-16 rounded-full bg-verde-50 border-[3px] border-verde-600 flex items-center justify-center text-xl font-bold text-verde-800 mx-auto mb-2">{initials}</div>
          <div className="text-base font-bold text-gray-900">{usuario?.nombre} {usuario?.apellido}</div>
          <div className="text-xs text-gray-400">CUIT: {formatCuit(cuenta?.cuit || '')}</div>
          <div className="flex justify-center gap-2 mt-2">
            <span className="bg-verde-50 text-verde-700 border border-verde-100 text-[10px] font-semibold px-2 py-0.5 rounded-full">🌱 Productor</span>
            <button onClick={() => { setRol(null); navigate('/roles') }} className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-0.5 rounded-full">Cambiar rol</button>
          </div>
          <Contador usuarioId={usuario?.id} rol="productor" className="mt-2" />
        </div>

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
              <Field label="Domicilio legal"><Input value={formPerfil.domicilio} onChange={e => setFormPerfil(f => ({...f, domicilio: e.target.value}))} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Localidad"><Input value={formPerfil.localidad} onChange={e => setFormPerfil(f => ({...f, localidad: e.target.value}))} /></Field>
                <Field label="Provincia"><Select value={formPerfil.provincia} onChange={e => setFormPerfil(f => ({...f, provincia: e.target.value}))}>{PROVINCIAS.map(p => <option key={p}>{p}</option>)}</Select></Field>
              </div>
              </> : (
                <p className="text-[11px] text-gray-400 mb-2">Los datos de la empresa los edita un usuario master.</p>
              )}
              <Button onClick={guardarPerfil} disabled={savingPerfil} className="mt-1">{savingPerfil ? 'Guardando…' : 'Guardar cambios'}</Button>
            </>
          ) : (
            [['Razón social', cuenta?.razon_social], ['Teléfono', usuario?.telefono], ['Email', usuario?.email], ['Domicilio', cuenta?.domicilio], ['Localidad', cuenta?.localidad], ['Provincia', cuenta?.provincia]].map(([label, val]) => val ? (
              <div key={label} className="flex items-start py-2 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">{label}</span>
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

        <Card className="mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-900">Mis establecimientos</div>
            <button onClick={abrirNuevo} className="text-xs text-azul-600 font-semibold">+ Agregar</button>
          </div>
          {establecimientos.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2 opacity-40">🏡</div>
              <div className="text-xs text-gray-400">No tenés establecimientos cargados</div>
              <button onClick={abrirNuevo} className="text-xs text-verde-700 font-semibold mt-1">Agregar el primero</button>
            </div>
          ) : establecimientos.map(e => (
            <div key={e.id} className="border border-gray-100 rounded-[10px] p-3 mb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">{e.nombre}</div>
                  <div className="text-xs text-gray-500 mt-0.5">📍 {e.localidad}, {e.provincia}</div>
                  {e.telefono && <div className="text-xs text-gray-400 mt-0.5">📞 {e.telefono}</div>}
                  {e.whatsapp && (
                    <a href={`https://wa.me/54${e.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                      className="text-xs text-green-600 font-medium mt-0.5 block">💬 WhatsApp</a>
                  )}
                  {e.link_maps && <a href={e.link_maps} target="_blank" rel="noreferrer" className="text-xs text-azul-600 mt-0.5 block">Ver en Maps</a>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <button onClick={() => abrirEditar(e)} className="text-xs text-azul-600 font-medium">Editar</button>
                  <Toggle value={e.activo} onChange={() => toggleActivo(e.id, e.activo)} />
                </div>
              </div>
            </div>
          ))}
        </Card>

        <Card className="mb-3">
          <div className="text-sm font-semibold text-gray-900 mb-3">Notificaciones</div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <div><div className="text-sm font-medium text-gray-800">📧 Email</div><div className="text-xs text-gray-400">Nuevas ofertas y actualizaciones</div></div>
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

      <Modal open={modalEstab} onClose={() => setModalEstab(false)} title={editando ? 'Editar establecimiento' : 'Nuevo establecimiento'}>
        <Field label="Nombre del establecimiento"><Input placeholder="Ej: La Cesira" value={form.nombre} onChange={e => setF('nombre', e.target.value)} /></Field>
        <Field label="Domicilio"><Input placeholder="Ej: Ruta 8 km 450" value={form.domicilio} onChange={e => setF('domicilio', e.target.value)} /></Field>
        <Field label="Localidad" hint="Buscá y elegí de la lista: completa departamento y provincia">
          <LocalidadInput value={form.localidad} placeholder="Ej: Diego de Alvear"
            onChange={v => setF('localidad', v)}
            onSelect={o => setForm(f => ({ ...f, localidad: o.localidad, departamento: o.departamento, provincia: o.provincia }))} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Depto./Partido"><Input placeholder="Ej: General López" value={form.departamento} onChange={e => setF('departamento', e.target.value)} /></Field>
          <Field label="Provincia"><Select value={form.provincia} onChange={e => setF('provincia', e.target.value)}><option value="">Seleccioná</option>{PROVINCIAS.map(p => <option key={p}>{p}</option>)}</Select></Field>
        </div>
        <Field label="Ubicación en mapa (opcional)">
          <button type="button" onClick={() => setShowMapEstab(true)}
            className={`w-full border rounded-[10px] px-3 py-2.5 text-sm text-left ${form.lat ? 'border-verde-400 bg-verde-50 text-gray-900' : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-400'}`}>
            {form.lat ? `📍 ${form.localidad || 'Punto seleccionado'} (${Number(form.lat).toFixed(4)}, ${Number(form.lng).toFixed(4)})` : '🗺 Marcar en el mapa…'}
          </button>
        </Field>
        {showMapEstab && (
          <MapPicker
            initialLat={form.lat || -34.6}
            initialLng={form.lng || -63.6}
            initialZoom={form.lat ? 14 : 5}
            onClose={() => setShowMapEstab(false)}
            onConfirm={o => {
              setForm(f => ({ ...f, lat: o.lat, lng: o.lng, link_maps: o.maps_url }))
              setShowMapEstab(false)
            }}
          />
        )}
        <Field label="Teléfono (opcional)"><Input placeholder="Ej: 3462 412345" value={form.telefono} onChange={e => setF('telefono', e.target.value)} /></Field>
        <Field label="WhatsApp (opcional)" hint="Número sin 0 ni 15, ej: 3462 412345"><Input placeholder="Ej: 3462 412345" value={form.whatsapp || ''} onChange={e => setF('whatsapp', e.target.value)} /></Field>
        {error && <Banner color="red" className="mb-3">{error}</Banner>}
        <Button onClick={guardarEstab} disabled={saving}>{saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar establecimiento'}</Button>
        <Button variant="ghost" onClick={() => setModalEstab(false)} className="mt-2">Cancelar</Button>
      </Modal>

      <BottomTabs rol="productor" />
    </Shell>
  )
}
