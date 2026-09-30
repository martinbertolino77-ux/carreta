import { TIPOS_CARGA, PRODUCTOS_GRANEL, DOCUMENTO_POR_TIPO } from './constants'

const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1)

export const tipoCarga = (p) => TIPOS_CARGA.find(t => t.id === p?.tipo_actividad) || TIPOS_CARGA[0]
export const iconoPedido = (p) => tipoCarga(p).icono
export const bgPedido = (p) => tipoCarga(p).bg

// Título corto: "Soja", "Hacienda", "Fertilizante"
export function tituloPedido(p) {
  if (!p) return ''
  if (p.tipo_actividad === 'ganadero') return 'Hacienda'
  if (p.tipo_actividad === 'granel') {
    if (p.producto_granel === 'otro' && p.producto_detalle) return cap(p.producto_detalle)
    return PRODUCTOS_GRANEL.find(x => x.value === p.producto_granel)?.label || 'Otras cargas'
  }
  return cap(p.tipo_cereal || 'Carga')
}

export const documentoDe = (p) => DOCUMENTO_POR_TIPO[p?.tipo_actividad] || DOCUMENTO_POR_TIPO.agricola
