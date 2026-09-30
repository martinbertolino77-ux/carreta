export default function Route({ origen, destino }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-1">
      <div className="w-1.5 h-1.5 rounded-full bg-verde-600 flex-shrink-0" />
      <span>{origen}</span>
      <div className="w-4 h-px bg-gray-200 flex-shrink-0" />
      <svg width="7" height="7" viewBox="0 0 8 8" className="flex-shrink-0">
        <polygon points="0,0 8,4 0,8" fill="#9ca3af"/>
      </svg>
      <div className="w-1.5 h-1.5 rounded bg-azul-600 flex-shrink-0" />
      <span>{destino}</span>
    </div>
  )
}
