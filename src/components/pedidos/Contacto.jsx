// Botones Llamar / WhatsApp a partir de un teléfono argentino
export function waNumero(tel = '') {
  let d = String(tel).replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('54')) return d.startsWith('549') ? d : '549' + d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)
  d = d.replace(/^(\d{2,4})15/, '$1')   // quita el 15 del celular
  return '549' + d
}

export default function Contacto({ telefono, mensaje = '', className = '' }) {
  if (!telefono) return null
  const wa = waNumero(telefono)
  return (
    <div className={`flex gap-2 mt-1.5 ${className}`}>
      <a href={`tel:${telefono}`} onClick={e => e.stopPropagation()}
        className="flex-1 text-center text-xs font-semibold border border-gray-200 rounded-[8px] py-1.5 text-gray-700 bg-white">
        📞 {telefono}
      </a>
      {wa && (
        <a href={`https://wa.me/${wa}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`}
          target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
          className="flex-1 text-center text-xs font-semibold rounded-[8px] py-1.5 text-white bg-[#25D366]">
          💬 WhatsApp
        </a>
      )}
    </div>
  )
}
