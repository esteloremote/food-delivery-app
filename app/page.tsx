"use client";

import { useState } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface SlotDeal {
  id: string;
  timeWindow: string;
  discount: string;
  availableTables: number;
}

interface Venue {
  id: string;
  name: string;
  category: string;
  area: string;
  image: string;
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

const INITIAL_VENUES: Venue[] = [
  {
    id: "v1",
    name: "Εστιατόριο ΚΟΥΚΟΥΤΣΗΣ",
    category: "Παραδοσιακή Κουζίνα",
    area: "Κέντρο",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
    slots: [
      { id: "s1", timeWindow: "19:00 - 21:00", discount: "-20%", availableTables: 4 },
      { id: "s2", timeWindow: "21:00 - 23:00", discount: "Happy Hour (-40%)", availableTables: 10 },
    ],
  },
  {
    id: "v2",
    name: "Cucina Bella",
    category: "Ιταλικό & Wine Bar",
    area: "Γλυφάδα",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80",
    slots: [
      { id: "s3", timeWindow: "18:00 - 20:00", discount: "Early Bird (-30%)", availableTables: 5 },
      { id: "s4", timeWindow: "22:00 - 00:00", discount: "Late Night (-25%)", availableTables: 2 },
    ],
  },
];

export default function Home() {
  const [venues, setVenues] = useState<Venue[]>(INITIAL_VENUES);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotDeal | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBooking = async () => {
    if (!selectedVenue || !selectedSlot) return;

    if (selectedSlot.availableTables <= 0) {
      alert("Δυστυχώς εξαντλήθηκαν τα τραπέζια για αυτή την ώρα!");
      return;
    }

    setIsSubmitting(true);

    // Δημιουργία Μοναδικού Κωδικού Ticket (π.χ. KOU-5839)
    const code = `${selectedVenue.name.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const todayDate = new Date().toLocaleDateString("el-GR");

    const newBooking: Booking = {
      ticketCode: code,
      venueName: selectedVenue.name,
      timeWindow: selectedSlot.timeWindow,
      discount: selectedSlot.discount,
      partySize,
      date: todayDate,
    };

    try {
      // 1. Αποθήκευση της κράτησης στο Firebase Firestore
      await addDoc(collection(db, "bookings"), {
        ...newBooking,
        venueId: selectedVenue.id,
        slotId: selectedSlot.id,
        status: "confirmed", // confirmed | checked_in
        createdAt: serverTimestamp(),
      });

      // 2. Μείωση των διαθέσιμων τραπεζιών τοπικά στην οθόνη
      setVenues((prevVenues) =>
        prevVenues.map((v) => {
          if (v.id !== selectedVenue.id) return v;
          return {
            ...v,
            slots: v.slots.map((s) =>
              s.id === selectedSlot.id
                ? { ...s, availableTables: s.availableTables - 1 }
                : s
            ),
          };
        })
      );

      // Εμφάνιση του ticket στον χρήστη
      setCurrentBooking(newBooking);
      setSelectedSlot(null);
    } catch (error) {
      console.error("Σφάλμα κράτησης:", error);
      alert("Προέκυψε σφάλμα κατά την αποθήκευση της κράτησης.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-6">
      <header className="max-w-5xl mx-auto flex items-center justify-between pb-6 border-b border-neutral-800">
        <div>
          <h1 className="text-2xl font-black text-amber-400">HappySeats</h1>
          <p className="text-xs text-neutral-400">Κλείσε τραπέζι τις σωστές ώρες, κέρδισε έκπτωση</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-8">
        {/* e-Ticket Banner όταν επιβεβαιωθεί η κράτηση */}
        {currentBooking && (
          <div className="mb-10 p-6 bg-neutral-800 border-2 border-amber-400 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl animate-fade-in">
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
                Δείξε αυτό το QR code κατά την άφιξή σου στο κατάστημα.
              </p>
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

        {/* Καταστήματα & Χρονοθυρίδες */}
        <h2 className="text-xl font-bold mb-6">Διαθέσιμες Προσφορές Σήμερα</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {venues.map((venue) => (
            <div key={venue.id} className="bg-neutral-800 rounded-3xl overflow-hidden border border-neutral-700 shadow-md">
              <div className="relative w-full h-48">
                <Image
                  src={venue.image}
                  alt={venue.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-white">{venue.name}</h3>
                  <span className="text-xs bg-neutral-700 text-neutral-300 px-2 py-1 rounded-md">{venue.area}</span>
                </div>
                <p className="text-xs text-neutral-400 mb-4">{venue.category}</p>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Διαθέσιμες Χρονοθυρίδες
                  </div>
                  {venue.slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="p-3 rounded-xl bg-neutral-900 border border-neutral-700/80 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-bold text-white">{slot.timeWindow}</div>
                        <div className="text-xs text-amber-400 font-medium">{slot.discount}</div>
                        <div className="text-[11px] text-neutral-400">
                          {slot.availableTables > 0 ? `${slot.availableTables} τραπέζια απομένουν` : "Εξαντλήθηκε"}
                        </div>
                      </div>
                      <button
                        disabled={slot.availableTables <= 0}
                        onClick={() => {
                          setSelectedVenue(venue);
                          setSelectedSlot(slot);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          slot.availableTables > 0
                            ? "bg-amber-400 hover:bg-amber-300 text-neutral-950"
                            : "bg-neutral-700 text-neutral-500 cursor-not-allowed"
                        }`}
                      >
                        {slot.availableTables > 0 ? "Κράτηση" : "Full"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Pop-up Επιβεβαίωσης */}
      {selectedSlot && selectedVenue && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-800 border border-neutral-700 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">Επιβεβαίωση Κράτησης</h3>
            <p className="text-sm text-neutral-300">
              {selectedVenue.name} ({selectedSlot.timeWindow})
            </p>
            <div className="text-xs text-amber-400 font-semibold">{selectedSlot.discount}</div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1">Αριθμός Ατόμων:</label>
              <select
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-xl p-2.5 text-sm text-white focus:outline-none"
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
                className="flex-1 py-2.5 bg-neutral-700 rounded-xl text-sm font-semibold hover:bg-neutral-600 transition"
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