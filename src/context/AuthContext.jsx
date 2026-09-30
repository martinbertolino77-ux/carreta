import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [usuario, setUsuario]   = useState(null)
  const [rol, setRol]           = useState(null) // 'productor' | 'transportista'
  const [loading, setLoading]   = useState(true)

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

  async function signOut() {
    await supabase.auth.signOut()
    setRol(null)
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ session, usuario, rol, setRol, loading, signOut, cargarUsuario }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
