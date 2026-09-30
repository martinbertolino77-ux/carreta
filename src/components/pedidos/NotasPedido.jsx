import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Campo de notas privadas por rol. Se auto-guarda al perder foco.
export default function NotasPedido({ pedidoId, rol, usuarioId }) {
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    if (!pedidoId || !usuarioId) return
    supabase.from('notas_pedido').select('texto')
      .eq('pedido_id', pedidoId).eq('usuario_id', usuarioId).eq('rol', rol)
      .maybeSingle()
      .then(({ data }) => setTexto(data?.texto || ''))
  }, [pedidoId, usuarioId, rol])

  const guardar = async (val) => {
    setGuardando(true)
    await supabase.from('notas_pedido').upsert({
      pedido_id: pedidoId, usuario_id: usuarioId, rol,
      texto: val, updated_at: new Date().toISOString()
    }, { onConflict: 'pedido_id,usuario_id,rol' })
    setGuardando(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  const onChange = (v) => {
    setTexto(v); setGuardado(false)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => guardar(v), 1500)
  }

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold text-gray-600">📝 Mis notas (privadas)</div>
        <div className="text-[10px] text-gray-400">
          {guardando ? 'Guardando…' : guardado ? '✓ Guardado' : ''}
        </div>
      </div>
      <textarea rows={3} value={texto} onChange={e => onChange(e.target.value)}
        placeholder="Anotá lo que quieras recordar de este pedido (solo vos lo ves)"
        className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-xs bg-gray-50 focus:outline-none focus:border-azul-400 resize-none font-[Inter]" />
    </div>
  )
}
