"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface SlotDeal {
  id: string;
  venueId?: string;
  venueName: string;
  timeWindow: string;
  discount: string;
  availableTables: number;
  totalTables: number;
}

interface VenueDetails {
  id: string;
  name: string;
  slug: string;
  category: string;
  area: string;
  address: string;
  phone: string;
  hours: string;
  description: string;
  image: string;
  highlights: string[];
}

export default function VenueProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const venueIdOrSlug = resolvedParams.id;

  const [venue, setVenue] = useState<VenueDetails | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);
  const [slots, setSlots] = useState<SlotDeal[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotDeal | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccessCode, setBookingSuccessCode] = useState<string | null>(null);

  // Ανάκτηση στοιχείων καταστήματος από Firestore
  useEffect(() => {
    const fetchVenue = async () => {
      setVenueLoading(true);
      try {
        // 1. Δοκιμή με Document ID
        const docRef = doc(db, "venues", venueIdOrSlug);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setVenue({ id: docSnap.id, ...(docSnap.data() as Omit<VenueDetails, "id">) });
        } else {
          // 2. Εναλλακτική αναζήτηση με βάση το slug
          const qSlug = query(collection(db, "venues"), where("slug", "==", venueIdOrSlug));
          const querySnap = await getDocs(qSlug);
          if (!querySnap.empty) {
            const firstDoc = querySnap.docs[0];
            setVenue({ id: firstDoc.id, ...(firstDoc.data() as Omit<VenueDetails, "id">) });
          } else {
            setVenue(null);
          }
        }
      } catch (err) {
        console.error("Σφάλμα φόρτωσης καταστήματος:", err);
      } finally {
        setVenueLoading(false);
      }
    };

    fetchVenue();
  }, [venueIdOrSlug]);

  // Real-time συγχρονισμός των slots του συγκεκριμένου μαγαζιού
  useEffect(() => {
    if (!venue) return;

    const q = query(collection(db, "slots"), where("venueName", "==", venue.name));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SlotDeal[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as Omit<SlotDeal, "id">) });
      });
      setSlots(list);
    });

    return () => unsubscribe();
  }, [venue]);

  const handleBooking = async () => {
    if (!venue || !selectedSlot || selectedSlot.availableTables <= 0) return;
    setIsSubmitting(true);

    const cleanPrefix = venue.name.substring(0, 3).toUpperCase();
    const code = `${cleanPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    const todayDate = new Date().toLocaleDateString("el-GR");

    try {
      const slotRef = doc(db, "slots", selectedSlot.id);
      const bookingsCollectionRef = collection(db, "bookings");
      const newBookingRef = doc(bookingsCollectionRef);

      await runTransaction(db, async (transaction) => {
        const slotSnap = await transaction.get(slotRef);
        if (!slotSnap.exists()) throw new Error("Το slot δεν υπάρχει πλέον!");

        const currentTables = slotSnap.data().availableTables ?? 0;
        if (currentTables <= 0) throw new Error("Εξαντλήθηκαν τα τραπέζια!");

        transaction.update(slotRef, {
          availableTables: currentTables - 1,
        });

        transaction.set(newBookingRef, {
          ticketCode: code,
          venueName: venue.name,
          timeWindow: selectedSlot.timeWindow,
          discount: selectedSlot.discount,
          partySize,
          date: todayDate,
          venueId: venue.id,
          slotId: selectedSlot.id,
          status: "confirmed",
          createdAt: serverTimestamp(),
        });
      });

      const stored = localStorage.getItem("happyseats_tickets");
      const existing = stored ? JSON.parse(stored) : [];
      if (!existing.includes(code)) {
        localStorage.setItem("happyseats_tickets", JSON.stringify([code, ...existing]));
      }

      setBookingSuccessCode(code);
      setSelectedSlot(null);
    } catch (err) {
      console.error(err);
      alert("Παρουσιάστηκε σφάλμα κατά την κράτηση.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (venueLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center text-sm">
        Φόρτωση καταστήματος...
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <h1 className="text-2xl font-bold">Το κατάστημα δεν βρέθηκε</h1>
        <p className="text-neutral-400 text-sm">
          Το κατάστημα που αναζητάτε δεν υπάρχει ή έχει αφαιρεθεί.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-amber-400 text-neutral-950 rounded-xl text-xs font-bold"
        >
          ← Επιστροφή στην Αρχική
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-16">
      {/* Cover Image */}
      <div className="relative w-full h-72 md:h-96">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={venue.image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80"}
          alt={venue.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
        <div className="absolute top-6 left-6 right-6 max-w-5xl mx-auto flex justify-between items-center">
          <Link
            href="/"
            className="px-3.5 py-2 bg-neutral-900/80 hover:bg-neutral-900 backdrop-blur-md rounded-xl text-xs font-semibold border border-neutral-700 transition"
          >
            ← Επιστροφή
          </Link>
          <Link
            href="/my-tickets"
            className="px-3.5 py-2 bg-neutral-900/80 hover:bg-neutral-900 backdrop-blur-md rounded-xl text-xs font-semibold border border-neutral-700 transition"
          >
            🎟️ Τα Εισιτήριά μου
          </Link>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 -mt-16 relative z-10 space-y-8">
        {/* Header Profile Box */}
        <div className="bg-neutral-900 border border-neutral-800 p-6 md:p-8 rounded-3xl shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                {venue.category}
              </span>
              <h1 className="text-3xl font-black text-white mt-1">{venue.name}</h1>
              <p className="text-sm text-neutral-400 mt-1">{venue.area}</p>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${venue.name} ${venue.address}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold border border-neutral-700 transition flex items-center justify-center gap-1.5 self-start"
            >
              <span>📍</span> Οδηγίες στο Google Maps
            </a>
          </div>

          {venue.description && (
            <p className="text-sm text-neutral-300 leading-relaxed pt-2 border-t border-neutral-800/80">
              {venue.description}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-neutral-800/80 text-xs text-neutral-400">
            <div>
              <span className="text-neutral-500 block">Διεύθυνση:</span>
              <strong className="text-neutral-200">{venue.address}</strong>
            </div>
            <div>
              <span className="text-neutral-500 block">Τηλέφωνο Επικοινωνίας:</span>
              <strong className="text-neutral-200">{venue.phone}</strong>
            </div>
            <div>
              <span className="text-neutral-500 block">Ωράριο Λειτουργίας:</span>
              <strong className="text-neutral-200">{venue.hours}</strong>
            </div>
          </div>
        </div>

        {/* Επιτυχής Κράτηση Banner */}
        {bookingSuccessCode && (
          <div className="p-6 bg-neutral-900 border-2 border-amber-400 rounded-3xl flex justify-between items-center shadow-xl">
            <div>
              <span className="text-xs font-bold bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full uppercase">
                ✓ Η κράτηση ολοκληρώθηκε!
              </span>
              <p className="text-sm text-neutral-300 mt-2">
                Ο κωδικός σου είναι: <strong className="text-white font-mono">{bookingSuccessCode}</strong>
              </p>
            </div>
            <Link
              href="/my-tickets"
              className="px-4 py-2 bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl hover:bg-amber-300 transition"
            >
              Δες το e-Ticket →
            </Link>
          </div>
        )}

        {/* Διαθέσιμα Slots */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Διαθέσιμα Happy Hour Slots</h2>
            <span className="text-xs text-neutral-400">{slots.length} διαθέσιμα</span>
          </div>

          {slots.length === 0 ? (
            <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-3xl text-center text-xs text-neutral-500">
              Δεν υπάρχουν ενεργές προσφορές για αυτό το κατάστημα αυτή τη στιγμή.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {slots.map((s) => (
                <div
                  key={s.id}
                  className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl flex flex-col justify-between space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-base font-bold text-white">{s.timeWindow}</div>
                      <div className="text-sm text-amber-400 font-semibold">{s.discount}</div>
                    </div>
                    <span className="text-xs bg-neutral-800 text-neutral-300 px-2.5 py-1 rounded-lg">
                      {s.availableTables} τραπέζια
                    </span>
                  </div>

                  <button
                    disabled={s.availableTables <= 0}
                    onClick={() => setSelectedSlot(s)}
                    className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs transition disabled:opacity-50"
                  >
                    {s.availableTables > 0 ? "Κράτηση Θέσης" : "Εξαντλήθηκε"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Highlights / Πιάτα */}
        {venue.highlights && venue.highlights.length > 0 && (
          <section className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-3">
            <h3 className="text-base font-bold text-white">Δημοφιλή Πιάτα & Επιλογές</h3>
            <div className="flex flex-wrap gap-2 pt-1">
              {venue.highlights.map((item) => (
                <span
                  key={item}
                  className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 text-xs font-medium text-neutral-300 rounded-xl"
                >
                  🍴 {item}
                </span>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Modal Κράτησης */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Επιβεβαίωση Κράτησης</h3>
            <p className="text-sm text-neutral-300">
              {venue.name} ({selectedSlot.timeWindow})
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