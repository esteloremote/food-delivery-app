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

  // Φόρμα Εγγραφής Νέου Συνεργάτη & Καταστήματος από τον Admin
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

    return () => {
      unsubVenues();
      unsubMerchants();
    };
  }, []);

  // Εναλλαγή κατάστασης συνδρομής ΑΝΑ ΚΑΤΑΣΤΗΜΑ & Συγχρονισμός με Πελάτες (isPublished)
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
      // 1. Ενημέρωση του ίδιου του καταστήματος (ώστε να κρύβεται/εμφανίζεται στους πελάτες)
      await updateDoc(doc(db, "venues", venue.id), {
        subscriptionStatus: nextStatus,
        isPublished: nextPublished,
        validUntil: validUntilStr,
      });

      // 2. Ενημέρωση και του λογαριασμού Merchant
      if (merchant) {
        await updateDoc(doc(db, "merchants", merchant.id), {
          "subscription.status": nextStatus,
          "subscription.validUntil": validUntilStr,
        });
      }

      setActionMessage(
        `Το κατάστημα "${venue.name}" είναι πλέον: ${
          nextStatus === "active" ? "✓ Ενεργό & Δημοσιευμένο" : "⚠️ Σε Αναστολή (Κρυφό από Πελάτες)"
        }`
      );
    } catch (err) {
      console.error(err);
      alert("Σφάλμα ενημέρωσης συνδρομής.");
    }
  };

  // Δημιουργία Πραγματικού Λογαριασμού Συνεργάτη (Firebase Auth) & Καταστήματος
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
      // Έλεγχος αν υπάρχει ήδη ο συνεργάτης στη λίστα merchants
      const existingMerchant = merchants.find(
        (m) => m.email?.toLowerCase() === cleanEmail
      );

      if (existingMerchant) {
        partnerUid = existingMerchant.id;
      } else {
        // Δημιουργούμε τον χρήστη στο Firebase Auth μέσω Secondary App ώστε να ΜΗΝ αποσυνδεθεί ο Admin!
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

        // Αποθήκευση στον πίνακα merchants με το ΠΡΑΓΜΑΤΙΚΟ Firebase Auth UID
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

      // Δημιουργία του Καταστήματος συνδεδεμένου με το πραγματικό UID & Email
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
        image:
          "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
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

      setActionMessage(
        `✓ Ο συνεργάτης (${cleanEmail}) και το κατάστημα "${newVenueName}" δημιουργήθηκαν! Μπορεί να συνδεθεί άμεσα στο /merchant/login.`
      );
      setNewCompanyName("");
      setNewMerchantEmail("");
      setNewMerchantPassword("");
      setNewVenueName("");
      setNewVenueArea("");
    } catch (err: unknown) {
      console.error(err);
      const code = (err as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        alert(
          "Το email χρησιμοποιείται ήδη στο Firebase Auth. Αν ανήκει σε υπάρχοντα συνεργάτη, βεβαιωθείτε ότι υπάρχει στη συλλογή merchants."
        );
      } else {
        alert("Σφάλμα κατά την καταχώρηση συνεργάτη.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVenue = async (venueId: string, name: string) => {
    if (!confirm(`Θέλετε να διαγράψετε οριστικά το κατάστημα "${name}";`)) return;
    try {
      await deleteDoc(doc(db, "venues", venueId));
      setActionMessage(`Το κατάστημα "${name}" διαγράφηκε.`);
    } catch (err) {
      console.error(err);
      alert("Σφάλμα κατά τη διαγραφή.");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface text-text-muted flex items-center justify-center text-sm">
        Έλεγχος διαπιστευτηρίων διαχειριστή...
      </div>
    );
  }

  const isAuthorizedAdmin = Boolean(
    currentUser?.email &&
      ADMIN_EMAILS.map((e) => e.toLowerCase().trim()).includes(
        currentUser.email.toLowerCase().trim()
      )
  );

  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-screen bg-surface text-text-main flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center text-2xl font-bold shadow-sm">
          🚫
        </div>
        <h1 className="text-xl font-black text-text-main">Περιορισμένη Πρόσβαση (403)</h1>
        <p className="text-xs text-text-muted text-center max-w-sm">
          Ο λογαριασμός{" "}
          <strong className="text-text-main">{currentUser?.email || "Επισκέπτης"}</strong> δεν
          διαθέτει δικαιώματα διαχειριστή στην πλατφόρμα HappySeats.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition shadow-sm"
        >
          ← Επιστροφή στην Αρχική Σελίδα
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-text-main p-6">
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-border-theme gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest bg-brand text-white font-black px-2 py-0.5 rounded-md">
              Platform Admin
            </span>
            <span className="text-[10px] bg-subtle text-text-muted font-medium px-2 py-0.5 rounded-full border border-border-theme">
              {currentUser?.email}
            </span>
          </div>
          <h1 className="text-2xl font-black text-text-main mt-1">
            Κεντρική Διαχείριση Καταστημάτων & Συνδρομών
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/merchant"
            className="text-xs bg-card hover:bg-subtle px-3 py-2 rounded-xl transition text-text-main border border-border-theme shadow-sm"
          >
            Merchant View →
          </Link>
          <Link
            href="/"
            className="text-xs bg-card hover:bg-subtle px-3 py-2 rounded-xl transition text-text-main border border-border-theme shadow-sm"
          >
            Customer View →
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 space-y-8">
        {actionMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl text-xs font-bold flex justify-between items-center shadow-sm">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* 1. Φόρμα Εγγραφής Νέας Επιχείρησης από τον Admin */}
        <section className="bg-card border border-border-theme p-6 rounded-3xl shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-text-main flex items-center gap-2">
              <span>➕</span> Δημιουργία Λογαριασμού Συνεργάτη & Καταστήματος
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Δημιουργεί έτοιμο λογαριασμό σύνδεσης για τον καταστηματάρχη και ενεργοποιεί τη μηνιαία συνδρομή του καταστήματος.
            </p>
          </div>

          <form
            onSubmit={handleCreatePartnerAndVenue}
            className="bg-subtle p-5 rounded-2xl border border-border-theme space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-text-muted font-semibold mb-1">
                  Επωνυμία Επιχείρησης *
                </label>
                <input
                  required
                  type="text"
                  placeholder="π.χ. Όμιλος Εστίασης Αθήνα"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full bg-card border border-border-theme rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-text-muted font-semibold mb-1">
                  Email Σύνδεσης Καταστηματάρχη *
                </label>
                <input
                  required
                  type="email"
                  placeholder="manager@restaurant.gr"
                  value={newMerchantEmail}
                  onChange={(e) => setNewMerchantEmail(e.target.value)}
                  className="w-full bg-card border border-border-theme rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-text-muted font-semibold mb-1">
                  Αρχικός Κωδικός Πρόσβασης *
                </label>
                <input
                  required
                  type="text"
                  minLength={6}
                  placeholder="Τουλάχιστον 6 χαρακτήρες"
                  value={newMerchantPassword}
                  onChange={(e) => setNewMerchantPassword(e.target.value)}
                  className="w-full bg-card border border-border-theme rounded-xl px-3 py-2 text-text-main font-mono focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-text-muted font-semibold mb-1">
                  Όνομα Καταστήματος *
                </label>
                <input
                  required
                  type="text"
                  placeholder="π.χ. Ταβέρνα ο Πέτρος"
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                  className="w-full bg-card border border-border-theme rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-text-muted font-semibold mb-1">
                  Περιοχή Καταστήματος *
                </label>
                <input
                  required
                  type="text"
                  placeholder="π.χ. Πλάκα, Κολωνάκι"
                  value={newVenueArea}
                  onChange={(e) => setNewVenueArea(e.target.value)}
                  className="w-full bg-card border border-border-theme rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-text-muted font-semibold mb-1">
                  Κατηγορία & Μηνιαία Συνδρομή (€) *
                </label>
                <div className="flex gap-2">
                  <input
                    required
                    type="text"
                    placeholder="Ελληνική"
                    value={newVenueCategory}
                    onChange={(e) => setNewVenueCategory(e.target.value)}
                    className="w-2/3 bg-card border border-border-theme rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-brand"
                  />
                  <input
                    required
                    type="number"
                    min={10}
                    value={newMonthlyPrice}
                    onChange={(e) => setNewMonthlyPrice(Number(e.target.value))}
                    className="w-1/3 bg-card border border-border-theme rounded-xl px-3 py-2 text-text-main focus:outline-none focus:border-brand"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {isSubmitting
                ? "Δημιουργία Λογαριασμού & Καταστήματος..."
                : "+ Δημιουργία Συνεργάτη & Ενεργοποίηση Συνδρομής"}
            </button>
          </form>
        </section>

        {/* 2. Λίστα Καταστημάτων & Έλεγχος Συνδρομών ανά Κατάστημα */}
        <section className="bg-card border border-border-theme p-6 rounded-3xl shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-border-theme">
            <div>
              <h2 className="text-base font-bold text-text-main">
                🏢 Εγγεγραμμένα Καταστήματα ({venues.length})
              </h2>
              <p className="text-xs text-text-muted">
                Όταν αναστέλλετε τη συνδρομή ενός καταστήματος, κρύβεται αυτόματα από την αρχική σελίδα των πελατών και κλειδώνει ο πίνακας του εστιάτορα.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-theme text-text-muted uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Κατάστημα</th>
                  <th className="py-3 px-3">Περιοχή</th>
                  <th className="py-3 px-3">Email Συνεργάτη</th>
                  <th className="py-3 px-3">Συνδρομή & Προβολή</th>
                  <th className="py-3 px-3 text-right">Ενέργειες</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-theme">
                {venues.map((v) => {
                  const merchant = merchants.find(
                    (m) =>
                      m.id === v.ownerId ||
                      m.email?.toLowerCase() === v.ownerEmail?.toLowerCase()
                  );
                  const status =
                    v.subscriptionStatus || merchant?.subscription?.status || "active";
                  const isPublished = v.isPublished !== false && status === "active";
                  const price = v.monthlyPrice || merchant?.subscription?.monthlyPrice || 49;

                  return (
                    <tr key={v.id} className="hover:bg-subtle/50 transition">
                      <td className="py-3 px-3 font-bold text-text-main">
                        {v.name}
                        <span className="block text-[10px] text-text-muted font-mono">
                          /{v.slug}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-text-muted">{v.area}</td>
                      <td className="py-3 px-3 font-mono text-text-main">
                        {v.ownerEmail || "—"}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isPublished
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {isPublished
                            ? `✓ Ενεργή (${price}€/μήνα) • Δημόσιο`
                            : "⚠️ Σε Αναστολή • Κρυφό από Πελάτες"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => toggleVenueSubscription(v)}
                          className="px-2.5 py-1 bg-subtle hover:bg-border-theme text-text-main rounded-lg border border-border-theme font-medium transition cursor-pointer"
                        >
                          {isPublished ? "Αναστολή Συνδρομής" : "Ενεργοποίηση"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVenue(v.id, v.name)}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 font-medium transition cursor-pointer"
                        >
                          Διαγραφή
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