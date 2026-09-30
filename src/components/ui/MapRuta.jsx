import { useEffect, useRef, useState } from 'react'

import { cargarGoogleMaps } from '../../lib/gmaps'

export default function MapRuta({ origen, destino, origenLabel, destinoLabel }) {
  const mapRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [distancia, setDistancia] = useState('')
  const [duracion, setDuracion] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!origen || !destino) return
    cargarGoogleMaps().then(() => {
      setLoading(false)
      setTimeout(() => initMap(), 100)
    })
  }, [origen, destino])

  function initMap() {
    if (!mapRef.current) return
    const map = new window.google.maps.Map(mapRef.current, {
      zoom: 7,
      mapTypeId: 'roadmap',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })

    const directionsService = new window.google.maps.DirectionsService()
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      map,
      suppressMarkers: false,
      polylineOptions: { strokeColor: '#2d6a4f', strokeWeight: 4 },
    })

    // Limpiar códigos postales de strings de localidad
    const limpiarDir = (d) => typeof d === 'string' ? d.replace(/\b[A-Z0-9]{4,}\s+/g, '').trim() : d

    directionsService.route({
      origin: typeof origen === 'string' ? limpiarDir(origen) : { lat: origen.lat, lng: origen.lng },
      destination: typeof destino === 'string' ? limpiarDir(destino) : { lat: destino.lat, lng: destino.lng },
      travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK') {
        directionsRenderer.setDirections(result)
        const leg = result.routes[0]?.legs[0]
        if (leg) {
          setDistancia(leg.distance?.text || '')
          setDuracion(leg.duration?.text || '')
        }
      } else {
        setError('No se pudo calcular la ruta')
      }
    })
  }

  if (!origen || !destino) return null

  return (
    <div className="rounded-[12px] overflow-hidden border border-gray-100 mb-3">
      {(distancia || duracion) && (
        <div className="bg-verde-50 px-3 py-2 flex items-center gap-4 border-b border-verde-100">
          <span className="text-xs text-verde-700 font-semibold">🗺 {origenLabel} → {destinoLabel}</span>
          {distancia && <span className="text-xs text-gray-600">📏 {distancia}</span>}
          {duracion && <span className="text-xs text-gray-600">⏱ {duracion}</span>}
        </div>
      )}
      {error && <div className="text-xs text-gray-400 px-3 py-2">{error}</div>}
      {loading && <div className="h-48 flex items-center justify-center bg-gray-50 text-xs text-gray-400">Cargando mapa…</div>}
      <div ref={mapRef} style={{ height: loading ? 0 : 220 }} />
    </div>
  )
}
