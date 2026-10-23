"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
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

  // Πεδία φόρμας slot
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [discount, setDiscount] = useState("-30%");
  const [tablesCount, setTablesCount] = useState(5);

  const [activeSlots, setActiveSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [isSavingSlot, setIsSavingSlot] = useState(false);

  // 1. Προστασία διαδρομής & ανάκτηση προφίλ
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/merchant/login");
        return;
      }
      setCurrentUser(user);

      // Φόρτωση στοιχείων καταστήματος από το doc `venues/{uid}`
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
      } catch (e) {
        console.error("Σφάλμα φόρτωσης προφίλ:", e);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // 2. Ανάκτηση κρατήσεων και slots του συνδεδεμένου καταστήματος
  const fetchMerchantData = async (userUid: string) => {
    try {
      // Κρατήσεις για το συγκεκριμένο κατάστημα
      const qBookings = query(
        collection(db, "bookings"),
        where("venueId", "==", userUid)
      );
      const snapshotBookings = await getDocs(qBookings);
      const bList: BookingItem[] = [];
      snapshotBookings.forEach((d) => {
        bList.push({ id: d.id, ...(d.data() as Omit<BookingItem, "id">) });
      });
      setBookings(bList);

      // Ενεργά slots του καταστήματος
      const qSlots = query(
        collection(db, "slots"),
        where("venueId", "==", userUid)
      );
      const snapshotSlots = await getDocs(qSlots);
      const sList: Slot[] = [];
      snapshotSlots.forEach((d) => {
        sList.push({ id: d.id, ...(d.data() as Omit<Slot, "id">) });
      });
      setActiveSlots(sList);
    } catch (err) {
      console.error("Σφάλμα ανάκτησης δεδομένων:", err);
    }
  };

  useEffect(() => {
    if (currentUser?.uid) {
      fetchMerchantData(currentUser.uid);
    }
  }, [currentUser]);

  // 3. Προσθήκη slot συνδεδεμένου με το UID του καταστήματος
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

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/merchant/login");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm">
        Έλεγχος πρόσβασης...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      {/* Top Header */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-8 border-b border-slate-800">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            Merchant Portal
          </span>
          <h1 className="text-3xl font-black text-white">{venueProfile?.name}</h1>
          <p className="text-xs text-slate-400">
            {venueProfile?.category} • {venueProfile?.area} | Συνδεδεμένος ως: {currentUser?.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/merchant/scan"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold transition flex items-center gap-1"
          >
            📷 Check-In Scanner
          </Link>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold transition"
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

      <main className="max-w-6xl mx-auto py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Στήλη 1: Φόρμα Προσθήκης Slot */}
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

          {/* Λίστα δημοσιευμένων slots */}
          {activeSlots.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Ενεργά Slots Καταστήματος
              </span>
              {activeSlots.map((s) => (
                <div
                  key={s.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center text-xs"
                >
                  <div>
                    <div className="font-bold text-white">{s.timeWindow}</div>
                    <div className="text-amber-400">{s.discount}</div>
                  </div>
                  <span className="bg-slate-800 px-2.5 py-1 rounded-lg text-slate-300 font-medium">
                    {s.availableTables} τραπέζια
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Στήλη 2 & 3: Λίστα Κρατήσεων Πελατών */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Κρατήσεις Πελατών</h2>
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-semibold">
              Σύνολο: {bookings.length}
            </span>
          </div>

          {bookings.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500">
              Δεν υπάρχουν ακόμη κρατήσεις για το κατάστημά σας.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-3"
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
                        b.status === "checked_in"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {b.status === "checked_in" ? "✓ Checked-In" : "Αναμονή"}
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
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}