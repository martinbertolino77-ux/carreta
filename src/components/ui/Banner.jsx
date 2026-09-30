const COLORS = {
  green:  'bg-verde-50 text-verde-800 border-verde-100',
  blue:   'bg-azul-50 text-azul-600 border-azul-100',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  red:    'bg-red-50 text-red-700 border-red-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
}

export default function Banner({ color = 'blue', title, children, className = '' }) {
  return (
    <div className={`rounded-[10px] px-3.5 py-2.5 mb-2.5 text-xs leading-relaxed border ${COLORS[color]} ${className}`}>
      {title && <div className="font-semibold mb-0.5">{title}</div>}
      {children}
    </div>
  )
}
