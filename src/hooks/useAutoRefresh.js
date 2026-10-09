import { useEffect, useRef } from 'react'

// Recarga los datos cada `ms` mientras la pestaña está visible,
// y apenas el usuario vuelve a la pestaña. `fn` recibe silencioso=true.
export function useAutoRefresh(fn, ms = 30000, activo = true) {
  const ref = useRef(fn)
  ref.current = fn

  useEffect(() => {
    if (!activo) return
    const tick = () => { if (document.visibilityState === 'visible') ref.current(true) }
    const id = setInterval(tick, ms)
    const alVolver = () => { if (document.visibilityState === 'visible') ref.current(true) }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [ms, activo])
}
