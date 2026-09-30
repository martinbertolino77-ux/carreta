const VARIANTS = {
  primary:   'bg-verde-700 text-white hover:bg-verde-800 active:scale-[.98]',
  secondary: 'bg-white text-verde-700 border border-verde-700 hover:bg-verde-50',
  danger:    'bg-white text-red-700 border border-red-200 hover:bg-red-50',
  ghost:     'bg-transparent text-gray-500 border border-gray-200 hover:bg-gray-50',
  whatsapp:  'bg-[#25D366] text-white hover:bg-[#1ebe57]',
  azul:      'bg-azul-600 text-white hover:bg-azul-800',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  full = true,
  disabled = false,
  onClick,
  children,
  className = '',
  type = 'button',
}) {
  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
  const w  = full ? 'w-full' : ''
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${w} ${sz} rounded-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all
        ${VARIANTS[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}`}
    >
      {children}
    </button>
  )
}
