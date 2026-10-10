import { useMemo, useState } from 'react'
import Card from '../ui/Card'
import Toggle from '../ui/Toggle'
import { VEHICULOS, TIPOS_CHASIS } from '../../utils/constants'

// Flota del transportista agrupada: pestañas (chasis / remolques / choferes),
// buscador, grupos por tipo que se abren y cierran, e inactivos aparte.
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function Grupo({ titulo, items, abierto, onToggle, render, aviso }) {
  return (
    <div className="mb-2">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between bg-gray-50 rounded-[10px] px-3 py-2 text-left">
        <span className="text-xs font-semibold text-gray-700">
          {abierto ? '▾' : '▸'} {titulo} <span className="text-gray-400 font-normal">({items.length})</span>
        </span>
        {aviso > 0 && <span className="text-[10px] text-orange-600 font-semibold">⚠️ {aviso} sin tara</span>}
      </button>
      {abierto && <div className="mt-1.5">{items.map(render)}</div>}
    </div>
  )
}

export default function Flota({ chasis, acoplados, choferes, onAgregar, onEditar, onToggleActivo }) {
  const [tab, setTab] = useState('chasis')
  const [busca, setBusca] = useState('')
  const [abiertos, setAbiertos] = useState({})   // clave de grupo → abierto

  const TABS = [
    { id: 'chasis',    label: 'Chasis',    n: chasis.length,    icono: '🚛' },
    { id: 'acoplados', label: 'Remolques', n: acoplados.length, icono: '🔗' },
    { id: 'choferes',  label: 'Choferes',  n: choferes.length,  icono: '👤' },
  ]

  const lista = tab === 'chasis' ? chasis : tab === 'acoplados' ? acoplados : choferes
  const q = norm(busca.trim())
  const filtrada = useMemo(() => !q ? lista : lista.filter(x =>
    norm([x.dominio, x.nombre, x.apellido, x.dni, x.cuit, x.carnet].filter(Boolean).join(' ')).includes(q)
  ), [lista, q])

  // Grupos: por tipo (vehículos) o por letra del apellido (choferes, solo si son muchos); inactivos al final
  const grupos = useMemo(() => {
    const activos = filtrada.filter(x => x.activo !== false)
    const inactivos = filtrada.filter(x => x.activo === false)
    const g = new Map()
    for (const x of activos) {
      let k
      if (tab === 'chasis') k = TIPOS_CHASIS[x.tipo] || 'Solo chasis'
      else if (tab === 'acoplados') k = VEHICULOS[x.tipo] || 'Sin tipo'
      else k = activos.length > 15 ? (x.apellido?.[0] || '#').toUpperCase() : 'Activos'
      if (!g.has(k)) g.set(k, [])
      g.get(k).push(x)
    }
    const res = [...g.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([titulo, items]) => ({ clave: `${tab}:${titulo}`, titulo, items }))
    if (inactivos.length) res.push({ clave: `${tab}:__inactivos`, titulo: 'Inactivos', items: inactivos, inactivos: true })
    return res
  }, [filtrada, tab])

  // Con búsqueda o con un solo grupo, todo abierto; si no, abiertos los que el usuario abrió (inactivos cerrado)
  const estaAbierto = (gr) => q || grupos.length === 1 ? true : (abiertos[gr.clave] ?? (!gr.inactivos && grupos.length <= 3))
  const toggle = (gr) => setAbiertos(a => ({ ...a, [gr.clave]: !estaAbierto(gr) }))

  const tabla = tab === 'chasis' ? 'chasis' : tab === 'acoplados' ? 'acoplados' : 'choferes'

  const fila = (x) => (
    <div key={x.id} className="flex items-center justify-between border border-gray-100 rounded-[10px] px-3 py-2 mb-1.5">
      <div className="min-w-0">
        {tab === 'choferes' ? (<>
          <div className="text-sm font-semibold text-gray-900 truncate">{x.apellido}, {x.nombre}</div>
          <div className="text-[11px] text-gray-400 truncate">
            {x.cuit ? `CUIT ${x.cuit}` : `DNI ${x.dni || '—'}`}{x.carnet ? ` · Carnet ${x.carnet}` : ''}
          </div>
        </>) : (<>
          <div className="text-sm font-semibold text-gray-900">{x.dominio}</div>
          <div className="text-[11px] text-gray-400">
            {x.tara_kg ? `Tara ${Number(x.tara_kg).toLocaleString('es-AR')} kg` : <span className="text-orange-600">⚠️ falta tara</span>}
            {tab === 'acoplados' && x.capacidad_kg ? ` · Cap. ${Number(x.capacidad_kg).toLocaleString('es-AR')} kg` : ''}
            {tab === 'acoplados' && x.seguro_poliza ? ` · Póliza ${x.seguro_poliza}` : ''}
          </div>
        </>)}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => onEditar(tab, x)} className="text-xs text-azul-600">Editar</button>
        <Toggle value={x.activo} onChange={() => onToggleActivo(tabla, x.id, x.activo)} />
      </div>
    </div>
  )

  return (
    <Card className="mb-3">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-sm font-semibold text-gray-900">Mi flota</div>
        <button onClick={() => onAgregar(tab)} className="text-xs text-azul-600 font-semibold">
          + Agregar {tab === 'chasis' ? 'chasis' : tab === 'acoplados' ? 'remolque' : 'chofer'}
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-[10px] p-1 mb-2.5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setBusca('') }}
            className={`flex-1 text-xs font-semibold rounded-[8px] py-1.5 transition-colors
              ${tab === t.id ? 'bg-white text-azul-600 shadow-sm' : 'text-gray-500'}`}>
            {t.icono} {t.label} <span className="font-normal opacity-70">{t.n}</span>
          </button>
        ))}
      </div>

      {lista.length > 5 && (
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder={tab === 'choferes' ? 'Buscar por nombre, DNI o CUIT' : 'Buscar dominio'}
          className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm mb-2.5 bg-gray-50 focus:outline-none focus:border-azul-600" />
      )}

      {lista.length === 0 ? (
        <div className="text-center py-4">
          <div className="text-2xl mb-1 opacity-40">{TABS.find(t => t.id === tab).icono}</div>
          <div className="text-xs text-gray-400">Todavía no cargaste {tab === 'chasis' ? 'chasis' : tab === 'acoplados' ? 'remolques' : 'choferes'}</div>
        </div>
      ) : filtrada.length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-3">Sin resultados para "{busca}"</div>
      ) : grupos.map(gr => (
        <Grupo key={gr.clave} titulo={gr.titulo} items={gr.items}
          abierto={estaAbierto(gr)} onToggle={() => toggle(gr)} render={fila}
          aviso={tab === 'choferes' ? 0 : gr.items.filter(x => !x.tara_kg).length} />
      ))}
    </Card>
  )
}
