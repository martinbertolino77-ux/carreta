// Selector o display de estrellas (1-5)
export default function Estrellas({ valor = 0, onChange, readonly = false, size = 'md' }) {
  const s = size === 'sm' ? 'text-base' : 'text-xl'
  return (
    <div className={`flex gap-0.5 ${readonly ? '' : 'cursor-pointer'}`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} onClick={() => !readonly && onChange?.(n)}
          className={`${s} ${n <= valor ? 'text-yellow-400' : 'text-gray-200'} ${!readonly ? 'hover:text-yellow-300' : ''}`}>
          ★
        </span>
      ))}
    </div>
  )
}
