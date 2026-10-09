// send-push: la llama la base de datos (trigger en notificaciones) con un secreto.
// Manda el push a los navegadores del destinatario de la notificación.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Adónde lleva el click en el aviso
function urlDestino(n: { tipo: string; rol: string | null; pedido_id: string | null }) {
  if (!n.pedido_id) return '/'
  if (n.rol === 'productor') return `/productor/pedido/${n.pedido_id}`
  if (n.tipo === 'pedido_nuevo') return `/transportista/disponible/${n.pedido_id}`
  if (n.tipo.includes('directo')) return `/transportista/pedido-directo/${n.pedido_id}`
  return `/transportista/pedido/${n.pedido_id}`
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  // 🔒 Solo la base de datos conoce este secreto
  const secreto = Deno.env.get('PUSH_SECRET')
  if (!secreto || req.headers.get('x-push-secret') !== secreto) {
    return json({ error: 'No autorizado' }, 401)
  }

  try {
    const { notificacion_id } = await req.json()
    if (!notificacion_id) return json({ error: 'Falta notificacion_id' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: n } = await supabase
      .from('notificaciones')
      .select('id, usuario_id, tipo, titulo, mensaje, pedido_id, rol')
      .eq('id', notificacion_id)
      .maybeSingle()
    if (!n?.usuario_id) return json({ ok: true, enviadas: 0 })

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('usuario_id', n.usuario_id)
    if (!subs?.length) return json({ ok: true, enviadas: 0 })

    const webpush = await import('https://esm.sh/web-push@3.6.7')
    webpush.setVapidDetails(
      'mailto:soporte@carreta.com.ar',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )

    const payload = JSON.stringify({
      title: n.titulo || 'Carreta',
      body: n.mensaje || '',
      url: urlDestino(n),
    })

    let enviadas = 0
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
        enviadas++
      } catch (err) {
        // Navegador dado de baja → se borra la suscripción
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
    return json({ ok: true, enviadas })
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500)
  }
})
