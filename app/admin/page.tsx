"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { initializeApp, getApps, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  User,
  signOut,
} from "firebase/auth";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface AdminVenue {
  id: string;
  name: string;
  slug: string;
  area: string;
  ownerEmail?: string;
  ownerId?: string;
  isPublished?: boolean;
  subscriptionStatus?: "active" | "past_due" | "canceled";
  monthlyPrice?: number;
  validUntil?: string;
}

interface MerchantAccount {
  id: string;
  companyName?: string;
  email?: string;
  subscription?: {
    status: "active" | "past_due" | "canceled";
    planName: string;
    validUntil: string;
    monthlyPrice: number;
  };
}

export const ADMIN_EMAILS = [
  "skampanar@gmail.com",
  "olga_dre@yahoo.gr",
  "tommyanastaso@gmail.com",
];

function generateSlug(text: string): string {
  const greekToLatinMap: Record<string, string> = {
    α: "a", ά: "a", β: "v", γ: "g", δ: "d", ε: "e", έ: "e", ζ: "z", η: "i", ή: "i",
    θ: "th", ι: "i", ί: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", ό: "o",
    π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", ύ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o", ώ: "o",
  };

  return text
    .toLowerCase()
    .split("")
    .map((char) => greekToLatinMap[char] || char)
    .join("")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function AdminDashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [merchants, setMerchants] = useState<MerchantAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Κεντρικές ρυθμίσεις συστήματος
  const [systemSettings, setSystemSettings] = useState({ isRaining: false, globalMissYou: false });

  const [newCompanyName, setNewCompanyName] = useState("");
  const [newMerchantEmail, setNewMerchantEmail] = useState("");
  const [newMerchantPassword, setNewMerchantPassword] = useState("");
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueArea, setNewVenueArea] = useState("");
  const [newVenueCategory, setNewVenueCategory] = useState("Ελληνική Ταβέρνα");
  const [newMonthlyPrice, setNewMonthlyPrice] = useState(49);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const unsubVenues = onSnapshot(collection(db, "venues"), (snap) => {
      const vList: AdminVenue[] = [];
      snap.forEach((d) => {
        const data = d.data();
        vList.push({
          id: d.id,
          name: data.name || d.id,
          slug: data.slug || d.id,
          area: data.area || "Αθήνα",
          ownerEmail: data.ownerEmail || "",
          ownerId: data.ownerId || "",
          isPublished: data.isPublished !== undefined ? Boolean(data.isPublished) : true,
          subscriptionStatus: data.subscriptionStatus || "active",
          monthlyPrice: data.monthlyPrice || 49,
          validUntil: data.validUntil || "",
        });
      });
      setVenues(vList);
    });

    const unsubMerchants = onSnapshot(collection(db, "merchants"), (snap) => {
      const mList: MerchantAccount[] = [];
      snap.forEach((d) => {
        mList.push({ id: d.id, ...(d.data() as Omit<MerchantAccount, "id">) });
      });
      setMerchants(mList);
      setLoading(false);
    });

    // Listener για τον Καιρό και το Σύστημα
    const unsubSettings = onSnapshot(doc(db, "settings", "system"), (docSnap) => {
      if (docSnap.exists()) {
        setSystemSettings({
          isRaining: docSnap.data().isRaining || false,
          globalMissYou: docSnap.data().globalMissYou || false,
        });
      }
    });

    return () => {
      unsubVenues();
      unsubMerchants();
      unsubSettings();
    };
  }, []);

  const toggleSystemSetting = async (key: string, currentValue: boolean) => {
    try {
      await setDoc(doc(db, "settings", "system"), { [key]: !currentValue }, { merge: true });
      setActionMessage(`Η ρύθμιση ενημερώθηκε σε ${!currentValue ? "ON" : "OFF"}`);
    } catch (err) {
      console.error(err);
      alert("Σφάλμα ενημέρωσης συστήματος.");
    }
  };

  const toggleVenueSubscription = async (venue: AdminVenue) => {
    const merchant = merchants.find(
      (m) => m.id === venue.ownerId || m.email?.toLowerCase() === venue.ownerEmail?.toLowerCase()
    );
    const currentStatus = venue.subscriptionStatus || merchant?.subscription?.status || "active";
    const nextStatus = currentStatus === "active" ? "past_due" : "active";
    const nextPublished = nextStatus === "active";

    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);
    const validUntilStr = nextDate.toLocaleDateString("el-GR");

    try {
      await updateDoc(doc(db, "venues", venue.id), {
        subscriptionStatus: nextStatus,
        isPublished: nextPublished,
        validUntil: validUntilStr,
      });

      if (merchant) {
        await updateDoc(doc(db, "merchants", merchant.id), {
          "subscription.status": nextStatus,
          "subscription.validUntil": validUntilStr,
        });
      }

      setActionMessage(
        `Το κατάστημα "${venue.name}" είναι πλέον: ${
          nextStatus === "active" ? "✓ Ενεργό & Δημοσιευμένο" : "⚠️ Σε Αναστολή (Κρυφό)"
        }`
      );
    } catch (err) {
      console.error(err);
      alert("Σφάλμα ενημέρωσης συνδρομής.");
    }
  };

  const handleCreatePartnerAndVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setActionMessage(null);

    const cleanEmail = newMerchantEmail.trim().toLowerCase();
    const venueSlug = generateSlug(newVenueName) || `venue-${Date.now()}`;
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);
    const validUntilStr = nextDate.toLocaleDateString("el-GR");

    let partnerUid = "";

    try {
      const existingMerchant = merchants.find((m) => m.email?.toLowerCase() === cleanEmail);

      if (existingMerchant) {
        partnerUid = existingMerchant.id;
      } else {
        const config = auth.app.options;
        const secondaryAppName = `SecondaryAuthApp-${Date.now()}`;
        const existingApps = getApps();
        const secondaryApp =
          existingApps.find((a) => a.name === secondaryAppName) ||
          initializeApp(config, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          cleanEmail,
          newMerchantPassword
        );
        partnerUid = cred.user.uid;

        await signOut(secondaryAuth);
        await deleteApp(secondaryApp);

        await setDoc(doc(db, "merchants", partnerUid), {
          companyName: newCompanyName.trim(),
          email: cleanEmail,
          role: "merchant",
          createdAt: serverTimestamp(),
          subscription: {
            status: "active",
            planName: "HappySeats Monthly Business",
            validUntil: validUntilStr,
            monthlyPrice: Number(newMonthlyPrice),
          },
        });
      }

      await setDoc(doc(db, "venues", venueSlug), {
        ownerId: partnerUid,
        ownerEmail: cleanEmail,
        name: newVenueName.trim(),
        slug: venueSlug,
        category: newVenueCategory.trim(),
        area: newVenueArea.trim(),
        address: `${newVenueArea.trim()}, Αθήνα`,
        phone: "+30 210 0000000",
        hours: "13:00 - 00:30 καθημερινά",
        description: `Επίσημη καταχώριση για το ${newVenueName.trim()}.`,
        image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
        lat: 37.9838,
        lng: 23.7275,
        tableStatus: "plenty",
        takeawayReady: true,
        panicDealActive: false,
        vibeTags: ["☀️ Έχει ήλιο έξω", "💻 Χαλαρό για δουλειά"],
        isPublished: true,
        subscriptionStatus: "active",
        monthlyPrice: Number(newMonthlyPrice),
        validUntil: validUntilStr,
        createdAt: serverTimestamp(),
      });

      setActionMessage(`✓ Ο συνεργάτης (${cleanEmail}) και το κατάστημα δημιουργήθηκαν!`);
      setNewCompanyName("");
      setNewMerchantEmail("");
      setNewMerchantPassword("");
      setNewVenueName("");
      setNewVenueArea("");
    } catch (err: unknown) {
      console.error(err);
      alert("Σφάλμα κατά την καταχώρηση συνεργάτη.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center text-sm">Έλεγχος διαπιστευτηρίων...</div>;
  }

  const isAuthorizedAdmin = Boolean(
    currentUser?.email &&
      ADMIN_EMAILS.map((e) => e.toLowerCase().trim()).includes(
        currentUser.email.toLowerCase().trim()
      )
  );

  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 space-y-4">
        <h1 className="text-xl font-black text-text-main">Περιορισμένη Πρόσβαση (403)</h1>
        <Link href="/" className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold">← Επιστροφή στην Αρχική</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-text-main p-6">
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-border-theme gap-4">
        <div>
          <h1 className="text-2xl font-black text-text-main mt-1">Admin Panel</h1>
        </div>
        <Link href="/" className="text-xs bg-card px-3 py-2 rounded-xl text-text-main border font-bold">
          ← Επιστροφή στην Εφαρμογή
        </Link>
      </header>

      <main className="max-w-6xl mx-auto py-8 space-y-8">
        {actionMessage && (
          <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-bold flex justify-between animate-pulse">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)}>✕</button>
          </div>
        )}

        {/* --- ΝΕΟ: ΚΕΝΤΡΙΚΟΣ ΕΛΕΓΧΟΣ (ΚΑΙΡΟΣ) --- */}
        <section className="bg-card border border-border-theme p-6 rounded-3xl shadow-sm space-y-4">
          <h2 className="text-base font-bold">⚙️ Κεντρικός Έλεγχος Πλατφόρμας (Global Automations)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-subtle rounded-2xl border flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">🌧️ Προσομοίωση Βροχής</h3>
                <p className="text-xs text-text-muted mt-1">Ενεργοποιεί μαζικά τα "Weather Deals" στους πελάτες.</p>
              </div>
              <button 
                onClick={() => toggleSystemSetting("isRaining", systemSettings.isRaining)} 
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${systemSettings.isRaining ? "bg-sky-600 text-white" : "bg-card border"}`}
              >
                {systemSettings.isRaining ? "ON (Βρέχει)" : "OFF"}
              </button>
            </div>

            <div className="p-4 bg-subtle rounded-2xl border flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">💌 "Miss You" Κουπόνι</h3>
                <p className="text-xs text-text-muted mt-1">Εμφανίζει το banner επιστροφής πελατών.</p>
              </div>
              <button 
                onClick={() => toggleSystemSetting("globalMissYou", systemSettings.globalMissYou)} 
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${systemSettings.globalMissYou ? "bg-purple-600 text-white" : "bg-card border"}`}
              >
                {systemSettings.globalMissYou ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        </section>

        <section className="bg-card border border-border-theme p-6 rounded-3xl shadow-sm space-y-4">
          <h2 className="text-base font-bold">➕ Δημιουργία Λογαριασμού Συνεργάτη & Καταστήματος</h2>
          <form onSubmit={handleCreatePartnerAndVenue} className="bg-subtle p-5 rounded-2xl border space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <input required type="text" placeholder="Επωνυμία Επιχείρησης *" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} className="w-full px-3 py-2 rounded-xl border" />
              <input required type="email" placeholder="Email Συνεργάτη *" value={newMerchantEmail} onChange={(e) => setNewMerchantEmail(e.target.value)} className="w-full px-3 py-2 rounded-xl border" />
              <input required type="text" minLength={6} placeholder="Αρχικός Κωδικός *" value={newMerchantPassword} onChange={(e) => setNewMerchantPassword(e.target.value)} className="w-full px-3 py-2 rounded-xl border" />
              <input required type="text" placeholder="Όνομα Καταστήματος *" value={newVenueName} onChange={(e) => setNewVenueName(e.target.value)} className="w-full px-3 py-2 rounded-xl border" />
              <input required type="text" placeholder="Περιοχή *" value={newVenueArea} onChange={(e) => setNewVenueArea(e.target.value)} className="w-full px-3 py-2 rounded-xl border" />
              <div className="flex gap-2">
                <input required type="text" placeholder="Κατηγορία" value={newVenueCategory} onChange={(e) => setNewVenueCategory(e.target.value)} className="w-2/3 px-3 py-2 rounded-xl border" />
                <input required type="number" min={10} placeholder="Τιμή €" value={newMonthlyPrice} onChange={(e) => setNewMonthlyPrice(Number(e.target.value))} className="w-1/3 px-3 py-2 rounded-xl border" />
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-brand text-white font-bold rounded-xl disabled:opacity-50 cursor-pointer">
              {isSubmitting ? "Καταχώριση..." : "+ Δημιουργία Συνεργάτη & Καταστήματος"}
            </button>
          </form>
        </section>

        <section className="bg-card border border-border-theme p-6 rounded-3xl shadow-sm space-y-4">
          <h2 className="text-base font-bold">🏢 Εγγεγραμμένα Καταστήματα</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b uppercase text-[10px] tracking-wider text-text-muted">
                  <th className="py-3 px-3">Κατάστημα</th>
                  <th className="py-3 px-3">Περιοχή</th>
                  <th className="py-3 px-3">Email Συνεργάτη</th>
                  <th className="py-3 px-3">Συνδρομή</th>
                  <th className="py-3 px-3 text-right">Ενέργειες</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-theme">
                {venues.map((v) => {
                  const isPublished = v.isPublished !== false && v.subscriptionStatus === "active";
                  return (
                    <tr key={v.id} className="hover:bg-subtle/50 transition">
                      <td className="py-3 px-3 font-bold">{v.name}</td>
                      <td className="py-3 px-3 text-text-muted">{v.area}</td>
                      <td className="py-3 px-3 font-mono">{v.ownerEmail || "—"}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${isPublished ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                          {isPublished ? `✓ Ενεργή (${v.monthlyPrice}€)` : "⚠️ Σε Αναστολή"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button onClick={() => toggleVenueSubscription(v)} className="px-2.5 py-1.5 bg-subtle rounded-lg border font-medium cursor-pointer">
                          {isPublished ? "Αναστολή" : "Ενεργοποίηση"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}