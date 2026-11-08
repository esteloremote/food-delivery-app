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

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubAuth();
  }, []);

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
    <div className="min-h-screen bg-surface text-text-main p-6">
      <header className="max-w-4xl mx-auto flex items-center justify-between pb-6 border-b border-border-theme">
        <div>
          <Link href="/" className="text-xs text-text-muted hover:text-text-main transition font-medium">
            ← Επιστροφή στην Αρχική
          </Link>
          <h1 className="text-2xl font-black text-text-main mt-1">🎟️ Τα Εισιτήριά μου</h1>
        </div>

        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-muted font-medium">
                👤 {currentUser.displayName || currentUser.email}
              </span>
              <button
                onClick={() => signOut(auth)}
                className="text-xs px-3 py-1.5 bg-card hover:bg-subtle text-text-muted hover:text-red-600 rounded-xl transition border border-border-theme shadow-sm cursor-pointer"
              >
                Αποσύνδεση
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-bold px-3.5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl transition shadow-sm"
            >
              Σύνδεση Πελάτη
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 space-y-6">
        {!currentUser && (
          <div className="p-4 bg-brand-light border border-brand-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-brand-text">
              💡 <strong>Συμβουλή:</strong> Συνδεθείτε για να συγχρονίζονται αυτόματα τα εισιτήριά σας σε όλες τις συσκευές σας.
            </span>
            <Link
              href="/login"
              className="px-3 py-1.5 bg-brand text-white font-bold rounded-lg shrink-0 hover:bg-brand-hover transition shadow-sm"
            >
              Σύνδεση / Εγγραφή →
            </Link>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-text-muted text-sm">Φόρτωση εισιτηρίων...</div>
        ) : tickets.length === 0 ? (
          <div className="bg-card border border-border-theme p-12 rounded-3xl text-center space-y-3 shadow-sm">
            <span className="text-4xl">🎟️</span>
            <h3 className="text-lg font-bold text-text-main">Δεν έχετε ενεργά εισιτήρια</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Εξερευνήστε τις διαθέσιμες προσφορές στην αρχική σελίδα και κλείστε το τραπέζι σας με έκπτωση!
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-block px-5 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-xs transition shadow-sm"
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
                  className={`bg-card border rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4 transition ${
                    isUsed
                      ? "border-border-theme opacity-60"
                      : "border-border-theme hover:border-brand shadow-sm"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span
                        className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${
                          isUsed
                            ? "bg-subtle text-text-muted"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {isUsed ? "Εξαργυρωμένο" : "✓ Ενεργό"}
                      </span>
                      <h2 className="text-xl font-bold text-text-main mt-2">{t.venueName}</h2>
                      <p className="text-xs text-text-muted">
                        📅 {t.date} | ⏰ {t.timeWindow}
                      </p>
                      <p className="text-xs text-text-main mt-1">
                        👥 {t.partySize} άτομα | Έκπτωση:{" "}
                        <strong className="text-brand-text font-bold">{t.discount}</strong>
                      </p>
                    </div>

                    <div className="bg-subtle border border-border-theme p-2.5 rounded-xl shrink-0">
                      <QRCodeSVG
                        value={`HAPPYSEATS:${t.ticketCode}|${t.venueName}|${t.partySize}P`}
                        size={90}
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border-theme flex items-center justify-between">
                    <span className="font-mono font-bold text-brand-text text-sm">
                      {t.ticketCode}
                    </span>

                    <button
                      onClick={() => handleShare(t)}
                      className="px-3 py-1.5 bg-subtle hover:bg-border-theme text-text-main rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer border border-border-theme"
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