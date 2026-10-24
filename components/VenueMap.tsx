"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Διόρθωση των default icons του Leaflet στο Next.js
const customIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface MapVenue {
  name: string;
  category: string;
  area: string;
  lat: number;
  lng: number;
  bestDiscount: string;
}

export default function VenueMap({ venues }: { venues: MapVenue[] }) {
  // Κέντρο Αθήνας ως default αρχική θέση
  const defaultCenter: [number, number] = [37.9838, 23.7275];

  return (
    <div className="w-full h-80 rounded-3xl overflow-hidden border border-neutral-800 shadow-xl my-6 relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {venues.map((v) => (
          <Marker key={v.name} position={[v.lat, v.lng]} icon={customIcon}>
            <Popup>
              <div className="text-neutral-900 p-1">
                <strong className="block font-bold text-sm">{v.name}</strong>
                <span className="text-xs text-neutral-600 block">{v.category} • {v.area}</span>
                <span className="inline-block mt-1 font-bold text-xs bg-amber-400 text-neutral-950 px-2 py-0.5 rounded">
                  Έως {v.bestDiscount}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}