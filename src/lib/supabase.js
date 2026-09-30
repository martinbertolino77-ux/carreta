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

// Transportista del usuario logueado (filtrado por usuario: un productor
// también puede ver otros transportistas, por eso no alcanza con .single()).
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
