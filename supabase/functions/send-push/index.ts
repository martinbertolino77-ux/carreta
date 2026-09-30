import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { usuario_id, titulo, cuerpo, url } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Obtener suscripciones del usuario
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('usuario_id', usuario_id)

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviadas: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!

    // Importar web-push via esm
    const webpush = await import('https://esm.sh/web-push@3.6.7')
    webpush.setVapidDetails('mailto:admin@carreta.app', VAPID_PUBLIC, VAPID_PRIVATE)

    let enviadas = 0
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: titulo, body: cuerpo, url: url || '/' })
        )
        enviadas++
      } catch (err) {
        // Suscripción expirada — borrar
        if (err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, enviadas }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
