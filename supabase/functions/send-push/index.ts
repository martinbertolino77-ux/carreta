// send-push: la llama la base de datos (trigger en notificaciones) con un secreto.
// Manda el push a los navegadores del destinatario de la notificación
// y, si tiene activado "Email" en su perfil, también un mail (SMTP de Ferozo).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Adónde lleva el click en el aviso
const TIPOS_EQUIPO = ['solicitud_acceso', 'equipo_alta', 'acceso_aprobado', 'acceso_rechazado', 'equipo_baja']

function urlDestino(n: { tipo: string; rol: string | null; pedido_id: string | null }) {
  if (['solicitud_acceso', 'equipo_alta'].includes(n.tipo)) return '/equipo'
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

    const [enviadas, mail] = await Promise.all([enviarPush(supabase, n), enviarMail(supabase, n)])
    return json({ ok: true, enviadas, mail })
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500)
  }
})

// ── Push ─────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function enviarPush(supabase: any, n: any): Promise<number> {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('usuario_id', n.usuario_id)
  if (!subs?.length) return 0

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
      // deno-lint-ignore no-explicit-any
      const code = (err as any)?.statusCode
      if (code === 404 || code === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
  return enviadas
}

// ── Mail ─────────────────────────────────────────────────────────
// Se manda si la cuenta del destinatario tiene "Email" activado para el rol
// del aviso. Los avisos del equipo (pedidos de acceso, altas) van siempre.
// deno-lint-ignore no-explicit-any
async function enviarMail(supabase: any, n: any): Promise<string> {
  const host = Deno.env.get('SMTP_HOST')
  const user = Deno.env.get('SMTP_USER')
  const pass = Deno.env.get('SMTP_PASS')
  if (!host || !user || !pass) return 'sin_config'

  const { data: u } = await supabase.from('usuarios')
    .select('email, nombre, notif_email_productor, notif_email_transportista').eq('id', n.usuario_id).maybeSingle()
  if (!u?.email) return 'sin_email'

  // Cada integrante elige sus avisos por mail, por rol (Perfil → Mis avisos)
  if (!TIPOS_EQUIPO.includes(n.tipo)) {
    const quiere = n.rol === 'productor' ? u.notif_email_productor
      : n.rol === 'transportista' ? u.notif_email_transportista
      : (u.notif_email_productor || u.notif_email_transportista)
    if (quiere === false) return 'desactivado'
  }

  const link = `https://carreta.com.ar${urlDestino(n)}`
  const esc = (t: string) => String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f4;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:14px;overflow:hidden">
      <tr><td style="background:#1b5e20;padding:16px 20px;color:#fff;font-size:18px;font-weight:bold">Carreta</td></tr>
      <tr><td style="padding:20px">
        <div style="font-size:16px;font-weight:bold;color:#111;margin-bottom:8px">${esc(n.titulo)}</div>
        <div style="font-size:14px;color:#444;line-height:1.5;margin-bottom:20px">${esc(n.mensaje || '')}</div>
        <a href="${link}" style="display:inline-block;background:#2e7d32;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:bold">Ver en Carreta</a>
      </td></tr>
      <tr><td style="padding:14px 20px;border-top:1px solid #eee;font-size:11px;color:#999">
        Recibís este mail porque tenés activados los avisos por email en Carreta. Podés desactivarlos en tu Perfil → Mis avisos.<br>
        ¿Consultas o problemas con tu cuenta? Escribinos a <a href="mailto:soporte@carreta.com.ar" style="color:#2e7d32">soporte@carreta.com.ar</a>
      </td></tr>
    </table>
  </td></tr></table></body></html>`

  try {
    const { SMTPClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts')
    const client = new SMTPClient({
      connection: {
        hostname: host,
        port: Number(Deno.env.get('SMTP_PORT') || 465),
        tls: true,
        auth: { username: user, password: pass },
      },
    })
    await client.send({
      from: `Carreta <${Deno.env.get('SMTP_FROM') || user}>`,
      to: u.email,
      replyTo: 'soporte@carreta.com.ar',   // si responden el aviso, llega a soporte
      subject: n.titulo || 'Aviso de Carreta',
      content: `${n.titulo}\n\n${n.mensaje || ''}\n\nVer en Carreta: ${link}`,
      html,
    })
    await client.close()
    return 'enviado'
  } catch (err) {
    console.error('[mail]', err)
    return 'error: ' + String((err as Error)?.message || err)
  }
}
