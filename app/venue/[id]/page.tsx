"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
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
import { auth, db } from "@/lib/firebase";

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
  isPublished?: boolean;
  subscriptionStatus?: string;
}

export default function VenueProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const venueIdOrSlug = resolvedParams.id;

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [venue, setVenue] = useState<VenueDetails | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);
  const [slots, setSlots] = useState<SlotDeal[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotDeal | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccessCode, setBookingSuccessCode] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchVenue = async () => {
      setVenueLoading(true);
      try {
        const docRef = doc(db, "venues", venueIdOrSlug);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setVenue({ id: docSnap.id, ...(docSnap.data() as Omit<VenueDetails, "id">) });
        } else {
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

    if (!currentUser) {
      alert("Παρακαλώ συνδεθείτε για να ολοκληρώσετε την κράτηση.");
      router.push("/login");
      return;
    }

    setIsSubmitting(true);
    const cleanPrefix = venue.name.substring(0, 3).toUpperCase();
    const code = `${cleanPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    const todayDate = new Date().toLocaleDateString("el-GR");

    try {
      const slotRef = doc(db, "slots", selectedSlot.id);
      const newBookingRef = doc(collection(db, "bookings"));

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
          customerId: currentUser.uid,
          customerEmail: currentUser.email,
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
      <div className="min-h-screen bg-surface text-text-muted flex items-center justify-center text-sm">
        Φόρτωση καταστήματος...
      </div>
    );
  }

  if (
    !venue ||
    venue.isPublished === false ||
    venue.subscriptionStatus === "past_due"
  ) {
    return (
      <div className="min-h-screen bg-surface text-text-main flex flex-col items-center justify-center p-6 space-y-4">
        <h1 className="text-2xl font-bold">Το κατάστημα δεν είναι διαθέσιμο</h1>
        <p className="text-text-muted text-sm text-center max-w-md">
          Το κατάστημα που αναζητάτε δεν δέχεται κρατήσεις αυτή τη στιγμή ή έχει αφαιρεθεί.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold shadow-sm"
        >
          ← Επιστροφή στην Αρχική
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-text-main pb-16">
      <div className="relative w-full h-72 md:h-96">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            venue.image ||
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80"
          }
          alt={venue.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute top-6 left-6 right-6 max-w-5xl mx-auto flex justify-between items-center">
          <Link
            href="/"
            className="px-3.5 py-2 bg-card/90 hover:bg-card text-text-main backdrop-blur-md rounded-xl text-xs font-semibold border border-border-theme transition shadow-sm"
          >
            ← Επιστροφή
          </Link>
          <Link
            href="/my-tickets"
            className="px-3.5 py-2 bg-card/90 hover:bg-card text-text-main backdrop-blur-md rounded-xl text-xs font-semibold border border-border-theme transition shadow-sm"
          >
            🎟️ Τα Εισιτήριά μου
          </Link>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 -mt-16 relative z-10 space-y-8">
        <div className="bg-card border border-border-theme p-6 md:p-8 rounded-3xl shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-text bg-brand-light px-2.5 py-1 rounded-md border border-brand-border">
                {venue.category}
              </span>
              <h1 className="text-3xl font-black text-text-main mt-2">{venue.name}</h1>
              <p className="text-sm text-text-muted mt-1">📍 {venue.area}</p>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${venue.name} ${venue.address}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-subtle hover:bg-border-theme text-text-main rounded-xl text-xs font-semibold border border-border-theme transition flex items-center justify-center gap-1.5 self-start shadow-sm"
            >
              <span>📍</span> Οδηγίες στο Google Maps
            </a>
          </div>

          {venue.description && (
            <p className="text-sm text-text-muted leading-relaxed pt-2 border-t border-border-theme">
              {venue.description}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border-theme text-xs text-text-muted">
            <div>
              <span className="text-text-muted block">Διεύθυνση:</span>
              <strong className="text-text-main">{venue.address}</strong>
            </div>
            <div>
              <span className="text-text-muted block">Τηλέφωνο Επικοινωνίας:</span>
              <strong className="text-text-main">{venue.phone}</strong>
            </div>
            <div>
              <span className="text-text-muted block">Ωράριο Λειτουργίας:</span>
              <strong className="text-text-main">{venue.hours}</strong>
            </div>
          </div>
        </div>

        {bookingSuccessCode && (
          <div className="p-6 bg-card border-2 border-brand rounded-3xl flex justify-between items-center shadow-md">
            <div>
              <span className="text-xs font-bold bg-brand-light text-brand-text border border-brand-border px-3 py-1 rounded-full uppercase">
                ✓ Η κράτηση ολοκληρώθηκε!
              </span>
              <p className="text-sm text-text-muted mt-2">
                Ο κωδικός σου είναι:{" "}
                <strong className="text-text-main font-mono text-base">
                  {bookingSuccessCode}
                </strong>
              </p>
            </div>
            <Link
              href="/my-tickets"
              className="px-4 py-2 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand-hover transition shadow-sm"
            >
              Δες το e-Ticket →
            </Link>
          </div>
        )}

        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-text-main">Διαθέσιμα Happy Hour Slots</h2>
            <span className="text-xs text-text-muted">{slots.length} διαθέσιμα</span>
          </div>

          {slots.length === 0 ? (
            <div className="p-8 bg-card border border-border-theme rounded-3xl text-center text-xs text-text-muted">
              Δεν υπάρχουν ενεργές προσφορές για αυτό το κατάστημα αυτή τη στιγμή.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {slots.map((s) => (
                <div
                  key={s.id}
                  className="bg-card border border-border-theme p-5 rounded-2xl flex flex-col justify-between space-y-3 shadow-sm hover:border-brand transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-base font-bold text-text-main">{s.timeWindow}</div>
                      <div className="text-sm text-brand-text font-bold">{s.discount}</div>
                    </div>
                    <span className="text-xs bg-subtle text-text-main font-medium px-2.5 py-1 rounded-lg border border-border-theme">
                      {s.availableTables} τραπέζια
                    </span>
                  </div>

                  <button
                    disabled={s.availableTables <= 0}
                    onClick={() => setSelectedSlot(s)}
                    className="w-full py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-xs transition disabled:opacity-40 shadow-sm cursor-pointer"
                  >
                    {s.availableTables > 0 ? "Κράτηση Θέσης" : "Εξαντλήθηκε"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {venue.highlights && venue.highlights.length > 0 && (
          <section className="bg-card border border-border-theme p-6 rounded-3xl space-y-3 shadow-sm">
            <h3 className="text-base font-bold text-text-main">Δημοφιλή Πιάτα & Επιλογές</h3>
            <div className="flex flex-wrap gap-2 pt-1">
              {venue.highlights.map((item) => (
                <span
                  key={item}
                  className="px-3 py-1.5 bg-subtle border border-border-theme text-xs font-medium text-text-main rounded-xl"
                >
                  🍴 {item}
                </span>
              ))}
            </div>
          </section>
        )}
      </main>

      {selectedSlot && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border-theme p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-text-main">Επιβεβαίωση Κράτησης</h3>
            <p className="text-sm text-text-muted">
              {venue.name} ({selectedSlot.timeWindow})
            </p>
            <div className="text-xs text-brand-text font-bold">{selectedSlot.discount}</div>

            <div>
              <label className="block text-xs text-text-muted mb-1">Αριθμός Ατόμων:</label>
              <select
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full bg-subtle border border-border-theme rounded-xl p-2.5 text-sm text-text-main focus:outline-none focus:border-brand cursor-pointer"
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
                className="flex-1 py-2.5 bg-subtle rounded-xl text-sm font-semibold hover:bg-border-theme text-text-main transition cursor-pointer"
              >
                Άκυρο
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleBooking}
                className="flex-1 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-hover transition disabled:opacity-50 shadow-sm cursor-pointer"
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