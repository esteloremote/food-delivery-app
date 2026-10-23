"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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

export default function MerchantPortal() {
  const [venueName, setVenueName] = useState("Εστιατόριο ΚΟΥΚΟΥΤΣΗΣ");
  const [category, setCategory] = useState("Παραδοσιακή Κουζίνα");
  const [area, setArea] = useState("Κέντρο");

  // Πεδία νέου Slot
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [discount, setDiscount] = useState("-30%");
  const [tablesCount, setTablesCount] = useState(5);

  const [activeSlots, setActiveSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [isSavingSlot, setIsSavingSlot] = useState(false);

  // Ανάκτηση κρατήσεων του καταστήματος από το Firestore
  const fetchMerchantData = async () => {
    try {
      const q = query(
        collection(db, "bookings"),
        where("venueName", "==", venueName)
      );
      const snapshot = await getDocs(q);
      const list: BookingItem[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...(doc.data() as Omit<BookingItem, "id">) });
      });
      setBookings(list);
    } catch (err) {
      console.error("Σφάλμα ανάκτησης κρατήσεων:", err);
    }
  };

  useEffect(() => {
    fetchMerchantData();
  }, [venueName]);

  // Προσθήκη νέου Slot
  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSlot(true);

    const timeWindow = `${startTime} - ${endTime}`;
    const newSlot = {
      timeWindow,
      discount,
      availableTables: Number(tablesCount),
      totalTables: Number(tablesCount),
      createdAt: serverTimestamp(),
    };

    try {
      // Αποθήκευση στη συλλογή venue_slots
      const docRef = await addDoc(collection(db, "slots"), {
        ...newSlot,
        venueName,
      });

      setActiveSlots((prev) => [
        ...prev,
        { id: docRef.id, ...newSlot },
      ]);

      alert("Το Happy Hour slot προστέθηκε επιτυχώς!");
    } catch (error) {
      console.error("Σφάλμα προσθήκης slot:", error);
      alert("Αποτυχία προσθήκης slot.");
    } finally {
      setIsSavingSlot(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      {/* Top Bar */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-8 border-b border-slate-800">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            Merchant Portal
          </span>
          <h1 className="text-3xl font-black">{venueName}</h1>
          <p className="text-xs text-slate-400">
            {category} • {area}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold transition"
          >
            ← Επιστροφή στην Αρχική
          </Link>
          <button
            onClick={fetchMerchantData}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition"
          >
            Ανανέωση Κρατήσεων
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Στήλη 1: Φόρμα Προσθήκης Slot */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">Ορισμός Happy Hour / Slot</h2>
            <p className="text-xs text-slate-400 mt-1">
              Άνοιξε τραπέζια με ειδική έκπτωση για συγκεκριμένες ώρες σήμερα.
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

          {/* Προεπισκόπηση ενεργών slots που προστέθηκαν */}
          {activeSlots.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Πρόσφατα Δημοσιευμένα
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
                  <span className="bg-slate-800 px-2 py-1 rounded text-slate-300">
                    {s.availableTables} τραπέζια
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Στήλη 2 & 3: Λίστα Κρατήσεων & e-Tickets σε πραγματικό χρόνο */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Κρατήσεις Πελατών</h2>
            <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-semibold">
              Σύνολο: {bookings.length}
            </span>
          </div>

          {bookings.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500">
              Δεν υπάρχουν ακόμη κρατήσεις για αυτό το κατάστημα.
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
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-2 py-0.5 rounded">
                      {b.status || "confirmed"}
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