export default function Card({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-[14px] p-3.5 mb-2.5
        ${onClick ? 'cursor-pointer hover:border-verde-100 transition-colors' : ''}
        ${className}`}
    >
      {children}
    </div>
  )
}
