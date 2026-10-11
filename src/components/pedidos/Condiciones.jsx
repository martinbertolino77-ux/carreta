import { formatNum } from '../../utils/format'
import { useAuth } from '../../context/AuthContext'
import { puede } from '../../utils/permisos'

// Condiciones acordadas por teléfono y cargadas por el productor al elegir
export default function Condiciones({ oferta, titulo = 'Condiciones acordadas' }) {
  const { cuenta } = useAuth()
  if (!oferta) return null
  const ver = puede(cuenta, 'ver_precios')
  const { forma_pago, condiciones_acordadas } = oferta
  const precio_acordado = ver ? oferta.precio_acordado : null
  const monto_acordado  = ver ? oferta.monto_acordado : null
  if (!precio_acordado && !forma_pago && !monto_acordado && !condiciones_acordadas) return null
  const Fila = ({ l, v }) => (
    <div className="flex justify-between gap-3 py-1 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 flex-shrink-0">{l}</span>
      <span className="text-xs font-medium text-gray-800 text-right">{v}</span>
    </div>
  )
  return (
    <div className="bg-verde-50/50 border border-verde-100 rounded-[10px] px-3 py-2 mb-2">
      <div className="text-[11px] font-semibold text-verde-700 mb-1">🤝 {titulo}</div>
      {precio_acordado && <Fila l="Precio" v={precio_acordado} />}
      {forma_pago && <Fila l="Forma de pago" v={forma_pago} />}
      {monto_acordado && <Fila l="Monto" v={`$${formatNum(monto_acordado)}`} />}
      {condiciones_acordadas && <Fila l="Condiciones" v={condiciones_acordadas} />}
    </div>
  )
}
