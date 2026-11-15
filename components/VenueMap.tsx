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

// Δημιουργία πινέζας με Badge Έκπτωσης
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

// Μπλε πινέζα για τη θέση του χρήστη
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
  venues: MapVenue[];
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
      map.setView([venues[0].lat, venues[0].lng], 15);
    } else {
      const points: [number, number][] = venues.map((v) => [v.lat, v.lng]);
      if (userPos) points.push(userPos);
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [venues, userPos, map]);

  return null;
}

export default function VenueMap({ venues }: { venues: MapVenue[] }) {
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);

  // Εντοπισμός Τοποθεσίας Χρήστη
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

  const centerLat = userPosition?.[0] ?? (venues[0]?.lat || 37.9838);
  const centerLng = userPosition?.[1] ?? (venues[0]?.lng || 23.7275);

  return (
    <div className="w-full h-84 md:h-96 rounded-3xl overflow-hidden border border-border-theme shadow-2xl relative z-0">
      <div className="absolute top-4 right-4 z-[500]">
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          className="bg-card/90 hover:bg-card text-text-main border border-border-theme px-3 py-2 rounded-xl text-xs font-bold shadow-xl flex items-center gap-1.5 backdrop-blur-md transition cursor-pointer"
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

        <MapBoundsUpdater venues={venues} userPos={userPosition} />

        {/* Πινέζα Χρήστη */}
        {userPosition && (
          <Marker position={userPosition} icon={userLocationIcon}>
            <Popup>
              <div className="p-1 font-bold text-xs text-text-main">
                📍 Είστε εδώ!
              </div>
            </Popup>
          </Marker>
        )}

        {/* Πινέζες Καταστημάτων με ποσοστό έκπτωσης */}
        {venues.map((v, idx) => (
          <Marker
            key={`${v.name}-${idx}`}
            position={[v.lat, v.lng]}
            icon={createDiscountPinIcon(v.bestDiscount)}
          >
            <Popup className="custom-leaflet-popup">
              <div className="p-1 space-y-1.5 min-w-[190px]">
                <h4 className="font-black text-text-main text-sm leading-tight">
                  {v.name}
                </h4>

                <div className="text-[11px] text-text-muted font-medium">
                  {v.category}
                </div>

                <div className="text-[11px] text-text-main bg-subtle p-2 rounded-xl border border-border-theme">
                  📍 <strong>{v.address || v.area}</strong>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-bold text-brand-text bg-brand-light border border-brand-border px-2 py-0.5 rounded-md">
                    Έως {v.bestDiscount}
                  </span>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${v.name} ${v.address || v.area}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-brand hover:underline font-bold"
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