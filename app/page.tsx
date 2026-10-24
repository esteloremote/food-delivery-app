"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  collection,
  onSnapshot,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Dynamic import του χάρτη χωρίς SSR
const VenueMap = dynamic(() => import("@/components/VenueMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 bg-neutral-900 rounded-3xl border border-neutral-800 flex items-center justify-center text-xs text-neutral-500 my-6">
      Φόρτωση χάρτη...
    </div>
  ),
});

interface SlotDeal {
  id: string;
  venueId?: string;
  venueName: string;
  timeWindow: string;
  discount: string;
  availableTables: number;
  totalTables: number;
}

interface VenueData {
  name: string;
  category: string;
  area: string;
  image: string;
  lat: number;
  lng: number;
  slots: SlotDeal[];
}

interface Booking {
  ticketCode: string;
  venueName: string;
  timeWindow: string;
  discount: string;
  partySize: number;
  date: string;
}

const VENUE_METADATA: Record<
  string,
  { slug: string; category: string; area: string; image: string; lat: number; lng: number }
> = {
  "Εστιατόριο ΚΟΥΚΟΥΤΣΗΣ": {
    slug: "koukoutsis",
    category: "Παραδοσιακή Κουζίνα",
    area: "Κέντρο",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
    lat: 37.9753,
    lng: 23.7361,
  },
  "Cucina Bella": {
    slug: "cucina-bella",
    category: "Ιταλικό & Wine Bar",
    area: "Γλυφάδα",
    image:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80",
    lat: 37.8631,
    lng: 23.7533,
  },
};

function useCountdown(timeWindow: string) {
  const [timeLeft, setTimeLeft] = useState<{ label: string; isExpired: boolean }>({
    label: "",
    isExpired: false,
  });

  useEffect(() => {
    const calculateTime = () => {
      const parts = timeWindow.split("-");
      if (parts.length < 2) return;

      const endPart = parts[1].trim();
      const [endHourStr, endMinuteStr] = endPart.split(":");
      const endHour = parseInt(endHourStr, 10);
      const endMinute = parseInt(endMinuteStr, 10);

      const now = new Date();
      const target = new Date();
      target.setHours(endHour, endMinute, 0, 0);

      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ label: "Έληξε", isExpired: true });
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft({ label: `${hours}ώ ${minutes}λ`, isExpired: false });
      } else {
        setTimeLeft({
          label: `${minutes}λ ${seconds < 10 ? "0" : ""}${seconds}δ`,
          isExpired: false,
        });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [timeWindow]);

  return timeLeft;
}

function SlotItem({
  slot,
  onSelect,
}: {
  slot: SlotDeal;
  onSelect: () => void;
}) {
  const { label, isExpired } = useCountdown(slot.timeWindow);
  const isAvailable = slot.availableTables > 0 && !isExpired;

  return (
    <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">{slot.timeWindow}</span>
          {label && (
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                isExpired
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-amber-400/10 text-amber-300 border border-amber-400/20"
              }`}
            >
              ⏳ {label}
            </span>
          )}
        </div>
        <div className="text-xs text-amber-400 font-medium">{slot.discount}</div>
        <div className="text-[11px] text-neutral-400">
          {isExpired
            ? "Η προσφορά ολοκληρώθηκε"
            : slot.availableTables > 0
            ? `${slot.availableTables} τραπέζια απομένουν`
            : "Εξαντλήθηκε"}
        </div>
      </div>
      <button
        disabled={!isAvailable}
        onClick={onSelect}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
          isAvailable
            ? "bg-amber-400 hover:bg-amber-300 text-neutral-950"
            : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
        }`}
      >
        {isExpired ? "Έληξε" : slot.availableTables > 0 ? "Κράτηση" : "Full"}
      </button>
    </div>
  );
}

export default function Home() {
  const [venues, setVenues] = useState<VenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenueName, setSelectedVenueName] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotDeal | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States για αναζήτηση, φίλτρα και προβολή χάρτη
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState("all");
  const [minDiscount, setMinDiscount] = useState<number>(0);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "slots"),
      (snapshot) => {
        const slotsList: SlotDeal[] = [];
        snapshot.forEach((docSnap) => {
          slotsList.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<SlotDeal, "id">),
          });
        });

        const groupedVenues: Record<string, VenueData> = {};

        Object.keys(VENUE_METADATA).forEach((name) => {
          groupedVenues[name] = {
            name,
            ...VENUE_METADATA[name],
            slots: [],
          };
        });

        slotsList.forEach((slot) => {
          const vName = slot.venueName || "Εστιατόριο ΚΟΥΚΟΥΤΣΗΣ";
          if (!groupedVenues[vName]) {
            groupedVenues[vName] = {
              name: vName,
              category: "Εστιατόριο",
              area: "Κέντρο",
              image:
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
              lat: 37.9753,
              lng: 23.7361,
              slots: [],
            };
          }
          groupedVenues[vName].slots.push(slot);
        });

        setVenues(Object.values(groupedVenues));
        setLoading(false);
      },
      (error) => {
        console.error("Σφάλμα φόρτωσης slots:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    venues.forEach((v) => {
      if (v.area) areas.add(v.area);
    });
    return Array.from(areas);
  }, [venues]);

  const extractDiscountNumber = (discountStr: string): number => {
    const match = discountStr.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const filteredVenues = useMemo(() => {
    return venues
      .map((venue) => {
        const matchedSlots = venue.slots.filter((slot) => {
          if (minDiscount === 0) return true;
          return extractDiscountNumber(slot.discount) >= minDiscount;
        });

        return {
          ...venue,
          slots: matchedSlots,
        };
      })
      .filter((venue) => {
        const matchesSearch =
          venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          venue.category.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesArea =
          selectedArea === "all" || venue.area.toLowerCase() === selectedArea.toLowerCase();

        const matchesDiscount = minDiscount === 0 || venue.slots.length > 0;

        return matchesSearch && matchesArea && matchesDiscount;
      });
  }, [venues, searchTerm, selectedArea, minDiscount]);

  // Μετατροπή των φιλτραρισμένων καταστημάτων για το Leaflet
  const mapVenuesData = useMemo(() => {
    return filteredVenues.map((v) => {
      const bestDiscount = v.slots.length > 0 ? v.slots[0].discount : "-20%";
      return {
        name: v.name,
        category: v.category,
        area: v.area,
        lat: v.lat,
        lng: v.lng,
        bestDiscount,
      };
    });
  }, [filteredVenues]);

  const handleShareCurrentBooking = async () => {
    if (!currentBooking) return;
    const shareText = `🍽️ Έκλεισα τραπέζι στο "${currentBooking.venueName}" μέσω HappySeats!\n📅 Ημερομηνία: ${currentBooking.date}\n⏰ Ώρα: ${currentBooking.timeWindow}\n👥 Άτομα: ${currentBooking.partySize}\n🎁 Έκπτωση: ${currentBooking.discount}\n🎟️ Κωδικός Κράτησης: ${currentBooking.ticketCode}\n\nΡαντεβού εκεί!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Κράτηση HappySeats - ${currentBooking.venueName}`,
          text: shareText,
        });
      } catch (err) {
        console.log("Share cancelled:", err);
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
      alert("Τα στοιχεία της κράτησης αντιγράφηκαν! Μπορείτε να τα στείλετε στην παρέα σας.");
    }
  };

  const handleBooking = async () => {
    if (!selectedVenueName || !selectedSlot) return;

    if (selectedSlot.availableTables <= 0) {
      alert("Δυστυχώς εξαντλήθηκαν τα τραπέζια για αυτή τη χρονοθυρίδα!");
      return;
    }

    setIsSubmitting(true);

    const cleanPrefix = selectedVenueName.substring(0, 3).toUpperCase();
    const code = `${cleanPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    const todayDate = new Date().toLocaleDateString("el-GR");

    const newBooking: Booking = {
      ticketCode: code,
      venueName: selectedVenueName,
      timeWindow: selectedSlot.timeWindow,
      discount: selectedSlot.discount,
      partySize,
      date: todayDate,
    };

    try {
      const slotRef = doc(db, "slots", selectedSlot.id);
      const bookingsCollectionRef = collection(db, "bookings");
      const newBookingRef = doc(bookingsCollectionRef);

      await runTransaction(db, async (transaction) => {
        const slotSnap = await transaction.get(slotRef);
        if (!slotSnap.exists()) {
          throw new Error("Το slot δεν υπάρχει πλέον!");
        }

        const currentTables = slotSnap.data().availableTables ?? 0;
        if (currentTables <= 0) {
          throw new Error("Εξαντλήθηκαν τα τραπέζια!");
        }

        transaction.update(slotRef, {
          availableTables: currentTables - 1,
        });

        transaction.set(newBookingRef, {
          ...newBooking,
          venueId: selectedSlot.venueId || "default",
          slotId: selectedSlot.id,
          status: "confirmed",
          createdAt: serverTimestamp(),
        });
      });

      const stored = localStorage.getItem("happyseats_tickets");
      const existingCodes = stored ? JSON.parse(stored) : [];
      if (!existingCodes.includes(code)) {
        localStorage.setItem(
          "happyseats_tickets",
          JSON.stringify([code, ...existingCodes])
        );
      }

      setCurrentBooking(newBooking);
      setSelectedSlot(null);
    } catch (error) {
      console.error("Σφάλμα κράτησης:", error);
      const msg = error instanceof Error ? error.message : "Παρουσιάστηκε σφάλμα κατά την κράτηση.";
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <header className="max-w-5xl mx-auto flex items-center justify-between pb-6 border-b border-neutral-800">
        <div>
          <h1 className="text-2xl font-black text-amber-400">HappySeats</h1>
          <p className="text-xs text-neutral-400">Κλείσε τραπέζι τις σωστές ώρες, κέρδισε έκπτωση</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/my-tickets"
            className="text-xs font-semibold px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl transition border border-neutral-800 flex items-center gap-1"
          >
            🎟️ Τα Εισιτήριά μου
          </a>
          <a
            href="/merchant"
            className="text-xs font-semibold px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-amber-300 rounded-xl transition border border-neutral-800"
          >
            Είσοδος Καταστήματος →
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-8">
        {currentBooking && (
          <div className="mb-10 p-6 bg-neutral-900 border-2 border-amber-400 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-widest px-3 py-1 bg-amber-400/20 text-amber-300 rounded-full font-bold">
                ✓ e-Ticket Έτοιμο & Αποθηκευμένο
              </span>
              <h2 className="text-2xl font-bold text-white">{currentBooking.venueName}</h2>
              <p className="text-neutral-300 text-sm">
                Ώρα: <span className="font-semibold text-white">{currentBooking.timeWindow}</span> | Ημερομηνία: {currentBooking.date}
              </p>
              <p className="text-neutral-300 text-sm">
                Άτομα: <span className="font-semibold text-white">{currentBooking.partySize}</span> | Προσφορά: <span className="text-amber-400 font-bold">{currentBooking.discount}</span>
              </p>
              <p className="text-xs text-neutral-400 pt-2">
                Δείξε αυτό το QR code κατά την άφιξή σου στην υποδοχή.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleShareCurrentBooking}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <span>📲</span> Κοινοποίηση στην παρέα
                </button>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl flex flex-col items-center">
              <QRCodeSVG
                value={`HAPPYSEATS:${currentBooking.ticketCode}|${currentBooking.venueName}|${currentBooking.partySize}P`}
                size={140}
              />
              <span className="text-black font-mono font-bold text-sm mt-2">{currentBooking.ticketCode}</span>
            </div>
          </div>
        )}

        {/* Μπάρα Αναζήτησης και Φίλτρων */}
        <section className="bg-neutral-900 border border-neutral-800 p-5 rounded-3xl mb-8 shadow-lg space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                Αναζήτηση
              </label>
              <input
                type="text"
                placeholder="Όνομα μαγαζιού ή κουζίνα..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 placeholder:text-neutral-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                Περιοχή
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                <option value="all">Όλες οι περιοχές</option>
                {availableAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                Έκπτωση
              </label>
              <select
                value={minDiscount}
                onChange={(e) => setMinDiscount(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                <option value={0}>Όλες οι εκπτώσεις</option>
                <option value={20}>Τουλάχιστον -20%</option>
                <option value={30}>Τουλάχιστον -30%</option>
                <option value={40}>Τουλάχιστον -40%</option>
                <option value={50}>Happy Hour (-50%)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-neutral-800/60 text-xs">
            <span className="text-neutral-400">
              Βρέθηκαν <strong className="text-amber-400">{filteredVenues.length}</strong> καταστήματα
            </span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowMap((prev) => !prev)}
                className="px-3 py-1 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-lg font-bold transition flex items-center gap-1"
              >
                {showMap ? "📋 Προβολή Λίστας" : "🗺️ Προβολή Χάρτη"}
              </button>
              {(searchTerm || selectedArea !== "all" || minDiscount > 0) && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedArea("all");
                    setMinDiscount(0);
                  }}
                  className="text-neutral-400 hover:text-white transition underline"
                >
                  Καθαρισμός
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Προβολή Διαδραστικού Χάρτη */}
        {showMap && <VenueMap venues={mapVenuesData} />}

        <h2 className="text-xl font-bold mb-6">Διαθέσιμες Προσφορές Σήμερα</h2>

        {loading ? (
          <div className="text-center py-20 text-neutral-500 text-sm">Φόρτωση προσφορών...</div>
        ) : filteredVenues.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 p-12 rounded-3xl text-center space-y-3">
            <span className="text-3xl">🔍</span>
            <h3 className="font-bold text-white text-base">Δεν βρέθηκαν αποτελέσματα</h3>
            <p className="text-xs text-neutral-400">
              Δοκιμάστε να αλλάξετε την αναζήτηση ή τα φίλτρα περιοχής και έκπτωσης.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredVenues.map((venue) => (
              <div key={venue.name} className="bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 shadow-md">
                <div className="relative w-full h-48">
                  <div className="relative w-full h-48">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={venue.image}
                      alt={venue.name}
                      loading="eager"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <Link
                      href={`/venue/${(VENUE_METADATA[venue.name]?.slug) || "koukoutsis"}`}
                      className="hover:text-amber-400 transition"
                    >
                      <h3 className="text-lg font-bold text-white">{venue.name} →</h3>
                    </Link>
                    <span className="text-xs bg-neutral-800 text-neutral-300 px-2.5 py-1 rounded-md border border-neutral-700/50">
                      {venue.area}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mb-4">{venue.category}</p>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Διαθέσιμες Χρονοθυρίδες
                    </div>

                    {venue.slots.length === 0 ? (
                      <p className="text-xs text-neutral-500 py-3 italic">
                        Δεν υπάρχουν ενεργά happy hour slots που να ταιριάζουν στα κριτήρια.
                      </p>
                    ) : (
                      venue.slots.map((slot) => (
                        <SlotItem
                          key={slot.id}
                          slot={slot}
                          onSelect={() => {
                            setSelectedVenueName(venue.name);
                            setSelectedSlot(slot);
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Pop-up Επιβεβαίωσης */}
      {selectedSlot && selectedVenueName && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Επιβεβαίωση Κράτησης</h3>
            <p className="text-sm text-neutral-300">
              {selectedVenueName} ({selectedSlot.timeWindow})
            </p>
            <div className="text-xs text-amber-400 font-semibold">{selectedSlot.discount}</div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1">Αριθμός Ατόμων:</label>
              <select
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-sm text-white focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 8].map((num) => (
                  <option key={num} value={num}>
                    {num} άτομα
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="flex-1 py-2.5 bg-neutral-800 rounded-xl text-sm font-semibold hover:bg-neutral-700 transition"
              >
                Άκυρο
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleBooking}
                className="flex-1 py-2.5 bg-amber-400 text-neutral-950 rounded-xl text-sm font-bold hover:bg-amber-300 transition disabled:opacity-50"
              >
                {isSubmitting ? "Έκδοση..." : "Έκδοση Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}