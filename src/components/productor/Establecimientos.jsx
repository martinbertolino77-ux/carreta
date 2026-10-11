import { useMemo, useState } from 'react'
import Card from '../ui/Card'
import Toggle from '../ui/Toggle'

// Establecimientos del productor: tarjeta replegada, buscador si son muchos,
// grupos por provincia (si hay más de una) e inactivos aparte. Todo se abre al tocar.
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function Grupo({ titulo, items, abierto, onToggle, render }) {
  return (
    <div className="mb-2">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between bg-gray-50 rounded-[10px] px-3 py-2 text-left">
        <span className="text-xs font-semibold text-gray-700">
          {abierto ? '▾' : '▸'} {titulo} <span className="text-gray-400 font-normal">({items.length})</span>
        </span>
      </button>
      {abierto && <div className="mt-1.5">{items.map(render)}</div>}
    </div>
  )
}

export default function Establecimientos({ establecimientos, onAgregar, onEditar, onToggleActivo, soloVer = false }) {
  const [abierta, setAbierta] = useState(false)
  const [busca, setBusca] = useState('')
  const [abiertos, setAbiertos] = useState({})

  const q = norm(busca.trim())
  const filtrada = useMemo(() => !q ? establecimientos : establecimientos.filter(e =>
    norm([e.nombre, e.localidad, e.provincia, e.departamento].filter(Boolean).join(' ')).includes(q)
  ), [establecimientos, q])

  const grupos = useMemo(() => {
    const activos = filtrada.filter(e => e.activo !== false)
    const inactivos = filtrada.filter(e => e.activo === false)
    const provincias = new Set(establecimientos.filter(e => e.activo !== false).map(e => e.provincia || 'Sin provincia'))
    const g = new Map()
    for (const e of activos) {
      const k = provincias.size > 1 ? (e.provincia || 'Sin provincia') : 'Activos'
      if (!g.has(k)) g.set(k, [])
      g.get(k).push(e)
    }
    const res = [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([titulo, items]) => ({ clave: titulo, titulo, items: items.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')) }))
    if (inactivos.length) res.push({ clave: '__inactivos', titulo: 'Inactivos', items: inactivos })
    return res
  }, [filtrada, establecimientos])

  const estaAbierto = (gr) => q ? true : !!abiertos[gr.clave]
  const toggle = (gr) => setAbiertos(a => ({ ...a, [gr.clave]: !estaAbierto(gr) }))

  const activos = establecimientos.filter(e => e.activo !== false).length
  const inactivos = establecimientos.length - activos

  const fila = (e) => (
    <div key={e.id} className="border border-gray-100 rounded-[10px] p-3 mb-1.5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{e.nombre}</div>
          <div className="text-xs text-gray-500 mt-0.5">📍 {e.localidad}, {e.provincia}</div>
          {e.telefono && <div className="text-xs text-gray-400 mt-0.5">📞 {e.telefono}</div>}
          {e.whatsapp && (
            <a href={`https://wa.me/54${e.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
              className="text-xs text-green-600 font-medium mt-0.5 block">💬 WhatsApp</a>
          )}
          {e.link_maps && <a href={e.link_maps} target="_blank" rel="noreferrer" className="text-xs text-azul-600 mt-0.5 block">Ver en Maps</a>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {!soloVer && <button onClick={() => onEditar(e)} className="text-xs text-azul-600 font-medium">Editar</button>}
          {!soloVer && <Toggle value={e.activo} onChange={() => onToggleActivo(e.id, e.activo)} />}
        </div>
      </div>
    </div>
  )

  return (
    <Card className="mb-3">
      <button onClick={() => setAbierta(a => !a)} className="w-full flex items-center justify-between text-left">
        <div>
          <div className="text-sm font-semibold text-gray-900">{abierta ? '▾' : '▸'} Mis establecimientos</div>
          {!abierta && (
            <div className="text-[11px] text-gray-400 mt-0.5">
              {establecimientos.length === 0 ? 'Ninguno cargado'
                : `${activos} activo${activos === 1 ? '' : 's'}${inactivos ? ` · ${inactivos} inactivo${inactivos === 1 ? '' : 's'}` : ''}`}
            </div>
          )}
        </div>
        {!abierta && <span className="text-xs text-azul-600 font-semibold">Ver</span>}
      </button>

      {abierta && (<>
        {!soloVer && <div className="flex justify-end mt-2 mb-2">
          <button onClick={onAgregar} className="text-xs text-azul-600 font-semibold">+ Agregar establecimiento</button>
        </div>}

        {establecimientos.length > 5 && (
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nombre o localidad"
            className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm mb-2.5 bg-gray-50 focus:outline-none focus:border-azul-600" />
        )}

        {establecimientos.length === 0 ? (
          <div className="text-center py-4">
            <div className="text-2xl mb-1 opacity-40">🏡</div>
            <div className="text-xs text-gray-400">No tenés establecimientos cargados</div>
            {!soloVer && <button onClick={onAgregar} className="text-xs text-verde-700 font-semibold mt-1">Agregar el primero</button>}
          </div>
        ) : filtrada.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-3">Sin resultados para "{busca}"</div>
        ) : grupos.map(gr => (
          <Grupo key={gr.clave} titulo={gr.titulo} items={gr.items}
            abierto={estaAbierto(gr)} onToggle={() => toggle(gr)} render={fila} />
        ))}
      </>)}
    </Card>
  )
}
