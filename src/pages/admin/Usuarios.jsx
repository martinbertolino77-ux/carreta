import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdminShell from './Shell'
import * as XLSX from 'xlsx'

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [busqueda, setBusqueda] = useState('')
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

  const filtrados = usuarios.filter(u => {
    const q = busqueda.toLowerCase()
    return !q || u.nombre?.toLowerCase().includes(q) || u.apellido?.toLowerCase().includes(q)
      || u.razon_social?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      || u.cuit?.includes(q)
  })

  const exportar = () => {
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
      'Registro': u.created_at?.slice(0,10),
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
      <input placeholder="Buscar por nombre, email o CUIT…" value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:border-gray-400" />
      {loading ? <p className="text-sm text-gray-400">Cargando…</p> : (
        <div className="space-y-2">
          {filtrados.map(u => (
            <div key={u.id} className={`bg-white rounded-xl border p-4 ${!u.activo ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-900">{u.razon_social || `${u.nombre} ${u.apellido}`}</div>
                  <div className="text-xs text-gray-500">{u.email} · CUIT: {u.cuit}</div>
                  <div className="text-xs text-gray-400">{u.localidad}, {u.provincia} · {(u.roles||[]).join(' + ')}{u.is_admin ? ' · ⚡ Admin' : ''}</div>
                  <div className="text-[10px] text-gray-300 mt-0.5">Registro: {u.created_at?.slice(0,10)}</div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={() => toggleActivo(u)}
                    className={`text-xs px-3 py-1 rounded-lg font-medium ${u.activo ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
