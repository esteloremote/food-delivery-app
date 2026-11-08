"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { VIBE_OPTIONS } from "@/app/page";
import type { TableStatus } from "@/components/VenueMap";

interface VenueDoc {
  id: string;
  name: string;
  slug: string;
  area?: string;
  tableStatus?: TableStatus;
  takeawayReady?: boolean;
  panicDealActive?: boolean;
  panicDealText?: string;
  vibeTags?: string[];
}

interface SlotDeal {
  id: string;
  venueId?: string;
  venueName: string;
  timeWindow: string;
  discount: string;
  availableTables: number;
  totalTables: number;
  dayOfWeek?: string;
}

interface BookingRecord {
  id: string;
  ticketCode: string;
  venueName: string;
  timeWindow: string;
  discount: string;
  partySize: number;
  date: string;
  status: "confirmed" | "used" | "checked_in" | "cancelled";
  orderMode?: "dine-in" | "takeaway";
}

interface SubscriptionInfo {
  status: "active" | "past_due" | "canceled" | "trial";
  planName?: string;
  validUntil?: string;
}

const DAYS_OF_WEEK = [
  { key: "Δευτέρα", short: "Δευ" },
  { key: "Τρίτη", short: "Τρί" },
  { key: "Τετάρτη", short: "Τετ" },
  { key: "Πέμπτη", short: "Πέμ" },
  { key: "Παρασκευή", short: "Παρ" },
  { key: "Σάββατο", short: "Σάβ" },
  { key: "Κυριακή", short: "Κυρ" },
];

const TIME_OPTIONS = [
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30", "23:00", "23:30", "00:00"
];

const DISCOUNT_PRESETS = ["-20%", "-30%", "-40%", "-50%"];

function timeToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function isTimeOverlapping(windowA: string, windowB: string): boolean {
  const [startAStr, endAStr] = windowA.split("-");
  const [startBStr, endBStr] = windowB.split("-");
  if (!startAStr || !endAStr || !startBStr || !endBStr) return false;

  const startA = timeToMinutes(startAStr);
  const endA = timeToMinutes(endAStr);
  const startB = timeToMinutes(startBStr);
  const endB = timeToMinutes(endBStr);

  return Math.max(startA, startB) < Math.min(endA, endB);
}

export default function MerchantDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorizedMerchant, setIsAuthorizedMerchant] = useState<boolean | null>(null);

  // Subscription State (Συνδρομή)
  const [subscription, setSubscription] = useState<SubscriptionInfo>({
    status: "active", // default active για demo/existing, ελέγχεται παρακάτω
    planName: "HappySeats Monthly Business",
    validUntil: "30/11/2026",
  });

  const [venues, setVenues] = useState<VenueDoc[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<VenueDoc | null>(null);
  const [venuesLoading, setVenuesLoading] = useState(true);

  const [selectedDay, setSelectedDay] = useState("Σήμερα");

  const [slots, setSlots] = useState<SlotDeal[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);

  // Φόρμα Δημιουργίας Slot
  const [startHour, setStartHour] = useState("18:00");
  const [endHour, setEndHour] = useState("20:00");
  const [discount, setDiscount] = useState("-30%");
  const [totalTables, setTotalTables] = useState(3);
  const [isCreatingSlot, setIsCreatingSlot] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Ειδοποίηση Νέας Κράτησης
  const [newBookingAlert, setNewBookingAlert] = useState<string | null>(null);
  const previousBookingsCount = useRef<number | null>(null);

  // 1. Auth & Subscription Check
  // 1. Αυστηρός έλεγχος: Είναι συνδεδεμένος ΚΑΙ είναι καταχωρημένος ως Merchant;
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAuthorizedMerchant(false);
        setAuthLoading(false);
        router.push("/merchant/login");
        return;
      }

      try {
        // Έλεγχος αν υπάρχει ο φάκελος του συνεργάτη στο Firestore
        const mSnap = await getDoc(doc(db, "merchants", user.uid));
        
        if (!mSnap.exists()) {
          // Ο χρήστης είναι συνδεδεμένος (π.χ. απλός πελάτης), αλλά ΔΕΝ είναι εγκεκριμένος merchant!
          setIsAuthorizedMerchant(false);
          setAuthLoading(false);
          return;
        }

        // Ο χρήστης είναι έγκυρος merchant
        setCurrentUser(user);
        setIsAuthorizedMerchant(true);

        const data = mSnap.data();
        if (data.subscription) {
          setSubscription({
            status: data.subscription.status || "active",
            planName: data.subscription.planName || "Monthly Business",
            validUntil: data.subscription.validUntil || "Ενεργή",
          });
        }
      } catch (err) {
        console.error("Σφάλμα ελέγχου merchant guard:", err);
        setIsAuthorizedMerchant(false);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  // 2. Real-time Venues του Εστιάτορα
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "venues"),
      where("ownerId", "==", currentUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: VenueDoc[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name || d.id,
          slug: data.slug || d.id,
          area: data.area || "",
          tableStatus: data.tableStatus || "plenty",
          takeawayReady: data.takeawayReady !== undefined ? Boolean(data.takeawayReady) : true,
          panicDealActive: Boolean(data.panicDealActive),
          panicDealText: data.panicDealText || "-30% Flash Fill-the-Table",
          vibeTags: Array.isArray(data.vibeTags) ? data.vibeTags : [],
        });
      });
      setVenues(list);
      setVenuesLoading(false);

      if (list.length > 0) {
        const savedId =
          typeof window !== "undefined"
            ? localStorage.getItem("happyseats_merchant_venueId")
            : null;
        const matched = list.find((v) => v.id === savedId) || list[0];
        setSelectedVenue(matched);
      } else {
        setSelectedVenue(null);
      }
    });

    return () => unsub();
  }, [currentUser]);

  // 3. Real-time Slots
  useEffect(() => {
    if (!selectedVenue) return;

    const q = query(
      collection(db, "slots"),
      where("venueName", "==", selectedVenue.name)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: SlotDeal[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as Omit<SlotDeal, "id">) });
      });
      setSlots(list);
    });

    return () => unsub();
  }, [selectedVenue]);

  // 4. Real-time Bookings & Ήχος Καμπανάκι
  useEffect(() => {
    if (!selectedVenue) return;

    const q = query(
      collection(db, "bookings"),
      where("venueName", "==", selectedVenue.name)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: BookingRecord[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as Omit<BookingRecord, "id">) });
      });

      if (
        previousBookingsCount.current !== null &&
        list.length > previousBookingsCount.current
      ) {
        const latest = list[list.length - 1];
        setNewBookingAlert(`Νέα κράτηση: ${latest.ticketCode} (${latest.partySize} άτομα, ${latest.timeWindow})!`);
        
        try {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
          }
        } catch {
          // ignore
        }
      }

      previousBookingsCount.current = list.length;
      setBookings(list);
    });

    return () => unsub();
  }, [selectedVenue]);

  const stats = useMemo(() => {
    const totalBookings = bookings.length;
    const totalGuests = bookings.reduce((acc, b) => acc + (b.partySize || 0), 0);
    const checkedInCount = bookings.filter(
      (b) => b.status === "used" || b.status === "checked_in"
    ).length;
    const checkInRate =
      totalBookings > 0 ? Math.round((checkedInCount / totalBookings) * 100) : 0;

    return { totalBookings, totalGuests, checkedInCount, checkInRate };
  }, [bookings]);

  // 1-Tap Ενημέρωση Βάρδιας (Μόνο από τον καταστηματάρχη)
  const updateShiftLive = async (updates: Partial<VenueDoc>) => {
    if (!selectedVenue) return;
    try {
      await updateDoc(doc(db, "venues", selectedVenue.id), updates);
      setSelectedVenue((prev) => (prev ? { ...prev, ...updates } : null));
    } catch (err) {
      console.error("Σφάλμα ενημέρωσης βάρδιας:", err);
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVenue) return;
    setFormError(null);

    // Subscription Guard
    if (subscription.status !== "active") {
      setFormError("Απαιτείται ενεργή συνδρομή για τη δημιουργία νέων χρονοθυρίδων.");
      return;
    }

    if (slots.length >= 6) {
      setFormError("Έχετε φτάσει το μέγιστο όριο slots (6 ενεργά slots).");
      return;
    }

    const startMin = timeToMinutes(startHour);
    const endMin = timeToMinutes(endHour);

    if (endMin <= startMin) {
      setFormError("Η ώρα λήξης πρέπει να είναι μεταγενέστερη της ώρας έναρξης.");
      return;
    }

    const newWindow = `${startHour} - ${endHour}`;

    const hasOverlap = slots.some((s) => isTimeOverlapping(s.timeWindow, newWindow));
    if (hasOverlap) {
      setFormError(
        `Το διάστημα ${newWindow} επικαλύπτει υπάρχουσα χρονοθυρίδα! Δεν επιτρέπονται επικαλυπτόμενες ώρες.`
      );
      return;
    }

    setIsCreatingSlot(true);
    try {
      await addDoc(collection(db, "slots"), {
        venueId: selectedVenue.id,
        venueName: selectedVenue.name,
        timeWindow: newWindow,
        discount,
        totalTables: Number(totalTables),
        availableTables: Number(totalTables),
        dayOfWeek: selectedDay,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      setFormError("Σφάλμα δημιουργίας χρονοθυρίδας.");
    } finally {
      setIsCreatingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Θέλετε σίγουρα να διαγράψετε αυτή τη χρονοθυρίδα;")) return;
    try {
      await deleteDoc(doc(db, "slots", slotId));
    } catch (err) {
      console.error(err);
    }
  };

  // 1. Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface text-text-muted flex items-center justify-center text-sm">
        Έλεγχος διαπιστευτηρίων καταστηματάρχη...
      </div>
    );
  }

  // 2. Μπλοκάρισμα αν δεν είναι εγκεκριμένος merchant
  if (isAuthorizedMerchant === false) {
    return (
      <div className="min-h-screen bg-surface text-text-main flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center text-2xl font-bold shadow-sm">
          🚫
        </div>
        <h1 className="text-xl font-black text-text-main">Μη Εξουσιοδοτημένη Πρόσβαση</h1>
        <p className="text-xs text-text-muted text-center max-w-sm">
          Ο λογαριασμός σας δεν είναι καταχωρημένος ως συνεργάτης εστίασης. Η πρόσβαση στο Merchant Dashboard επιτρέπεται μόνο σε εξουσιοδοτημένα καταστήματα.
        </p>
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              signOut(auth);
              router.push("/merchant/login");
            }}
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Σύνδεση με Εταιρικό Λογαριασμό
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-subtle hover:bg-border-theme text-text-main rounded-xl text-xs font-semibold transition border border-border-theme"
          >
            Αρχική Σελίδα
          </Link>
        </div>
      </div>
    );
  }

  if (venuesLoading) {
    return (
      <div className="min-h-screen bg-surface text-text-muted flex items-center justify-center text-sm">
        Φόρτωση στοιχείων καταστήματος...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-text-main p-6">
      {/* Top Header */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-border-theme gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-brand-text font-bold">
              Merchant Operations
            </span>
            <span className="text-[10px] bg-subtle text-text-muted font-medium px-2 py-0.5 rounded-full border border-border-theme">
              {currentUser?.email}
            </span>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                subscription.status === "active"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {subscription.status === "active" ? "✓ Συνδρομή Ενεργή" : "⚠️ Ανενεργή Συνδρομή"}
            </span>
          </div>
          <h1 className="text-2xl font-black text-text-main mt-1">
            {selectedVenue?.name || "Merchant Dashboard"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedVenue?.id || ""}
            onChange={(e) => {
              const v = venues.find((item) => item.id === e.target.value);
              if (v) {
                setSelectedVenue(v);
                localStorage.setItem("happyseats_merchant_venueId", v.id);
                localStorage.setItem("happyseats_merchant_venueName", v.name);
              }
            }}
            className="bg-card border border-border-theme text-brand-text font-bold text-xs rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer shadow-sm"
          >
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                📍 {v.name}
              </option>
            ))}
          </select>

          <Link
            href="/merchant/scan"
            className="px-4 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>📷</span> Scanner Κάμερας
          </Link>

          <Link
            href="/merchant/profile"
            className="px-3.5 py-2.5 bg-card hover:bg-subtle text-text-main border border-border-theme text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span>⚙️</span> Προφίλ & Ρυθμίσεις
          </Link>

          <button
            onClick={() => signOut(auth)}
            className="px-3 py-2.5 bg-card hover:bg-red-50 text-text-muted hover:text-red-600 border border-border-theme rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
          >
            Αποσύνδεση
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 space-y-6">
        {/* Banner Ειδοποίησης Νέας Κράτησης */}
        {newBookingAlert && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-400 text-emerald-800 rounded-2xl flex items-center justify-between shadow-sm animate-pulse">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span>🔔</span> {newBookingAlert}
            </div>
            <button
              onClick={() => setNewBookingAlert(null)}
              className="text-xs text-text-muted hover:text-text-main px-2 py-1 rounded-lg cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Subscription Guard Notice (Αν η συνδρομή έχει λήξει) */}
        {subscription.status !== "active" && (
          <div className="p-5 bg-red-50 border-2 border-red-300 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-red-800 text-sm">⚠️ Η μηνιαία συνδρομή σας δεν είναι ενεργή</h3>
              <p className="text-xs text-red-600 mt-0.5">
                Τα τραπέζια του καταστήματός σας έχουν τεθεί προσωρινά σε παύση. Ανανεώστε τη συνδρομή σας για να συνεχίσετε να δέχεστε κρατήσεις.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch("/api/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      merchantId: currentUser?.uid,
                      merchantEmail: currentUser?.email,
                      venueName: selectedVenue?.name,
                      monthlyPrice: 49,
                    }),
                  });
                  const data = await res.json();
                  if (data.url) {
                    window.location.href = data.url; // Ανακατεύθυνση στη σελίδα κάρτας της Stripe
                  } else {
                    alert(data.error || "Σφάλμα εκκίνησης πληρωμής.");
                  }
                } catch (err) {
                  console.error(err);
                  alert("Σφάλμα σύνδεσης με την πύλη πληρωμών.");
                }
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm shrink-0 cursor-pointer"
            >
              Ανανέωση Συνδρομής (49€/μήνα) →
            </button>
          </div>
        )}

        {/* 1-TAP ΚΟΝΣΟΛΑ ΒΑΡΔΙΑΣ (ΑΠΟΚΛΕΙΣΤΙΚΑ ΕΔΩ ΣΤΟ DASHBOARD ΤΟΥ ΕΣΤΙΑΤΟΡΑ) */}
        {selectedVenue && (
          <section className="p-5 bg-card border-2 border-brand rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-theme pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-brand text-white px-2 py-0.5 rounded-md">
                  1-TAP ΚΟΝΣΟΛΑ ΒΑΡΔΙΑΣ
                </span>
                <h3 className="text-base font-bold text-text-main mt-1">
                  Ζωντανή Πληρότητα & Panic Button ({selectedVenue.name})
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => updateShiftLive({ tableStatus: "plenty" })}
                className={`py-3 px-4 rounded-2xl font-black text-xs border transition cursor-pointer ${
                  selectedVenue.tableStatus === "plenty"
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                    : "bg-subtle text-text-main border-border-theme hover:border-emerald-500"
                }`}
              >
                🟢 ΑΝΕΤΟ (Διαθέσιμα Τραπέζια)
              </button>

              <button
                onClick={() => updateShiftLive({ tableStatus: "few" })}
                className={`py-3 px-4 rounded-2xl font-black text-xs border transition cursor-pointer ${
                  selectedVenue.tableStatus === "few"
                    ? "bg-amber-400 text-neutral-950 border-amber-400 shadow-sm"
                    : "bg-subtle text-text-main border-border-theme hover:border-amber-400"
                }`}
              >
                🟠 1-3 ΤΡΑΠΕΖΙΑ (Σχεδόν Γεμάτο)
              </button>

              <button
                onClick={() => updateShiftLive({ tableStatus: "full" })}
                className={`py-3 px-4 rounded-2xl font-black text-xs border transition cursor-pointer ${
                  selectedVenue.tableStatus === "full"
                    ? "bg-red-500 text-white border-red-500 shadow-sm"
                    : "bg-subtle text-text-main border-border-theme hover:border-red-500"
                }`}
              >
                🔴 ΠΛΗΡΕΣ (Μόνο Takeaway)
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() =>
                    updateShiftLive({ panicDealActive: !selectedVenue.panicDealActive })
                  }
                  className={`px-4 py-2.5 rounded-xl font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                    selectedVenue.panicDealActive
                      ? "bg-red-600 text-white animate-pulse"
                      : "bg-subtle hover:bg-red-50 text-red-600 border border-red-200"
                  }`}
                >
                  🔥{" "}
                  {selectedVenue.panicDealActive
                    ? "PANIC DEAL ΕΝΕΡΓΟ (-30% για 1 ώρα)"
                    : "Ενεργοποίηση Panic Deal (-30% στα επόμενα 3 τραπέζια)"}
                </button>

                <button
                  onClick={() =>
                    updateShiftLive({ takeawayReady: !selectedVenue.takeawayReady })
                  }
                  className={`px-3.5 py-2.5 rounded-xl font-bold text-xs border transition cursor-pointer ${
                    selectedVenue.takeawayReady
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-subtle text-text-muted border-border-theme"
                  }`}
                >
                  🛍️ Take-away: {selectedVenue.takeawayReady ? "ON" : "OFF"}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {VIBE_OPTIONS.map((tag) => {
                  const hasTag = (selectedVenue.vibeTags || []).includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => {
                        const currentTags = selectedVenue.vibeTags || [];
                        const updatedTags = hasTag
                          ? currentTags.filter((t) => t !== tag)
                          : [...currentTags, tag];
                        updateShiftLive({ vibeTags: updatedTags });
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition cursor-pointer ${
                        hasTag
                          ? "bg-brand-light text-brand-text border-brand-border"
                          : "bg-subtle text-text-muted border-border-theme"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Εβδομαδιαίο Ημερολόγιο */}
        <section className="bg-card border border-border-theme p-4 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              📅 Εβδομαδιαίος Προγραμματισμός
            </span>
            <span className="text-xs text-brand-text font-bold">
              Επιλεγμένη ημέρα: {selectedDay}
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            <button
              type="button"
              onClick={() => setSelectedDay("Σήμερα")}
              className={`py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer ${
                selectedDay === "Σήμερα"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-subtle text-text-muted hover:bg-card border border-border-theme"
              }`}
            >
              ⚡ Σήμερα
            </button>

            {DAYS_OF_WEEK.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setSelectedDay(d.key)}
                className={`py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer ${
                  selectedDay === d.key
                    ? "bg-brand text-white shadow-sm"
                    : "bg-subtle text-text-muted hover:bg-card border border-border-theme"
                }`}
              >
                {d.short}
              </button>
            ))}
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border-theme p-5 rounded-3xl shadow-sm">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
              Κρατήσεις Σήμερα
            </span>
            <div className="text-3xl font-black text-text-main mt-2">
              {stats.totalBookings}
            </div>
            <span className="text-[11px] text-brand-text font-medium mt-1 block">
              ⚡ Ενεργή ζήτηση
            </span>
          </div>

          <div className="bg-card border border-border-theme p-5 rounded-3xl shadow-sm">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
              Συνολικοί Επισκέπτες
            </span>
            <div className="text-3xl font-black text-text-main mt-2">
              {stats.totalGuests}
            </div>
            <span className="text-[11px] text-text-muted mt-1 block">
              👥 Άτομα συνολικά
            </span>
          </div>

          <div className="bg-card border border-border-theme p-5 rounded-3xl shadow-sm">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
              Προσέλευση (Check-in)
            </span>
            <div className="text-3xl font-black text-emerald-600 mt-2">
              {stats.checkedInCount}{" "}
              <span className="text-sm text-text-muted font-normal">
                ({stats.checkInRate}%)
              </span>
            </div>
            <span className="text-[11px] text-emerald-700 mt-1 block font-medium">
              ✓ Επιβεβαιωμένες αφίξεις
            </span>
          </div>

          <div className="bg-card border border-border-theme p-5 rounded-3xl shadow-sm">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
              Ενεργά Slots ({selectedDay})
            </span>
            <div className="text-3xl font-black text-brand-text mt-2">
              {slots.length} <span className="text-xs text-text-muted font-normal">/ 6 max</span>
            </div>
            <span className="text-[11px] text-text-muted mt-1 block">
              🕒 Χρονοθυρίδες
            </span>
          </div>
        </section>

        {/* 2-Column Content */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <section className="bg-card border border-border-theme p-6 md:p-8 rounded-3xl shadow-sm space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                    <span>⚡</span> Άνοιγμα Χρονοθυρίδας ({selectedDay})
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Αυτοματοποιημένη επιλογή 24ώρου και ποσοστών έκπτωσης.
                  </p>
                </div>
                <span className="text-xs bg-subtle px-3 py-1 rounded-full text-text-main font-mono font-bold border border-border-theme">
                  {slots.length}/6 slots
                </span>
              </div>

              <form onSubmit={handleCreateSlot} className="bg-subtle p-5 rounded-2xl border border-border-theme space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-text-muted font-medium mb-1">
                      Ώρα Έναρξης (24ωρο)
                    </label>
                    <select
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                      className="w-full bg-card border border-border-theme rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-brand cursor-pointer shadow-sm"
                    >
                      {TIME_OPTIONS.slice(0, -1).map((t) => (
                        <option key={`start-${t}`} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-text-muted font-medium mb-1">
                      Ώρα Λήξης (24ωρο)
                    </label>
                    <select
                      value={endHour}
                      onChange={(e) => setEndHour(e.target.value)}
                      className="w-full bg-card border border-border-theme rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-brand cursor-pointer shadow-sm"
                    >
                      {TIME_OPTIONS.slice(1).map((t) => (
                        <option key={`end-${t}`} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-text-muted font-medium mb-1.5">
                    Ποσοστό Έκπτωσης
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {DISCOUNT_PRESETS.map((disc) => (
                      <button
                        key={disc}
                        type="button"
                        onClick={() => setDiscount(disc)}
                        className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                          discount === disc
                            ? "bg-brand text-white border-brand shadow-sm"
                            : "bg-card text-text-main border-border-theme hover:border-text-muted"
                        }`}
                      >
                        {disc}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-text-muted font-medium mb-1">
                    Αριθμός Διαθέσιμων Τραπεζιών
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    required
                    value={totalTables}
                    onChange={(e) => setTotalTables(Number(e.target.value))}
                    className="w-full bg-card border border-border-theme rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-brand shadow-sm"
                  />
                </div>

                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold">
                    ✕ {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isCreatingSlot || slots.length >= 6}
                  className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-xs transition disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isCreatingSlot ? "Προσθήκη..." : `+ Άνοιγμα Slot (${startHour} - ${endHour} | ${discount})`}
                </button>
              </form>

              {slots.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-muted italic bg-subtle rounded-2xl border border-border-theme">
                  Δεν υπάρχουν ενεργές χρονοθυρίδες για το {selectedVenue?.name}.
                </div>
              ) : (
                <div className="space-y-3">
                  {slots.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 bg-card border border-border-theme rounded-2xl flex items-center justify-between hover:border-text-muted transition shadow-sm"
                    >
                      <div>
                        <div className="text-sm font-bold text-text-main flex items-center gap-2">
                          {s.timeWindow}
                          <span className="text-xs text-brand-text font-bold">
                            ({s.discount})
                          </span>
                        </div>
                        <div className="text-xs text-text-muted mt-1">
                          Διαθέσιμα: <strong className="text-text-main">{s.availableTables}</strong> / {s.totalTables} τραπέζια
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(s.id)}
                        className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer font-medium"
                      >
                        Διαγραφή
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <section className="bg-card border border-border-theme p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-border-theme">
                <div>
                  <h3 className="font-bold text-text-main text-base flex items-center gap-2">
                    <span>📋</span> Ροή Κρατήσεων
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {bookings.length} κρατήσεις καταγεγραμμένες
                  </p>
                </div>
                <Link
                  href="/merchant/scan"
                  className="text-xs font-bold text-brand-text hover:underline cursor-pointer"
                >
                  Scanner →
                </Link>
              </div>

              {bookings.length === 0 ? (
                <div className="text-center py-12 text-xs text-text-muted italic">
                  Δεν υπάρχουν καταχωρημένες κρατήσεις ακόμα.
                </div>
              ) : (
                <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                  {bookings.map((b) => {
                    const isCheckedIn =
                      b.status === "used" || b.status === "checked_in";

                    return (
                      <div
                        key={b.id}
                        className={`p-4 rounded-2xl border transition space-y-2 text-xs ${
                          isCheckedIn
                            ? "bg-subtle/50 border-border-theme opacity-60"
                            : "bg-card border-border-theme shadow-sm"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-brand-text text-sm">
                            {b.ticketCode}
                          </span>
                          <span
                            className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                              isCheckedIn
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-brand-light text-brand-text border border-brand-border"
                            }`}
                          >
                            {isCheckedIn ? "✓ Checked-In" : "Αναμονή"}
                          </span>
                        </div>

                        <div className="text-text-main space-y-0.5">
                          <div>
                            Ώρα: <strong className="text-text-main">{b.timeWindow}</strong>
                          </div>
                          <div>
                            Άτομα: <strong className="text-text-main">{b.partySize}</strong> | Έκπτωση:{" "}
                            <strong className="text-brand-text">{b.discount}</strong>
                          </div>
                          <div className="text-[10px] text-text-muted">
                            Ημερομηνία: {b.date}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}