import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/45 flex items-end justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl p-5 w-full max-w-[420px] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {title && <h2 className="text-base font-bold text-gray-900 mb-1.5">{title}</h2>}
        {children}
      </div>
    </div>
  )
}
