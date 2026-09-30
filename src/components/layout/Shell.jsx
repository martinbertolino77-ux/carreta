// Shell: contenedor principal de la app móvil
export default function Shell({ children }) {
  return (
    <div className="max-w-[420px] mx-auto bg-white flex flex-col border-x border-gray-200"
      style={{ height: '100dvh', overflow: 'hidden' }}>
      {children}
    </div>
  )
}

// Body: área scrolleable entre topbar y bottomtabs
export function Body({ children, className = '' }) {
  return (
    <div className={`flex-1 overflow-y-auto px-3.5 py-3.5 pb-4 ${className}`}
      style={{ scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}>
      {children}
    </div>
  )
}
