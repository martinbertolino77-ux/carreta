import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdminShell from './Shell'


const ROLES = ['todos', 'productor', 'transportista']

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')
  const [expandido, setExpandido] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('usuarios')
      .select('id, nombre, apellido, razon_social, email, cuit, telefono, localidad, provincia, roles, is_admin, activo, created_at')
      .order('created_at', { ascending: false })
    setUsuarios(data || [])
    setLoading(false)
  }

  const toggleActivo = async (u) => {
    if (!confirm(`¿${u.activo ? 'Desactivar' : 'Activar'} a ${u.razon_social || u.nombre}?`)) return
    await supabase.rpc('admin_toggle_usuario', { p_usuario_id: u.id, p_activo: !u.activo })
    cargar()
  }

  const toggleAdmin = async (u) => {
    const accion = u.is_admin ? 'quitar permisos admin a' : 'hacer admin a'
    if (!confirm(`¿Querés ${accion} ${u.razon_social || u.nombre}?`)) return
    await supabase.from('usuarios').update({ is_admin: !u.is_admin }).eq('id', u.id)
    cargar()
  }

  const toggleExpandido = (id) => setExpandido(expandido === id ? null : id)

  const filtrados = usuarios.filter(u => {
    const q = busqueda.toLowerCase()
    const matchRol = filtroRol === 'todos' || (u.roles || []).includes(filtroRol)
    const matchBusqueda = !q || u.nombre?.toLowerCase().includes(q) || u.apellido?.toLowerCase().includes(q)
      || u.razon_social?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      || u.cuit?.includes(q)
    return matchRol && matchBusqueda
  })

  const exportar = async () => {
    const XLSX = await import('xlsx')
    const filas = filtrados.map(u => ({
      'Nombre': `${u.nombre} ${u.apellido}`,
      'Razón social': u.razon_social,
      'Email': u.email,
      'CUIT': u.cuit,
      'Teléfono': u.telefono,
      'Localidad': u.localidad,
      'Provincia': u.provincia,
      'Roles': (u.roles || []).join(', '),
      'Admin': u.is_admin ? 'Sí' : 'No',
      'Activo': u.activo ? 'Sí' : 'No',
      'Registro': u.created_at?.slice(0, 10),
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Usuarios')
    XLSX.writeFile(wb, 'carreta_usuarios.xlsx')
  }

  return (
    <AdminShell seccion="usuarios">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Usuarios ({filtrados.length})</h2>
        <button onClick={exportar} className="text-xs bg-gray-900 text-white rounded-lg px-3 py-1.5 hover:bg-gray-700">⬇ Excel</button>
      </div>

      <div className="flex gap-1 mb-3">
        {ROLES.map(r => (
          <button key={r} onClick={() => setFiltroRol(r)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${filtroRol === r ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
            {r === 'todos' ? 'Todos' : r === 'productor' ? '🌱 Productor' : '🚛 Transportista'}
          </button>
        ))}
      </div>

      <input placeholder="Buscar por nombre, email o CUIT…" value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:border-gray-400" />

      {loading ? <p className="text-sm text-gray-400">Cargando…</p> : (
        <div className="space-y-2">
          {filtrados.map(u => (
            <div key={u.id} className={`bg-white rounded-xl border transition-opacity ${!u.activo ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3 p-4 cursor-pointer"
                onClick={() => toggleExpandido(u.id)}>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-900">
                    {u.razon_social || `${u.nombre} ${u.apellido}`}
                    {u.is_admin && <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">⚡ Admin</span>}
                  </div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                  <div className="flex gap-1 mt-1">
                    {(u.roles || []).map(r => (
                      <span key={r} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {r === 'productor' ? '🌱' : '🚛'} {r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-gray-300 text-xs">{expandido === u.id ? '▲' : '▼'}</span>
                  <button onClick={e => { e.stopPropagation(); toggleActivo(u) }}
                    className={`text-xs px-3 py-1 rounded-lg font-medium ${u.activo ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>

              {expandido === u.id && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-xl">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
                    <div>
                      <div className="text-[10px] text-gray-400">CUIT</div>
                      <div className="text-xs text-gray-700">{u.cuit || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">Teléfono</div>
                      <div className="text-xs text-gray-700">{u.telefono || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">Localidad</div>
                      <div className="text-xs text-gray-700">{u.localidad || '—'}, {u.provincia || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">Registro</div>
                      <div className="text-xs text-gray-700">{u.created_at?.slice(0, 10)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">Estado</div>
                      <div className="text-xs text-gray-700">{u.activo ? '✅ Activo' : '❌ Inactivo'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">Permisos</div>
                      <div className="text-xs text-gray-700">{u.is_admin ? '⚡ Admin' : 'Usuario normal'}</div>
                    </div>
                  </div>
                  <button onClick={() => toggleAdmin(u)}
                    className={`w-full text-xs py-2 rounded-xl font-medium ${u.is_admin ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' : 'bg-gray-900 text-white hover:bg-gray-700'}`}>
                    {u.is_admin ? '⚡ Quitar admin' : '⚡ Hacer admin'}
                  </button>
                </div>
              )}
            </div>
          ))}
          {filtrados.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Sin resultados</p>
          )}
        </div>
      )}
    </AdminShell>
  )
}
