"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

interface ScannerInstance {
  render: (
    onSuccess: (decodedText: string) => void,
    onError: () => void
  ) => void;
  clear: () => Promise<void>;
  getState: () => number;
}

export default function TicketScannerPage() {
  const [ticketData, setTicketData] = useState<ScannedTicket | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const scannerRef = useRef<ScannerInstance | null>(null);

  // Ήχος Beep επιτυχίας
  const playSuccessSound = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.log("Audio not supported or blocked:", e);
    }
  };

  // Δόνηση κινητού
  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(150);
    }
  };

  const verifyAndCheckIn = useCallback(async (codeToVerify: string) => {
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

      playSuccessSound();
      triggerHaptic();

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
  }, []);

  // Ref για ασφαλή κλήση μέσα στο scanner callback χωρίς re-trigger του effect
  const verifyRef = useRef(verifyAndCheckIn);
  useEffect(() => {
    verifyRef.current = verifyAndCheckIn;
  }, [verifyAndCheckIn]);

  useEffect(() => {
    let isMounted = true;

    const container = document.getElementById("qr-reader");
    if (container) {
      container.innerHTML = "";
    }

    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      if (!isMounted) return;

      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          videoConstraints: {
            facingMode: { ideal: "environment" },
          },
        },
        false
      );

      scanner.render(
        (decodedText: string) => {
          verifyRef.current(decodedText);
        },
        () => {
          // Ignored frame errors
        }
      );

      scannerRef.current = scanner;
    });

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        try {
          scannerRef.current.clear().catch((e) => console.log("Scanner cleanup:", e));
        } catch (e) {
          console.log("Scanner clear error:", e);
        }
        scannerRef.current = null;
      }
      const el = document.getElementById("qr-reader");
      if (el) {
        el.innerHTML = "";
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center">
      <style jsx global>{`
        #qr-reader {
          border: none !important;
          color: #f1f5f9 !important;
        }
        #qr-reader__scan_region {
          background: #0f172a !important;
          border-radius: 1rem;
        }
        #qr-reader__dashboard_section_csr span,
        #qr-reader__dashboard_section_swaplink,
        #qr-reader__header_message {
          color: #cbd5e1 !important;
          font-size: 0.85rem !important;
        }
        #qr-reader button {
          background-color: #f59e0b !important;
          color: #020617 !important;
          font-weight: 700 !important;
          border-radius: 0.75rem !important;
          padding: 0.5rem 1rem !important;
          border: none !important;
          cursor: pointer !important;
          margin: 0.5rem 0.25rem !important;
          transition: background-color 0.2s ease !important;
        }
        #qr-reader button:hover {
          background-color: #fbbf24 !important;
        }
        #qr-reader a {
          color: #f59e0b !important;
          text-decoration: underline !important;
        }
        #qr-reader select {
          background-color: #020617 !important;
          color: #f8fafc !important;
          border: 1px solid #334155 !important;
          padding: 0.4rem 0.75rem !important;
          border-radius: 0.5rem !important;
          margin-bottom: 0.5rem !important;
        }
        #qr-reader img {
          filter: invert(1) !important;
        }
      `}</style>

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
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl overflow-hidden shadow-xl">
          <div id="qr-reader" className="w-full overflow-hidden rounded-2xl" />
        </div>

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

        {scanError && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm text-center font-semibold">
            ✕ {scanError}
          </div>
        )}

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