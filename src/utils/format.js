export const formatCuit = (c = '') => {
  const n = c.replace(/\D/g, '')
  if (n.length !== 11) return c
  return `${n.slice(0,2)}-${n.slice(2,10)}-${n.slice(10)}`
}

export const validCuit = (c = '') => /^\d{11}$/.test(c.replace(/\D/g, ''))

export const validDominio = (d = '') => {
  const c = d.toUpperCase().replace(/[\s\-.]/g, '')
  return /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(c) || /^[A-Z]{3}\d{3}$/.test(c)
}

export const formatPesos = (n) =>
  new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 }).format(n)

export const formatNum = (n) => new Intl.NumberFormat('es-AR').format(n)

export const formatFecha = (d) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-AR')
}

export const formatNroPedido = (n) => `#${String(n).padStart(4,'0')}`
