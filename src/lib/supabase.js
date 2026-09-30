import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    storageKey: 'carreta-auth',
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
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
