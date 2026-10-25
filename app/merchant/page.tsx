"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface VenueDoc {
  id: string;
  name: string;
  slug: string;
}

interface SlotDeal {
  id: string;
  venueId?: string;
  venueName: string;
  timeWindow: string;
  discount: string;
  availableTables: number;
  totalTables: number;
}

interface BookingRecord {
  id: string;
  ticketCode: string;
  venueName: string;
  timeWindow: string;
  discount: string;
  partySize: number;
  date: string;
  status: "confirmed" | "used" | "checked_in" | "cancelled";
}

export default function MerchantDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Venues State
  const [venues, setVenues] = useState<VenueDoc[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<VenueDoc | null>(null);
  const [venuesLoading, setVenuesLoading] = useState(true);

  // Slots & Bookings State
  const [slots, setSlots] = useState<SlotDeal[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);

  // Form State για Νέο Slot
  const [timeWindow, setTimeWindow] = useState("17:30 - 19:30");
  const [discount, setDiscount] = useState("-30%");
  const [totalTables, setTotalTables] = useState(3);
  const [isCreatingSlot, setIsCreatingSlot] = useState(false);

  // 1. Έλεγχος Σύνδεσης
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/merchant/login");
      } else {
        setCurrentUser(user);
        setAuthLoading(false);
      }
    });

    return () => unsubAuth();
  }, [router]);

  // 2. Real-time Subscription ΜΟΝΟ στα καταστήματα του συνδεδεμένου εστιάτορα
  useEffect(() => {
    if (!currentUser) return;

    const qVenues = query(
      collection(db, "venues"),
      where("ownerId", "==", currentUser.uid)
    );

    const unsub = onSnapshot(qVenues, (snapshot) => {
      const list: VenueDoc[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name || d.id,
          slug: data.slug || d.id,
        });
      });
      setVenues(list);
      setVenuesLoading(false);

      if (list.length > 0) {
        const savedId =
          typeof window !== "undefined"
            ? localStorage.getItem("happyseats_merchant_venueId")
            : null;
        const matched = list.find((v) => v.id === savedId) || list[0];
        setSelectedVenue(matched);
      } else {
        setSelectedVenue(null);
      }
    });

    return () => unsub();
  }, [currentUser]);

  // 3. Real-time Subscription στα Slots του επιλεγμένου καταστήματος
  useEffect(() => {
    if (!selectedVenue) return;

    const q = query(
      collection(db, "slots"),
      where("venueName", "==", selectedVenue.name)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: SlotDeal[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as Omit<SlotDeal, "id">) });
      });
      setSlots(list);
    });

    return () => unsub();
  }, [selectedVenue]);

  // 4. Real-time Subscription στις Κρατήσεις του επιλεγμένου καταστήματος
  useEffect(() => {
    if (!selectedVenue) return;

    const q = query(
      collection(db, "bookings"),
      where("venueName", "==", selectedVenue.name)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: BookingRecord[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as Omit<BookingRecord, "id">) });
      });
      setBookings(list);
    });

    return () => unsub();
  }, [selectedVenue]);

  // Υπολογισμός Live Στατιστικών
  const stats = useMemo(() => {
    const totalBookings = bookings.length;
    const totalGuests = bookings.reduce((acc, b) => acc + (b.partySize || 0), 0);
    const checkedInCount = bookings.filter(
      (b) => b.status === "used" || b.status === "checked_in"
    ).length;
    const checkInRate =
      totalBookings > 0 ? Math.round((checkedInCount / totalBookings) * 100) : 0;

    return {
      totalBookings,
      totalGuests,
      checkedInCount,
      checkInRate,
    };
  }, [bookings]);

  const handleSwitchVenue = (venueId: string) => {
    const v = venues.find((item) => item.id === venueId);
    if (v) {
      setSelectedVenue(v);
      setSlots([]);
      setBookings([]);
      localStorage.setItem("happyseats_merchant_venueId", v.id);
      localStorage.setItem("happyseats_merchant_venueName", v.name);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/merchant/login");
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVenue) return;

    setIsCreatingSlot(true);
    try {
      await addDoc(collection(db, "slots"), {
        venueId: selectedVenue.id,
        venueName: selectedVenue.name,
        timeWindow,
        discount,
        totalTables: Number(totalTables),
        availableTables: Number(totalTables),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      alert("Σφάλμα δημιουργίας slot.");
    } finally {
      setIsCreatingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Θέλετε σίγουρα να διαγράψετε αυτή τη χρονοθυρίδα;")) return;
    try {
      await deleteDoc(doc(db, "slots", slotId));
    } catch (err) {
      console.error(err);
    }
  };

  if (authLoading || venuesLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm">
        Φόρτωση πίνακα διαχείρισης...
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-3xl shadow-lg">
          🍽️
        </div>
        <div className="text-center max-w-md space-y-2">
          <h1 className="text-2xl font-bold">Καλώς ήρθατε στο HappySeats Partner!</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Ο λογαριασμός σας (<strong className="text-slate-200">{currentUser?.email}</strong>) είναι έτοιμος. Για να ξεκινήσετε, καταχωρήστε το πρώτο σας εστιατόριο.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/merchant/onboarding"
            className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-sm transition shadow-xl"
          >
            + Καταχώρηση Πρώτου Εστιατορίου
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-xl text-sm transition"
          >
            Αποσύνδεση
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Top Header */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-amber-400 font-bold">
              Merchant Operations
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
              {currentUser?.email}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">
            {selectedVenue?.name || "Merchant Dashboard"}
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedVenue?.id || ""}
            onChange={(e) => handleSwitchVenue(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-amber-400 font-bold text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                📍 {v.name}
              </option>
            ))}
          </select>

          {/* Dedicated Scanner Button */}
          <Link
            href="/merchant/scan"
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition shadow-lg flex items-center gap-1.5"
          >
            <span>📷</span> Scanner Κάμερας
          </Link>

          <Link
            href="/merchant/profile"
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
          >
            <span>⚙️</span> Προφίλ & Μενού
          </Link>

          <Link
            href="/merchant/onboarding"
            className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold rounded-xl transition"
          >
            + Νέο Κατάστημα
          </Link>

          <button
            onClick={handleLogout}
            className="px-3 py-2.5 bg-slate-900 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-800 rounded-xl text-xs font-semibold transition"
          >
            Αποσύνδεση
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 space-y-8">
        {/* KPI Analytics Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Κρατήσεις Σήμερα
            </span>
            <div className="text-3xl font-black text-white mt-2">
              {stats.totalBookings}
            </div>
            <span className="text-[11px] text-amber-400 mt-1 block">
              ⚡ Ενεργή ζήτηση
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Συνολικοί Επισκέπτες
            </span>
            <div className="text-3xl font-black text-white mt-2">
              {stats.totalGuests}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              👥 Άτομα συνολικά
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Προσέλευση (Check-in)
            </span>
            <div className="text-3xl font-black text-emerald-400 mt-2">
              {stats.checkedInCount}{" "}
              <span className="text-sm text-slate-400 font-normal">
                ({stats.checkInRate}%)
              </span>
            </div>
            <span className="text-[11px] text-emerald-400/80 mt-1 block">
              ✓ Επιβεβαιωμένες αφίξεις
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Ενεργά Slots
            </span>
            <div className="text-3xl font-black text-amber-400 mt-2">
              {slots.length}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              🕒 Διαθέσιμες ώρες
            </span>
          </div>
        </section>

        {/* 2-Column Core Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Αριστερά: Διαχείριση Slots (3 στήλες) */}
          <div className="lg:col-span-3 space-y-6">
            <section className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>⚡</span> Διαχείριση Happy Hour Slots
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ρυθμίστε τις ώρες, τις εκπτώσεις και τα διαθέσιμα τραπέζια.
                  </p>
                </div>
                <span className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-300 font-mono">
                  {slots.length} ενεργά
                </span>
              </div>

              {/* Φόρμα Προσθήκης Slot */}
              <form
                onSubmit={handleCreateSlot}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
              >
                <div>
                  <label className="block text-[11px] text-slate-400 font-medium mb-1">
                    Χρονοθυρίδα
                  </label>
                  <input
                    type="text"
                    required
                    value={timeWindow}
                    onChange={(e) => setTimeWindow(e.target.value)}
                    placeholder="18:00 - 20:00"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-medium mb-1">
                    Έκπτωση
                  </label>
                  <input
                    type="text"
                    required
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="-30%"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-medium mb-1">
                    Αριθμός Τραπεζιών
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={totalTables}
                    onChange={(e) => setTotalTables(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCreatingSlot}
                  className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs transition disabled:opacity-50"
                >
                  {isCreatingSlot ? "Προσθήκη..." : "+ Άνοιγμα Slot"}
                </button>
              </form>

              {/* Λίστα Slots */}
              {slots.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 italic bg-slate-950/50 rounded-2xl border border-slate-800/50">
                  Δεν υπάρχουν ανοιχτές χρονοθυρίδες για το {selectedVenue?.name}.
                </div>
              ) : (
                <div className="space-y-3">
                  {slots.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-slate-700 transition"
                    >
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          {s.timeWindow}
                          <span className="text-xs text-amber-400 font-semibold">
                            ({s.discount})
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Διαθέσιμα: <strong className="text-white">{s.availableTables}</strong> / {s.totalTables} τραπέζια
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(s.id)}
                        className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition"
                      >
                        Διαγραφή
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Δεξιά: Ζωντανή Ροή Κρατήσεων & Αφίξεων (2 στήλες) */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <span>📋</span> Ροή Κρατήσεων
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ζωντανές αφίξεις για το {selectedVenue?.name}
                  </p>
                </div>
                <Link
                  href="/merchant/scan"
                  className="text-xs font-bold text-amber-400 hover:underline"
                >
                  Scanner →
                </Link>
              </div>

              {bookings.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500 italic">
                  Δεν υπάρχουν καταχωρημένες κρατήσεις ακόμα.
                </div>
              ) : (
                <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                  {bookings.map((b) => {
                    const isCheckedIn =
                      b.status === "used" || b.status === "checked_in";

                    return (
                      <div
                        key={b.id}
                        className={`p-4 rounded-2xl border transition space-y-2 text-xs ${
                          isCheckedIn
                            ? "bg-slate-950/60 border-slate-800/60 opacity-70"
                            : "bg-slate-950 border-slate-800 shadow-sm"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-amber-400 text-sm">
                            {b.ticketCode}
                          </span>
                          <span
                            className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                              isCheckedIn
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-amber-400/10 text-amber-300 border border-amber-400/20"
                            }`}
                          >
                            {isCheckedIn ? "✓ Checked-In" : "Αναμονή"}
                          </span>
                        </div>

                        <div className="text-slate-300 space-y-0.5">
                          <div>
                            Ώρα: <strong className="text-white">{b.timeWindow}</strong>
                          </div>
                          <div>
                            Άτομα: <strong className="text-white">{b.partySize}</strong> | Έκπτωση:{" "}
                            <strong className="text-amber-400">{b.discount}</strong>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Ημερομηνία: {b.date}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}