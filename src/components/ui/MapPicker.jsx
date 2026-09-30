import { useEffect, useRef, useState } from 'react'

import { cargarGoogleMaps } from '../../lib/gmaps'

export default function MapPicker({ onConfirm, onClose, initialLat = -34.6, initialLng = -63.6, initialZoom = 5 }) {
  const mapRef = useRef(null)
  const mapObj = useRef(null)
  const marker = useRef(null)
  const [coords, setCoords] = useState(null)
  const [direccion, setDireccion] = useState('')
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [sugerencias, setSugerencias] = useState([])
  const sessionToken = useRef(null)

  useEffect(() => {
    cargarGoogleMaps().then(() => {
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (loading || !mapRef.current || mapObj.current) return

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: initialLat, lng: initialLng },
      zoom: initialZoom,
      mapTypeId: 'hybrid',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
    mapObj.current = map

    const mk = new window.google.maps.Marker({ map, draggable: true })
    marker.current = mk

    map.addListener('click', (e) => {
      mk.setPosition(e.latLng)
      geocodificar(e.latLng)
    })

    mk.addListener('dragend', () => {
      geocodificar(mk.getPosition())
    })
  }, [loading])

  function geocodificar(latLng) {
    const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat
    const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng
    setCoords({ lat, lng })
    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) setDireccion(results[0].formatted_address)
    })
  }

  async function buscar(texto) {
    setBusqueda(texto)
    if (!texto || texto.length < 3 || !window.google?.maps?.places) { setSugerencias([]); return }
    try {
      // Usar AutocompleteSuggestion (Places API New)
      const { AutocompleteSuggestion, AutocompleteSessionToken } = window.google.maps.places
      if (!sessionToken.current) sessionToken.current = new AutocompleteSessionToken()
      const request = { input: texto, sessionToken: sessionToken.current, includedRegionCodes: ['ar'] }
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
      setSugerencias((suggestions || []).map(s => ({
        place_id: s.placePrediction?.placeId || '',
        description: s.placePrediction?.text?.text || '',
        _pred: s.placePrediction,
      })).filter(s => s.description))
    } catch(e) { console.error('buscar error', e); setSugerencias([]) }
  }

  function elegirSugerencia(item) {
    setSugerencias([])
    setBusqueda(item.description)
    sessionToken.current = null
    // Geocodificar por texto directamente
    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ address: item.description + ', Argentina' }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const loc = results[0].geometry.location
        mapObj.current?.setCenter(loc)
        mapObj.current?.setZoom(14)
        marker.current?.setPosition(loc)
        const lat = loc.lat(); const lng = loc.lng()
        setCoords({ lat, lng })
        setDireccion(results[0].formatted_address || item.description)
      }
    })
  }

  const confirmar = () => {
    if (!coords) return
    const mapsUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`
    let localidad = '', provincia = ''
    if (direccion) {
      const partes = direccion.split(',').map(p => p.trim())
      // Limpiar códigos postales: "B6001ARC Rafael Obligado" → "Rafael Obligado"
      const limpiar = (s) => s.replace(/^[A-Z0-9]{4,}\s+/, '').trim()
      if (partes.length >= 3) {
        localidad = limpiar(partes[partes.length - 3])
        provincia = limpiar(partes[partes.length - 2])
      } else if (partes.length === 2) {
        localidad = limpiar(partes[0]); provincia = limpiar(partes[1])
      }
    }
    onConfirm?.({ lat: coords.lat, lng: coords.lng, direccion, localidad, provincia, maps_url: mapsUrl })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60">
      {/* Buscador manual */}
      <div className="bg-white px-4 py-3 shadow relative">
        <div className="flex items-center gap-2">
          <input value={busqueda} onChange={e => buscar(e.target.value)}
            placeholder="🔍 Buscar zona, localidad o ruta…"
            className="flex-1 border border-gray-200 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:border-verde-600" />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl font-bold px-2">✕</button>
        </div>
        {sugerencias.length > 0 && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
            {sugerencias.map(s => (
              <button key={s.place_id} onClick={() => elegirSugerencia(s)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0">
                📍 {s.description}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
            <div className="text-sm text-gray-500">Cargando mapa…</div>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/90 rounded-full px-3 py-1 text-xs text-gray-600 shadow pointer-events-none">
          Tocá el mapa o arrastrá el pin para marcar el destino
        </div>
      </div>
      <div className="bg-white px-4 py-3 shadow-lg">
        {coords ? (
          <>
            <div className="text-xs text-gray-500 mb-1 truncate">📍 {direccion || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}</div>
            <button onClick={confirmar}
              className="w-full bg-verde-700 text-white rounded-[12px] py-3 text-sm font-bold hover:bg-verde-800">
              ✓ Confirmar este punto
            </button>
          </>
        ) : (
          <div className="text-xs text-center text-gray-400 py-2">Tocá el mapa para seleccionar el destino</div>
        )}
      </div>
    </div>
  )
}
