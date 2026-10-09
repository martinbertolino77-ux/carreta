import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Capturar la URL ANTES de crear el cliente: detectSessionInUrl la limpia
// y dispara PASSWORD_RECOVERY antes de que monte NuevaPassword (lazy).
const _hash   = new URLSearchParams(window.location.hash.replace(/^#/, ''))
const _query  = new URLSearchParams(window.location.search)
export const linkRecuperacion = {
  esRecovery: _hash.get('type') === 'recovery' || _query.get('type') === 'recovery',
  tokenHash:  _query.get('token_hash'),
  error:      _hash.get('error_description') || _query.get('error_description') || null,
  errorCode:  _hash.get('error_code') || _query.get('error_code') || null,
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    storageKey: 'carreta-auth',
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') linkRecuperacion.esRecovery = true
})

export async function getMiTransportista(campos = 'id') {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  const { data } = await supabase
    .from('transportistas')
    .select(campos)
    .eq('usuario_id', session.user.id)
    .maybeSingle()
  return data || null
}

export async function getMiTransportistaConNombre() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  const { data: t } = await supabase
    .from('transportistas')
    .select('id, usuario_id')
    .eq('usuario_id', session.user.id)
    .maybeSingle()
  if (!t) return null
  const { data: u } = await supabase
    .from('usuarios')
    .select('razon_social, nombre, apellido')
    .eq('id', session.user.id)
    .maybeSingle()
  return { ...t, usuarios: u }
}
