import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase, setCuentaActiva, cuentaGuardada } from '../lib/supabase'
import { usePushNotifications, quitarPushDeEsteNavegador } from '../hooks/usePushNotifications'

const AuthContext = createContext(null)

const INACTIVIDAD_MS = 8 * 60 * 60 * 1000 // 8 horas

function AuthProviderInner({ children, usuarioId }) {
  usePushNotifications(usuarioId)
  return children
}

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [usuario, setUsuario]   = useState(null)
  const [cuenta, setCuenta]     = useState(null) // empresa activa + su permiso
  const [cuentas, setCuentas]   = useState([])   // todas las empresas del usuario
  const [rol, setRol]           = useState(null)
  const [loading, setLoading]   = useState(true)
  const timerRef                = useRef(null)

  const signOut = useCallback(async () => {
    await quitarPushDeEsteNavegador()
    await supabase.auth.signOut()
    setRol(null)
    setUsuario(null)
    setCuenta(null)
    setCuentas([])
    setCuentaActiva(null)
  }, [])

  // Reinicia el timer cada vez que el usuario hace algo
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      signOut()
    }, INACTIVIDAD_MS)
  }, [signOut])

  // Escucha eventos de actividad del usuario
  useEffect(() => {
    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    eventos.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer() // arranca timer al montar
    return () => {
      eventos.forEach(e => window.removeEventListener(e, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resetTimer])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) cargarUsuario(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) cargarUsuario(session.user.id)
      else { setUsuario(null); setCuenta(null); setCuentas([]); setRol(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // preferida: empresa a dejar activa (por ej. la de una invitación recién aceptada)
  async function cargarUsuario(id, preferida) {
    const [{ data }, { data: mems }] = await Promise.all([
      supabase.from('usuarios').select('*').eq('id', id).single(),
      supabase.from('miembros')
        .select('permiso, created_at, cuentas(id, cuit, razon_social, roles, domicilio, localidad, provincia)')
        .eq('usuario_id', id).order('created_at'),
    ])
    const lista = (mems || []).filter(m => m.cuentas).map(m => ({ ...m.cuentas, permiso: m.permiso }))
    const elegida = preferida || cuentaGuardada()
    const activa = lista.find(c => c.id === elegida) || lista[0] || null
    setCuentaActiva(activa?.id)
    setCuentas(lista)
    setCuenta(activa)
    setUsuario(data)
    setLoading(false)
  }

  // Cambiar de empresa: se vuelve a elegir rol (salvo al abrir un pedido de otra empresa)
  const cambiarCuenta = useCallback((id, mantenerRol = false) => {
    const c = cuentas.find(x => x.id === id)
    if (!c) return false
    setCuentaActiva(c.id)
    setCuenta(c)
    if (!mantenerRol) setRol(null)
    return true
  }, [cuentas])

  return (
    <AuthContext.Provider value={{ session, usuario, cuenta, cuentas, cambiarCuenta, rol, setRol, loading, signOut, cargarUsuario }}>
      <AuthProviderInner usuarioId={usuario?.id}>
        {children}
      </AuthProviderInner>
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
