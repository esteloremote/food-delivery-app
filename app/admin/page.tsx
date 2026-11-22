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
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { SubscriptionPlanId } from "@/lib/plans";

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
  subscription?: {
    plan: SubscriptionPlanId;
    planLabel: string;
    status: "active" | "past_due" | "canceled";
    price: number;
    validUntil: string;
  };
}

interface MerchantAccount {
  id: string;
  companyName?: string;
  email?: string;
  vatNumber?: string;
  phone?: string;
  subscription?: {
    status: "active" | "past_due" | "canceled";
    planName: string;
    validUntil: string;
    monthlyPrice: number;
  };
}

interface PartnerApplication {
  id: string;
  companyName: string;
  vatNumber: string;
  taxOffice: string;
  contactName: string;
  phone: string;
  email: string;
  venueName: string;
  venueArea: string;
  venueAddress: string;
  venueCategory: string;
  notes?: string;
  planId: SubscriptionPlanId;
  planLabel: string;
  durationMonths: number;
  price: number;
  paymentReference: string;
  status: "pending" | "pre_approved" | "active" | "rejected";
  createdAt?: { toMillis?: () => number };
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

function generateTempPassword(): string {
  const randomPart = Math.random().toString(36).slice(-6).toUpperCase();
  return `HS-${randomPart}!`;
}

export default function AdminDashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [merchants, setMerchants] = useState<MerchantAccount[]>([]);
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingAppId, setProcessingAppId] = useState<string | null>(null);

  // Κεντρικές ρυθμίσεις συστήματος
  const [systemSettings, setSystemSettings] = useState({
    isRaining: false,
    globalMissYou: false,
  });

  // Χειροκίνητη δημιουργία συνεργάτη
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
          subscription: data.subscription,
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

    const unsubApplications = onSnapshot(
      collection(db, "partner_applications"),
      (snap) => {
        const appList: PartnerApplication[] = [];
        snap.forEach((d) => {
          appList.push({
            id: d.id,
            ...(d.data() as Omit<PartnerApplication, "id">),
          });
        });
        // Ταξινόμηση: οι πιο πρόσφατες πρώτες
        appList.sort(
          (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
        );
        setApplications(appList);
      },
      (err) => {
        if (err.code !== "permission-denied") console.error(err);
      }
    );

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
      unsubApplications();
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

  // --- ΒΗΜΑ Α: ΠΡΟΕΓΚΡΙΣΗ ΑΙΤΗΣΗΣ & ΑΠΟΣΤΟΛΗ ΟΡΩΝ + ΠΛΗΡΩΜΗΣ ---
  const handlePreApproveApplication = async (app: PartnerApplication) => {
    setProcessingAppId(app.id);
    setActionMessage(null);

    try {
      await updateDoc(doc(db, "partner_applications", app.id), {
        status: "pre_approved",
        preApprovedAt: serverTimestamp(),
      });

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "pre_approved",
          to: app.email,
          contactName: app.contactName,
          companyName: app.companyName,
          venueName: app.venueName,
          planLabel: app.planLabel,
          price: app.price,
          paymentReference: app.paymentReference,
        }),
      });

      if (!res.ok) {
        throw new Error("Αποτυχία αποστολής email προέγκρισης.");
      }

      setActionMessage(
        `✓ Η αίτηση για το "${app.venueName}" προεγκρίθηκε! Στάλθηκε email με τους όρους και τον κωδικό πληρωμής ${app.paymentReference}.`
      );
    } catch (err) {
      console.error(err);
      alert("Σφάλμα κατά την προέγκριση ή την αποστολή email.");
    } finally {
      setProcessingAppId(null);
    }
  };

  // --- ΒΗΜΑ Β: ΕΠΙΒΕΒΑΙΩΣΗ ΠΛΗΡΩΜΗΣ & ΕΝΕΡΓΟΠΟΙΗΣΗ ---
  const handleActivateApplication = async (app: PartnerApplication) => {
    const confirmed = window.confirm(
      `Επιβεβαιώνεις ότι έχει ολοκληρωθεί η πληρωμή (${app.price}€ + ΦΠΑ, κωδικός ${app.paymentReference}) για το "${app.venueName}";`
    );
    if (!confirmed) return;

    setProcessingAppId(app.id);
    setActionMessage(null);

    const cleanEmail = app.email.trim().toLowerCase();
    const venueSlug = generateSlug(app.venueName) || `venue-${Date.now()}`;
    const validUntilDate = new Date();
    validUntilDate.setMonth(validUntilDate.getMonth() + (app.durationMonths || 1));
    const validUntilStr = validUntilDate.toLocaleDateString("el-GR");

    let partnerUid = "";
    let isExistingUser = false;
    const tempPassword = generateTempPassword();

    try {
      // 1. Έλεγχος αν υπάρχει ήδη ως merchant
      const existingMerchant = merchants.find(
        (m) => m.email?.toLowerCase() === cleanEmail
      );

      if (existingMerchant) {
        partnerUid = existingMerchant.id;
        isExistingUser = true;
      } else {
        // 2. Προσπάθεια δημιουργίας νέου Auth χρήστη μέσω Secondary App
        const config = auth.app.options;
        const secondaryAppName = `SecondaryAuthApp-${Date.now()}`;
        const existingApps = getApps();
        const secondaryApp =
          existingApps.find((a) => a.name === secondaryAppName) ||
          initializeApp(config, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        try {
          const cred = await createUserWithEmailAndPassword(
            secondaryAuth,
            cleanEmail,
            tempPassword
          );
          partnerUid = cred.user.uid;
        } catch (authErr: unknown) {
          const code = (authErr as { code?: string })?.code;
          if (code === "auth/email-already-in-use") {
            const qUser = query(
              collection(db, "users"),
              where("email", "==", cleanEmail)
            );
            const userSnap = await getDocs(qUser);
            if (userSnap.empty) {
              alert(
                "Το email υπάρχει στο Firebase Auth, αλλά δεν βρέθηκε στη συλλογή users."
              );
              return;
            }
            partnerUid = userSnap.docs[0].id;
            isExistingUser = true;
          } else {
            throw authErr;
          }
        } finally {
          await signOut(secondaryAuth).catch(() => {});
          await deleteApp(secondaryApp).catch(() => {});
        }
      }

      // 3. Δημιουργία / Ενημέρωση προφίλ Merchant (1 merchant -> πολλά καταστήματα)
      await setDoc(
        doc(db, "merchants", partnerUid),
        {
          companyName: app.companyName,
          vatNumber: app.vatNumber,
          taxOffice: app.taxOffice,
          contactName: app.contactName,
          phone: app.phone,
          email: cleanEmail,
          role: "merchant",
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 4. Δημιουργία Καταστήματος με δική του συνδρομή
      await setDoc(doc(db, "venues", venueSlug), {
        ownerId: partnerUid,
        ownerEmail: cleanEmail,
        name: app.venueName,
        slug: venueSlug,
        category: app.venueCategory,
        area: app.venueArea,
        address: app.venueAddress || `${app.venueArea}, Αθήνα`,
        phone: app.phone,
        hours: "13:00 - 00:30 καθημερινά",
        description: `Επίσημη καταχώριση για το ${app.venueName}.`,
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
        monthlyPrice: app.price,
        validUntil: validUntilStr,
        subscription: {
          plan: app.planId,
          planLabel: app.planLabel,
          durationMonths: app.durationMonths,
          status: "active",
          price: app.price,
          validUntil: validUntilStr,
          paymentReference: app.paymentReference,
        },
        createdAt: serverTimestamp(),
      });

      // 5. Ενημέρωση της αίτησης σε active
      await updateDoc(doc(db, "partner_applications", app.id), {
        status: "active",
        activatedAt: serverTimestamp(),
        partnerUid,
        venueSlug,
      });

      // 6. Αποστολή email ενεργοποίησης
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "account_activated",
          to: cleanEmail,
          contactName: app.contactName,
          companyName: app.companyName,
          venueName: app.venueName,
          isExistingUser,
          tempPassword: isExistingUser ? undefined : tempPassword,
        }),
      });

      setActionMessage(
        `✅ Το κατάστημα "${app.venueName}" ενεργοποιήθηκε (λήξη συνδρομής: ${validUntilStr}) και στάλθηκε email πρόσβασης στο ${cleanEmail}!`
      );
    } catch (err) {
      console.error(err);
      alert("Σφάλμα κατά την ενεργοποίηση του καταστήματος.");
    } finally {
      setProcessingAppId(null);
    }
  };

  // --- ΑΠΟΡΡΙΨΗ ΑΙΤΗΣΗΣ ---
  const handleRejectApplication = async (app: PartnerApplication) => {
    if (!window.confirm(`Απόρριψη της αίτησης για το "${app.venueName}";`)) return;
    setProcessingAppId(app.id);
    try {
      await updateDoc(doc(db, "partner_applications", app.id), {
        status: "rejected",
        rejectedAt: serverTimestamp(),
      });
      setActionMessage(`Η αίτηση για το "${app.venueName}" απορρίφθηκε.`);
    } catch (err) {
      console.error(err);
      alert("Σφάλμα απόρριψης.");
    } finally {
      setProcessingAppId(null);
    }
  };

  const toggleVenueSubscription = async (venue: AdminVenue) => {
    const currentStatus =
      venue.subscription?.status || venue.subscriptionStatus || "active";
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
        "subscription.status": nextStatus,
        "subscription.validUntil": validUntilStr,
      });

      setActionMessage(
        `Το κατάστημα "${venue.name}" είναι πλέον: ${
          nextStatus === "active"
            ? "✓ Ενεργό & Δημοσιευμένο"
            : "⚠️ Σε Αναστολή (Κρυφό)"
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
    let isExistingUser = false;

    try {
      const existingMerchant = merchants.find(
        (m) => m.email?.toLowerCase() === cleanEmail
      );

      if (existingMerchant) {
        partnerUid = existingMerchant.id;
        isExistingUser = true;
      } else {
        const config = auth.app.options;
        const secondaryAppName = `SecondaryAuthApp-${Date.now()}`;
        const existingApps = getApps();
        const secondaryApp =
          existingApps.find((a) => a.name === secondaryAppName) ||
          initializeApp(config, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        try {
          const cred = await createUserWithEmailAndPassword(
            secondaryAuth,
            cleanEmail,
            newMerchantPassword
          );
          partnerUid = cred.user.uid;
        } catch (authErr: unknown) {
          const code = (authErr as { code?: string })?.code;

          if (code === "auth/email-already-in-use") {
            const qUser = query(
              collection(db, "users"),
              where("email", "==", cleanEmail)
            );
            const userSnap = await getDocs(qUser);

            if (userSnap.empty) {
              alert(
                "Το email υπάρχει ήδη στο Firebase Auth, αλλά δεν βρέθηκε προφίλ στη συλλογή users."
              );
              return;
            }
            partnerUid = userSnap.docs[0].id;
            isExistingUser = true;
          } else {
            throw authErr;
          }
        } finally {
          await signOut(secondaryAuth).catch(() => {});
          await deleteApp(secondaryApp).catch(() => {});
        }

        await setDoc(
          doc(db, "merchants", partnerUid),
          {
            companyName: newCompanyName.trim(),
            email: cleanEmail,
            role: "merchant",
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
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
        subscription: {
          plan: "monthly",
          planLabel: "Μηνιαίο",
          durationMonths: 1,
          status: "active",
          price: Number(newMonthlyPrice),
          validUntil: validUntilStr,
        },
        createdAt: serverTimestamp(),
      });

      const successText = isExistingUser
        ? `✅ Ο υπάρχων χρήστης (${cleanEmail}) αναβαθμίστηκε σε Συνεργάτη!`
        : `✓ Ο νέος συνεργάτης (${cleanEmail}) και το κατάστημα δημιουργήθηκαν επιτυχώς!`;

      setActionMessage(successText);
      setNewCompanyName("");
      setNewMerchantEmail("");
      setNewMerchantPassword("");
      setNewVenueName("");
      setNewVenueArea("");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/weak-password") {
        alert("Ο κωδικός πρόσβασης πρέπει να έχει τουλάχιστον 6 χαρακτήρες.");
      } else if (code === "auth/invalid-email") {
        alert("Η διεύθυνση email δεν είναι έγκυρη.");
      } else {
        console.error(err);
        alert("Σφάλμα κατά την καταχώρηση συνεργάτη.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center text-sm">
        Έλεγχος διαπιστευτηρίων...
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
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 space-y-4">
        <h1 className="text-xl font-black text-text-main">
          Περιορισμένη Πρόσβαση (403)
        </h1>
        <Link
          href="/"
          className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold"
        >
          ← Επιστροφή στην Αρχική
        </Link>
      </div>
    );
  }

  const pendingCount = applications.filter(
    (a) => a.status === "pending" || a.status === "pre_approved"
  ).length;

  return (
    <div className="min-h-screen bg-surface text-text-main p-6">
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-border-theme gap-4">
        <div>
          <h1 className="text-2xl font-black text-text-main mt-1">Admin Panel</h1>
          <p className="text-xs text-text-muted">
            Διαχείριση αιτήσεων συνεργασίας, συνδρομών & αυτοματισμών
          </p>
        </div>
        <Link
          href="/"
          className="text-xs bg-card px-3 py-2 rounded-xl text-text-main border border-border-theme font-bold"
        >
          ← Επιστροφή στην Εφαρμογή
        </Link>
      </header>

      <main className="max-w-6xl mx-auto py-8 space-y-8">
        {actionMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex justify-between items-center">
            <span>{actionMessage}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* --- 1. ΑΙΤΗΣΕΙΣ ΣΥΝΕΡΓΑΣΙΑΣ --- */}
        <section className="bg-card border border-border-theme p-6 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>📋 Αιτήσεις Συνεργασίας</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-black bg-brand text-white rounded-full">
                  {pendingCount} σε εξέλιξη
                </span>
              )}
            </h2>
          </div>

          {applications.length === 0 ? (
            <p className="text-xs text-text-muted py-4">
              Δεν υπάρχουν αιτήσεις συνεργασίας ακόμα.
            </p>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => {
                const isBusy = processingAppId === app.id;
                return (
                  <div
                    key={app.id}
                    className="p-4 bg-subtle rounded-2xl border border-border-theme flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-text-main">
                          {app.venueName}
                        </span>
                        <span className="text-[11px] text-text-muted">
                          ({app.venueArea} • {app.venueCategory})
                        </span>

                        {app.status === "pending" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            ⏳ Νέα Αίτηση
                          </span>
                        )}
                        {app.status === "pre_approved" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                            💳 Αναμονή Πληρωμής ({app.paymentReference})
                          </span>
                        )}
                        {app.status === "active" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✓ Ενεργοποιήθηκε
                          </span>
                        )}
                        {app.status === "rejected" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                            ✕ Απορρίφθηκε
                          </span>
                        )}
                      </div>

                      <div className="text-text-muted">
                        <strong>Επιχείρηση:</strong> {app.companyName} •{" "}
                        <strong>ΑΦΜ:</strong> {app.vatNumber} ({app.taxOffice})
                      </div>
                      <div className="text-text-muted">
                        <strong>Επικοινωνία:</strong> {app.contactName} •{" "}
                        {app.phone} • <span className="font-mono">{app.email}</span>
                      </div>
                      <div className="text-text-main font-semibold">
                        Πακέτο: {app.planLabel} ({app.price}€ + ΦΠΑ) • Κωδικός:{" "}
                        <span className="font-mono text-brand-text">
                          {app.paymentReference}
                        </span>
                      </div>
                      {app.notes && (
                        <div className="text-[11px] italic text-text-muted">
                          Σχόλιο: &quot;{app.notes}&quot;
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {app.status === "pending" && (
                        <>
                          <button
                            disabled={isBusy}
                            onClick={() => handlePreApproveApplication(app)}
                            className="px-3.5 py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                          >
                            {isBusy
                              ? "Αποστολή..."
                              : "✓ Προέγκριση & Email Πληρωμής"}
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() => handleRejectApplication(app)}
                            className="px-3 py-2 bg-card hover:bg-red-50 text-red-600 border border-red-200 font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                          >
                            Απόρριψη
                          </button>
                        </>
                      )}

                      {app.status === "pre_approved" && (
                        <>
                          <button
                            disabled={isBusy}
                            onClick={() => handleActivateApplication(app)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer disabled:opacity-50 shadow-sm"
                          >
                            {isBusy
                              ? "Ενεργοποίηση..."
                              : "💶 Επιβεβαίωση Πληρωμής & Ενεργοποίηση"}
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() => handleRejectApplication(app)}
                            className="px-3 py-2 bg-card hover:bg-red-50 text-red-600 border border-red-200 font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                          >
                            Ακύρωση
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* --- 2. ΚΕΝΤΡΙΚΟΣ ΕΛΕΓΧΟΣ (ΚΑΙΡΟΣ & AUTOMATIONS) --- */}
        <section className="bg-card border border-border-theme p-6 rounded-3xl shadow-sm space-y-4">
          <h2 className="text-base font-bold">
            ⚙️ Κεντρικός Έλεγχος Πλατφόρμας (Global Automations)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-subtle rounded-2xl border border-border-theme flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">🌧️ Προσομοίωση Βροχής</h3>
                <p className="text-xs text-text-muted mt-1">
                  Ενεργοποιεί μαζικά τα &quot;Weather Deals&quot; στους πελάτες.
                </p>
              </div>
              <button
                onClick={() =>
                  toggleSystemSetting("isRaining", systemSettings.isRaining)
                }
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  systemSettings.isRaining
                    ? "bg-sky-600 text-white"
                    : "bg-card border border-border-theme"
                }`}
              >
                {systemSettings.isRaining ? "ON (Βρέχει)" : "OFF"}
              </button>
            </div>

            <div className="p-4 bg-subtle rounded-2xl border border-border-theme flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">💌 &quot;Miss You&quot; Κουπόνι</h3>
                <p className="text-xs text-text-muted mt-1">
                  Εμφανίζει το banner επιστροφής πελατών.
                </p>
              </div>
              <button
                onClick={() =>
                  toggleSystemSetting(
                    "globalMissYou",
                    systemSettings.globalMissYou
                  )
                }
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  systemSettings.globalMissYou
                    ? "bg-purple-600 text-white"
                    : "bg-card border border-border-theme"
                }`}
              >
                {systemSettings.globalMissYou ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        </section>

        {/* --- 3. ΧΕΙΡΟΚΙΝΗΤΗ ΔΗΜΙΟΥΡΓΙΑ --- */}
        <section className="bg-card border border-border-theme p-6 rounded-3xl shadow-sm space-y-4">
          <h2 className="text-base font-bold">
            ➕ Χειροκίνητη Δημιουργία Συνεργάτη & Καταστήματος
          </h2>
          <form
            onSubmit={handleCreatePartnerAndVenue}
            className="bg-subtle p-5 rounded-2xl border border-border-theme space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <input
                required
                type="text"
                placeholder="Επωνυμία Επιχείρησης *"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border-theme bg-card"
              />
              <input
                required
                type="email"
                placeholder="Email Συνεργάτη *"
                value={newMerchantEmail}
                onChange={(e) => setNewMerchantEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border-theme bg-card"
              />
              <input
                required
                type="text"
                minLength={6}
                placeholder="Αρχικός Κωδικός *"
                value={newMerchantPassword}
                onChange={(e) => setNewMerchantPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border-theme bg-card"
              />
              <input
                required
                type="text"
                placeholder="Όνομα Καταστήματος *"
                value={newVenueName}
                onChange={(e) => setNewVenueName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border-theme bg-card"
              />
              <input
                required
                type="text"
                placeholder="Περιοχή *"
                value={newVenueArea}
                onChange={(e) => setNewVenueArea(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border-theme bg-card"
              />
              <div className="flex gap-2">
                <input
                  required
                  type="text"
                  placeholder="Κατηγορία"
                  value={newVenueCategory}
                  onChange={(e) => setNewVenueCategory(e.target.value)}
                  className="w-2/3 px-3 py-2 rounded-xl border border-border-theme bg-card"
                />
                <input
                  required
                  type="number"
                  min={10}
                  placeholder="Τιμή €"
                  value={newMonthlyPrice}
                  onChange={(e) => setNewMonthlyPrice(Number(e.target.value))}
                  className="w-1/3 px-3 py-2 rounded-xl border border-border-theme bg-card"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-brand text-white font-bold rounded-xl disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting
                ? "Καταχώριση..."
                : "+ Δημιουργία Συνεργάτη & Καταστήματος"}
            </button>
          </form>
        </section>

        {/* --- 4. ΕΓΓΕΓΡΑΜΜΕΝΑ ΚΑΤΑΣΤΗΜΑΤΑ --- */}
        <section className="bg-card border border-border-theme p-6 rounded-3xl shadow-sm space-y-4">
          <h2 className="text-base font-bold">🏢 Εγγεγραμμένα Καταστήματα</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-theme uppercase text-[10px] tracking-wider text-text-muted">
                  <th className="py-3 px-3">Κατάστημα</th>
                  <th className="py-3 px-3">Περιοχή</th>
                  <th className="py-3 px-3">Email Συνεργάτη</th>
                  <th className="py-3 px-3">Συνδρομή</th>
                  <th className="py-3 px-3 text-right">Ενέργειες</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-theme">
                {venues.map((v) => {
                  const status =
                    v.subscription?.status || v.subscriptionStatus || "active";
                  const isPublished = v.isPublished !== false && status === "active";
                  const planText = v.subscription?.planLabel || "Μηνιαίο";
                  const price = v.subscription?.price ?? v.monthlyPrice ?? 49;
                  const validUntil = v.subscription?.validUntil || v.validUntil;

                  return (
                    <tr key={v.id} className="hover:bg-subtle/50 transition">
                      <td className="py-3 px-3 font-bold">{v.name}</td>
                      <td className="py-3 px-3 text-text-muted">{v.area}</td>
                      <td className="py-3 px-3 font-mono">
                        {v.ownerEmail || "—"}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isPublished
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {isPublished
                            ? `✓ ${planText} (${price}€)${validUntil ? ` • έως ${validUntil}` : ""}`
                            : "⚠️ Σε Αναστολή"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button
                          onClick={() => toggleVenueSubscription(v)}
                          className="px-2.5 py-1.5 bg-subtle rounded-lg border border-border-theme font-medium cursor-pointer"
                        >
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