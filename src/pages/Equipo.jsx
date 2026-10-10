import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Shell, { Body } from '../components/layout/Shell'
import Topbar from '../components/layout/Topbar'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { formatCuit } from '../utils/format'

// Por ahora: master (administra todo) u operador (opera, no administra el equipo).
// "Solo lectura" llega en la etapa 4.
const PERMISOS = [
  { id: 'operador', label: 'Operador' },
  { id: 'master',   label: 'Master' },
]
const COLOR_PERMISO = { master: 'purple', operador: 'blue', lectura: 'gray' }
const NOMBRE_PERMISO = { master: 'Master', operador: 'Operador', lectura: 'Solo lectura' }

const fecha = (d) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })

export default function Equipo() {
  const { usuario, cuenta, rol, cargarUsuario } = useAuth()
  const esMaster = cuenta?.permiso === 'master'

  const [miembros, setMiembros]       = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [invitaciones, setInvitaciones] = useState([])
  const [permisoSol, setPermisoSol]   = useState({})       // id solicitud → permiso elegido
  const [ocupado, setOcupado]         = useState(null)
  const [error, setError]             = useState('')

  const [invEmail, setInvEmail]       = useState('')
  const [invPermiso, setInvPermiso]   = useState('operador')
  const [linkInv, setLinkInv]         = useState(null)
  const [copiado, setCopiado]         = useState(false)

  async function cargar() {
    if (!cuenta) return
    const { data: m } = await supabase.rpc('equipo_miembros', { p_cuenta: cuenta.id })
    setMiembros(m || [])
    if (esMaster) {
      const [{ data: s }, { data: i }] = await Promise.all([
        supabase.rpc('equipo_solicitudes', { p_cuenta: cuenta.id }),
        supabase.from('invitaciones').select('id, email, permiso, token, vence_en')
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
    ejecutar(`sol-${s.id}`, () => supabase.rpc('resolver_solicitud', {
      p_id: s.id, p_aprobar: aprobar, p_permiso: permisoSol[s.id] || 'operador',
    }))
  }

  const cambiarPermiso = async (m, permiso) => {
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

  const invitar = async () => {
    setError(''); setLinkInv(null); setCopiado(false)
    if (!/\S+@\S+\.\S+/.test(invEmail)) { setError('Ingresá un email válido'); return }
    setOcupado('invitar')
    const { data, error } = await supabase.rpc('crear_invitacion', {
      p_cuenta: cuenta.id, p_email: invEmail, p_permiso: invPermiso,
    })
    setOcupado(null)
    if (error) { setError(error.message); return }
    setLinkInv({ email: invEmail.trim().toLowerCase(), url: linkDe(data) })
    setInvEmail('')
    cargar()
  }

  const copiar = async (url) => {
    try { await navigator.clipboard.writeText(url); setCopiado(true) } catch { /* sin portapapeles */ }
  }
  const textoWA = (url) => encodeURIComponent(
    `Te invito a sumarte a ${cuenta.razon_social} en Carreta. Creá tu usuario con este link: ${url}`)

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
                </div>
                <Badge color={COLOR_PERMISO[m.permiso]}>{NOMBRE_PERMISO[m.permiso]}</Badge>
              </div>
              {esMaster && (
                <div className="flex items-center gap-2 mt-2">
                  <select value={m.permiso} disabled={!!ocupado}
                    onChange={e => cambiarPermiso(m, e.target.value)}
                    className="border border-gray-200 rounded-[8px] px-2 py-1 text-xs bg-white">
                    {PERMISOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    {m.permiso === 'lectura' && <option value="lectura">Solo lectura</option>}
                  </select>
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
                Generá un link y mandáselo. Con ese link crea su usuario y entra directo a tu cuenta.
              </p>
              <input type="email" placeholder="Email de la persona" value={invEmail}
                onChange={e => setInvEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm mb-2 bg-gray-50 focus:outline-none focus:border-verde-600" />
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">Permiso:</span>
                <select value={invPermiso} onChange={e => setInvPermiso(e.target.value)}
                  className="border border-gray-200 rounded-[8px] px-2 py-1 text-xs bg-white">
                  {PERMISOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <Button disabled={ocupado === 'invitar'} onClick={invitar}>
                {ocupado === 'invitar' ? 'Generando…' : 'Generar link de invitación'}
              </Button>

              {linkInv && (
                <div className="mt-3 bg-verde-50 border border-verde-100 rounded-[10px] p-2.5">
                  <div className="text-xs text-gray-600 mb-1">Link para <strong>{linkInv.email}</strong> (vence en 7 días):</div>
                  <div className="text-[10px] text-gray-500 break-all mb-2">{linkInv.url}</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => copiar(linkInv.url)}>{copiado ? '✓ Copiado' : 'Copiar'}</Button>
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
                            {NOMBRE_PERMISO[i.permiso]} · {vencida ? 'Vencida' : `Vence ${fecha(i.vence_en)}`}
                          </div>
                        </div>
                        <div className="flex gap-3 flex-shrink-0">
                          {!vencida && (
                            <button onClick={() => { setLinkInv({ email: i.email, url: linkDe(i.token) }); setCopiado(false) }}
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
      </Body>
    </Shell>
  )
}
