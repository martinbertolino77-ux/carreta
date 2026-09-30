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
    if (!VAPID_PUBLIC_KEY) return

    suscribir(usuarioId)
  }, [usuarioId])
}

async function suscribir(usuarioId) {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: await urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const { endpoint, keys } = sub.toJSON()

    await supabase.from('push_subscriptions').upsert({
      usuario_id: usuarioId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }, { onConflict: 'usuario_id,endpoint' })

  } catch (err) {
    console.warn('[Push] Error suscribiendo:', err)
  }
}
