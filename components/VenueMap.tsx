"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type TableStatus = "plenty" | "few" | "full";

export interface MapVenue {
  name: string;
  category: string;
  area: string;
  address?: string;
  lat: number;
  lng: number;
  bestDiscount: string;
  tableStatus?: TableStatus;
  takeawayReady?: boolean;
  panicDealActive?: boolean;
  panicDealText?: string;
  vibeTags?: string[];
  microZoneType?: "student" | "office" | null;
}

interface GeocodedVenue extends MapVenue {
  resolvedLat: number;
  resolvedLng: number;
}

// Δημιουργία πινέζας με Badge Έκπτωσης (Σημείο 10)
const createDiscountPinIcon = (discount: string) => {
  return L.divIcon({
    className: "custom-venue-pin",
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        <div style="
          background: var(--brand-primary, #f97316);
          color: #ffffff;
          font-weight: 900;
          font-size: 11px;
          padding: 2px 7px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          border: 1.5px solid #ffffff;
          white-space: nowrap;
          margin-bottom: 2px;
        ">
          ${discount}
        </div>
        <div style="
          background-color: var(--brand-primary, #f97316);
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(0,0,0,0.25);
        ">
          <span style="transform: rotate(45deg); font-size: 14px;">🍽️</span>
        </div>
      </div>
    `,
    iconSize: [42, 54],
    iconAnchor: [21, 54],
    popupAnchor: [0, -50],
  });
};

// Μπλε πινέζα για τη θέση του χρήστη (Σημείο 9)
const userLocationIcon = L.divIcon({
  className: "custom-user-pin",
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center;">
      <div style="
        position: absolute;
        width: 32px;
        height: 32px;
        background: rgba(59, 130, 246, 0.3);
        border-radius: 50%;
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        width: 18px;
        height: 18px;
        background: #3b82f6;
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      "></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

function MapBoundsUpdater({
  venues,
  userPos,
}: {
  venues: GeocodedVenue[];
  userPos: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (userPos && venues.length === 0) {
      map.setView(userPos, 15);
      return;
    }
    if (venues.length === 0) return;

    if (venues.length === 1 && !userPos) {
      map.setView([venues[0].resolvedLat, venues[0].resolvedLng], 15);
    } else {
      const points: [number, number][] = venues.map((v) => [
        v.resolvedLat,
        v.resolvedLng,
      ]);
      if (userPos) points.push(userPos);
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [venues, userPos, map]);

  return null;
}

export default function VenueMap({ venues }: { venues: MapVenue[] }) {
  const [resolvedVenues, setResolvedVenues] = useState<GeocodedVenue[]>([]);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(
    null
  );
  const [locating, setLocating] = useState(false);

  // Αυτόματος εντοπισμός διεύθυνσης
  useEffect(() => {
    let isCancelled = false;

    const resolveAddresses = async () => {
      const results: GeocodedVenue[] = [];

      for (const v of venues) {
        let finalLat = v.lat;
        let finalLng = v.lng;

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

  // Εντοπισμός Τοποθεσίας Χρήστη (Σημείο 9)
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Η γεωγραφική τοποθεσία δεν υποστηρίζεται από τον browser σας.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPosition([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      (err) => {
        console.warn("Geolocation error:", err);
        alert("Δεν ήταν δυνατή η ανάκτηση της τοποθεσίας σας. Βεβαιωθείτε ότι έχετε δώσει δικαίωμα πρόσβασης.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const centerLat =
    userPosition?.[0] ?? (resolvedVenues[0]?.resolvedLat || 37.9838);
  const centerLng =
    userPosition?.[1] ?? (resolvedVenues[0]?.resolvedLng || 23.7275);

  return (
    <div className="w-full h-84 md:h-96 rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl my-6 relative z-0">
      {/* Κουμπί «Η Τοποθεσία μου» */}
      <div className="absolute top-4 right-4 z-[500]">
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          className="bg-neutral-900/90 hover:bg-neutral-900 text-white border border-neutral-700 px-3 py-2 rounded-xl text-xs font-bold shadow-xl flex items-center gap-1.5 backdrop-blur-md transition cursor-pointer"
        >
          <span>📍</span>
          <span>{locating ? "Εντοπισμός..." : "Η Τοποθεσία μου"}</span>
        </button>
      </div>

      <MapContainer
        center={[centerLat, centerLng]}
        zoom={14}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBoundsUpdater venues={resolvedVenues} userPos={userPosition} />

        {/* Πινέζα Χρήστη */}
        {userPosition && (
          <Marker position={userPosition} icon={userLocationIcon}>
            <Popup>
              <div className="p-1 font-bold text-xs text-slate-900">
                📍 Είστε εδώ!
              </div>
            </Popup>
          </Marker>
        )}

        {/* Πινέζες Καταστημάτων με ποσοστό έκπτωσης */}
        {resolvedVenues.map((v, idx) => (
          <Marker
            key={`${v.name}-${idx}`}
            position={[v.resolvedLat, v.resolvedLng]}
            icon={createDiscountPinIcon(v.bestDiscount)}
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
                      `${v.name}${v.address || v.area}`
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