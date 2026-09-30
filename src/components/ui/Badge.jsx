const COLORS = {
  green:  'bg-verde-50 text-verde-700 border-verde-100',
  blue:   'bg-azul-50 text-azul-600 border-azul-100',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  red:    'bg-red-50 text-red-700 border-red-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  gray:   'bg-gray-100 text-gray-600 border-gray-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
}

export default function Badge({ color = 'gray', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${COLORS[color]} ${className}`}>
      {children}
    </span>
  )
}
