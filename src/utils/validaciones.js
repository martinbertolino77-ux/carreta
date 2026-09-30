// Validaciones de CUIT y DNI (solo para datos nuevos)

export function validarCuit(v = '') {
  const d = String(v).replace(/\D/g, '')
  if (!d) return 'Ingresá el CUIT'
  if (d.length !== 11) return 'El CUIT debe tener 11 dígitos'
  const pref = Number(d.slice(0, 2))
  if (![20, 23, 24, 27, 30, 33, 34].includes(pref))
    return 'CUIT inválido (prefijo incorrecto)'
  const f = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const sum = f.reduce((a, x, i) => a + x * Number(d[i]), 0)
  const ver = 11 - (sum % 11)
  const dig = ver === 11 ? 0 : ver === 10 ? 9 : ver
  if (dig !== Number(d[10])) return 'CUIT inválido (dígito verificador incorrecto)'
  return null
}

export function validarDni(v = '') {
  const d = String(v).replace(/\D/g, '')
  if (!d) return 'Ingresá el DNI'
  if (d.length < 7 || d.length > 8) return 'El DNI debe tener 7 u 8 dígitos'
  return null
}

export function formatCuit(v = '') {
  const d = String(v).replace(/\D/g, '')
  if (d.length !== 11) return v
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d[10]}`
}

export function limpiarCuit(v = '') {
  return String(v).replace(/\D/g, '')
}
