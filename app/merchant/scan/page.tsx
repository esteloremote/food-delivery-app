"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Scanner } from "@yudiel/react-qr-scanner";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function MerchantScanPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorizedMerchant, setIsAuthorizedMerchant] = useState(false);
  const [ownedVenueNames, setOwnedVenueNames] = useState<string[]>([]);

  const [ticketInput, setTicketInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    ticketCode?: string;
    venueName?: string;
    partySize?: number;
    discount?: string;
    timeWindow?: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"camera" | "manual">("camera");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAuthorizedMerchant(false);
        setAuthLoading(false);
        router.push("/merchant/login");
        return;
      }

      try {
        const mSnap = await getDoc(doc(db, "merchants", user.uid));
        const qEmail = query(
          collection(db, "merchants"),
          where("email", "==", user.email?.toLowerCase() || "")
        );
        const emailSnap = await getDocs(qEmail);

        if (!mSnap.exists() && emailSnap.empty) {
          setIsAuthorizedMerchant(false);
          setAuthLoading(false);
          return;
        }

        setCurrentUser(user);
        setIsAuthorizedMerchant(true);

        // Φόρτωση των ονομάτων καταστημάτων που ανήκουν στον συγκεκριμένο εστιάτορα
        const qVenues = query(
          collection(db, "venues"),
          where("ownerEmail", "==", user.email?.toLowerCase() || "")
        );
        const vSnap = await getDocs(qVenues);
        const names: string[] = [];
        vSnap.forEach((d) => {
          if (d.data().name) names.push(d.data().name);
        });
        setOwnedVenueNames(names);
      } catch (err) {
        console.error(err);
        setIsAuthorizedMerchant(false);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const verifyTicket = async (rawCode: string) => {
    let cleanCode = rawCode.trim();
    if (cleanCode.startsWith("HAPPYSEATS:")) {
      cleanCode = cleanCode.replace("HAPPYSEATS:", "").split("|")[0];
    }

    if (!cleanCode) return;
    setLoading(true);
    setScanResult(null);

    try {
      const q = query(
        collection(db, "bookings"),
        where("ticketCode", "==", cleanCode)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setScanResult({
          success: false,
          message: `Δεν βρέθηκε εισιτήριο με τον κωδικό: ${cleanCode}`,
        });
        return;
      }

      const bookingDoc = snapshot.docs[0];
      const data = bookingDoc.data();

      // Έλεγχος ότι το εισιτήριο ανήκει σε κατάστημα του συνδεδεμένου εστιάτορα
      if (
        ownedVenueNames.length > 0 &&
        !ownedVenueNames.includes(data.venueName)
      ) {
        setScanResult({
          success: false,
          message: `Αυτό το εισιτήριο ανήκει σε άλλο κατάστημα (${data.venueName})!`,
        });
        return;
      }

      if (data.status === "used" || data.status === "checked_in") {
        setScanResult({
          success: false,
          message: `Το εισιτήριο ${cleanCode} έχει ΗΔΗ εξαργυρωθεί!`,
          ticketCode: cleanCode,
          venueName: data.venueName,
          partySize: data.partySize,
        });
        return;
      }

      await updateDoc(doc(db, "bookings", bookingDoc.id), {
        status: "checked_in",
        checkedInAt: serverTimestamp(),
        checkedInBy: currentUser?.email || "",
      });

      setScanResult({
        success: true,
        message: `Επιτυχές Check-in! Τραπέζι για ${data.partySize} άτομα (${data.discount}).`,
        ticketCode: cleanCode,
        venueName: data.venueName,
        partySize: data.partySize,
        discount: data.discount,
        timeWindow: data.timeWindow,
      });

      setTicketInput("");
    } catch (err) {
      console.error(err);
      setScanResult({
        success: false,
        message: "Σφάλμα επικοινωνίας με τη βάση δεδομένων.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface text-text-muted flex items-center justify-center text-sm">
        Έλεγχος πρόσβασης Scanner...
      </div>
    );
  }

  if (!isAuthorizedMerchant) {
    return (
      <div className="min-h-screen bg-surface text-text-main flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center text-2xl font-bold">
          🚫
        </div>
        <h1 className="text-xl font-black">Μη Εξουσιοδοτημένη Πρόσβαση</h1>
        <p className="text-xs text-text-muted text-center max-w-sm">
          Ο QR Scanner προορίζεται αποκλειστικά για εξουσιοδοτημένους συνεργάτες εστίασης.
        </p>
        <Link
          href="/merchant/login"
          className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold shadow-sm"
        >
          Σύνδεση Συνεργάτη →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-text-main p-6 flex flex-col items-center">
      <header className="w-full max-w-md flex justify-between items-center pb-6 border-b border-border-theme mb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-brand-text">
            Check-In Scanner
          </span>
          <h1 className="text-2xl font-black text-text-main">Έλεγχος Εισιτηρίου</h1>
        </div>
        <Link
          href="/merchant"
          className="text-xs bg-card hover:bg-subtle px-3.5 py-2 rounded-xl transition text-text-main border border-border-theme shadow-sm font-medium"
        >
          ← Dashboard
        </Link>
      </header>

      <main className="w-full max-w-md space-y-6">
        <div className="grid grid-cols-2 p-1 bg-subtle rounded-xl text-xs font-bold border border-border-theme">
          <button
            type="button"
            onClick={() => setActiveTab("camera")}
            className={`py-2 rounded-lg transition cursor-pointer ${
              activeTab === "camera"
                ? "bg-card text-brand-text shadow-sm"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            📷 Κάμερα QR
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={`py-2 rounded-lg transition cursor-pointer ${
              activeTab === "manual"
                ? "bg-card text-brand-text shadow-sm"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            ⌨️ Πληκτρολόγηση
          </button>
        </div>

        {activeTab === "camera" ? (
          <div className="bg-card border border-border-theme p-4 rounded-3xl overflow-hidden shadow-sm flex flex-col items-center">
            <div className="w-full aspect-square max-w-[280px] rounded-2xl overflow-hidden border-2 border-brand relative">
              <Scanner
                onScan={(result: { rawValue: string }[]) => {
                  if (result && result.length > 0 && !loading) {
                    verifyTicket(result[0].rawValue);
                  }
                }}
              />
            </div>
            <p className="text-xs text-text-muted mt-3 text-center">
              Στρέψτε την κάμερα στο QR code του πελάτη.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyTicket(ticketInput);
            }}
            className="bg-card border border-border-theme p-6 rounded-3xl shadow-sm space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">
                Κωδικός Ticket (π.χ. KAF-4821)
              </label>
              <input
                type="text"
                required
                placeholder="π.χ. KAF-4821"
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value.toUpperCase())}
                className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-3 text-base text-text-main font-mono focus:outline-none focus:border-brand tracking-wider text-center"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !ticketInput.trim()}
              className="w-full py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {loading ? "Έλεγχος..." : "Εξαργύρωση Εισιτηρίου"}
            </button>
          </form>
        )}

        {scanResult && (
          <div
            className={`p-6 rounded-3xl border shadow-sm space-y-2 text-center transition ${
              scanResult.success
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : "bg-red-50 border-red-300 text-red-900"
            }`}
          >
            <div className="text-3xl">{scanResult.success ? "🎉" : "⚠️"}</div>
            <h3 className="font-bold text-base">{scanResult.message}</h3>

            {scanResult.ticketCode && (
              <div className="pt-2 border-t border-border-theme text-xs text-text-muted space-y-1">
                <div>
                  Κωδικός:{" "}
                  <strong className="font-mono text-text-main">{scanResult.ticketCode}</strong>
                </div>
                {scanResult.partySize && (
                  <div>
                    Άτομα: <strong className="text-text-main">{scanResult.partySize}</strong> | Ώρα:{" "}
                    <strong className="text-text-main">{scanResult.timeWindow}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}