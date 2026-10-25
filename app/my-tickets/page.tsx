"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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

export default function MyTicketsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Παρακολούθηση Auth
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubAuth();
  }, []);

  // Ανάκτηση Εισιτηρίων (από User UID ή LocalStorage fallback)
  useEffect(() => {
    if (currentUser) {
      const q = query(
        collection(db, "bookings"),
        where("customerId", "==", currentUser.uid)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        const list: BookingRecord[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as Omit<BookingRecord, "id">) });
        });
        setTickets(list);
        setLoading(false);
      });

      return () => unsub();
    } else {
      const stored = typeof window !== "undefined" ? localStorage.getItem("happyseats_tickets") : null;
      const codes: string[] = stored ? JSON.parse(stored) : [];

      if (codes.length === 0) {
        // Χρήση microtask για αποφυγή σύγχρονου cascading render
        queueMicrotask(() => {
          setTickets([]);
          setLoading(false);
        });
        return;
      }

      const q = query(
        collection(db, "bookings"),
        where("ticketCode", "in", codes.slice(0, 10))
      );

      const unsub = onSnapshot(q, (snapshot) => {
        const list: BookingRecord[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as Omit<BookingRecord, "id">) });
        });
        setTickets(list);
        setLoading(false);
      });

      return () => unsub();
    }
  }, [currentUser]);

  const handleShare = async (ticket: BookingRecord) => {
    const shareText = `🍽️ Έκλεισα τραπέζι στο "${ticket.venueName}" μέσω HappySeats!\n📅 Ημερομηνία: ${ticket.date}\n⏰ Ώρα: ${ticket.timeWindow}\n👥 Άτομα: ${ticket.partySize}\n🎁 Έκπτωση: ${ticket.discount}\n🎟️ Κωδικός Κράτησης: ${ticket.ticketCode}\n\nΡαντεβού εκεί!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Κράτηση HappySeats - ${ticket.venueName}`,
          text: shareText,
        });
      } catch (err) {
        console.log("Share cancelled:", err);
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
      alert("Τα στοιχεία της κράτησης αντιγράφηκαν!");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <header className="max-w-4xl mx-auto flex items-center justify-between pb-6 border-b border-neutral-800">
        <div>
          <Link href="/" className="text-xs text-neutral-400 hover:text-white transition">
            ← Επιστροφή στην Αρχική
          </Link>
          <h1 className="text-2xl font-black text-white mt-1">🎟️ Τα Εισιτήριά μου</h1>
        </div>

        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-400">
                👤 {currentUser.displayName || currentUser.email}
              </span>
              <button
                onClick={() => signOut(auth)}
                className="text-xs px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl transition border border-neutral-800"
              >
                Αποσύνδεση
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-bold px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded-xl transition shadow"
            >
              Σύνδεση Πελάτη
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 space-y-6">
        {!currentUser && (
          <div className="p-4 bg-amber-400/10 border border-amber-400/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-amber-300">
              💡 <strong>Συμβουλή:</strong> Συνδεθείτε για να συγχρονίζονται αυτόματα τα εισιτήριά σας σε όλες τις συσκευές σας.
            </span>
            <Link
              href="/login"
              className="px-3 py-1.5 bg-amber-400 text-neutral-950 font-bold rounded-lg shrink-0 hover:bg-amber-300 transition"
            >
              Σύνδεση / Εγγραφή →
            </Link>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-neutral-500 text-sm">Φόρτωση εισιτηρίων...</div>
        ) : tickets.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 p-12 rounded-3xl text-center space-y-3">
            <span className="text-4xl">🎟️</span>
            <h3 className="text-lg font-bold text-white">Δεν έχετε ενεργά εισιτήρια</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Εξερευνήστε τις διαθέσιμες προσφορές στην αρχική σελίδα και κλείστε το τραπέζι σας με έκπτωση!
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-block px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs transition"
              >
                Αναζήτηση Προσφορών →
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tickets.map((t) => {
              const isUsed = t.status === "used" || t.status === "checked_in";

              return (
                <div
                  key={t.id}
                  className={`bg-neutral-900 border rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-4 ${
                    isUsed
                      ? "border-neutral-800/60 opacity-60"
                      : "border-neutral-700"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span
                        className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${
                          isUsed
                            ? "bg-neutral-800 text-neutral-400"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {isUsed ? "Εξαργυρωμένο" : "✓ Ενεργό"}
                      </span>
                      <h2 className="text-xl font-bold text-white mt-2">{t.venueName}</h2>
                      <p className="text-xs text-neutral-400">
                        📅 {t.date} | ⏰ {t.timeWindow}
                      </p>
                      <p className="text-xs text-neutral-300 mt-1">
                        👥 {t.partySize} άτομα | Έκπτωση:{" "}
                        <strong className="text-amber-400">{t.discount}</strong>
                      </p>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl shrink-0">
                      <QRCodeSVG
                        value={`HAPPYSEATS:${t.ticketCode}|${t.venueName}|${t.partySize}P`}
                        size={90}
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {t.ticketCode}
                    </span>

                    <button
                      onClick={() => handleShare(t)}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1"
                    >
                      <span>📲</span> Κοινοποίηση
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}