import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// "Canceló X de Y viajes" de un usuario en un rol.
// pedidoId: contador del productor de ese pedido (lo usa el transportista).
export default function Contador({ usuarioId, rol, pedidoId, className = '' }) {
  const [d, setD] = useState(null)

  useEffect(() => {
    const q = pedidoId
      ? supabase.rpc('contador_productor_pedido', { p_pedido_id: pedidoId })
      : usuarioId ? supabase.rpc('contador_cancelaciones', { p_usuario_id: usuarioId, p_rol: rol }) : null
    if (!q) return
    q.then(({ data }) => setD(Array.isArray(data) ? data[0] : data))
  }, [usuarioId, rol, pedidoId])

  if (!d || !d.viajes) return null
  const palabra = rol === 'productor' ? 'pedidos' : 'viajes'
  return d.canceladas > 0 ? (
    <div className={`text-[11px] text-orange-700 ${className}`}>⚠️ Canceló {d.canceladas} de {d.viajes} {palabra}</div>
  ) : (
    <div className={`text-[11px] text-verde-700 ${className}`}>✔ Sin cancelaciones ({d.viajes} {palabra})</div>
  )
}
