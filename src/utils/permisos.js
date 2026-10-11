// Permisos a medida de cada Operador (los define el master en "Mi equipo").
// Lo que no está en NO, está permitido. La base controla lo mismo.
export const ACCIONES = {
  productor: [
    { id: 'ver_precios',      label: 'Ver precios y montos' },
    { id: 'crear_pedidos',    label: 'Crear y publicar pedidos' },
    { id: 'aceptar_ofertas',  label: 'Aceptar ofertas y cerrar acuerdos', precio: true },
    { id: 'cancelar',         label: 'Cancelar pedidos' },
    { id: 'documentos',       label: 'Subir documentos (CPE)' },
    { id: 'establecimientos', label: 'Cargar y editar establecimientos' },
  ],
  transportista: [
    { id: 'ver_precios',      label: 'Ver precios y montos' },
    { id: 'ofertar',          label: 'Ofertar y responder pedidos directos', precio: true },
    { id: 'camiones',         label: 'Asignar camiones y choferes, cargado, en camino e incidencias' },
    { id: 'cancelar_viajes',  label: 'Cancelar viajes' },
    { id: 'flota',            label: 'Cargar y editar la flota' },
  ],
}

// ¿La empresa activa le permite esta acción al usuario?
export function puede(cuenta, accion) {
  if (!cuenta) return false
  if (cuenta.permiso === 'master') return true
  if (cuenta.permiso === 'lectura') return accion === 'ver_precios'
  const p = cuenta.permisos || {}
  if (p[accion] === false) return false
  if ((accion === 'ofertar' || accion === 'aceptar_ofertas') && p.ver_precios === false) return false
  return true
}

export const limitado = (permisos) => Object.values(permisos || {}).some(v => v === false)
