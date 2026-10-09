import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
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
  const [rol, setRol]           = useState(null)
  const [loading, setLoading]   = useState(true)
  const timerRef                = useRef(null)

  const signOut = useCallback(async () => {
    await quitarPushDeEsteNavegador()
    await supabase.auth.signOut()
    setRol(null)
    setUsuario(null)
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
      else { setUsuario(null); setRol(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function cargarUsuario(id) {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .single()
    setUsuario(data)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ session, usuario, rol, setRol, loading, signOut, cargarUsuario }}>
      <AuthProviderInner usuarioId={usuario?.id}>
        {children}
      </AuthProviderInner>
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
