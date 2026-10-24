"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface StoredTicket {
  id: string;
  ticketCode: string;
  venueName: string;
  slotId: string;
  timeWindow: string;
  discount: string;
  partySize: number;
  date: string;
  status: string;
}

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<StoredTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingCode, setCancellingCode] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTickets = async () => {
      try {
        const stored = localStorage.getItem("happyseats_tickets");
        if (!stored) {
          if (isMounted) setLoading(false);
          return;
        }

        const codes: string[] = JSON.parse(stored);
        if (codes.length === 0) {
          if (isMounted) setLoading(false);
          return;
        }

        const loadedTickets: StoredTicket[] = [];

        for (const code of codes) {
          const q = query(
            collection(db, "bookings"),
            where("ticketCode", "==", code)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const docSnap = snap.docs[0];
            loadedTickets.push({
              id: docSnap.id,
              ...(docSnap.data() as Omit<StoredTicket, "id">),
            });
          }
        }

        if (isMounted) {
          setTickets(loadedTickets);
          setLoading(false);
        }
      } catch (err) {
        console.error("Σφάλμα φόρτωσης εισιτηρίων:", err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTickets();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleShareTicket = async (ticket: StoredTicket) => {
    const shareText = `🍽️ Έκλεισα τραπέζι στο "${ticket.venueName}" μέσω HappySeats!\n📅 Ημερομηνία: ${ticket.date}\n⏰ Ώρα: ${ticket.timeWindow}\n👥 Άτομα: ${ticket.partySize}\n🎁 Έκπτωση: ${ticket.discount}\n🎟️ Κωδικός Κράτησης: ${ticket.ticketCode}\n\nΡαντεβού εκεί!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Κράτηση HappySeats - ${ticket.venueName}`,
          text: shareText,
        });
      } catch (err) {
        // Ο χρήστης μπορεί απλώς να έκλεισε το share sheet
        console.log("Share cancelled or failed:", err);
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
      alert("Τα στοιχεία της κράτησης αντιγράφηκαν! Μπορείτε να τα στείλετε στην παρέα σας.");
    }
  };

  const handleCancelBooking = async (ticket: StoredTicket) => {
    const confirmCancel = window.confirm(
      `Είστε σίγουροι ότι θέλετε να ακυρώσετε την κράτηση στο ${ticket.venueName};`
    );
    if (!confirmCancel) return;

    setCancellingCode(ticket.ticketCode);

    try {
      const bookingRef = doc(db, "bookings", ticket.id);
      const slotRef = doc(db, "slots", ticket.slotId);

      await runTransaction(db, async (transaction) => {
        const slotSnap = await transaction.get(slotRef);

        if (slotSnap.exists()) {
          const currentTables = slotSnap.data().availableTables ?? 0;
          const totalTables = slotSnap.data().totalTables ?? currentTables + 1;

          transaction.update(slotRef, {
            availableTables: Math.min(currentTables + 1, totalTables),
          });
        }

        transaction.update(bookingRef, {
          status: "cancelled",
        });
      });

      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticket.id ? { ...t, status: "cancelled" } : t
        )
      );

      alert("Η κράτηση ακυρώθηκε επιτυχώς και το τραπέζι απελευθερώθηκε.");
    } catch (error) {
      console.error("Σφάλμα κατά την ακύρωση:", error);
      alert("Παρουσιάστηκε σφάλμα κατά την ακύρωση της κράτησης.");
    } finally {
      setCancellingCode(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 flex flex-col items-center">
      <header className="w-full max-w-lg flex justify-between items-center pb-6 border-b border-neutral-800 mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            HappySeats Pass
          </span>
          <h1 className="text-2xl font-black text-white">Τα Εισιτήριά μου</h1>
        </div>
        <Link
          href="/"
          className="text-xs bg-neutral-800 hover:bg-neutral-700 px-3.5 py-2 rounded-xl transition text-neutral-300"
        >
          ← Αρχική
        </Link>
      </header>

      <main className="w-full max-w-lg space-y-6">
        {loading ? (
          <div className="text-center py-20 text-neutral-500 text-sm">
            Φόρτωση εισιτηρίων...
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-3xl text-center space-y-3">
            <span className="text-3xl">🎟️</span>
            <h3 className="font-bold text-white text-base">Δεν βρέθηκαν εισιτήρια</h3>
            <p className="text-xs text-neutral-400">
              Δεν έχετε κάνει κάποια κράτηση ακόμα από αυτή τη συσκευή.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-block px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs rounded-xl transition"
              >
                Εξερεύνηση Προσφορών
              </Link>
            </div>
          </div>
        ) : (
          tickets.map((t) => {
            const isCancelled = t.status === "cancelled";
            const isCheckedIn = t.status === "checked_in";
            const isActive = !isCancelled && !isCheckedIn;

            return (
              <div
                key={t.ticketCode}
                className={`p-6 bg-neutral-900 border rounded-3xl space-y-4 shadow-xl transition ${
                  isCancelled
                    ? "border-red-900/30 opacity-50"
                    : isCheckedIn
                    ? "border-neutral-800 opacity-60"
                    : "border-amber-400/50"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                        isCancelled
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : isCheckedIn
                          ? "bg-neutral-800 text-neutral-400"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}
                    >
                      {isCancelled
                        ? "✕ Ακυρώθηκε"
                        : isCheckedIn
                        ? "✓ Χρησιμοποιήθηκε"
                        : "Ενεργό e-Ticket"}
                    </span>
                    <h2 className="text-xl font-bold text-white mt-2">{t.venueName}</h2>
                  </div>
                  <span className="text-sm font-mono font-bold text-amber-400">
                    {t.ticketCode}
                  </span>
                </div>

                {isActive ? (
                  <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center my-2">
                    <QRCodeSVG
                      value={`HAPPYSEATS:${t.ticketCode}|${t.venueName}|${t.partySize}P`}
                      size={150}
                    />
                    <span className="text-black font-mono font-bold text-xs mt-2">
                      {t.ticketCode}
                    </span>
                  </div>
                ) : (
                  <div className="p-4 bg-neutral-950 rounded-2xl text-center text-xs text-neutral-500 my-2">
                    {isCancelled
                      ? "Το εισιτήριο έχει ακυρωθεί και δεν μπορεί να εξαργυρωθεί."
                      : "Το εισιτήριο έχει ήδη εξαργυρωθεί στην είσοδο του καταστήματος."}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs text-neutral-400 border-t border-neutral-800 pt-3">
                  <div>
                    <span>Ώρα: </span>
                    <strong className="text-white block">{t.timeWindow}</strong>
                  </div>
                  <div>
                    <span>Ημερομηνία: </span>
                    <strong className="text-white block">{t.date}</strong>
                  </div>
                  <div>
                    <span>Άτομα: </span>
                    <strong className="text-white block">{t.partySize} άτομα</strong>
                  </div>
                  <div>
                    <span>Έκπτωση: </span>
                    <strong className="text-amber-400 block">{t.discount}</strong>
                  </div>
                </div>

                {/* Ενέργειες για ενεργά εισιτήρια */}
                {isActive && (
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => handleShareTicket(t)}
                      className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition border border-neutral-700 flex items-center justify-center gap-1.5"
                    >
                      <span>📲</span> Κοινοποίηση στην παρέα
                    </button>
                    <button
                      onClick={() => handleCancelBooking(t)}
                      disabled={cancellingCode === t.ticketCode}
                      className="py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                    >
                      {cancellingCode === t.ticketCode ? "..." : "Ακύρωση"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}