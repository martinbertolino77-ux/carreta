// Shell: contenedor principal. En el celular es una columna;
// en la PC (≥1024px) ocupa la pantalla con menú lateral (ver index.css)
export default function Shell({ children }) {
  return (
    <div className="shell max-w-[420px] mx-auto bg-white flex flex-col border-x border-gray-200"
      style={{ height: '100dvh', overflow: 'hidden' }}>
      {children}
    </div>
  )
}

// Body: área scrolleable entre topbar y bottomtabs
export function Body({ children, className = '' }) {
  return (
    <div className={`shell-body flex-1 overflow-y-auto px-3.5 py-3.5 pb-4 lg:px-8 lg:py-6 ${className}`}
      style={{ scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}>
      <div className="lg:max-w-3xl lg:mx-auto">{children}</div>
    </div>
  )
}
