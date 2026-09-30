import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Modal from '../ui/Modal'
import Banner from '../ui/Banner'
import Button from '../ui/Button'
import Field, { Select, Textarea } from '../ui/Field'
import { MOTIVOS_CANCELACION } from '../../utils/constants'

// Modal de cancelación con motivo obligatorio.
// rol: 'productor' | 'transportista'
export default function ModalCancelar({ open, onClose, pedidoId, rol, onCancelado }) {
  const [motivo, setMotivo] = useState('')
  const [detalle, setDetalle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) { setMotivo(''); setDetalle(''); setError('') }
  }, [open])

  const esOtro = motivo === 'Otro'

  const confirmar = async () => {
    if (!motivo) { setError('Elegí un motivo'); return }
    if (esOtro && !detalle.trim()) { setError('Contá brevemente el motivo'); return }

    setSaving(true); setError('')
    const { error: err } = await supabase.rpc('cancelar_pedido', {
      p_pedido_id: pedidoId,
      p_rol: rol,
      p_motivo: motivo,
      p_detalle: detalle.trim() || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onCancelado?.()
  }

  return (
    <Modal open={open} onClose={onClose} title="Cancelar pedido">
      <Banner color="red" className="mb-3">
        {rol === 'productor'
          ? 'El pedido se cancela para todos. La otra parte verá el motivo.'
          : 'Dejás este viaje. El pedido vuelve a recibir ofertas y el productor verá el motivo.'}
        <br />La cancelación queda registrada en tu perfil.
      </Banner>

      <Field label="Motivo">
        <Select value={motivo} onChange={e => setMotivo(e.target.value)}>
          <option value="">Seleccioná</option>
          {MOTIVOS_CANCELACION[rol].map(m => <option key={m}>{m}</option>)}
        </Select>
      </Field>

      <Field label={esOtro ? 'Detalle' : 'Detalle (opcional)'}>
        <Textarea rows={2} placeholder="Ej: se rompió el acoplado"
          value={detalle} onChange={e => setDetalle(e.target.value)} />
      </Field>

      {error && <Banner color="red" className="mb-3">{error}</Banner>}

      <Button variant="danger" onClick={confirmar} disabled={saving}>
        {saving ? 'Cancelando…' : 'Sí, cancelar pedido'}
      </Button>
      <Button variant="ghost" onClick={onClose} className="mt-2">No, volver</Button>
    </Modal>
  )
}
