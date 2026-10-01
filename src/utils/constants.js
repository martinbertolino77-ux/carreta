export const CEREALES = [
  { label:'Soja',    value:'soja' },
  { label:'Maíz',   value:'maiz' },
  { label:'Trigo',  value:'trigo' },
  { label:'Girasol',value:'girasol' },
  { label:'Sorgo',  value:'sorgo' },
  { label:'Cebada', value:'cebada' },
  { label:'Maní',   value:'mani' },
  { label:'Arroz',  value:'arroz' },
  { label:'Otro',   value:'otro' },
]

export const CATEGORIAS_HACIENDA = [
  { id:'ternero',    label:'Ternero' },
  { id:'ternera',    label:'Ternera' },
  { id:'novillito',  label:'Novillito' },
  { id:'vaquillona', label:'Vaquillona' },
  { id:'novillo',    label:'Novillo' },
  { id:'toro',       label:'Toro' },
  { id:'vaca',       label:'Vaca' },
]

export const PROVINCIAS = [
  'Buenos Aires','Capital Federal','Catamarca','Chaco','Chubut',
  'Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa',
  'La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta',
  'San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero',
  'Tierra del Fuego','Tucumán',
]

export const ALCANCES = [
  { id:'localidad',    label:'🏘️ Mi localidad' },
  { id:'departamento', label:'🗺️ Mi departamento / partido' },
  { id:'provincia',    label:'📌 Toda la provincia' },
  { id:'nacional',     label:'🇦🇷 Nacional' },
]

export const ESTADOS_PEDIDO = {
  esperando_respuesta:       { label:'Esperando respuesta', color:'blue' },
  rechazado_directo:         { label:'Rechazado',            color:'red' },
  esperando_ofertas:         { label:'Esperando ofertas',    color:'gray' },
  con_ofertas:               { label:'Con ofertas',          color:'orange' },
  confirmado:                { label:'Confirmado',           color:'green' },
  datos_operativos_enviados: { label:'Datos enviados',       color:'blue' },
  esperando_documentacion:   { label:'Datos enviados',       color:'blue' },   // en desuso
  en_camino:                 { label:'En camino',            color:'blue' },
  entrega_informada:           { label:'Entrega informada',           color:'purple' },
  completado:                { label:'Finalizado',           color:'green' },
  cancelado:                 { label:'Cancelado',            color:'red' },
}

// Estados donde todavía se puede cancelar (pasos 1 a 4)
export const ESTADOS_CANCELABLES_PRODUCTOR = [
  'esperando_ofertas','con_ofertas','confirmado','datos_operativos_enviados','esperando_documentacion',
]
export const ESTADOS_CANCELABLES_TRANSPORTISTA = [
  'confirmado','datos_operativos_enviados','esperando_documentacion',
]

export const ESTADOS_OFERTA = {
  enviada:      { label:'Pendiente',    color:'orange' },
  seleccionada: { label:'Seleccionada', color:'green' },
  en_pausa:     { label:'En pausa',     color:'gray' },
  rechazada:    { label:'Rechazada',    color:'red' },
  cancelada:    { label:'Cancelada',    color:'red' },
  cerrada:      { label:'Cerrada',      color:'gray' },
}

export const MOTIVOS_CANCELACION = {
  productor: [
    'Vendí en campo',
    'Cambié destino',
    'Clima',
    'Camino intransitable',
    'Otro',
  ],
  transportista: [
    'Camión roto',
    'Chofer no disponible',
    'Clima',
    'Camino intransitable',
    'Otro',
  ],
}

// Etapa de cada transportista aceptado dentro de un pedido
export const ETAPAS_TRANSPORTISTA = {
  confirmado:     { label:'Confirmado',       color:'green',  orden:1 },
  datos_enviados: { label:'Datos enviados',   color:'blue',   orden:2 },
  en_camino:      { label:'En camino',        color:'blue',   orden:3 },
  descargado:     { label:'Descargado',       color:'purple', orden:4 },
  finalizado:     { label:'Finalizado',       color:'green',  orden:5 },
}

// ── Tipos de carga (parte 5) ──────────────────────────────────────────
export const TIPOS_CARGA = [
  { id:'agricola', label:'Agrícola',      corto:'🌾 Agrícola', icono:'🌾', bg:'bg-verde-50' },
  { id:'ganadero', label:'Ganadero',      corto:'🐄 Ganadero', icono:'🐄', bg:'bg-yellow-50' },
  { id:'granel',   label:'Otras cargas',  corto:'🪨 Otras',    icono:'🪨', bg:'bg-orange-50' },
]

export const PRODUCTOS_GRANEL = [
  { value:'fertilizante', label:'Fertilizante' },
  { value:'arena',        label:'Arena' },
  { value:'piedra',       label:'Piedra' },
  { value:'tierra',       label:'Tierra' },
  { value:'cal',          label:'Cal' },
  { value:'yeso',         label:'Yeso' },
  { value:'otro',         label:'Otro' },
]

// Tipos de chasis (camión)
export const TIPOS_CHASIS = {
  solo_chasis:  'Solo chasis',
  con_acoplado: 'Chasis con acoplado',
  con_tolva:    'Chasis con tolva',
  con_jaula:    'Chasis con jaula',
  con_batea:    'Chasis con batea',
}

// Tipos de remolque
export const TIPOS_REMOLQUE = {
  jaula:              'Jaula',
  jaula_doble:        'Jaula doble',
  acoplado:           'Acoplado',
  acoplado_escalable: 'Acoplado escalable',
  tolva:              'Tolva',
  tolva_escalable:    'Tolva escalable',
  batea:              'Batea',
}

// Equipo que informa el transportista al postularse = tipos de remolque
export const EQUIPOS = TIPOS_REMOLQUE

// Equipo que carga un camión: el remolque, o la carrocería del chasis si va solo
export function equipoDe(tipoChasis, tipoRemolque) {
  if (tipoRemolque) return tipoRemolque
  return { con_acoplado:'acoplado', con_tolva:'tolva', con_jaula:'jaula', con_batea:'batea' }[tipoChasis] || null
}

// Compatibilidad: nombres viejos
export const VEHICULOS = {
  ...TIPOS_REMOLQUE,
  jaula_simple: 'Jaula',
}

export const VEHICULOS_POR_TIPO = {
  agricola: ['acoplado', 'batea'],
  ganadero: ['jaula_simple', 'jaula_doble'],
  granel:   ['batea', 'acoplado'],
}

// Documento que el productor adjunta en el paso 5
export const DOCUMENTO_POR_TIPO = {
  agricola: { tipo:'cpe',    label:'CPE',          ayuda:'según la CPE emitida en ARCA' },
  ganadero: { tipo:'dte',    label:'DT-e + Guía',  ayuda:'según el DT-e y Guía emitidos en SENASA' },
  granel:   { tipo:'remito', label:'Remito',       ayuda:'según el remito de la carga' },
}

export const FORMAS_PAGO = [
  'Efectivo', 'Transferencia bancaria', 'Cheque', 'Cheque diferido', 'E-cheq', 'Cuenta corriente',
]
