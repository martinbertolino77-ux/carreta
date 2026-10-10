import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

// Toda respuesta lleva CORS (si no, el navegador muestra "Failed to fetch")
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Usuario válido
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return json({ error: 'No autorizado' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user) return json({ error: 'Sesión inválida' }, 401)
    const userId = userData.user.id

    // 2. Datos del formulario
    const formData = await req.formData()
    const file = formData.get('file') as File
    const pedidoId = formData.get('pedido_id') as string
    const camionId = formData.get('camion_id') as string
    const tipo = formData.get('tipo') as string
    const kilos = formData.get('kilos') as string

    if (!file || !pedidoId || !camionId) return json({ error: 'Faltan datos' }, 400)

    // 3. Solo PDF, tamaño máximo
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      return json({ error: 'Solo se aceptan archivos PDF' }, 400)
    }
    if (file.size > MAX_BYTES) return json({ error: 'El PDF supera 10 MB' }, 400)

    // 4. El pedido tiene que ser de la cuenta del usuario, con permiso para operar
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, productores(cuenta_id)')
      .eq('id', pedidoId)
      .single()

    if (pedidoError || !pedido) return json({ error: 'Pedido no encontrado' }, 404)
    // deno-lint-ignore no-explicit-any
    const cuentaId = (pedido as any).productores?.cuenta_id
    const { data: miembro } = await supabase
      .from('miembros')
      .select('permiso')
      .eq('cuenta_id', cuentaId)
      .eq('usuario_id', userId)
      .maybeSingle()

    if (!miembro) return json({ error: 'No tenés permiso sobre este pedido' }, 403)
    if (miembro.permiso === 'lectura') {
      return json({ error: 'Tu usuario es de solo lectura. Pedile al master permiso de operador.' }, 403)
    }

    // 5. Subir archivo
    const path = `${pedidoId}/${camionId}.pdf`

    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, file, { upsert: true, contentType: 'application/pdf' })
    if (uploadError) throw uploadError

    // 6. Registrar documento (reemplaza el anterior del camión)
    await supabase.from('documentos').delete().eq('camion_viaje_id', camionId)

    const { error: insertError } = await supabase.from('documentos').insert({
      camion_viaje_id: camionId,
      pedido_id: pedidoId,
      tipo: tipo === 'dte' ? 'dte' : 'cpe',
      storage_path: path,
      nombre_original: file.name,
      kilos_asignados: kilos ? Number(kilos) : null,
    })
    if (insertError) throw insertError

    return json({ path, nombre: file.name })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
