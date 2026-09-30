export default function Field({ label, error, children, hint }) {
  return (
    <div className="mb-3">
      {label && (
        <label className="block text-[11px] font-semibold text-azul-600 mb-1 tracking-wide">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
    </div>
  )
}

export function Input({ error, ...props }) {
  return (
    <input
      {...props}
      className={`w-full bg-gray-50 border rounded-[10px] px-3 py-2 text-sm text-gray-800 font-[Inter]
        focus:outline-none focus:border-verde-600 focus:bg-white transition-colors
        ${error ? 'border-red-400' : 'border-gray-200'}
        ${props.className || ''}`}
    />
  )
}

export function Select({ error, children, ...props }) {
  return (
    <select
      {...props}
      className={`w-full bg-gray-50 border rounded-[10px] px-3 py-2 text-sm text-gray-800 font-[Inter]
        appearance-none focus:outline-none focus:border-verde-600 focus:bg-white transition-colors cursor-pointer
        ${error ? 'border-red-400' : 'border-gray-200'}
        ${props.className || ''}`}
    >
      {children}
    </select>
  )
}

export function Textarea({ error, ...props }) {
  return (
    <textarea
      {...props}
      className={`w-full bg-gray-50 border rounded-[10px] px-3 py-2 text-sm text-gray-800 font-[Inter]
        focus:outline-none focus:border-verde-600 focus:bg-white transition-colors resize-none
        ${error ? 'border-red-400' : 'border-gray-200'}
        ${props.className || ''}`}
    />
  )
}
