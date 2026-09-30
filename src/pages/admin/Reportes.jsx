import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdminShell from './Shell'
import * as XLSX from 'xlsx'
import { formatNroPedido } from '../../utils/format'

export default function AdminReportes() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [loading, setLoading] = useState('')

  const descargar = async (tipo) => {
    setLoading(tipo)
    let filas = []

    if (tipo === 'pedidos') {
      const q = supabase.from('pedidos')
        .select(`numero, estado, tipo_actividad, tipo_cereal, producto_granel, modo_publicacion,
          camiones_necesarios, kilos_estimados, destino_localidad, destino_provincia, created_at,
          establecimientos(localidad, provincia),
          productores(usuarios(nombre, apellido, razon_social, email))`)
        .order('created_at', { ascending: false })
      if (desde) q.gte('created_at', desde)
      if (hasta) q.lte('created_at', hasta + 'T23:59:59')
      const { data } = await q
      filas = (data||[]).map(p => ({
        'Nro': formatNroPedido(p.numero), 'Estado': p.estado,
        'Tipo': p.tipo_actividad === 'agricola' ? p.tipo_cereal : p.tipo_actividad === 'ganadero' ? 'Ganadero' : p.producto_granel,
        'Origen': `${p.establecimientos?.localidad}, ${p.establecimientos?.provincia}`,
        'Destino': `${p.destino_localidad}, ${p.destino_provincia}`,
        'Camiones': p.camiones_necesarios, 'Kilos': p.kilos_estimados,
        'Productor': p.productores?.usuarios?.razon_social || `${p.productores?.usuarios?.nombre||''} ${p.productores?.usuarios?.apellido||''}`.trim(),
        'Email productor': p.productores?.usuarios?.email,
        'Modo': p.modo_publicacion, 'Fecha': p.created_at?.slice(0,10),
      }))
    }

    if (tipo === 'usuarios') {
      const { data } = await supabase.from('usuarios')
        .select('nombre, apellido, razon_social, email, cuit, telefono, localidad, provincia, roles, is_admin, activo, created_at')
        .order('created_at', { ascending: false })
      filas = (data||[]).map(u => ({
        'Nombre': `${u.nombre} ${u.apellido}`, 'Razón social': u.razon_social,
        'Email': u.email, 'CUIT': u.cuit, 'Teléfono': u.telefono,
        'Localidad': u.localidad, 'Provincia': u.provincia,
        'Roles': (u.roles||[]).join(', '), 'Admin': u.is_admin?'Sí':'No',
        'Activo': u.activo?'Sí':'No', 'Registro': u.created_at?.slice(0,10),
      }))
    }

    if (tipo === 'calificaciones') {
      const { data } = await supabase.from('calificaciones')
        .select('calificador_rol, puntaje_1, puntaje_2, puntaje_3, comentario, visible, created_at, ofertas(pedidos(numero))')
        .order('created_at', { ascending: false })
      filas = (data||[]).map(c => ({
        'Pedido': c.ofertas?.pedidos?.numero ? formatNroPedido(c.ofertas.pedidos.numero) : '—',
        'Rol calificador': c.calificador_rol,
        'Puntaje 1': c.puntaje_1, 'Puntaje 2': c.puntaje_2, 'Puntaje 3': c.puntaje_3,
        'Promedio': ((c.puntaje_1+c.puntaje_2+c.puntaje_3)/3).toFixed(1),
        'Comentario': c.comentario || '', 'Visible': c.visible?'Sí':'No',
        'Fecha': c.created_at?.slice(0,10),
      }))
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), tipo)
    XLSX.writeFile(wb, `carreta_${tipo}${desde||hasta ? `_${desde||''}_${hasta||''}` : ''}.xlsx`)
    setLoading('')
  }

  const Btn = ({ tipo, label, desc }) => (
    <div className="bg-white rounded-xl border p-5">
      <div className="font-semibold text-gray-900 mb-1">{label}</div>
      <div className="text-xs text-gray-500 mb-4">{desc}</div>
      <button onClick={() => descargar(tipo)} disabled={loading === tipo}
        className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-gray-700 disabled:opacity-60">
        {loading === tipo ? 'Descargando…' : '⬇ Descargar Excel'}
      </button>
    </div>
  )

  return (
    <AdminShell seccion="reportes">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Reportes</h2>
      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="text-sm font-semibold text-gray-700 mb-3">Filtrar por fecha (opcional)</div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none" /></div>
          <div><label className="text-xs text-gray-500">Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none" /></div>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <Btn tipo="pedidos" label="📋 Pedidos" desc="Todos los pedidos con estado, productor, tipo de carga, origen y destino." />
        <Btn tipo="usuarios" label="👥 Usuarios" desc="Todos los usuarios registrados con datos personales y roles." />
        <Btn tipo="calificaciones" label="⭐ Calificaciones" desc="Todas las calificaciones con puntajes y comentarios." />
      </div>
    </AdminShell>
  )
}
