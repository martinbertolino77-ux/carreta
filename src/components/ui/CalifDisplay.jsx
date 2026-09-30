import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Estrellas from './Estrellas'

// Muestra promedio de estrellas de un transportista o productor
// modo='transportista': llama calif_transportista(transportistaId)
// modo='productor': llama calif_productor(pedidoId)
export default function CalifDisplay({ transportistaId, pedidoId, className = '' }) {
  const [d, setD] = useState(null)

  useEffect(() => {
    if (transportistaId) {
      supabase.rpc('calif_transportista', { p_transportista_id: transportistaId })
        .then(({ data }) => setD(Array.isArray(data) ? data[0] : data))
    } else if (pedidoId) {
      supabase.rpc('calif_productor', { p_pedido_id: pedidoId })
        .then(({ data }) => setD(Array.isArray(data) ? data[0] : data))
    }
  }, [transportistaId, pedidoId])

  if (!d || !d.total) return null
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Estrellas valor={Math.round(d.promedio)} readonly size="sm" />
      <span className="text-[11px] text-gray-500">{d.promedio} ({d.total} viaje{d.total > 1 ? 's' : ''})</span>
    </div>
  )
}
