import { useEffect, useRef, useState } from 'react'
import { buscarLocalidades } from '../../utils/georef'

// Campo de localidad con buscador oficial (Georef).
// value: texto mostrado. onSelect({ localidad, departamento, provincia }).
// Si Georef no responde, deja escribir libre (onChange).
export default function LocalidadInput({ value, onSelect, onChange, provincia = '', placeholder = 'Escribí 3 letras…', error }) {
  const [texto, setTexto] = useState(value || '')
  const [opciones, setOpciones] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const timer = useRef(null)
  const elegido = useRef(false)

  useEffect(() => { setTexto(value || '') }, [value])

  useEffect(() => {
    if (elegido.current) { elegido.current = false; return }
    clearTimeout(timer.current)
    if (texto.trim().length < 3) { setOpciones([]); return }
    timer.current = setTimeout(async () => {
      setBuscando(true)
      const r = await buscarLocalidades(texto, provincia)
      setOpciones(r); setBuscando(false); setAbierto(true)
    }, 300)
    return () => clearTimeout(timer.current)
  }, [texto, provincia])

  const elegir = (o) => {
    elegido.current = true
    setTexto(o.localidad)
    setAbierto(false)
    onSelect?.(o)
  }

  return (
    <div className="relative">
      <input
        value={texto}
        placeholder={placeholder}
        onChange={e => { setTexto(e.target.value); onChange?.(e.target.value) }}
        onFocus={() => opciones.length && setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        className={`w-full bg-gray-50 border rounded-[10px] px-3 py-2 text-sm text-gray-800 font-[Inter]
          focus:outline-none focus:border-azul-400 ${error ? 'border-red-400' : 'border-gray-200'}`}
      />
      {buscando && <span className="absolute right-3 top-2.5 text-[10px] text-gray-400">buscando…</span>}
      {abierto && opciones.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-[10px] shadow-lg max-h-60 overflow-y-auto">
          {opciones.map((o, i) => (
            <button key={i} type="button" onMouseDown={() => elegir(o)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0">
              <div className="text-sm text-gray-900">{o.localidad}</div>
              <div className="text-[11px] text-gray-400">{o.departamento}{o.departamento ? ', ' : ''}{o.provincia}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
