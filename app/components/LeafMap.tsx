"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

/* ---------- FIX LEAFLET ICON ISSUE (RUN ONCE) ---------- */
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

/* ---------- TYPES ---------- */
type Incident = {
  id: string;
  latitude: number;
  longitude: number;
  description: string | null;
};

/* ---------- COMPONENT ---------- */
export default function LeafMap({
  center,
  incidents,
}: {
  center: { lat: number; lng: number };
  incidents: Incident[];
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={15}
      scrollWheelZoom
      className="h-full w-full z-0"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* USER LOCATION */}
      <Marker position={[center.lat, center.lng]}>
        <Popup>You are here</Popup>
      </Marker>

      {/* INCIDENT MARKERS */}
      {incidents.map((incident) => (
        <Marker
          key={incident.id}
          position={[incident.latitude, incident.longitude]}
        >
          <Popup>
            {incident.description ?? "No description provided"}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
