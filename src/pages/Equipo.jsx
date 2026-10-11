import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Shell, { Body } from '../components/layout/Shell'
import Topbar from '../components/layout/Topbar'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { ACCIONES, puede, limitado } from '../utils/permisos'
import { formatCuit } from '../utils/format'

// master: administra todo · operador: opera, no administra el equipo · lectura: solo ve
const PERMISOS = [
  { id: 'operador', label: 'Operador' },
  { id: 'lectura',  label: 'Solo lectura' },
  { id: 'master',   label: 'Master' },
]
const COLOR_PERMISO = { master: 'purple', operador: 'blue', lectura: 'gray', chofer: 'orange' }
const NOMBRE_PERMISO = { master: 'Master', operador: 'Operador', lectura: 'Solo lectura', chofer: 'Chofer' }

// Acciones que aplican a la empresa (según sus roles), sin repetir "ver precios"
function accionesDe(roles = []) {
  const vistas = new Set()
  return [...(roles.includes('productor') ? ACCIONES.productor : []), ...(roles.includes('transportista') ? ACCIONES.transportista : [])]
    .filter(a => !vistas.has(a.id) && vistas.add(a.id))
}

// Qué puede hacer cada permiso, en nombre de la empresa (para avisar antes de darlo)
function alcance(permiso, roles = [], permisos = {}) {
  if (permiso === 'chofer') return {
    puede: ['ver solo los viajes donde está asignado (origen, destino, kilos, CPE y contacto)', 'marcar cargado e informar la descarga', 'avisar problemas en el viaje'],
    nota: 'No ve precios, ni otros viajes, ni la flota, ni el equipo.',
  }
  if (permiso === 'operador') {
    const c = { permiso: 'operador', permisos }
    const lista = accionesDe(roles)
    const no = lista.filter(a => !puede(c, a.id)).map(a => a.label.toLowerCase())
    return {
      puede: lista.filter(a => puede(c, a.id)).map(a => a.label.toLowerCase()),
      nota: 'No puede administrar el equipo ni cambiar los datos de la empresa.' + (no.length ? ` Tampoco: ${no.join(', ')}.` : ''),
    }
  }
  const prod = roles.includes('productor'), transp = roles.includes('transportista')
  const opera = [
    ...(prod ? ['publicar, modificar y cancelar pedidos', 'aceptar ofertas y comprometer a la empresa con transportistas'] : []),
    ...(transp ? ['ofertar y aceptar viajes', 'cargar y dar de baja camiones y choferes', 'subir documentos (CPE) e informar incidencias'] : []),
  ]
  if (permiso === 'master') return {
    puede: [...opera, 'editar los datos de la empresa', 'invitar, cambiar permisos y quitar integrantes'],
    nota: 'Tiene el mismo control que vos: también puede cambiarte el permiso o quitarte (salvo al titular original). Dalo solo a alguien de total confianza.',
  }
  return {
    puede: opera,
    nota: 'No puede administrar el equipo ni cambiar los datos de la empresa.',
  }
}

const fecha = (d) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })

export default function Equipo() {
  const { usuario, cuenta, rol, cargarUsuario } = useAuth()
  const esMaster = cuenta?.permiso === 'master'

  const [miembros, setMiembros]       = useState([])
  const [editPerm, setEditPerm]       = useState(null)   // { titulo, permisos, guardar }
  const [invPermisos, setInvPermisos] = useState({})
  const [solicitudes, setSolicitudes] = useState([])
  const [invitaciones, setInvitaciones] = useState([])
  const [permisoSol, setPermisoSol]   = useState({})       // id solicitud → permiso elegido
  const [ocupado, setOcupado]         = useState(null)
  const [error, setError]             = useState('')

  const [invEmail, setInvEmail]       = useState('')
  const [invPermiso, setInvPermiso]   = useState('operador')
  const [invChofer, setInvChofer]     = useState('')
  const [choferes, setChoferes]       = useState([])    // choferes de la flota (para invitar como chofer)
  const esTransporte = (cuenta?.roles || []).includes('transportista')
  const opciones = esTransporte ? [...PERMISOS, { id: 'chofer', label: 'Chofer' }] : PERMISOS
  const [linkInv, setLinkInv]         = useState(null)
  const [copiado, setCopiado]         = useState(false)
  const [mail, setMail]               = useState(null)   // estado del mail de la invitación: enviando / ok / error
  const [aviso, setAviso]             = useState(null)   // { permiso, quien, accion, seguir }

  // Antes de dar master u operador: mostrar qué va a poder hacer
  const confirmarPermiso = (permiso, quien, accion, seguir) => {
    if (permiso === 'lectura') return seguir()
    setAviso({ permiso, quien, accion, seguir })
  }

  async function cargar() {
    if (!cuenta) return
    const { data: m } = await supabase.rpc('equipo_miembros', { p_cuenta: cuenta.id })
    // permisos a medida de cada integrante
    const { data: pm } = await supabase.from('miembros').select('usuario_id, permisos, chofer_id').eq('cuenta_id', cuenta.id)
    const porUsuario = Object.fromEntries((pm || []).map(x => [x.usuario_id, x]))
    setMiembros((m || []).map(x => ({ ...x, permisos: porUsuario[x.usuario_id]?.permisos || {}, chofer_id: porUsuario[x.usuario_id]?.chofer_id })))
    if (esTransporte) {
      const { data: tr } = await supabase.from('transportistas').select('id').eq('cuenta_id', cuenta.id)
      const ids = (tr || []).map(t => t.id)
      if (ids.length) {
        const { data: ch } = await supabase.from('choferes').select('id, nombre, apellido, activo')
          .in('transportista_id', ids).order('apellido')
        setChoferes(ch || [])
      }
    }
    if (esMaster) {
      const [{ data: s }, { data: i }] = await Promise.all([
        supabase.rpc('equipo_solicitudes', { p_cuenta: cuenta.id }),
        supabase.from('invitaciones').select('id, email, permiso, permisos, token, vence_en')
          .eq('cuenta_id', cuenta.id).is('aceptada_en', null).order('created_at', { ascending: false }),
      ])
      setSolicitudes(s || [])
      setInvitaciones(i || [])
    }
  }

  useEffect(() => {
    cargar()
    if (!cuenta || !esMaster) return
    // Tiempo real: llega un pedido de acceso nuevo
    const sub = supabase.channel(`equipo-${cuenta.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'solicitudes_acceso', filter: `cuenta_id=eq.${cuenta.id}`,
      }, () => cargar())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [cuenta?.id, esMaster])

  async function ejecutar(clave, fn) {
    setOcupado(clave); setError('')
    const { error } = await fn()
    if (error) setError(error.message)
    await cargar()
    setOcupado(null)
    return !error
  }

  const resolver = (s, aprobar) => {
    if (!aprobar && !window.confirm(`¿Rechazar el pedido de ${s.nombre} ${s.apellido}?`)) return
    const permiso = permisoSol[s.id] || 'operador'
    const hacer = () => ejecutar(`sol-${s.id}`, () => supabase.rpc('resolver_solicitud', {
      p_id: s.id, p_aprobar: aprobar, p_permiso: permiso,
    }))
    if (!aprobar) return hacer()
    confirmarPermiso(permiso, `${s.nombre} ${s.apellido}`, 'Aprobar', hacer)
  }

  const cambiarPermiso = (m, permiso) => {
    const sube = permiso === 'master' || (permiso === 'operador' && m.permiso === 'lectura')
    if (!sube) return aplicarPermiso(m, permiso)
    confirmarPermiso(permiso, `${m.nombre} ${m.apellido}`, 'Cambiar permiso', () => aplicarPermiso(m, permiso))
  }

  const aplicarPermiso = async (m, permiso) => {
    const ok = await ejecutar(`perm-${m.usuario_id}`, () => supabase.rpc('cambiar_permiso', {
      p_cuenta: cuenta.id, p_usuario: m.usuario_id, p_permiso: permiso,
    }))
    if (ok && m.usuario_id === usuario.id) cargarUsuario(usuario.id)  // me cambié a mí mismo
  }

  const quitar = (m) => {
    if (!window.confirm(`¿Quitar a ${m.nombre} ${m.apellido} del equipo? No va a poder operar más en esta cuenta.`)) return
    ejecutar(`quitar-${m.usuario_id}`, () => supabase.rpc('quitar_miembro', { p_cuenta: cuenta.id, p_usuario: m.usuario_id }))
  }

  const linkDe = (token) => `${window.location.origin}/registro?inv=${token}`

  const invitar = () => {
    setError(''); setLinkInv(null); setCopiado(false); setMail(null)
    if (!/\S+@\S+\.\S+/.test(invEmail)) { setError('Ingresá un email válido'); return }
    if (invPermiso === 'chofer' && !invChofer) { setError('Elegí qué chofer de tu flota es'); return }
    confirmarPermiso(invPermiso, invEmail.trim().toLowerCase(), 'Invitar', generarInvitacion)
  }

  const generarInvitacion = async () => {
    setOcupado('invitar')
    const { data, error } = await supabase.rpc('crear_invitacion', {
      p_cuenta: cuenta.id, p_email: invEmail, p_permiso: invPermiso,
    })
    setOcupado(null)
    if (error) { setError(error.message); return }
    if (invPermiso === 'chofer') {
      const { error: e3 } = await supabase.rpc('asignar_chofer_invitacion', { p_token: data, p_chofer: invChofer })
      if (e3) { setError(e3.message); return }
    }
    if (invPermiso === 'operador' && limitado(invPermisos)) {
      const { error: e2 } = await supabase.rpc('ajustar_permisos_invitacion', { p_token: data, p_permisos: invPermisos })
      if (e2) { setError(e2.message); return }
    }
    setLinkInv({ email: invEmail.trim().toLowerCase(), url: linkDe(data), token: data })
    setInvEmail(''); setInvPermisos({}); setInvChofer('')
    cargar()
    mandarMail(data)
  }

  // El mail sale desde soporte@ (puede tardar unos segundos)
  async function mandarMail(token) {
    setMail('enviando')
    const { data, error } = await supabase.functions.invoke('enviar-invitacion', { body: { token } })
    setMail(error || data?.error ? 'error' : 'ok')
  }

  const copiar = async (url) => {
    try { await navigator.clipboard.writeText(url); setCopiado(true) } catch { /* sin portapapeles */ }
  }
  const textoWA = (url) => encodeURIComponent(
    `Te invito a sumarte a ${cuenta.razon_social} en Carreta. Sumate con este link: ${url}`)

  const borrarInv = (i) => ejecutar(`inv-${i.id}`, () => supabase.from('invitaciones').delete().eq('id', i.id))

  const accent = rol === 'transportista' ? 'azul' : 'verde'
  const volver = rol === 'transportista' ? '/transportista/perfil' : rol === 'productor' ? '/productor/perfil' : '/roles'

  return (
    <Shell>
      <Topbar accent={accent} title="Mi equipo" showBack backTo={volver} />
      <Body>
        {/* Empresa */}
        <Card>
          <div className="text-sm font-bold text-gray-900">{cuenta?.razon_social}</div>
          <div className="text-xs text-gray-400">CUIT {formatCuit(cuenta?.cuit || '')}</div>
          <div className="mt-1.5 text-xs text-gray-500">
            Tu permiso: <Badge color={COLOR_PERMISO[cuenta?.permiso]}>{NOMBRE_PERMISO[cuenta?.permiso]}</Badge>
          </div>
          {cuenta?.permiso === 'operador' && limitado(cuenta.permisos) && (
            <div className="mt-1.5 text-[11px] text-orange-700">
              No podés: {accionesDe(cuenta.roles).filter(a => !puede(cuenta, a.id)).map(a => a.label.toLowerCase()).join(', ')}.
            </div>
          )}
        </Card>

        {error && <div className="bg-red-50 border border-red-200 rounded-[10px] p-2.5 text-xs text-red-700 mb-2.5">{error}</div>}

        {/* Pedidos de acceso */}
        {esMaster && solicitudes.length > 0 && (
          <>
            <div className="text-[11px] font-semibold text-gray-400 tracking-wide mb-1.5 mt-1">PEDIDOS DE ACCESO</div>
            {solicitudes.map(s => (
              <Card key={s.id} className="border-orange-200 bg-orange-50/40">
                <div className="text-sm font-semibold text-gray-900">{s.nombre} {s.apellido}</div>
                <div className="text-xs text-gray-500">{s.email}{s.telefono ? ` · ${s.telefono}` : ''}</div>
                <div className="text-[10px] text-gray-400 mb-2">Pidió acceso el {fecha(s.created_at)}</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500">Permiso:</span>
                  <select value={permisoSol[s.id] || 'operador'}
                    onChange={e => setPermisoSol(p => ({ ...p, [s.id]: e.target.value }))}
                    className="border border-gray-200 rounded-[8px] px-2 py-1 text-xs bg-white">
                    {PERMISOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={!!ocupado} onClick={() => resolver(s, true)}>✓ Aprobar</Button>
                  <Button size="sm" variant="danger" disabled={!!ocupado} onClick={() => resolver(s, false)}>Rechazar</Button>
                </div>
              </Card>
            ))}
          </>
        )}

        {/* Integrantes */}
        <div className="text-[11px] font-semibold text-gray-400 tracking-wide mb-1.5 mt-1">INTEGRANTES</div>
        {miembros.map(m => {
          const yo = m.usuario_id === usuario?.id
          return (
            <Card key={m.usuario_id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">
                    {m.nombre} {m.apellido} {yo && <span className="text-xs text-gray-400 font-normal">(vos)</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{m.email}</div>
                  {m.telefono && <div className="text-xs text-gray-400">{m.telefono}</div>}
                  {m.permiso === 'chofer' && (() => {
                    const c = choferes.find(x => x.id === m.chofer_id)
                    return <div className="text-[11px] text-orange-700">🧑‍✈️ {c ? `Chofer de la flota: ${c.apellido}, ${c.nombre}` : 'Chofer sin asignar en la flota'}</div>
                  })()}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge color={COLOR_PERMISO[m.permiso]}>{NOMBRE_PERMISO[m.permiso]}</Badge>
                  {m.permiso === 'operador' && limitado(m.permisos) && <span className="text-[10px] text-orange-600 font-semibold">Permisos limitados</span>}
                </div>
              </div>
              {esMaster && (
                <div className="flex items-center gap-2 mt-2">
                  <select value={m.permiso} disabled={!!ocupado}
                    onChange={e => cambiarPermiso(m, e.target.value)}
                    className="border border-gray-200 rounded-[8px] px-2 py-1 text-xs bg-white">
                    {PERMISOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    {m.permiso === 'chofer' && <option value="chofer">Chofer</option>}
                  </select>
                  {m.permiso === 'operador' && (
                    <button disabled={!!ocupado} className="text-xs text-azul-600 font-semibold"
                      onClick={() => setEditPerm({
                        titulo: `Permisos de ${m.nombre} ${m.apellido}`, permisos: m.permisos || {},
                        guardar: (p) => ejecutar(`pp-${m.usuario_id}`, () => supabase.rpc('cambiar_permisos_operador', {
                          p_cuenta: cuenta.id, p_usuario: m.usuario_id, p_permisos: p })),
                      })}>
                      Ajustar permisos
                    </button>
                  )}
                  {!yo && (
                    <button onClick={() => quitar(m)} disabled={!!ocupado}
                      className="text-xs text-red-600 hover:text-red-800 ml-auto">Quitar</button>
                  )}
                </div>
              )}
            </Card>
          )
        })}

        {/* Invitar */}
        {esMaster && (
          <>
            <div className="text-[11px] font-semibold text-gray-400 tracking-wide mb-1.5 mt-3">INVITAR A ALGUIEN</div>
            <Card>
              <p className="text-xs text-gray-500 mb-2">
                Le mandamos un mail con el link para sumarse. También podés mandárselo por WhatsApp. Si ya usa Carreta, se suma sin dejar su empresa.
              </p>
              <input type="email" placeholder="Email de la persona" value={invEmail}
                onChange={e => setInvEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm mb-2 bg-gray-50 focus:outline-none focus:border-verde-600" />
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">Permiso:</span>
                <select value={invPermiso} onChange={e => setInvPermiso(e.target.value)}
                  className="border border-gray-200 rounded-[8px] px-2 py-1 text-xs bg-white">
                  {opciones.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                {invPermiso === 'chofer' && (
                  <select value={invChofer} onChange={e => setInvChofer(e.target.value)}
                    className="border border-gray-200 rounded-[8px] px-2 py-1 text-xs bg-white flex-1 min-w-0">
                    <option value="">¿Qué chofer de la flota es?</option>
                    {choferes.filter(c => c.activo !== false).map(c => <option key={c.id} value={c.id}>{c.apellido}, {c.nombre}</option>)}
                  </select>
                )}
                {invPermiso === 'operador' && (
                  <button className="text-xs text-azul-600 font-semibold"
                    onClick={() => setEditPerm({ titulo: 'Permisos del invitado', permisos: invPermisos,
                      guardar: async (p) => setInvPermisos(p) })}>
                    {limitado(invPermisos) ? 'Permisos limitados ✎' : 'Ajustar permisos'}
                  </button>
                )}
              </div>
              <Button disabled={ocupado === 'invitar'} onClick={invitar}>
                {ocupado === 'invitar' ? 'Generando…' : 'Invitar'}
              </Button>

              {linkInv && (
                <div className="mt-3 bg-verde-50 border border-verde-100 rounded-[10px] p-2.5">
                  <div className="text-xs mb-1.5">
                    {mail === 'enviando' && <span className="text-gray-500">📧 Mandando el mail a {linkInv.email}…</span>}
                    {mail === 'ok' && <span className="text-verde-700 font-semibold">✓ Le mandamos el mail a {linkInv.email}</span>}
                    {mail === 'error' && <span className="text-red-600">No se pudo mandar el mail. Mandale el link por WhatsApp o copialo.</span>}
                  </div>
                  <div className="text-xs text-gray-600 mb-1">Link para <strong>{linkInv.email}</strong> (vence en 7 días):</div>
                  <div className="text-[10px] text-gray-500 break-all mb-2">{linkInv.url}</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => copiar(linkInv.url)}>{copiado ? '✓ Copiado' : 'Copiar'}</Button>
                    <Button size="sm" variant="secondary" disabled={mail === 'enviando'} onClick={() => mandarMail(linkInv.token)}>
                      {mail === 'ok' || mail === 'error' ? 'Reenviar mail' : 'Mail'}
                    </Button>
                    <a href={`https://wa.me/?text=${textoWA(linkInv.url)}`} target="_blank" rel="noreferrer" className="w-full">
                      <Button size="sm" variant="whatsapp">WhatsApp</Button>
                    </a>
                  </div>
                </div>
              )}
            </Card>

            {invitaciones.length > 0 && (
              <>
                <div className="text-[11px] font-semibold text-gray-400 tracking-wide mb-1.5 mt-3">INVITACIONES PENDIENTES</div>
                {invitaciones.map(i => {
                  const vencida = new Date(i.vence_en) < new Date()
                  return (
                    <Card key={i.id}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-800 truncate">{i.email}</div>
                          <div className="text-[10px] text-gray-400">
                            {NOMBRE_PERMISO[i.permiso]}{i.permiso === 'operador' && limitado(i.permisos) ? ' (limitado)' : ''} · {vencida ? 'Vencida' : `Vence ${fecha(i.vence_en)}`}
                          </div>
                        </div>
                        <div className="flex gap-3 flex-shrink-0">
                          {!vencida && (
                            <button onClick={() => { setLinkInv({ email: i.email, url: linkDe(i.token), token: i.token }); setCopiado(false); setMail(null) }}
                              className="text-xs text-verde-700 font-semibold">Ver link</button>
                          )}
                          <button onClick={() => borrarInv(i)} disabled={!!ocupado}
                            className="text-xs text-red-600">Borrar</button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </>
            )}
          </>
        )}

        {!esMaster && (
          <p className="text-xs text-gray-400 text-center mt-3">
            Solo los usuarios master pueden aprobar pedidos, invitar o quitar integrantes.
          </p>
        )}
        {esMaster && (
          <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
            <strong>Master:</strong> opera y administra el equipo y los datos de la empresa.{' '}
            <strong>Operador:</strong> opera (pedidos, ofertas, camiones), no administra.{' '}
            <strong>Solo lectura:</strong> ve todo, no puede modificar nada.
          </p>
        )}
      </Body>

      <PermisosModal datos={editPerm} roles={cuenta?.roles} onCerrar={() => setEditPerm(null)} />

      <Modal open={!!aviso} onClose={() => setAviso(null)}
        title={aviso ? `Dar permiso ${NOMBRE_PERMISO[aviso.permiso]}` : ''}>
        {aviso && (() => {
          const a = alcance(aviso.permiso, cuenta?.roles, aviso.accion === 'Invitar' ? invPermisos : (aviso.permisos || {}))
          return (
            <>
              <p className="text-sm text-gray-600 mb-2">
                <strong>{aviso.quien}</strong> va a poder actuar en nombre de <strong>{cuenta?.razon_social}</strong>:
              </p>
              <ul className="text-sm text-gray-700 mb-3 space-y-1">
                {a.puede.map(x => <li key={x}>• {x}</li>)}
              </ul>
              <div className={`text-xs rounded-[10px] p-2.5 mb-4 border
                ${aviso.permiso === 'master' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
                ⚠️ {a.nota} Lo que haga queda a nombre de la empresa.
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setAviso(null)}>Cancelar</Button>
                <Button onClick={() => { const f = aviso.seguir; setAviso(null); f() }}>
                  {aviso.accion} como {NOMBRE_PERMISO[aviso.permiso]}
                </Button>
              </div>
            </>
          )
        })()}
      </Modal>
    </Shell>
  )
}

// Casillas de permisos de un Operador
function PermisosModal({ datos, roles, onCerrar }) {
  const [p, setP] = useState({})
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { if (datos) setP(datos.permisos || {}) }, [datos])
  if (!datos) return null
  const lista = accionesDe(roles)
  const c = { permiso: 'operador', permisos: p }
  const cambiar = (id, valor) => setP(prev => {
    const n = { ...prev }
    if (valor) delete n[id]; else n[id] = false
    if (id === 'ver_precios' && valor) { delete n.ofertar; delete n.aceptar_ofertas }
    return n
  })
  const guardar = async () => { setGuardando(true); await datos.guardar(p); setGuardando(false); onCerrar() }
  return (
    <Modal open onClose={onCerrar} title={datos.titulo}>
      <p className="text-xs text-gray-500 mb-3">Destildá lo que no querés que haga. El resto queda permitido.</p>
      {lista.map(a => {
        const bloqueada = a.precio && p.ver_precios === false
        return (
          <label key={a.id} className={`flex items-start gap-2.5 py-2 border-b border-gray-50 ${bloqueada ? 'opacity-50' : ''}`}>
            <input type="checkbox" className="mt-0.5 w-4 h-4 accent-green-700" disabled={bloqueada}
              checked={puede(c, a.id)} onChange={e => cambiar(a.id, e.target.checked)} />
            <span className="text-sm text-gray-800">
              {a.label}
              {bloqueada && <span className="block text-[11px] text-gray-400">Necesita "Ver precios y montos"</span>}
            </span>
          </label>
        )
      })}
      <div className="flex gap-2 mt-4">
        <Button variant="secondary" onClick={onCerrar}>Cancelar</Button>
        <Button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </Modal>
  )
}
