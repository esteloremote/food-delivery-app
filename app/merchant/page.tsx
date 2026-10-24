"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface Slot {
  id: string;
  timeWindow: string;
  discount: string;
  availableTables: number;
  totalTables: number;
}

interface BookingItem {
  id: string;
  ticketCode: string;
  timeWindow: string;
  discount: string;
  partySize: number;
  date: string;
  status: string;
}

interface VenueProfile {
  name: string;
  category: string;
  area: string;
}

export default function MerchantPortal() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [venueProfile, setVenueProfile] = useState<VenueProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Φόρμα νέου slot
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [discount, setDiscount] = useState("-30%");
  const [tablesCount, setTablesCount] = useState(5);

  const [activeSlots, setActiveSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [isSavingSlot, setIsSavingSlot] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "checked_in" | "cancelled">("all");

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/merchant/login");
        return;
      }

      if (!isMounted) return;
      setCurrentUser(user);

      try {
        const venueDoc = await getDoc(doc(db, "venues", user.uid));
        if (venueDoc.exists()) {
          setVenueProfile(venueDoc.data() as VenueProfile);
        } else {
          setVenueProfile({
            name: user.displayName || "Το Κατάστημά μου",
            category: "Εστίαση",
            area: "Αθήνα",
          });
        }

        // Φόρτωση κρατήσεων
        const qBookings = query(
          collection(db, "bookings"),
          where("venueId", "==", user.uid)
        );
        const snapshotBookings = await getDocs(qBookings);
        const bList: BookingItem[] = [];
        snapshotBookings.forEach((d) => {
          bList.push({ id: d.id, ...(d.data() as Omit<BookingItem, "id">) });
        });

        // Φόρτωση slots
        const qSlots = query(
          collection(db, "slots"),
          where("venueId", "==", user.uid)
        );
        const snapshotSlots = await getDocs(qSlots);
        const sList: Slot[] = [];
        snapshotSlots.forEach((d) => {
          sList.push({ id: d.id, ...(d.data() as Omit<Slot, "id">) });
        });

        if (isMounted) {
          setBookings(bList);
          setActiveSlots(sList);
        }
      } catch (e) {
        console.error("Σφάλμα ανάκτησης δεδομένων:", e);
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [router]);

  // Υπολογισμός Στατιστικών (KPIs)
  const stats = useMemo(() => {
    const totalBookings = bookings.length;
    const checkedInBookings = bookings.filter((b) => b.status === "checked_in").length;
    const cancelledBookings = bookings.filter((b) => b.status === "cancelled").length;
    const activeBookings = bookings.filter((b) => b.status === "confirmed").length;

    const totalGuests = bookings
      .filter((b) => b.status !== "cancelled")
      .reduce((acc, curr) => acc + (curr.partySize || 0), 0);

    const completionRate =
      totalBookings - cancelledBookings > 0
        ? Math.round((checkedInBookings / (totalBookings - cancelledBookings)) * 100)
        : 0;

    return {
      totalBookings,
      checkedInBookings,
      cancelledBookings,
      activeBookings,
      totalGuests,
      completionRate,
    };
  }, [bookings]);

  // Φιλτραρισμένες κρατήσεις
  const filteredBookings = useMemo(() => {
    if (statusFilter === "all") return bookings;
    return bookings.filter((b) => b.status === statusFilter);
  }, [bookings, statusFilter]);

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !venueProfile) return;
    setIsSavingSlot(true);

    const timeWindow = `${startTime} - ${endTime}`;
    const newSlot = {
      venueId: currentUser.uid,
      venueName: venueProfile.name,
      timeWindow,
      discount,
      availableTables: Number(tablesCount),
      totalTables: Number(tablesCount),
      createdAt: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(db, "slots"), newSlot);
      setActiveSlots((prev) => [
        ...prev,
        { id: docRef.id, ...newSlot },
      ]);
      alert("Το Happy Hour slot δημοσιεύτηκε επιτυχώς!");
    } catch (error) {
      console.error("Σφάλμα προσθήκης slot:", error);
      alert("Αποτυχία προσθήκης slot.");
    } finally {
      setIsSavingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    const confirmDelete = window.confirm("Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το slot;");
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "slots", slotId));
      setActiveSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (err) {
      console.error("Σφάλμα διαγραφής slot:", err);
      alert("Αποτυχία διαγραφής slot.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/merchant/login");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm">
        Έλεγχος πρόσβασης & φόρτωση αναλυτικών...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-8 border-b border-slate-800">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            Merchant Dashboard
          </span>
          <h1 className="text-3xl font-black text-white">{venueProfile?.name}</h1>
          <p className="text-xs text-slate-400">
            {venueProfile?.category} • {venueProfile?.area} | {currentUser?.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/merchant/scan"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold transition flex items-center gap-1 text-white shadow-lg shadow-emerald-950"
          >
            📷 Check-In Scanner
          </Link>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold transition text-slate-200"
          >
            Αρχική
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold transition"
          >
            Αποσύνδεση
          </button>
        </div>
      </header>

      {/* Κάρτες Στατιστικών (KPIs) */}
      <section className="max-w-6xl mx-auto py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Συνολικες Κρατησεις</span>
            <div className="text-2xl font-black text-white mt-1">{stats.totalBookings}</div>
            <span className="text-[11px] text-amber-400 font-medium">{stats.activeBookings} ενεργές</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Check-Ins</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{stats.checkedInBookings}</div>
            <span className="text-[11px] text-slate-400">{stats.completionRate}% προσέλευση</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Συνολο Πελατων</span>
            <div className="text-2xl font-black text-white mt-1">{stats.totalGuests}</div>
            <span className="text-[11px] text-slate-400">άτομα που εξυπηρετήθηκαν</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Ακυρωσεις</span>
            <div className="text-2xl font-black text-red-400 mt-1">{stats.cancelledBookings}</div>
            <span className="text-[11px] text-slate-400">απελευθερωμένα τραπέζια</span>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Στήλη 1: Ορισμός & Διαχείριση Slots */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">Ορισμός Happy Hour / Slot</h2>
            <p className="text-xs text-slate-400 mt-1">
              Άνοιξε τραπέζια με ειδική έκπτωση για τις ώρες χαμηλής κίνησης.
            </p>
          </div>

          <form onSubmit={handleAddSlot} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Έναρξη:</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Λήξη:</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Έκπτωση / Προσφορά:</label>
              <select
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                <option value="-20%">-20% στο λογαριασμό</option>
                <option value="-30%">-30% στο λογαριασμό</option>
                <option value="-40%">-40% στο λογαριασμό</option>
                <option value="Happy Hour (-50%)">Happy Hour (-50%)</option>
                <option value="Early Bird (-25%)">Early Bird (-25%)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Διαθέσιμα Τραπέζια:</label>
              <input
                type="number"
                min="1"
                max="50"
                value={tablesCount}
                onChange={(e) => setTablesCount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSavingSlot}
              className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-sm transition disabled:opacity-50"
            >
              {isSavingSlot ? "Αποθήκευση..." : "+ Δημοσίευση Slot"}
            </button>
          </form>

          {/* Λίστα Slots με δυνατότητα Διαγραφής */}
          {activeSlots.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Ενεργά Slots Καταστήματος ({activeSlots.length})
              </span>
              {activeSlots.map((s) => (
                <div
                  key={s.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center text-xs group"
                >
                  <div>
                    <div className="font-bold text-white">{s.timeWindow}</div>
                    <div className="text-amber-400">{s.discount}</div>
                    <div className="text-slate-400 text-[11px]">
                      {s.availableTables} / {s.totalTables} τραπέζια
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteSlot(s.id)}
                    title="Διαγραφή slot"
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Στήλη 2 & 3: Κρατήσεις & Φίλτρα */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">Κρατήσεις Πελατών</h2>
              <p className="text-xs text-slate-400">Παρακολούθηση σε πραγματικό χρόνο</p>
            </div>

            {/* Φίλτρα Κατάστασης */}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg transition font-medium ${
                  statusFilter === "all" ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Όλες ({bookings.length})
              </button>
              <button
                onClick={() => setStatusFilter("confirmed")}
                className={`px-3 py-1.5 rounded-lg transition font-medium ${
                  statusFilter === "confirmed" ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Αναμονή ({stats.activeBookings})
              </button>
              <button
                onClick={() => setStatusFilter("checked_in")}
                className={`px-3 py-1.5 rounded-lg transition font-medium ${
                  statusFilter === "checked_in" ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Checked-In ({stats.checkedInBookings})
              </button>
              <button
                onClick={() => setStatusFilter("cancelled")}
                className={`px-3 py-1.5 rounded-lg transition font-medium ${
                  statusFilter === "cancelled" ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Ακυρώσεις ({stats.cancelledBookings})
              </button>
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500">
              Δεν υπάρχουν κρατήσεις για τη συγκεκριμένη κατηγορία.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBookings.map((b) => {
                const isChecked = b.status === "checked_in";
                const isCancelled = b.status === "cancelled";

                return (
                  <div
                    key={b.id}
                    className={`bg-slate-900 border p-5 rounded-2xl flex flex-col justify-between space-y-3 transition ${
                      isCancelled
                        ? "border-red-900/30 opacity-60"
                        : isChecked
                        ? "border-emerald-500/30"
                        : "border-slate-800"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-mono font-bold px-2.5 py-1 bg-amber-400/20 text-amber-300 rounded-lg">
                          {b.ticketCode}
                        </span>
                        <div className="font-bold text-white text-base mt-2">
                          {b.partySize} Άτομα
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                          isChecked
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : isCancelled
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {isChecked ? "✓ Checked-In" : isCancelled ? "✕ Ακυρώθηκε" : "Αναμονή"}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 border-t border-slate-800 pt-3 flex justify-between">
                      <div>
                        <span>Ώρα: </span>
                        <strong className="text-slate-200">{b.timeWindow}</strong>
                      </div>
                      <div>
                        <span>Έκπτωση: </span>
                        <strong className="text-amber-400">{b.discount}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}