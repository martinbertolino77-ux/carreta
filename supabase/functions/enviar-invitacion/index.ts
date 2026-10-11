// enviar-invitacion: manda por mail (desde soporte@) el link de invitación
// a una empresa. Lo llama la app después de generar la invitación.
// Solo un master de esa empresa puede mandarlo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SITE = 'https://carreta.com.ar'
const PERMISO: Record<string, string> = { master: 'Master', operador: 'Operador', lectura: 'Solo lectura', chofer: 'Chofer' }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const esc = (t: string) => String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

function html(d: { empresa: string; quien: string; permiso: string; link: string; vence: string; yaTiene: boolean }) {
  const pasos = d.yaTiene
    ? 'Como ya tenés usuario en Carreta, ingresá con este mismo mail y aceptá la invitación. Seguís en tu empresa actual y sumás esta.'
    : 'Tocá el botón, creá tu usuario con este mismo mail y vas a entrar directo a la empresa.'
  return `<!doctype html><html><body style="margin:0;background:#f4f6f4;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:14px;overflow:hidden">
      <tr><td style="background:#1b5e20;padding:16px 20px;color:#fff;font-size:18px;font-weight:bold">Carreta</td></tr>
      <tr><td style="padding:20px">
        <div style="font-size:16px;font-weight:bold;color:#111;margin-bottom:8px">Te invitaron a ${esc(d.empresa)}</div>
        <div style="font-size:14px;color:#444;line-height:1.5;margin-bottom:12px">
          ${esc(d.quien)} te invitó a sumarte al equipo de <b>${esc(d.empresa)}</b> en Carreta,
          con permiso <b>${esc(d.permiso)}</b>.
        </div>
        <div style="font-size:14px;color:#444;line-height:1.5;margin-bottom:20px">${pasos}</div>
        <a href="${d.link}" style="display:inline-block;background:#2e7d32;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:bold">${d.yaTiene ? 'Ver invitación' : 'Aceptar invitación'}</a>
        <div style="font-size:12px;color:#888;margin-top:14px">La invitación vence el ${esc(d.vence)}.</div>
        <div style="font-size:11px;color:#999;margin-top:8px;word-break:break-all">Si el botón no funciona, copiá este link: ${d.link}</div>
      </td></tr>
      <tr><td style="padding:14px 20px;border-top:1px solid #eee;font-size:11px;color:#999">
        Si no conocés a quien te invita, ignorá este mail.<br>¿Consultas? Escribinos a <a href="mailto:soporte@carreta.com.ar" style="color:#2e7d32">soporte@carreta.com.ar</a>
      </td></tr>
    </table>
  </td></tr></table></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    // 1. Quién pide
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    if (!token) return json({ error: 'No autorizado' }, 401)
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: u, error: uErr } = await sb.auth.getUser(token)
    if (uErr || !u?.user) return json({ error: 'Sesión inválida' }, 401)

    // 2. La invitación y su empresa
    const { token: tokenInv } = await req.json().catch(() => ({}))
    if (!tokenInv) return json({ error: 'Falta la invitación' }, 400)
    const { data: inv } = await sb.from('invitaciones')
      .select('id, email, permiso, token, vence_en, aceptada_en, cuenta_id, cuentas(razon_social)')
      .eq('token', tokenInv).maybeSingle()
    if (!inv) return json({ error: 'Invitación no encontrada' }, 404)
    if (inv.aceptada_en || new Date(inv.vence_en) < new Date()) return json({ error: 'La invitación venció o ya fue usada' }, 400)

    // 3. Solo un master de esa empresa
    const { data: yo } = await sb.from('miembros').select('permiso')
      .eq('cuenta_id', inv.cuenta_id).eq('usuario_id', u.user.id).maybeSingle()
    if (yo?.permiso !== 'master') return json({ error: 'Solo el master puede invitar' }, 403)

    const [{ data: quien }, { data: existe }] = await Promise.all([
      sb.from('usuarios').select('nombre, apellido').eq('id', u.user.id).maybeSingle(),
      sb.from('usuarios').select('id').ilike('email', inv.email).maybeSingle(),
    ])

    // deno-lint-ignore no-explicit-any
    const empresa = (inv as any).cuentas?.razon_social || 'una empresa'
    const datos = {
      empresa,
      quien: [quien?.nombre, quien?.apellido].filter(Boolean).join(' ') || 'Un integrante',
      permiso: PERMISO[inv.permiso] || inv.permiso,
      link: `${SITE}/registro?inv=${inv.token}`,
      vence: new Date(inv.vence_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }),
      yaTiene: !!existe,
    }

    // 4. Mandar desde soporte@ (SMTP de Ferozo)
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
        to: inv.email,
        subject: `${datos.quien} te invitó a ${empresa} en Carreta`,
        content: `${datos.quien} te invitó a sumarte a ${empresa} en Carreta (permiso ${datos.permiso}).\n\nAbrí este link: ${datos.link}\n\nVence el ${datos.vence}.`,
        html: html(datos),
      })
    } finally {
      await client.close()
    }
    return json({ ok: true })
  } catch (e) {
    console.error('[enviar-invitacion]', e)
    return json({ error: 'No se pudo mandar el mail' }, 500)
  }
})
