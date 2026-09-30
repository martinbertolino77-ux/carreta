import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdminShell from './Shell'
import { formatNroPedido } from '../../utils/format'

export default function AdminCalificaciones() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')
  const [expandido, setExpandido] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('calificaciones')
      .select(`id, calificador_rol, puntaje_1, puntaje_2, puntaje_3, comentario, visible, created_at,
        ofertas(pedido_id, pedidos(numero), transportistas(usuarios(razon_social, nombre, apellido)),
        productores:pedidos(productores(usuarios(razon_social, nombre, apellido))))`)
      .order('created_at', { ascending: false })
      .limit(300)
    setItems(data || [])
    setLoading(false)
  }

  const toggleVisible = async (c) => {
    await supabase.rpc('admin_toggle_calificacion', { p_id: c.id, p_visible: !c.visible })
    cargar()
  }

  const prom = (c) => ((c.puntaje_1 + c.puntaje_2 + c.puntaje_3) / 3).toFixed(1)
  const estrellas = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n))

  const LABELS = ['Puntualidad', 'Trato', 'Cumplimiento']

  const filtrados = items.filter(c =>
    filtro === 'todas' ? true : filtro === 'ocultas' ? !c.visible : c.visible
  )

  return (
    <AdminShell seccion="calificaciones">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Calificaciones ({filtrados.length})</h2>
        <div className="flex gap-1">
          {['todas', 'visibles', 'ocultas'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`text-xs px-3 py-1 rounded-full border ${filtro === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-sm text-gray-400">Cargando…</p> : (
        <div className="space-y-2">
          {filtrados.map(c => {
            const transp = c.ofertas?.transportistas?.usuarios
            const nombreT = transp?.razon_social || `${transp?.nombre || ''} ${transp?.apellido || ''}`.trim()
            const numero = c.ofertas?.pedidos?.numero
            const promedio = Number(prom(c))
            const abierto = expandido === c.id

            return (
              <div key={c.id} className={`bg-white rounded-xl border ${!c.visible ? 'opacity-50' : ''}`}>
                {/* Fila principal */}
                <div className="flex items-start justify-between gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandido(abierto ? null : c.id)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-yellow-500 text-sm">{estrellas(promedio)}</span>
                      <span className="text-xs font-bold text-gray-900">{prom(c)}</span>
                      <span className="text-[10px] text-gray-400">· Pedido {numero ? formatNroPedido(numero) : '—'}</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {c.calificador_rol === 'productor' ? '🌱 Productor calificó a' : '🚛 Transportista calificó a'} <b>{nombreT || '—'}</b>
                    </div>
                    {c.comentario && <div className="text-xs text-gray-500 mt-1 italic">"{c.comentario}"</div>}
                    <div className="text-[10px] text-gray-300 mt-1">{c.created_at?.slice(0, 10)}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-gray-300 text-xs">{abierto ? '▲' : '▼'}</span>
                    <button onClick={e => { e.stopPropagation(); toggleVisible(c) }}
                      className={`text-xs px-3 py-1 rounded-lg ${c.visible ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                      {c.visible ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                </div>

                {/* Puntajes separados */}
                {abierto && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-xl">
                    <div className="text-xs font-semibold text-gray-700 mb-2">Puntajes detallados</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[c.puntaje_1, c.puntaje_2, c.puntaje_3].map((p, i) => (
                        <div key={i} className="bg-white rounded-lg border border-gray-100 px-3 py-2 text-center">
                          <div className="text-lg font-bold text-gray-900">{p}</div>
                          <div className="text-yellow-400 text-xs">{estrellas(p)}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{LABELS[i]}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">Promedio general</span>
                      <span className="text-sm font-bold text-gray-900">{prom(c)} <span className="text-yellow-500">{estrellas(promedio)}</span></span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </AdminShell>
  )
}
