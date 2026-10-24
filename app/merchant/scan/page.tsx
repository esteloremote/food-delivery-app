"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ScannedTicket {
  id: string;
  ticketCode: string;
  venueName: string;
  partySize: number;
  timeWindow: string;
  discount: string;
  status: string;
}

export default function TicketScannerPage() {
  const [ticketData, setTicketData] = useState<ScannedTicket | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const scannerRef = useRef<any>(null);

  // Επικύρωση κράτησης στο Firestore
  const verifyAndCheckIn = async (codeToVerify: string) => {
    setIsProcessing(true);
    setScanError(null);

    try {
      let cleanCode = codeToVerify.trim();
      if (cleanCode.includes("HAPPYSEATS:")) {
        const parts = cleanCode.replace("HAPPYSEATS:", "").split("|");
        cleanCode = parts[0];
      }

      const q = query(
        collection(db, "bookings"),
        where("ticketCode", "==", cleanCode)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setScanError(`Δεν βρέθηκε κράτηση με κωδικό: ${cleanCode}`);
        setTicketData(null);
        return;
      }

      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data() as Omit<ScannedTicket, "id">;

      await updateDoc(doc(db, "bookings", docSnap.id), {
        status: "checked_in",
      });

      setTicketData({
        id: docSnap.id,
        ...data,
        status: "checked_in",
      });
    } catch (err) {
      console.error("Σφάλμα επικύρωσης:", err);
      setScanError("Παρουσιάστηκε σφάλμα κατά την επικύρωση.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Αρχικοποίηση κάμερας με προτίμηση στην πίσω κάμερα (environment)
  useEffect(() => {
    let html5QrcodeScanner: any = null;

    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          videoConstraints: {
            // Επιλογή της πίσω κάμερας αντί για τη selfie
            facingMode: { ideal: "environment" },
          },
        },
        false
      );

      html5QrcodeScanner.render(
        (decodedText: string) => {
          verifyAndCheckIn(decodedText);
        },
        () => {
          // Αγνοούμε τα προσωρινά frame errors
        }
      );

      scannerRef.current = html5QrcodeScanner;
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center">
      <header className="w-full max-w-md flex justify-between items-center mb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            Check-In Desk
          </span>
          <h1 className="text-2xl font-black">Έλεγχος e-Ticket</h1>
        </div>
        <Link
          href="/merchant"
          className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition"
        >
          ← Merchant Portal
        </Link>
      </header>

      <main className="w-full max-w-md space-y-6">
        {/* Κάμερα QR Scanner */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl overflow-hidden shadow-xl">
          <div id="qr-reader" className="text-slate-900 overflow-hidden rounded-2xl" />
        </div>

        {/* Χειροκίνητη εισαγωγή */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex gap-2">
          <input
            type="text"
            placeholder="ή γράψε τον κωδικό (π.χ. KOU-1234)"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
          />
          <button
            onClick={() => verifyAndCheckIn(manualCode)}
            disabled={isProcessing || !manualCode}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs transition disabled:opacity-50"
          >
            Έλεγχος
          </button>
        </div>

        {/* Μηνύματα σφάλματος */}
        {scanError && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm text-center font-semibold">
            ✕ {scanError}
          </div>
        )}

        {/* Επιτυχές Check-In */}
        {ticketData && (
          <div className="p-6 bg-slate-900 border-2 border-emerald-400 rounded-3xl shadow-2xl space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-xs uppercase tracking-wider font-bold bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full">
                ✓ Έγκυρο Ticket (Checked-In)
              </span>
              <span className="font-mono font-bold text-amber-400 text-sm">
                {ticketData.ticketCode}
              </span>
            </div>

            <div className="pt-2">
              <h2 className="text-xl font-black text-white">{ticketData.venueName}</h2>
              <p className="text-slate-300 text-sm mt-1">
                Τραπέζι για: <strong className="text-white">{ticketData.partySize} άτομα</strong>
              </p>
              <p className="text-slate-300 text-sm">
                Χρονοθυρίδα: <strong className="text-white">{ticketData.timeWindow}</strong>
              </p>
              <p className="text-slate-300 text-sm">
                Έκπτωση: <strong className="text-amber-400">{ticketData.discount}</strong>
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}