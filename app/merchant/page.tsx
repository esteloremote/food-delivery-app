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
  getDocs,
  updateDoc,
  setDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { VIBE_OPTIONS } from "@/app/page";
import type { TableStatus } from "@/components/VenueMap";
import { PLAN_LIST, SUBSCRIPTION_PLANS, SubscriptionPlanId } from "@/lib/plans";

interface MerchantProfile {
  companyName?: string;
  vatNumber?: string;
  taxOffice?: string;
  contactName?: string;
  phone?: string;
  email?: string;
}

interface VenueSubscription {
  plan?: SubscriptionPlanId;
  planLabel?: string;
  status: "active" | "past_due" | "canceled" | "trial";
  price?: number;
  validUntil?: string;
}

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
  rainAutoDeal?: boolean;
  missYouCampaign?: boolean;
  bountyActive?: boolean;
  bountyText?: string;
  isPublished?: boolean;
  subscriptionStatus?: "active" | "past_due" | "canceled";
  monthlyPrice?: number;
  validUntil?: string;
  subscription?: VenueSubscription;
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
  isVipOnly?: boolean;
  isBounty?: boolean;
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
  customerId?: string;
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
  "21:00", "21:30", "22:00", "22:30", "23:00", "23:30", "00:00",
];

const DISCOUNT_PRESETS = ["-20%", "-30%", "-40%", "-50%"];

const CATEGORIES = [
  "Ελληνική Ταβέρνα",
  "Εστιατόριο / Bistro",
  "Καφέ / Brunch",
  "Cocktail Bar / Wine Bar",
  "Street Food / Burger",
  "Ιταλικό / Pizza",
  "Ασιατικό / Sushi",
  "Άλλο",
];

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
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfile | null>(null);

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
  const [isVipOnly, setIsVipOnly] = useState(false);
  const [isCreatingSlot, setIsCreatingSlot] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Ειδοποίηση Νέας Κράτησης ή Αυτοματισμού
  const [newBookingAlert, setNewBookingAlert] = useState<string | null>(null);
  const previousBookingsCount = useRef<number | null>(null);

  // Modal Προσθήκης Νέου Καταστήματος (2ο, 3ο κ.λπ.)
  const [showAddVenueModal, setShowAddVenueModal] = useState(false);
  const [addVenueName, setAddVenueName] = useState("");
  const [addVenueArea, setAddVenueArea] = useState("");
  const [addVenueAddress, setAddVenueAddress] = useState("");
  const [addVenueCategory, setAddVenueCategory] = useState(CATEGORIES[0]);
  const [addVenuePlan, setAddVenuePlan] = useState<SubscriptionPlanId>("biannual");
  const [submittingVenue, setSubmittingVenue] = useState(false);

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
        const mSnap = await getDoc(doc(db, "merchants", user.uid));
        let merchantData = mSnap.exists() ? mSnap.data() : null;

        if (!merchantData && user.email) {
          const qEmail = query(
            collection(db, "merchants"),
            where("email", "==", user.email.toLowerCase().trim())
          );
          const emailSnap = await getDocs(qEmail);
          if (!emailSnap.empty) {
            merchantData = emailSnap.docs[0].data();
          }
        }

        if (!merchantData) {
          setIsAuthorizedMerchant(false);
          setAuthLoading(false);
          return;
        }

        setCurrentUser(user);
        setIsAuthorizedMerchant(true);
        setMerchantProfile({
          companyName: merchantData.companyName || "",
          vatNumber: merchantData.vatNumber || "",
          taxOffice: merchantData.taxOffice || "",
          contactName: merchantData.contactName || user.displayName || "",
          phone: merchantData.phone || "",
          email: merchantData.email || user.email || "",
        });
      } catch (err) {
        console.error("Σφάλμα ελέγχου merchant guard:", err);
        setIsAuthorizedMerchant(false);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  // 2. Real-time Venues του Εστιάτορα (Multi-Venue)
  useEffect(() => {
    if (!currentUser) return;

    const unsub = onSnapshot(
      collection(db, "venues"),
      (snap) => {
        const list: VenueDoc[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const matchesOwner =
            data.ownerId === currentUser.uid ||
            (currentUser.email &&
              data.ownerEmail?.toLowerCase().trim() ===
                currentUser.email.toLowerCase().trim());

          if (!matchesOwner) return;

          list.push({
            id: d.id,
            name: data.name || d.id,
            slug: data.slug || d.id,
            area: data.area || "",
            tableStatus: data.tableStatus || "plenty",
            takeawayReady:
              data.takeawayReady !== undefined ? Boolean(data.takeawayReady) : true,
            panicDealActive: Boolean(data.panicDealActive),
            panicDealText: data.panicDealText || "-30% Last-Minute Table (30')",
            vibeTags: Array.isArray(data.vibeTags) ? data.vibeTags : [],
            rainAutoDeal: Boolean(data.rainAutoDeal),
            missYouCampaign: Boolean(data.missYouCampaign),
            bountyActive: Boolean(data.bountyActive),
            bountyText: data.bountyText || "-40% + Δωρεάν Ορεκτικό (Bounty 10')",
            isPublished: data.isPublished !== undefined ? Boolean(data.isPublished) : true,
            subscriptionStatus: data.subscriptionStatus || "active",
            monthlyPrice: data.monthlyPrice || 49,
            validUntil: data.validUntil || "",
            subscription: data.subscription,
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
      },
      (err) => {
        if (err.code !== "permission-denied") console.error(err);
      }
    );

    return () => unsub();
  }, [currentUser]);

  // 3. Real-time Slots για το επιλεγμένο κατάστημα
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
    previousBookingsCount.current = null;

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
        setNewBookingAlert(
          `Νέα κράτηση: ${latest.ticketCode} (${latest.partySize} άτομα, ${latest.timeWindow})!`
        );

        try {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
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

  // Στοιχεία συνδρομής για το ΕΠΙΛΕΓΜΕΝΟ κατάστημα
  const activeVenueSub = useMemo(() => {
    const status =
      selectedVenue?.subscription?.status ||
      selectedVenue?.subscriptionStatus ||
      "active";
    const planLabel = selectedVenue?.subscription?.planLabel || "Μηνιαίο";
    const price =
      selectedVenue?.subscription?.price ?? selectedVenue?.monthlyPrice ?? 49;
    const validUntil =
      selectedVenue?.subscription?.validUntil || selectedVenue?.validUntil || "";
    const isActive = status === "active" && selectedVenue?.isPublished !== false;

    return { status, planLabel, price, validUntil, isActive };
  }, [selectedVenue]);

  // Smart Analytics
  const stats = useMemo(() => {
    const totalBookings = bookings.length;
    const totalGuests = bookings.reduce((acc, b) => acc + (b.partySize || 0), 0);
    const checkedInCount = bookings.filter(
      (b) => b.status === "used" || b.status === "checked_in"
    ).length;
    const checkInRate =
      totalBookings > 0 ? Math.round((checkedInCount / totalBookings) * 100) : 0;
    const noShows = bookings.filter((b) => b.status === "cancelled").length;

    const hoursCount: Record<string, number> = {};
    bookings.forEach((b) => {
      hoursCount[b.timeWindow] = (hoursCount[b.timeWindow] || 0) + 1;
    });
    const peakHour =
      Object.keys(hoursCount).sort((a, b) => hoursCount[b] - hoursCount[a])[0] ||
      "-";

    return {
      totalBookings,
      totalGuests,
      checkedInCount,
      checkInRate,
      noShows,
      peakHour,
    };
  }, [bookings]);

  // Εκκίνηση Πληρωμής Συνδρομής μέσω Stripe Checkout (για το επιλεγμένο κατάστημα)
  const handleStripeCheckout = async () => {
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId: currentUser?.uid,
          merchantEmail: currentUser?.email,
          venueId: selectedVenue?.id,
          venueName: selectedVenue?.name || "Κατάστημα",
          monthlyPrice: activeVenueSub.price,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Σφάλμα εκκίνησης πληρωμής Stripe.");
      }
    } catch (err) {
      console.error(err);
      alert("Σφάλμα σύνδεσης με την πύλη πληρωμών Stripe.");
    }
  };

  // Υποβολή αίτησης για Προσθήκη Νέου Καταστήματος (με ξεχωριστή συνδρομή)
  const handleApplyNewVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubmittingVenue(true);

    const plan = SUBSCRIPTION_PLANS[addVenuePlan];
    const cleanEmail = (
      merchantProfile?.email ||
      currentUser.email ||
      ""
    ).toLowerCase();
    const paymentReference = `HS-${new Date().getFullYear()}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    try {
      await addDoc(collection(db, "partner_applications"), {
        companyName: merchantProfile?.companyName || "Υπάρχων Συνεργάτης",
        vatNumber: merchantProfile?.vatNumber || "—",
        taxOffice: merchantProfile?.taxOffice || "—",
        contactName:
          merchantProfile?.contactName || currentUser.displayName || "Συνεργάτης",
        phone: merchantProfile?.phone || "—",
        email: cleanEmail,
        venueName: addVenueName.trim(),
        venueArea: addVenueArea.trim(),
        venueAddress: addVenueAddress.trim(),
        venueCategory: addVenueCategory,
        notes: "Αίτημα προσθήκης επιπλέον καταστήματος από υπάρχοντα συνεργάτη.",
        planId: plan.id,
        planLabel: plan.label,
        durationMonths: plan.durationMonths,
        price: plan.price,
        paymentReference,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "application_received",
          to: cleanEmail,
          contactName: merchantProfile?.contactName || "Συνεργάτη",
          companyName: merchantProfile?.companyName || "",
          venueName: addVenueName.trim(),
          venueArea: addVenueArea.trim(),
          phone: merchantProfile?.phone,
          vatNumber: merchantProfile?.vatNumber,
          planLabel: plan.label,
          price: plan.price,
          paymentReference,
        }),
      });

      setShowAddVenueModal(false);
      setAddVenueName("");
      setAddVenueArea("");
      setAddVenueAddress("");
      setNewBookingAlert(
        `✓ Η αίτηση για το νέο κατάστημα "${addVenueName.trim()}" υποβλήθηκε! Θα λάβετε email μόλις προεγκριθεί.`
      );
    } catch (err) {
      console.error(err);
      alert("Σφάλμα κατά την υποβολή της αίτησης.");
    } finally {
      setSubmittingVenue(false);
    }
  };

  // 1-Tap Ενημέρωση Βάρδιας & Αυτοματισμών
  const updateShiftLive = async (updates: Partial<VenueDoc>) => {
    if (!selectedVenue) return;
    try {
      await updateDoc(doc(db, "venues", selectedVenue.id), updates);
      setSelectedVenue((prev) => (prev ? { ...prev, ...updates } : null));
    } catch (err) {
      console.error("Σφάλμα ενημέρωσης βάρδιας:", err);
    }
  };

  // #7: Ενεργοποίηση No-Show Bounty & Μηδενισμός Streak Πελάτη
  const handleTriggerBounty = async (booking?: BookingRecord) => {
    if (!selectedVenue) return;
    try {
      if (booking) {
        await updateDoc(doc(db, "bookings", booking.id), { status: "cancelled" });

        if (booking.customerId && booking.customerId !== "guest") {
          await setDoc(
            doc(db, "users", booking.customerId),
            { streak: 0 },
            { merge: true }
          );
        }
      }
      await updateShiftLive({
        bountyActive: true,
        bountyText: "-40% + Κερασμένο Ορεκτικό (No-Show Bounty 10')",
      });
      setNewBookingAlert(
        `🎯 NO-SHOW BOUNTY ΕΝΕΡΓΟ! Το σερί του πελάτη μηδενίστηκε.`
      );
    } catch (err) {
      console.error("Σφάλμα ενεργοποίησης Bounty:", err);
    }
  };

  const handlePushAlert = (slotWindow: string, slotDiscount: string) => {
    alert(
      `📡 Εστάλη Push Notification ("Βρέθηκε κενό τραπέζι (${slotWindow}) στο ${selectedVenue?.name} με ${slotDiscount}!") σε 42 πελάτες σε ακτίνα 1 χλμ.`
    );
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVenue) return;
    setFormError(null);

    if (!activeVenueSub.isActive) {
      setFormError(
        "Απαιτείται ενεργή συνδρομή για αυτό το κατάστημα ώστε να ανοίξετε νέες χρονοθυρίδες."
      );
      return;
    }

    if (slots.length >= 6) {
      setFormError("Έχετε φτάσει το μέγιστο όριο slots (6 ενεργά slots).");
      return;
    }

    const startMin = timeToMinutes(startHour);
    const endMin = timeToMinutes(endHour);

    if (endMin <= startMin) {
      setFormError(
        "Η ώρα λήξης πρέπει να είναι μεταγενέστερη της ώρας έναρξης."
      );
      return;
    }

    const newWindow = `${startHour} - ${endHour}`;

    const hasOverlap = slots.some((s) =>
      isTimeOverlapping(s.timeWindow, newWindow)
    );
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
        isVipOnly,
        createdAt: serverTimestamp(),
      });
      setIsVipOnly(false);
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface text-text-muted flex items-center justify-center text-sm">
        Έλεγχος διαπιστευτηρίων καταστηματάρχη...
      </div>
    );
  }

  if (isAuthorizedMerchant === false) {
    return (
      <div className="min-h-screen bg-surface text-text-main flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center text-2xl font-bold shadow-sm">
          🚫
        </div>
        <h1 className="text-xl font-black text-text-main">
          Μη Εξουσιοδοτημένη Πρόσβαση
        </h1>
        <p className="text-xs text-text-muted text-center max-w-sm">
          Ο λογαριασμός σας δεν είναι καταχωρημένος ως συνεργάτης εστίασης. Η
          πρόσβαση στο Merchant Dashboard επιτρέπεται μόνο σε εξουσιοδοτημένα
          καταστήματα.
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
            href="/merchant/apply"
            className="px-4 py-2 bg-subtle hover:bg-border-theme text-text-main rounded-xl text-xs font-semibold transition border border-border-theme"
          >
            Αίτηση Συνεργασίας
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-brand-text font-bold">
              {merchantProfile?.companyName || "Merchant Operations"}
            </span>
            <span className="text-[10px] bg-subtle text-text-muted font-medium px-2 py-0.5 rounded-full border border-border-theme">
              {currentUser?.email}
            </span>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                activeVenueSub.isActive
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {activeVenueSub.isActive
                ? `✓ ${activeVenueSub.planLabel}${
                    activeVenueSub.validUntil
                      ? ` • έως ${activeVenueSub.validUntil}`
                      : ""
                  }`
                : "⚠️ Ανενεργή Συνδρομή"}
            </span>
          </div>
          <h1 className="text-2xl font-black text-text-main mt-1">
            {selectedVenue?.name || "Merchant Dashboard"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {venues.length > 0 && (
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
              className="bg-card border-2 border-brand text-brand-text font-bold text-xs rounded-xl px-3 py-2 focus:outline-none cursor-pointer shadow-sm"
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  📍 {v.name} {v.area ? `(${v.area})` : ""}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setShowAddVenueModal(true)}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center gap-1 cursor-pointer"
          >
            <span>+</span> Νέο Κατάστημα
          </button>

          <button
            type="button"
            onClick={handleStripeCheckout}
            className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>💳</span> Συνδρομή Stripe ({activeVenueSub.price}€)
          </button>

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
          
          <Link
            href="/"
            className="px-3.5 py-2.5 bg-card hover:bg-subtle text-text-main border border-border-theme text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            ← Αρχική
          </Link>

        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 space-y-6">
        {/* Banner Ειδοποίησης Νέας Κράτησης, Bounty ή Αίτησης */}
        {newBookingAlert && (
          <div className="p-4 bg-amber-50 border-2 border-amber-400 text-amber-950 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
              <span>⚡</span> {newBookingAlert}
            </div>
            <button
              onClick={() => setNewBookingAlert(null)}
              className="text-xs text-neutral-600 hover:text-neutral-950 px-2 py-1 rounded-lg cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Subscription Guard Notice (Αν η συνδρομή του επιλεγμένου καταστήματος έχει λήξει) */}
        {selectedVenue && !activeVenueSub.isActive && (
          <div className="p-5 bg-red-50 border-2 border-red-300 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-red-800 text-sm">
                ⚠️ Η συνδρομή για το &quot;{selectedVenue.name}&quot; δεν είναι ενεργή
              </h3>
              <p className="text-xs text-red-600 mt-0.5">
                Τα τραπέζια αυτού του καταστήματος έχουν τεθεί προσωρινά σε παύση.
                Ανανεώστε τη συνδρομή του για να συνεχίσετε να δέχεστε κρατήσεις.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStripeCheckout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm shrink-0 cursor-pointer"
            >
              Ανανέωση Συνδρομής ({activeVenueSub.price}€) →
            </button>
          </div>
        )}

        {/* 1-TAP ΚΟΝΣΟΛΑ ΒΑΡΔΙΑΣ */}
        {selectedVenue && (
          <section className="p-5 bg-card border-2 border-brand rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-theme pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-brand text-white px-2 py-0.5 rounded-md">
                  1-TAP ΚΟΝΣΟΛΑ ΒΑΡΔΙΑΣ
                </span>
                <h3 className="text-base font-bold text-text-main mt-1">
                  Ζωντανή Πληρότητα, Flash Deals & No-Show Bounty ({selectedVenue.name})
                </h3>
              </div>
              <span className="text-xs text-text-muted">
                Καταστήματα στον λογαριασμό:{" "}
                <strong className="text-text-main">{venues.length}</strong>
              </span>
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
                    updateShiftLive({
                      panicDealActive: !selectedVenue.panicDealActive,
                      panicDealText: "-30% Last-Minute Table (30')",
                    })
                  }
                  className={`px-4 py-2.5 rounded-xl font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                    selectedVenue.panicDealActive
                      ? "bg-red-600 text-white animate-pulse"
                      : "bg-subtle hover:bg-red-50 text-red-600 border border-red-200"
                  }`}
                >
                  🔥{" "}
                  {selectedVenue.panicDealActive
                    ? "FLASH DEAL ΕΝΕΡΓΟ (-30% για 30')"
                    : "Ενεργοποίηση Flash Deal (30')"}
                </button>

                {/* #7 Κουμπί No-Show Bounty */}
                <button
                  onClick={() =>
                    updateShiftLive({
                      bountyActive: !selectedVenue.bountyActive,
                      bountyText: "-40% + Δωρεάν Ορεκτικό (No-Show Bounty 10')",
                    })
                  }
                  className={`px-4 py-2.5 rounded-xl font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                    selectedVenue.bountyActive
                      ? "bg-amber-400 text-neutral-950 border-2 border-neutral-950 animate-bounce"
                      : "bg-subtle hover:bg-amber-50 text-amber-700 border border-amber-300"
                  }`}
                >
                  🎯{" "}
                  {selectedVenue.bountyActive
                    ? "BOUNTY ΑΚΥΡΩΣΗΣ ΕΝΕΡΓΟ (10')"
                    : "No-Show Bounty (Αναπλήρωση σε 10')"}
                </button>

                <button
                  onClick={() =>
                    updateShiftLive({
                      takeawayReady: !selectedVenue.takeawayReady,
                    })
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

        {/* #5 & #6: SMART AUTOMATIONS (ΑΥΤΟΜΑΤΟΣ ΠΙΛΟΤΟΣ B2B) */}
        {selectedVenue && (
          <section className="p-5 bg-card border border-border-theme rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white px-2.5 py-0.5 rounded-md">
                  🤖 SMART AUTOMATIONS (ΑΥΤΟΜΑΤΟΣ ΠΙΛΟΤΟΣ B2B)
                </span>
                <h3 className="text-sm font-bold text-text-main mt-1">
                  Αυτόματη προσέλκυση πελατών χωρίς καμία δική σας ενέργεια
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* #5 Weather-Triggered Deals */}
              <div
                className={`p-4 rounded-2xl border transition flex items-start justify-between gap-4 ${
                  selectedVenue.rainAutoDeal
                    ? "bg-sky-500/10 border-sky-400"
                    : "bg-subtle border-border-theme"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌧️</span>
                    <h4 className="text-xs font-black text-text-main">
                      Αλγόριθμος Καιρού (Weather-Triggered Deal)
                    </h4>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Μόλις πιάσει βροχή στην περιοχή (
                    {selectedVenue.area || "Αθήνα"}), στέλνει αυτόματα Push
                    Notification σε ακτίνα 500μ με{" "}
                    <strong>-20% σε καφέ/ρόφημα</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateShiftLive({
                      rainAutoDeal: !selectedVenue.rainAutoDeal,
                    })
                  }
                  className={`px-3.5 py-2 rounded-xl text-xs font-black shrink-0 transition cursor-pointer ${
                    selectedVenue.rainAutoDeal
                      ? "bg-sky-600 text-white shadow-sm"
                      : "bg-card text-text-muted border border-border-theme"
                  }`}
                >
                  {selectedVenue.rainAutoDeal ? "✓ AUTO ON" : "OFF"}
                </button>
              </div>

              {/* #6 Auto Miss You Campaign */}
              <div
                className={`p-4 rounded-2xl border transition flex items-start justify-between gap-4 ${
                  selectedVenue.missYouCampaign
                    ? "bg-purple-500/10 border-purple-400"
                    : "bg-subtle border-border-theme"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💌</span>
                    <h4 className="text-xs font-black text-text-main">
                      Auto &ldquo;Miss You&rdquo; Campaign (Retention)
                    </h4>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Εντοπίζει θαμώνες που έχουν να κάνουν check-in{" "}
                    <strong>πάνω από 14 ημέρες</strong> και τους στέλνει
                    αυτόματα κουπόνι επιστροφής.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateShiftLive({
                      missYouCampaign: !selectedVenue.missYouCampaign,
                    })
                  }
                  className={`px-3.5 py-2 rounded-xl text-xs font-black shrink-0 transition cursor-pointer ${
                    selectedVenue.missYouCampaign
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-card text-text-muted border border-border-theme"
                  }`}
                >
                  {selectedVenue.missYouCampaign ? "✓ AUTO ON" : "OFF"}
                </button>
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

        {/* SMART ANALYTICS DASHBOARD */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border-theme p-5 rounded-3xl shadow-sm">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block">
              Κρατήσεις Σήμερα
            </span>
            <div className="text-3xl font-black text-text-main mt-2">
              {stats.totalBookings}
            </div>
            <span className="text-[11px] text-brand-text font-medium mt-1 block">
              👥 {stats.totalGuests} επισκέπτες συνολικά
            </span>
          </div>

          <div className="bg-card border border-border-theme p-5 rounded-3xl shadow-sm">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block">
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
            <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wider block">
              No-Shows / Ακυρώσεις
            </span>
            <div className="text-3xl font-black text-red-600 mt-2">
              {stats.noShows}
            </div>
            <span className="text-[11px] text-red-600 mt-1 block font-medium">
              🎯 Μετατρέψιμα σε Bounty
            </span>
          </div>

          <div className="bg-card border border-border-theme p-5 rounded-3xl shadow-sm">
            <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider block">
              Κορυφαία Ώρα (Peak)
            </span>
            <div className="text-3xl font-black text-indigo-600 mt-2">
              {stats.peakHour}
            </div>
            <span className="text-[11px] text-indigo-600 mt-1 block font-medium">
              📈 {slots.length}/6 ενεργά slots
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

              <form
                onSubmit={handleCreateSlot}
                className="bg-subtle p-5 rounded-2xl border border-border-theme space-y-4"
              >
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

                <label className="flex items-center gap-2 mt-4 p-3 bg-brand/5 border border-brand/20 rounded-xl cursor-pointer hover:bg-brand/10 transition">
                  <input
                    type="checkbox"
                    checked={isVipOnly}
                    onChange={(e) => setIsVipOnly(e.target.checked)}
                    className="w-4 h-4 accent-brand cursor-pointer"
                  />
                  <span className="text-xs text-brand-text font-bold flex items-center gap-1">
                    ⭐ Secret Deal (Μόνο για VIP Πελάτες με Streak 3+)
                  </span>
                </label>

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
                  {isCreatingSlot
                    ? "Προσθήκη..."
                    : `+ Άνοιγμα Slot (${startHour} - ${endHour} | ${discount})`}
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
                          {s.isVipOnly && (
                            <span className="text-[10px] bg-brand text-white px-2 py-0.5 rounded-full font-bold ml-1">
                              ⭐ VIP
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text-muted mt-1">
                          Διαθέσιμα:{" "}
                          <strong className="text-text-main">
                            {s.availableTables}
                          </strong>{" "}
                          / {s.totalTables} τραπέζια
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePushAlert(s.timeWindow, s.discount)}
                          className="px-3 py-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition cursor-pointer flex items-center gap-1"
                        >
                          <span>🔔</span> Push Γειτονιάς
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(s.id)}
                          className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer font-medium"
                        >
                          Διαγραφή
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ΡΟΗ ΚΡΑΤΗΣΕΩΝ ΜΕ ΚΟΥΜΠΙ NO-SHOW BOUNTY (#7) */}
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
                    const isCancelled = b.status === "cancelled";

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
                                : isCancelled
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-brand-light text-brand-text border border-brand-border"
                            }`}
                          >
                            {isCheckedIn
                              ? "✓ Checked-In"
                              : isCancelled
                              ? "✕ Ακυρώθηκε (Bounty)"
                              : "Αναμονή"}
                          </span>
                        </div>

                        <div className="text-text-main space-y-0.5">
                          <div>
                            Ώρα:{" "}
                            <strong className="text-text-main">
                              {b.timeWindow}
                            </strong>
                          </div>
                          <div>
                            Άτομα:{" "}
                            <strong className="text-text-main">
                              {b.partySize}
                            </strong>{" "}
                            | Έκπτωση:{" "}
                            <strong className="text-brand-text">
                              {b.discount}
                            </strong>
                          </div>
                          <div className="text-[10px] text-text-muted">
                            Ημερομηνία: {b.date}
                          </div>
                        </div>

                        {/* #7 Κουμπί μετατροπής No-Show σε Bounty */}
                        {!isCheckedIn && !isCancelled && (
                          <div className="pt-2 border-t border-border-theme flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleTriggerBounty(b)}
                              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-neutral-950 font-black text-[11px] rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm"
                            >
                              🎯 Δεν ήρθε; Βγάλτο σε Bounty (10&apos;)
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* MODAL: ΠΡΟΣΘΗΚΗ ΝΕΟΥ ΚΑΤΑΣΤΗΜΑΤΟΣ */}
      {showAddVenueModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border-theme rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black">➕ Προσθήκη Νέου Καταστήματος</h3>
              <button
                type="button"
                onClick={() => setShowAddVenueModal(false)}
                className="text-text-muted hover:text-text-main cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-text-muted">
              Κάθε κατάστημα απαιτεί ξεχωριστή συνδρομή. Τα στοιχεία εταιρείας/ΑΦΜ θα
              συμπληρωθούν αυτόματα από τον λογαριασμό σας.
            </p>

            <form onSubmit={handleApplyNewVenue} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-text-muted mb-1">
                  Όνομα Νέου Καταστήματος *
                </label>
                <input
                  required
                  type="text"
                  value={addVenueName}
                  onChange={(e) => setAddVenueName(e.target.value)}
                  placeholder="π.χ. Το Κουτούκι - Γλυφάδα"
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-text-muted mb-1">
                    Περιοχή *
                  </label>
                  <input
                    required
                    type="text"
                    value={addVenueArea}
                    onChange={(e) => setAddVenueArea(e.target.value)}
                    placeholder="π.χ. Γλυφάδα"
                    className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-text-muted mb-1">
                    Κατηγορία *
                  </label>
                  <select
                    value={addVenueCategory}
                    onChange={(e) => setAddVenueCategory(e.target.value)}
                    className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-text-muted mb-1">
                  Διεύθυνση *
                </label>
                <input
                  required
                  type="text"
                  value={addVenueAddress}
                  onChange={(e) => setAddVenueAddress(e.target.value)}
                  placeholder="Οδός & αριθμός"
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-text-muted mb-1.5">
                  Επιλογή Πακέτου Συνδρομής *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PLAN_LIST.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAddVenuePlan(p.id)}
                      className={`p-2.5 rounded-xl border-2 text-center transition cursor-pointer ${
                        addVenuePlan === p.id
                          ? "border-brand bg-brand/10"
                          : "border-border-theme bg-subtle"
                      }`}
                    >
                      <div className="font-bold">{p.label}</div>
                      <div className="text-brand font-black mt-0.5">{p.price}€</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddVenueModal(false)}
                  className="flex-1 py-2.5 bg-subtle rounded-xl font-bold cursor-pointer"
                >
                  Άκυρο
                </button>
                <button
                  type="submit"
                  disabled={submittingVenue}
                  className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold cursor-pointer disabled:opacity-50"
                >
                  {submittingVenue ? "Υποβολή..." : "Υποβολή Αίτησης"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}