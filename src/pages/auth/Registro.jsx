import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { validarCuit, limpiarCuit } from '../../utils/validaciones'
import LocalidadInput from '../../components/ui/LocalidadInput'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { CLAVE_INVITACION } from './SinCuenta'

const HCAPTCHA_SITE_KEY = '06e4ad0e-ff76-469c-a496-0c929448e82e'

const STEPS = ['Credenciales', 'Datos', 'Roles', 'Confirmación']

const cls = 'w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm mb-3 bg-gray-50 focus:outline-none focus:border-verde-600 font-[Inter]'

export default function Registro() {
  const navigate = useNavigate()
  const [step, setStep]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [roles, setRoles]     = useState([])
  const [localidadElegida, setLocalidadElegida] = useState(false) // true = vino del buscador
  const [captchaToken, setCaptchaToken] = useState(null)
  const captchaRef = useRef(null)
  const [registrado, setRegistrado] = useState(false)
  // modo: 'nueva' (empresa nueva) · 'solicitud' (pedir acceso a una empresa existente) · 'invitacion'
  const [params] = useSearchParams()
  const tokenInv = params.get('inv')
  const [modo, setModo] = useState(tokenInv ? 'invitacion' : 'nueva')
  const [inv, setInv]   = useState(tokenInv ? undefined : null)   // undefined = cargando
  const [cuitTomado, setCuitTomado] = useState(false)

  const [form, setForm] = useState({
    email: '', password: '', password2: '',
    nombre: '', apellido: '', razon_social: '',
    cuit: '', telefono: '',
    domicilio: '', localidad: '', provincia: '',
  })

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Invitación: traer los datos del link
  useEffect(() => {
    if (!tokenInv) return
    try { localStorage.setItem(CLAVE_INVITACION, tokenInv) } catch { /* sin storage */ }
    supabase.rpc('ver_invitacion', { p_token: tokenInv }).then(({ data, error }) => {
      const i = !error && data?.[0]
      if (i?.vigente) { setInv(i); setForm(f => ({ ...f, email: i.email })) }
      else setInv(false)
    })
  }, [tokenInv])
  const toggleRol = (r) => setRoles(rs => rs.includes(r) ? rs.filter(x => x !== r) : [...rs, r])

  const validarStep1 = () => {
    if (!form.email)                          return 'Ingresá tu email'
    if (!/\S+@\S+\.\S+/.test(form.email))    return 'Email inválido'
    if (!form.password || form.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres'
    if (form.password !== form.password2)     return 'Las contraseñas no coinciden'
    return null
  }

  const validarStep2 = () => {
    if (!form.nombre)        return 'Ingresá tu nombre'
    if (!form.apellido)      return 'Ingresá tu apellido'
    if (modo === 'invitacion') return form.telefono ? null : 'Ingresá tu teléfono'
    if (!form.razon_social)  return 'Ingresá la razón social (persona física: tu nombre y apellido)'
    const errCuit = validarCuit(form.cuit)
    if (errCuit) return errCuit
    if (!form.telefono)      return 'Ingresá tu teléfono'
    if (!form.domicilio)     return 'Ingresá tu domicilio legal'
    if (!form.localidad)     return 'Ingresá tu localidad'
    if (!localidadElegida)   return 'Elegí la localidad de la lista oficial'
    if (!form.provincia)     return 'La localidad no tiene provincia asociada — elegila de la lista'
    return null
  }

  const validarStep3 = () => {
    if (roles.length === 0) return 'Seleccioná al menos un rol'
    return null
  }

  const cuitDisponible = async () => {
    const { data, error } = await supabase.rpc('cuit_disponible', { p_cuit: limpiarCuit(form.cuit) })
    if (error) { console.error('[cuit_disponible]', error); return true } // si falla el chequeo, no bloquear
    return data === true
  }

  const siguiente = async () => {
    setError('')
    if (step === 1) { const e = validarStep1(); if (e) { setError(e); return }; setStep(2) }
    else if (step === 2) {
      const e = validarStep2(); if (e) { setError(e); return }
      if (modo === 'invitacion') { setStep(4); return }   // los roles los define la empresa
      if (!(await cuitDisponible())) { setCuitTomado(true); return }
      setStep(3)
    }
    else if (step === 3) { const e = validarStep3(); if (e) { setError(e); return }; setStep(4) }
  }

  const registrar = async () => {
    if (!captchaToken) { setError('Completá el captcha'); return }
    setLoading(true); setError('')
    try {
      const { error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          captchaToken,
          data: {
            nombre: form.nombre,
            apellido: form.apellido,
            razon_social: form.razon_social,
            cuit: modo === 'invitacion' ? '' : limpiarCuit(form.cuit),
            telefono: form.telefono,
            domicilio: form.domicilio,
            localidad: form.localidad,
            provincia: form.provincia,
            roles: modo === 'nueva' ? roles : [],
            modo,
            invitacion: modo === 'invitacion' ? tokenInv : undefined,
          }
        }
      })
      if (authErr) {
        captchaRef.current?.resetCaptcha()
        setCaptchaToken(null)
        throw authErr
      }

      setRegistrado(true)
    } catch (e) {
      setError(e.message?.toLowerCase().includes('already registered')
        ? (modo === 'invitacion'
            ? 'Ese email ya tiene usuario. Ingresá con él y vas a poder aceptar la invitación.'
            : 'Ese email ya está registrado. Ingresá o recuperá la contraseña.')
        : e.message)
    } finally {
      setLoading(false)
    }
  }

  const Fila = ({ label, value }) => (
    <div className="flex justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
      <span className="text-xs font-medium text-gray-800 text-right break-all">{value}</span>
    </div>
  )

  if (registrado) {
    return (
      <div className="min-h-screen bg-verde-800 flex flex-col items-center justify-center px-6 py-10">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
          <div className="text-4xl mb-3">📧</div>
          <h2 className="text-base font-bold text-gray-900 mb-2">Revisá tu correo</h2>
          <p className="text-sm text-gray-500 mb-4">
            Te enviamos un link de confirmación a <strong>{form.email}</strong>. Hacé clic ahí para activar tu cuenta.
          </p>
          {modo === 'solicitud' && (
            <p className="text-xs text-gray-500 mb-4 bg-orange-50 border border-orange-200 rounded-[10px] p-2.5">
              Después de confirmar, el titular de la empresa tiene que aprobar tu acceso. Te avisamos cuando lo haga.
            </p>
          )}
          {modo === 'invitacion' && inv && (
            <p className="text-xs text-gray-500 mb-4">Al confirmar vas a entrar directo a <strong>{inv.razon_social}</strong>.</p>
          )}
          <Link to="/login" className="text-verde-700 font-semibold text-sm">Ir a iniciar sesión</Link>
        </div>
      </div>
    )
  }

  if (modo === 'invitacion' && inv === false) {
    return (
      <div className="min-h-screen bg-verde-800 flex flex-col items-center justify-center px-6 py-10">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
          <div className="text-4xl mb-3">⌛</div>
          <h2 className="text-base font-bold text-gray-900 mb-2">Invitación no válida</h2>
          <p className="text-sm text-gray-500 mb-4">El link venció o ya fue usado. Pedile al titular de la cuenta un link nuevo.</p>
          <Link to="/login" className="text-verde-700 font-semibold text-sm">Ir a iniciar sesión</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-verde-800 flex flex-col items-center justify-center px-6 py-10">
      <div className="flex items-center gap-3 mb-2">
        <img src="/logo_carreta.png" alt="Carreta" className="w-12 h-12 object-contain bg-white rounded-[13px] p-1" />
        <span className="text-2xl font-bold text-white tracking-tight">Carreta</span>
      </div>
      <p className="text-white/60 text-sm text-center mb-6">Conectando la actividad agropecuaria</p>

      {/* Steps */}
      <div className="flex items-center gap-1.5 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${step > i + 1 ? 'bg-verde-500 text-white' : step === i + 1 ? 'bg-white text-verde-800' : 'bg-white/20 text-white/50'}`}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] ${step === i + 1 ? 'text-white' : 'text-white/40'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-white/20" />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        {modo === 'invitacion' && inv && (
          <div className="bg-verde-50 border border-verde-100 rounded-[10px] p-3 text-xs text-gray-700 mb-4">
            👥 <strong>{inv.razon_social}</strong> te invitó a sumarte a su cuenta en Carreta.
          </div>
        )}
        {modo === 'invitacion' && inv === undefined && (
          <div className="text-xs text-gray-400 mb-4 text-center">Cargando invitación…</div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <>
            <h2 className="text-base font-bold text-gray-900 mb-4">Credenciales</h2>
            <input type="email" placeholder="Email *" value={form.email} readOnly={modo === 'invitacion'}
              onChange={e => setF('email', e.target.value)} className={`${cls} ${modo === 'invitacion' ? 'text-gray-500' : ''}`} />
            <input type="password" placeholder="Contraseña * (mín. 6 caracteres)" value={form.password}
              onChange={e => setF('password', e.target.value)} className={cls} />
            <input type="password" placeholder="Repetir contraseña *" value={form.password2}
              onChange={e => setF('password2', e.target.value)} className={cls} />
          </>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <>
            <h2 className="text-base font-bold text-gray-900 mb-4">Datos personales</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <input type="text" placeholder="Nombre *" value={form.nombre}
                onChange={e => setF('nombre', e.target.value)}
                className="border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:border-verde-600 font-[Inter]" />
              <input type="text" placeholder="Apellido *" value={form.apellido}
                onChange={e => setF('apellido', e.target.value)}
                className="border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:border-verde-600 font-[Inter]" />
            </div>
            {modo !== 'invitacion' && <>
            <input type="text" placeholder="Razón social *" value={form.razon_social}
              onChange={e => setF('razon_social', e.target.value)}
              className={cls} />
            <p className="text-[10px] text-gray-400 -mt-2 mb-3">Persona física: tu nombre y apellido. Empresa: nombre legal.</p>
            <input type="text" placeholder="CUIT * (11 dígitos, sin guiones)" value={form.cuit}
              onChange={e => { setF('cuit', e.target.value.replace(/\D/g, '')); setCuitTomado(false) }}
              className={cls} maxLength={11} />
            </>}
            <input type="tel" placeholder="Teléfono *" value={form.telefono}
              onChange={e => setF('telefono', e.target.value)}
              className={cls} />
            {modo !== 'invitacion' && <>
            <input type="text" placeholder="Domicilio legal *" value={form.domicilio}
              onChange={e => setF('domicilio', e.target.value)}
              className={cls} />
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Localidad base * — buscá y elegí de la lista oficial</p>
              <LocalidadInput value={form.localidad} placeholder="Ej: Cañuelas"
                onChange={v => { setF('localidad', v); setLocalidadElegida(false) }}
                onSelect={o => { setForm(f => ({ ...f, localidad: o.localidad, provincia: o.provincia })); setLocalidadElegida(true) }} />
              {form.provincia && <div className="text-xs text-gray-400 mt-1">📍 {form.provincia}</div>}
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-[10px] p-3 text-xs text-yellow-700">
              ⚠ La validación con RENAPER se habilitará próximamente.
            </div>
            </>}

            {cuitTomado && (
              <div className="bg-orange-50 border border-orange-200 rounded-[10px] p-3 mt-3">
                <div className="text-xs text-orange-800 font-semibold mb-1">Ese CUIT ya tiene cuenta en Carreta</div>
                <p className="text-xs text-gray-600 mb-2">
                  Si es tuyo, ingresá con tu usuario o recuperá la contraseña.
                  Si trabajás en esa empresa, pedí acceso: el titular lo aprueba y operás con tu propio usuario.
                </p>
                <button onClick={() => { setModo('solicitud'); setCuitTomado(false); setError(''); setStep(4) }}
                  className="w-full bg-orange-500 text-white rounded-[10px] py-2 text-xs font-bold hover:bg-orange-600 mb-1.5">
                  👥 Pedir acceso a esta empresa
                </button>
                <Link to="/login" className="block text-center text-xs text-verde-700 font-semibold">Es mío: ingresar</Link>
              </div>
            )}
          </>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <>
            <h2 className="text-base font-bold text-gray-900 mb-2">¿Con qué roles vas a operar?</h2>
            <p className="text-xs text-gray-500 mb-4">Podés tener ambos. Cada rol opera de forma independiente.</p>
            {[
              { id:'productor',     icon:'🌱', label:'Productor',     desc:'Publicá pedidos y gestioná tus traslados' },
              { id:'transportista', icon:'🚛', label:'Transportista', desc:'Explorá pedidos y gestioná tus viajes' },
            ].map(r => (
              <div key={r.id} onClick={() => toggleRol(r.id)}
                className={`border-[1.5px] rounded-[10px] p-3.5 mb-3 cursor-pointer transition-all flex items-center gap-3
                  ${roles.includes(r.id) ? 'border-verde-600 bg-verde-50' : 'border-gray-200'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0
                  ${r.id === 'productor' ? 'bg-verde-50' : 'bg-azul-50'}`}>{r.icon}</div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-gray-900">{r.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                  ${roles.includes(r.id) ? 'border-verde-600 bg-verde-600' : 'border-gray-300'}`}>
                  {roles.includes(r.id) && <span className="text-white text-[10px]">✓</span>}
                </div>
              </div>
            ))}
          </>
        )}

        {/* STEP 4 — Confirmación */}
        {step === 4 && (
          <>
            <h2 className="text-base font-bold text-gray-900 mb-1">Confirmá tus datos</h2>
            <p className="text-xs text-gray-500 mb-4">Revisá todo antes de crear tu cuenta.</p>
            {modo === 'solicitud' && (
              <div className="bg-orange-50 border border-orange-200 rounded-[10px] p-3 text-xs text-gray-700 mb-3">
                👥 Vas a <strong>pedir acceso</strong> a la empresa con CUIT <strong>{form.cuit}</strong>.
                El titular tiene que aprobarte antes de que puedas operar.
              </div>
            )}
            <div className="bg-gray-50 rounded-[10px] px-3 py-2 mb-3">
              <div className="text-[11px] font-semibold text-gray-400 mb-1">CREDENCIALES</div>
              <Fila label="Email" value={form.email} />
              <Fila label="Contraseña" value="••••••••" />
            </div>
            <div className="bg-gray-50 rounded-[10px] px-3 py-2 mb-3">
              <div className="text-[11px] font-semibold text-gray-400 mb-1">DATOS PERSONALES</div>
              <Fila label="Nombre" value={`${form.nombre} ${form.apellido}`} />
              {modo === 'nueva' && <Fila label="Razón social" value={form.razon_social} />}
              {modo !== 'invitacion' && <Fila label="CUIT" value={form.cuit} />}
              <Fila label="Teléfono" value={form.telefono} />
              {modo !== 'invitacion' && <>
                <Fila label="Domicilio" value={form.domicilio} />
                <Fila label="Localidad" value={`${form.localidad}, ${form.provincia}`} />
              </>}
            </div>
            {modo === 'nueva' && (
              <div className="bg-gray-50 rounded-[10px] px-3 py-2 mb-4">
                <div className="text-[11px] font-semibold text-gray-400 mb-1">ROLES</div>
                <Fila label="Roles" value={roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(' + ')} />
              </div>
            )}
            {modo === 'invitacion' && inv && (
              <div className="bg-gray-50 rounded-[10px] px-3 py-2 mb-4">
                <div className="text-[11px] font-semibold text-gray-400 mb-1">EMPRESA</div>
                <Fila label="Te sumás a" value={inv.razon_social} />
              </div>
            )}
            <div className="flex justify-center mb-3">
              <HCaptcha
                sitekey={HCAPTCHA_SITE_KEY}
                onVerify={token => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken(null)}
                ref={captchaRef}
              />
            </div>
          </>
        )}

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        {step < 4 ? (
          <button onClick={siguiente}
            className="w-full bg-verde-700 text-white rounded-[10px] py-2.5 text-sm font-bold hover:bg-verde-800 transition-colors mb-3">
            Continuar →
          </button>
        ) : (
          <button onClick={registrar} disabled={loading || !captchaToken}
            className="w-full bg-verde-700 text-white rounded-[10px] py-2.5 text-sm font-bold hover:bg-verde-800 transition-colors disabled:opacity-60 mb-3">
            {loading ? 'Enviando…' : modo === 'solicitud' ? '✓ Crear usuario y pedir acceso' : '✓ Confirmar y crear cuenta'}
          </button>
        )}

        {step > 1 && (
          <button onClick={() => {
              setError('')
              if (step === 4 && modo !== 'nueva') { if (modo === 'solicitud') setModo('nueva'); setStep(2) }
              else setStep(s => s - 1)
            }}
            className="w-full text-xs text-gray-400 hover:text-gray-600 mb-2">
            ← Volver a editar
          </button>
        )}

        <p className="text-center text-xs text-gray-500">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-verde-700 font-semibold">Ingresá</Link>
        </p>
      </div>
    </div>
  )
}
