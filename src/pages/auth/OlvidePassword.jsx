import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import HCaptcha from '@hcaptcha/react-hcaptcha'

const HCAPTCHA_SITE_KEY = '06e4ad0e-ff76-469c-a496-0c929448e82e'

export default function OlvidePassword() {
  const [email, setEmail]     = useState('')
  const [enviado, setEnviado] = useState(false)
  const [demorado, setDemorado] = useState(false)   // el correo tardó: suele llegar igual
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const captchaRef = useRef(null)

  const doReset = async (e) => {
    e.preventDefault()
    if (!email)        { setError('Ingresá tu email'); return }
    if (!captchaToken) { setError('Completá el captcha'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://carreta.com.ar/nueva-password',
      captchaToken,
    })
    if (err) {
      console.error('[recover]', err.status, err.message)
      const m = (err.message || '').toLowerCase()
      if (err.status === 429 || m.includes('rate limit'))
        setError('Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.')
      else if (m.includes('captcha'))
        setError('Falló el captcha. Marcalo de nuevo y reintentá.')
      else if (err.status === 504 || m.includes('deadline')) {
        // El servidor de correo tardó en responder, pero en general el mail sale igual
        setDemorado(true); setEnviado(true)
      }
      else if (m.includes('sending'))
        setError('No se pudo enviar el mail. Probá en unos minutos o escribinos a soporte@carreta.com.ar.')
      else
        setError(`No pudimos enviar el email: ${err.message}`)
      captchaRef.current?.resetCaptcha()
      setCaptchaToken(null)
    } else {
      setEnviado(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-verde-800 flex flex-col items-center justify-center px-6">
      <div className="flex items-center gap-3 mb-2">
        <img src="/logo_carreta.png" alt="Carreta" className="w-14 h-14 object-contain bg-white rounded-[14px] p-1" />
        <span className="text-3xl font-bold text-white tracking-tight">Carreta</span>
      </div>
      <p className="text-white/60 text-sm text-center mb-8">Conectando la actividad agropecuaria</p>

      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        {!enviado ? (
          <>
            <h1 className="text-base font-bold text-gray-900 mb-1">Recuperar contraseña</h1>
            <p className="text-xs text-gray-500 mb-4">
              Ingresá tu email y te mandamos un link para crear una nueva contraseña.
            </p>
            <form onSubmit={doReset}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                autoComplete="username"
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm mb-3 bg-gray-50
                  focus:outline-none focus:border-verde-600 font-[Inter]"
              />

              <div className="flex justify-center mb-3">
                <HCaptcha
                  sitekey={HCAPTCHA_SITE_KEY}
                  onVerify={token => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  ref={captchaRef}
                />
              </div>

              {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading || !captchaToken}
                className="w-full bg-verde-700 text-white rounded-[10px] py-2.5 text-sm font-bold
                  hover:bg-verde-800 transition-colors disabled:opacity-60 mb-3"
              >
                {loading ? 'Enviando…' : 'Enviar link'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-verde-100 mx-auto mb-4">
              <svg className="w-6 h-6 text-verde-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-base font-bold text-gray-900 text-center mb-2">Email enviado</h1>
            <p className="text-xs text-gray-500 text-center mb-4">
              Revisá tu bandeja de entrada (y spam). El link expira en 1 hora.
              {demorado && <><br /><br />El servidor de correo tardó en responder: el mail puede demorar unos minutos. Si no llega en 10 minutos, probá de nuevo.</>}
            </p>
          </>
        )}
        <p className="text-center text-xs text-gray-500">
          <Link to="/login" className="text-verde-700 font-semibold">Volver al inicio</Link>
        </p>
      </div>
    </div>
  )
}
