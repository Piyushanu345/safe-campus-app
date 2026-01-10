'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useState } from 'react'

// Fix Leaflet icon issue
const fixIcons = () => {
  if (typeof window !== 'undefined') {
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
  }
}

export default function LeafMap({
  center,
  incidents
}: {
  center: { lat: number; lng: number }
  incidents: { id: string; latitude: number; longitude: number; description: string | null }[]
}) {
  const [isMounted, setIsMounted] = useState(false)
  // Create a unique ID for this specific mount instance to prevent container reuse
  const [instanceKey] = useState(() => Math.random().toString(36).substring(7))

  useEffect(() => {
    fixIcons()
    setIsMounted(true)
  }, [])

  if (!isMounted || !center) {
    return <div className="h-full w-full bg-slate-100 animate-pulse" />
  }

  return (
    <div 
      key={`map-wrapper-${instanceKey}`} 
      className="h-full w-full relative z-10"
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        // Ensure the map instance is tied to this specific DOM element
        zoomControl={true}
      >
        <TileLayer 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
        />

        {/* User */}
        <Marker position={[center.lat, center.lng]}>
          <Popup>You are here</Popup>
        </Marker>

        {/* Incidents */}
        {incidents.map(i => (
          <Marker key={`incident-${i.id}-${instanceKey}`} position={[i.latitude, i.longitude]}>
            <Popup>{i.description || 'No description'}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
