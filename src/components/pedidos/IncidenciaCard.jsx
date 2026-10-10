// Muestra una incidencia de un camión (la usan productor y transportista)
export const ACCIONES_INCIDENCIA = {
  cambio:            'Cambio de camión o chofer',
  baja:              'Baja del camión',
  transbordo_propio: 'Transbordo a otro camión propio',
  transbordo_otro:   'Transbordo a otro transporte',
  reparacion:        'Se repara y sigue',
  siniestro:         'Siniestro / pérdida de carga',
  aviso_productor:   'Aviso del productor',
}
export const TIPOS_INCIDENCIA = { rotura: 'Rotura mecánica', accidente: 'Accidente', otro: 'Otro', aviso: 'Aviso' }

// ¿Esta incidencia obliga a emitir un documento nuevo?
export const pideDocumento = (inc) => ['cambio', 'transbordo_propio', 'transbordo_otro'].includes(inc?.accion)

const fmt = (n) => Number(n || 0).toLocaleString('es-AR')

export default function IncidenciaCard({ inc, cv, rol, tieneDocumento, docLabel = 'CPE', onResolver }) {
  if (!inc) return null
  const informativa = ['reparacion', 'aviso_productor'].includes(inc.accion)
  const color = informativa ? 'yellow' : 'orange'
  const cls = color === 'yellow'
    ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
    : 'bg-orange-50 border-orange-200 text-orange-800'
  const chasisNuevo = inc.nuevo_chasis_dom || (inc.nuevo_chasis_id ? cv?.chasis?.dominio : null)
  const acopNuevo = inc.nuevo_acoplado_dom || (inc.nuevo_acoplado_id ? cv?.acoplados?.dominio : null)
  const tara = Number(inc.nuevo_chasis_tara || 0) + Number(inc.nuevo_acoplado_tara || 0)

  return (
    <div className={`border rounded-[8px] px-2.5 py-2 mb-1.5 ${cls}`}>
      <div className="text-[11px] font-bold mb-0.5">
        ⚠️ {ACCIONES_INCIDENCIA[inc.accion] || 'Incidencia'}
        {inc.tipo && inc.tipo !== 'aviso' ? ` · ${TIPOS_INCIDENCIA[inc.tipo] || inc.tipo}` : ''}
        <span className="font-normal opacity-70"> · {inc.momento === 'en_viaje' ? 'con carga' : 'antes de cargar'}</span>
      </div>
      {inc.descripcion && <div className="text-[11px] mb-1">"{inc.descripcion}"</div>}

      {inc.accion === 'transbordo_otro' && (
        <div className="text-[11px] text-gray-800">
          <b>Transporte:</b> CUIT {inc.transporte_cuit}{inc.transporte_nombre ? ` · ${inc.transporte_nombre}` : ''}
        </div>
      )}
      {(chasisNuevo || acopNuevo) && (
        <div className="text-[11px] text-gray-800">
          <b>Equipo para el documento:</b> {chasisNuevo || cv?.chasis?.dominio}{acopNuevo ? ` + ${acopNuevo}` : ''}
          {tara ? ` · tara total: ${fmt(tara)} kg` : ''}
        </div>
      )}
      {inc.nuevo_chofer_nombre && (
        <div className="text-[11px] text-gray-800"><b>Chofer:</b> {inc.nuevo_chofer_nombre}{inc.nuevo_chofer_dni ? ` · DNI ${inc.nuevo_chofer_dni}` : ''}</div>
      )}
      {inc.demora && <div className="text-[11px] text-gray-800"><b>Demora estimada:</b> {inc.demora}</div>}
      {inc.accion === 'siniestro' && (
        <div className="text-[11px] text-gray-800"><b>Llegaron:</b> {fmt(inc.kilos_llegados)} kg</div>
      )}

      {pideDocumento(inc) && !tieneDocumento && (
        <div className="text-[11px] font-semibold mt-1">
          {rol === 'productor'
            ? `📄 Emití el ${docLabel} nuevo con estos datos y subilo acá.`
            : `Esperando ${docLabel} nuevo del productor.`}
        </div>
      )}
      {informativa && onResolver && (
        <button onClick={() => onResolver(inc.id)} className="text-[11px] font-semibold underline mt-1">
          Marcar como resuelto
        </button>
      )}
    </div>
  )
}
