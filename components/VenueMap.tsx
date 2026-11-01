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
  // --- ΝΕΑ ΠΕΔΙΑ (2, 3, 4, 6, 7) ---
  tableStatus?: TableStatus; // #7: "plenty" (Άνετο) | "few" (1-3 Τραπέζια) | "full" (Πλήρες)
  takeawayReady?: boolean;   // #7: Άμεση παραλαβή
  panicDealActive?: boolean; // #2: Dynamic "Fill the Table" (π.χ. -30% για 1 ώρα)
  panicDealText?: string;    // #2: π.χ. "-30% στα επόμενα 3 τραπέζια!"
  vibeTags?: string[];       // #4: π.χ. ["☀️ Ήλιος έξω", "🔥 Σόμπες", "⚽ Δείχνει Αγώνα"]
  microZoneType?: "student" | "office" | null; // #6: Φοιτητικό / Office Break
}

interface GeocodedVenue extends MapVenue {
  resolvedLat: number;
  resolvedLng: number;
}

// Δυναμικό εικονίδιο πινέζας ανάλογα με το αν τρέχει Panic Deal (#2) ή αν είναι Πλήρες (#7)
const getCustomIcon = (venue: MapVenue) => {
  const isPanic = venue.panicDealActive;
  const isFull = venue.tableStatus === "full";

  const bgColor = isPanic
    ? "#ef4444" // Κόκκινο για Flash/Panic Deal
    : isFull
    ? "#64748b" // Γκρι αν είναι Πλήρες
    : "#f59e0b"; // Κλασικό Amber HappySeats

  const emoji = isPanic ? "🔥" : isFull ? "⏳" : "🍽️";
  const pulseRing = isPanic
    ? `box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.35), 0 4px 12px rgba(0,0,0,0.6);`
    : `box-shadow: 0 4px 12px rgba(0,0,0,0.6);`;

  return L.divIcon({
    className: "custom-map-pin",
    html: `
      <div style="
        background-color: ${bgColor};
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid #020617;
        display: flex;
        align-items: center;
        justify-content: center;
        ${pulseRing}
      ">
        <span style="
          transform: rotate(45deg);
          font-size: 16px;
        ">${emoji}</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

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
  const [lockedVenueName, setLockedVenueName] = useState<string | null>(null);

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

  // #3: Λειτουργία «Κλείδωμα Παρέας» (Hold 15 mins & Share)
  const handleSquadLock = async (venue: GeocodedVenue) => {
    setLockedVenueName(venue.name);
    const shareText = `🍻 Έκλεισα τραπέζι στο ${venue.name} (${venue.area}) με έκπτωση ${venue.bestDiscount}! Έχουμε 15 λεπτά να επιβεβαιώσουμε. Είστε μέσα;`;
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `HappySeats - ${venue.name}`,
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // Ο χρήστης έκλεισε το share sheet
      }
    } else {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      alert("Το link για την παρέα αντιγράφηκε! Στείλτο σε Viber/WhatsApp (Ισχύει για 15 λεπτά).");
    }
  };

  // Helper για το badge διαθεσιμότητας (#7)
  const renderAvailabilityBadge = (status?: TableStatus) => {
    switch (status) {
      case "full":
        return (
          <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            🔴 Πλήρες Τραπεζιών
          </span>
        );
      case "few":
        return (
          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
            🟠 1-3 Τραπέζια
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
            🟢 Άνετο για Παρέα
          </span>
        );
    }
  };

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
            icon={getCustomIcon(v)}
          >
            <Popup className="custom-leaflet-popup">
              <div className="p-1 space-y-2 min-w-[220px]">
                {/* #2: Panic Button / Fill the Table Alert */}
                {v.panicDealActive && (
                  <div className="bg-red-600 text-white text-[10px] font-extrabold px-2 py-1 rounded-lg flex items-center justify-between animate-pulse">
                    <span>🔥 FLASH ΤΡΑΠΕΖΙ ΤΩΡΑ</span>
                    <span>{v.panicDealText || "-30% για 1 ώρα"}</span>
                  </div>
                )}

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-black text-slate-900 text-sm leading-tight">
                      {v.name}
                    </h4>
                    <div className="text-[11px] text-slate-600 font-medium">
                      {v.category}
                    </div>
                  </div>

                  {/* #6: Micro-Zone Badge */}
                  {v.microZoneType === "student" && (
                    <span className="text-[9px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                      🎓 Φοιτητικό
                    </span>
                  )}
                  {v.microZoneType === "office" && (
                    <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                      💼 Office Break
                    </span>
                  )}
                </div>

                {/* #7: Live Table Status & Take-away */}
                <div className="flex flex-wrap items-center gap-1">
                  {renderAvailabilityBadge(v.tableStatus)}
                  {v.takeawayReady !== false && (
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                      🛍️ Take-away
                    </span>
                  )}
                </div>

                {/* #4: Live Vibe & Weather Tags */}
                {v.vibeTags && v.vibeTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {v.vibeTags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-[9px] bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded-md font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-[11px] text-slate-800 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
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

                {/* #3: Κλείδωμα Παρέας (Hold 15 mins) */}
                {v.tableStatus !== "full" && (
                  <button
                    onClick={() => handleSquadLock(v)}
                    className="w-full mt-1 bg-slate-900 hover:bg-slate-800 text-amber-400 text-[11px] font-bold py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {lockedVenueName === v.name
                      ? "✅ Κλειδώθηκε (15') - Στείλτο!"
                      : "🤝 Κράτα το για την παρέα (15')"}
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}