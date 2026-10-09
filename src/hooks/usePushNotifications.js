import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

async function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushNotifications(usuarioId) {
  useEffect(() => {
    if (!usuarioId) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] VAPID_PUBLIC_KEY no definida')
      return
    }
    console.log('[Push] Iniciando suscripcion para usuario:', usuarioId)
    suscribir(usuarioId)
  }, [usuarioId])
}

async function suscribir(usuarioId) {
  console.log('[Push] VAPID KEY:', VAPID_PUBLIC_KEY?.slice(0, 10) + '...')
  try {
    const permission = await Notification.requestPermission()
    console.log('[Push] Permiso:', permission)
    if (permission !== 'granted') return

    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: await urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const json = sub.toJSON()
    console.log('[Push] Suscripcion OK:', json.endpoint?.slice(0, 30) + '...')

    // Este navegador queda anotado solo a nombre del usuario actual
    const { error } = await supabase.rpc('registrar_push', {
      p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth,
    })
    if (error) throw error

    console.log('[Push] Guardado en Supabase OK')

  } catch (err) {
    console.error('[Push] Error:', err)
  }
}

// Al cerrar sesión: este navegador deja de recibir avisos de ese usuario
export async function quitarPushDeEsteNavegador() {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager?.getSubscription()
    if (sub) await supabase.rpc('quitar_push', { p_endpoint: sub.endpoint })
  } catch (err) {
    console.warn('[Push] No se pudo quitar la suscripción:', err)
  }
}
