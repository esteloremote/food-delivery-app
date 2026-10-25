"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapVenue {
  name: string;
  category: string;
  area: string;
  address?: string;
  lat: number;
  lng: number;
  bestDiscount: string;
}

interface GeocodedVenue extends MapVenue {
  resolvedLat: number;
  resolvedLng: number;
}

// Προσαρμοσμένο εικονίδιο πινέζας HappySeats
const customIcon = L.divIcon({
  className: "custom-map-pin",
  html: `
    <div style="
      background-color: #f59e0b;
      width: 34px;
      height: 34px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid #020617;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.6);
    ">
      <span style="
        transform: rotate(45deg);
        font-size: 15px;
      ">🍽️</span>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

// Επανυπολογισμός εστίασης του χάρτη στις νέες συντεταγμένες
function MapBoundsUpdater({ venues }: { venues: GeocodedVenue[] }) {
  const map = useMap();

  useEffect(() => {
    if (venues.length === 0) return;

    if (venues.length === 1) {
      map.setView([venues[0].resolvedLat, venues[0].resolvedLng], 16);
    } else {
      const bounds = L.latLngBounds(
        venues.map((v) => [v.resolvedLat, v.resolvedLng])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [venues, map]);

  return null;
}

export default function VenueMap({ venues }: { venues: MapVenue[] }) {
  const [resolvedVenues, setResolvedVenues] = useState<GeocodedVenue[]>([]);

  useEffect(() => {
    let isCancelled = false;

    const resolveAddresses = async () => {
      const results: GeocodedVenue[] = [];

      for (const v of venues) {
        let finalLat = v.lat;
        let finalLng = v.lng;

        // Αν υπάρχει γραμμένη διεύθυνση, ψάχνουμε απευθείας με βάση τη διεύθυνση
        if (v.address && v.address.trim().length > 0) {
          try {
            const queryStr = `${v.address}, ${v.area || "Αθήνα"}, Greece`;
            const res = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                queryStr
              )}`
            );
            const data = await res.json();

            if (data && data.length > 0) {
              finalLat = parseFloat(data[0].lat);
              finalLng = parseFloat(data[0].lon);
            }
          } catch (e) {
            console.error("Geocoding failed for address:", v.address, e);
          }
        }

        results.push({
          ...v,
          resolvedLat: finalLat,
          resolvedLng: finalLng,
        });
      }

      if (!isCancelled) {
        setResolvedVenues(results);
      }
    };

    resolveAddresses();

    return () => {
      isCancelled = true;
    };
  }, [venues]);

  // Default κέντρο χάρτη
  const centerLat =
    resolvedVenues.length > 0 ? resolvedVenues[0].resolvedLat : 37.9838;
  const centerLng =
    resolvedVenues.length > 0 ? resolvedVenues[0].resolvedLng : 23.7275;

  return (
    <div className="w-full h-84 md:h-96 rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl my-6 relative z-0">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={15}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBoundsUpdater venues={resolvedVenues} />

        {resolvedVenues.map((v, idx) => (
          <Marker
            key={`${v.name}-${idx}`}
            position={[v.resolvedLat, v.resolvedLng]}
            icon={customIcon}
          >
            <Popup className="custom-leaflet-popup">
              <div className="p-1 space-y-1.5 min-w-[190px]">
                <h4 className="font-black text-slate-900 text-sm leading-tight">
                  {v.name}
                </h4>

                <div className="text-[11px] text-slate-600 font-medium">
                  {v.category}
                </div>

                <div className="text-[11px] text-slate-800 bg-slate-100 p-2 rounded-xl border border-slate-200">
                  📍 <strong>{v.address || v.area}</strong>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                    Έως {v.bestDiscount}
                  </span>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${v.name} ${v.address || v.area}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-600 hover:underline font-bold"
                  >
                    Οδηγίες →
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}