// Localidades oficiales (Georef — datos.gob.ar)
const BASE = 'https://apis.datos.gob.ar/georef/api'

// "RUFINO" → "Rufino"; deja igual si ya viene con mayúsculas y minúsculas
function titulo(s = '') {
  if (s !== s.toUpperCase()) return s
  return s.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
}

// Georef usa nombres largos para dos provincias; los llevamos a los de la app
export function provinciaApp(p = '') {
  const n = normalizar(p)
  if (n.startsWith('ciudad autonoma') || n === 'caba') return 'Capital Federal'
  if (n.startsWith('tierra del fuego')) return 'Tierra del Fuego'
  return p
}

// Comparación sin tildes ni mayúsculas
export function normalizar(s = '') {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export function mismaProvincia(a, b) {
  return normalizar(provinciaApp(a)) === normalizar(provinciaApp(b))
}

// Buscar localidades por nombre (autocompletar)
export async function buscarLocalidades(texto, provincia = '') {
  const q = texto.trim()
  if (q.length < 3) return []
  const params = new URLSearchParams({
    nombre: q, max: '12', aplanar: 'true',
    campos: 'id,nombre,departamento.nombre,provincia.nombre',
  })
  if (provincia) params.set('provincia', provincia === 'Capital Federal' ? 'Ciudad Autónoma de Buenos Aires' : provincia)
  try {
    const r = await fetch(`${BASE}/localidades?${params}`)
    if (!r.ok) return []
    const j = await r.json()
    const vistos = new Set()
    return (j.localidades || []).map(l => ({
      localidad: titulo(l.nombre),
      departamento: titulo(l.departamento_nombre || ''),
      provincia: provinciaApp(l.provincia_nombre || ''),
    })).filter(l => {
      const k = `${l.localidad}|${l.departamento}|${l.provincia}`
      if (vistos.has(k)) return false
      vistos.add(k); return true
    })
  } catch { return [] }
}

// Localidades del mismo departamento/partido (para sugerir vecinas)
export async function localidadesDelDepartamento(provincia, departamento) {
  if (!provincia || !departamento) return []
  const params = new URLSearchParams({
    provincia: provincia === 'Capital Federal' ? 'Ciudad Autónoma de Buenos Aires' : provincia,
    departamento, max: '500', aplanar: 'true', campos: 'nombre',
  })
  try {
    const r = await fetch(`${BASE}/localidades?${params}`)
    if (!r.ok) return []
    const j = await r.json()
    const nombres = [...new Set((j.localidades || []).map(l => titulo(l.nombre)))]
    return nombres.sort((a, b) => a.localeCompare(b, 'es'))
  } catch { return [] }
}
