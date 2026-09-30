// Módulo compartido para cargar Google Maps una sola vez
let promise = null

export function cargarGoogleMaps() {
  if (promise) return promise
  promise = new Promise((resolve) => {
    if (window.google?.maps?.Map) { resolve(); return }
    // Callback que Google llama cuando está listo
    window.__gmapsReady = resolve
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY
    const existing = document.getElementById('gmaps-script')
    if (!existing) {
      const s = document.createElement('script')
      s.id = 'gmaps-script'
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&language=es&region=AR&callback=__gmapsReady`
      s.async = true; s.defer = true
      document.head.appendChild(s)
    }
  })
  return promise
}
