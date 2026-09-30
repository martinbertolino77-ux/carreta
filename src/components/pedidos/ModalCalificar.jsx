import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Modal from '../ui/Modal'
import Banner from '../ui/Banner'
import Button from '../ui/Button'
import Field, { Textarea } from '../ui/Field'
import Estrellas from '../ui/Estrellas'

// items: [{ label, hint }] — 3 ítems según el rol
export default function ModalCalificar({ open, onClose, ofertaId, rol, pedidoNumero, onCalificado, obligatorio = false }) {
  const ITEMS = rol === 'productor'
    ? [
        { label: 'Puntualidad', hint: 'Llegó en la fecha acordada' },
        { label: 'Estado del equipo', hint: 'Camión y remolque en condiciones' },
        { label: 'Trato', hint: 'Comunicación y actitud' },
      ]
    : [
        { label: 'Facilidad de carga', hint: 'Acceso al campo, tiempos de espera' },
        { label: 'Pago en término', hint: 'Cumplió con lo acordado' },
        { label: 'Trato', hint: 'Comunicación y actitud' },
      ]

  const [pts, setPts] = useState([0, 0, 0])
  const [comentario, setComentario] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const reset = () => { setPts([0, 0, 0]); setComentario(''); setError('') }

  const guardar = async () => {
    if (pts.some(p => p === 0)) { setError('Calificá los tres ítems'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('calificaciones').insert({
      oferta_id: ofertaId,
      calificador_rol: rol,
      puntaje_1: pts[0],
      puntaje_2: pts[1],
      puntaje_3: pts[2],
      comentario: comentario.trim() || null,
    })
    setSaving(false)
    if (err) {
      if (err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
        // Ya calificado — cerrar y notificar
        reset(); onCalificado?.()
        return
      }
      setError(err.message); return
    }
    reset(); onCalificado?.()
  }

  return (
    <Modal open={open} onClose={() => { if (!obligatorio) { reset(); onClose() } }} title={`Calificar pedido #${String(pedidoNumero || '').padStart(4, '0')}`} hideClose={obligatorio}>
      <div className="text-xs text-gray-500 mb-4">
        {rol === 'productor' ? 'Calificá al transportista de este viaje.' : 'Calificá al productor de este pedido.'}
        {' '}Tu calificación es anónima para la otra parte pero ayuda a la comunidad.
      </div>

      {ITEMS.map((item, i) => (
        <div key={i} className="mb-4">
          <div className="text-sm font-semibold text-gray-800 mb-0.5">{item.label}</div>
          {item.hint && <div className="text-xs text-gray-400 mb-1">{item.hint}</div>}
          <Estrellas valor={pts[i]} onChange={v => setPts(p => p.map((x, j) => j === i ? v : x))} />
        </div>
      ))}

      <Field label="Comentario (opcional)">
        <Textarea rows={2} placeholder="¿Algo para destacar?" value={comentario}
          onChange={e => setComentario(e.target.value)} />
      </Field>

      {error && <Banner color="red" className="mb-3">{error}</Banner>}

      <Button onClick={guardar} disabled={saving}>
        {saving ? 'Guardando…' : '⭐ Enviar calificación'}
      </Button>

    </Modal>
  )
}
