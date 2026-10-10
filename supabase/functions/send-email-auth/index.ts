// send-email-auth: "Send Email Hook" de Supabase Auth.
// Supabase llama acá en vez de mandar el mail él mismo (confirmar cuenta,
// recuperar contraseña, etc.). Respondemos al instante y el mail sale en
// segundo plano por el SMTP de Ferozo desde soporte@: así la demora del
// servidor de correo ya no corta el pedido con error 504.
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const SITE = 'https://carreta.com.ar'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const esc = (t: string) => String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

function armarMail(tipo: string, d: Record<string, string>, nombre: string) {
  const supa = Deno.env.get('SUPABASE_URL')!
  const verify = (type: string, hash: string) =>
    `${supa}/auth/v1/verify?token=${encodeURIComponent(hash)}&type=${type}&redirect_to=${encodeURIComponent(d.redirect_to || SITE)}`
  const hola = nombre ? `Hola ${esc(nombre)},` : 'Hola,'

  switch (tipo) {
    case 'recovery':
      return {
        asunto: 'Recuperá tu contraseña de Carreta',
        titulo: 'Recuperar contraseña',
        texto: `${hola} recibimos un pedido para cambiar la contraseña de tu cuenta. Tocá el botón para elegir una nueva. El link vence en 1 hora.`,
        boton: 'Crear nueva contraseña',
        link: `${SITE}/nueva-password?token_hash=${encodeURIComponent(d.token_hash)}&type=recovery`,
        pie: 'Si no lo pediste vos, ignorá este mail: tu contraseña no cambia.',
      }
    case 'signup':
      return {
        asunto: 'Confirmá tu cuenta de Carreta',
        titulo: 'Confirmá tu email',
        texto: `${hola} gracias por registrarte en Carreta. Confirmá tu email para activar tu cuenta.`,
        boton: 'Confirmar mi cuenta',
        link: verify('signup', d.token_hash),
        pie: 'Si no te registraste vos, ignorá este mail.',
      }
    case 'email_change':
      return {
        asunto: 'Confirmá tu nuevo email en Carreta',
        titulo: 'Cambio de email',
        texto: `${hola} confirmá que querés usar este email en tu cuenta de Carreta.`,
        boton: 'Confirmar email',
        link: verify('email_change', d.token_hash_new || d.token_hash),
        pie: 'Si no pediste este cambio, escribinos a soporte@carreta.com.ar.',
      }
    case 'magiclink':
      return {
        asunto: 'Tu link para entrar a Carreta',
        titulo: 'Entrar a Carreta',
        texto: `${hola} tocá el botón para entrar a tu cuenta.`,
        boton: 'Entrar',
        link: verify('magiclink', d.token_hash),
        pie: 'Si no lo pediste vos, ignorá este mail.',
      }
    case 'invite':
      return {
        asunto: 'Te invitaron a Carreta',
        titulo: 'Invitación',
        texto: `${hola} te invitaron a usar Carreta. Tocá el botón para activar tu cuenta.`,
        boton: 'Activar cuenta',
        link: verify('invite', d.token_hash),
        pie: '',
      }
    default: // reauthentication y otros: código
      return {
        asunto: 'Tu código de Carreta',
        titulo: 'Código de verificación',
        texto: `${hola} tu código es: <b style="font-size:20px;letter-spacing:3px">${esc(d.token)}</b>`,
        boton: '',
        link: '',
        pie: 'Si no lo pediste vos, ignorá este mail.',
      }
  }
}

function html(m: ReturnType<typeof armarMail>) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f4;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:14px;overflow:hidden">
      <tr><td style="background:#1b5e20;padding:16px 20px;color:#fff;font-size:18px;font-weight:bold">Carreta</td></tr>
      <tr><td style="padding:20px">
        <div style="font-size:16px;font-weight:bold;color:#111;margin-bottom:8px">${m.titulo}</div>
        <div style="font-size:14px;color:#444;line-height:1.5;margin-bottom:20px">${m.texto}</div>
        ${m.boton ? `<a href="${m.link}" style="display:inline-block;background:#2e7d32;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:bold">${m.boton}</a>
        <div style="font-size:11px;color:#999;margin-top:14px;word-break:break-all">Si el botón no funciona, copiá este link: ${m.link}</div>` : ''}
      </td></tr>
      <tr><td style="padding:14px 20px;border-top:1px solid #eee;font-size:11px;color:#999">
        ${m.pie ? m.pie + '<br>' : ''}¿Consultas? Escribinos a <a href="mailto:soporte@carreta.com.ar" style="color:#2e7d32">soporte@carreta.com.ar</a>
      </td></tr>
    </table>
  </td></tr></table></body></html>`
}

async function enviar(para: string, m: ReturnType<typeof armarMail>) {
  const { SMTPClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts')
  const user = Deno.env.get('AUTH_SMTP_USER')!
  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get('SMTP_HOST')!,
      port: Number(Deno.env.get('SMTP_PORT') || 465),
      tls: true,
      auth: { username: user, password: Deno.env.get('AUTH_SMTP_PASS')! },
    },
  })
  try {
    await client.send({
      from: `Carreta <${user}>`,
      to: para,
      subject: m.asunto,
      content: `${m.titulo}\n\n${m.texto.replace(/<[^>]+>/g, '')}\n\n${m.link}\n\n${m.pie}`,
      html: html(m),
    })
  } finally {
    await client.close()
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  // 🔒 Firma de Supabase (secreto del hook, formato "v1,whsec_...")
  const payload = await req.text()
  const crudo = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') || '').trim().replace(/^["']|["']$/g, '')
  const secreto = crudo.replace(/^v1,/, '').replace(/^whsec_/, '')
  if (!secreto) {
    console.error('[send-email-auth] Falta el secreto SEND_EMAIL_HOOK_SECRET')
    return json({ error: { http_code: 500, message: 'Falta SEND_EMAIL_HOOK_SECRET' } }, 500)
  }
  let datos: { user: { email: string; user_metadata?: Record<string, string> }; email_data: Record<string, string> }
  try {
    datos = new Webhook(secreto).verify(payload, Object.fromEntries(req.headers)) as typeof datos
  } catch (e) {
    console.error('[send-email-auth] Firma inválida:', (e as Error)?.message,
      '| largo secreto:', secreto.length, '| empieza:', crudo.slice(0, 9),
      '| headers webhook:', ['webhook-id', 'webhook-timestamp', 'webhook-signature'].map(h => req.headers.has(h)).join(','))
    return json({ error: { http_code: 401, message: 'Firma inválida' } }, 401)
  }

  const { user, email_data } = datos
  const mail = armarMail(email_data.email_action_type, email_data, user.user_metadata?.nombre || '')
  // En el cambio de email el link va al email nuevo
  const para = email_data.email_action_type === 'email_change' && (user as Record<string, string>).new_email
    ? (user as Record<string, string>).new_email
    : user.email

  // Respondemos ya; el mail sale en segundo plano (Ferozo puede tardar)
  const tarea = enviar(para, mail).catch(err => console.error('[send-email-auth]', para, err))
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime
  if (rt?.waitUntil) rt.waitUntil(tarea)
  else await tarea

  return json({})
})
