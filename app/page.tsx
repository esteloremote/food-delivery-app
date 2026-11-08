"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  onSnapshot,
  doc,
  runTransaction,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { TableStatus } from "@/components/VenueMap";

const VenueMap = dynamic(() => import("@/components/VenueMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 bg-subtle rounded-3xl border border-border-theme flex items-center justify-center text-xs text-text-muted my-6">
      Φόρτωση χάρτη...
    </div>
  ),
});

export const VIBE_OPTIONS = [
  "☀️ Έχει ήλιο έξω",
  "🔥 Σόμπες αναμμένες",
  "💻 Χαλαρό για δουλειά",
  "⚽ Δείχνει αγώνα",
];

interface SlotDeal {
  id: string;
  venueId?: string;
  venueName: string;
  timeWindow: string;
  discount: string;
  availableTables: number;
  totalTables: number;
  isPanicSlot?: boolean;
  microZoneOnly?: "student" | "office" | null;
}

interface VenueDoc {
  id: string;
  slug: string;
  name: string;
  category: string;
  area: string;
  address: string;
  image: string;
  lat: number;
  lng: number;
  tableStatus: TableStatus;
  takeawayReady: boolean;
  panicDealActive: boolean;
  panicDealText: string;
  vibeTags: string[];
  microZoneType: "student" | "office" | null;
}

interface VenueWithSlots extends VenueDoc {
  slots: SlotDeal[];
}

interface Booking {
  ticketCode: string;
  venueName: string;
  timeWindow: string;
  discount: string;
  partySize: number;
  date: string;
  orderMode?: "dine-in" | "takeaway";
}

function useCountdown(timeWindow: string) {
  const [timeLeft, setTimeLeft] = useState<{ label: string; isExpired: boolean }>({
    label: "",
    isExpired: false,
  });

  useEffect(() => {
    const calculateTime = () => {
      const parts = timeWindow.split("-");
      if (parts.length < 2) return;

      const endPart = parts[1].trim();
      const [endHourStr, endMinuteStr] = endPart.split(":");
      const endHour = parseInt(endHourStr, 10);
      const endMinute = parseInt(endMinuteStr, 10);

      if (isNaN(endHour) || isNaN(endMinute)) return;

      const now = new Date();
      const target = new Date();
      target.setHours(endHour, endMinute, 0, 0);

      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ label: "Έληξε", isExpired: true });
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft({ label: `${hours}ώ ${minutes}λ`, isExpired: false });
      } else {
        setTimeLeft({
          label: `${minutes}λ ${seconds < 10 ? "0" : ""}${seconds}δ`,
          isExpired: false,
        });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [timeWindow]);

  return timeLeft;
}

function SlotItem({
  slot,
  onSelect,
}: {
  slot: SlotDeal;
  onSelect: () => void;
}) {
  const { label, isExpired } = useCountdown(slot.timeWindow);
  const isAvailable = slot.availableTables > 0 && !isExpired;

  return (
    <div
      className={`p-3 rounded-2xl border flex items-center justify-between transition ${
        slot.isPanicSlot
          ? "bg-red-50 border-red-200"
          : slot.microZoneOnly
          ? "bg-indigo-50 border-indigo-200"
          : "bg-subtle/80 border-border-theme hover:border-brand"
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-text-main">{slot.timeWindow}</span>
          {slot.isPanicSlot && (
            <span className="text-[10px] font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">
              🔥 FLASH DEAL
            </span>
          )}
          {slot.microZoneOnly === "student" && (
            <span className="text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
              🎓 Φοιτητικό Πάσο
            </span>
          )}
          {slot.microZoneOnly === "office" && (
            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
              💼 Office Break
            </span>
          )}
          {label && (
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                isExpired
                  ? "bg-red-100 text-red-700 border border-red-200"
                  : "bg-brand-light text-brand-text border border-brand-border"
              }`}
            >
              ⏳ {label}
            </span>
          )}
        </div>
        <div className="text-xs text-brand-text font-bold mt-0.5">
          {slot.discount}
        </div>
        <div className="text-[11px] text-text-muted">
          {isExpired
            ? "Η προσφορά ολοκληρώθηκε"
            : slot.availableTables > 0
            ? `${slot.availableTables} τραπέζια απομένουν`
            : "Εξαντλήθηκε"}
        </div>
      </div>

      <button
        type="button"
        disabled={!isAvailable}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm ${
          isAvailable
            ? slot.isPanicSlot
              ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/20"
              : "bg-brand hover:bg-brand-hover text-white"
            : "bg-subtle text-text-muted cursor-not-allowed shadow-none border border-border-theme"
        }`}
      >
        {isExpired ? "Έληξε" : slot.availableTables > 0 ? "Κράτηση" : "Full"}
      </button>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [venueList, setVenueList] = useState<VenueDoc[]>([]);
  const [slotList, setSlotList] = useState<SlotDeal[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedVenue, setSelectedVenue] = useState<VenueDoc | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotDeal | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [orderMode, setOrderMode] = useState<"dine-in" | "takeaway">("dine-in");
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Φίλτρα
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState("all");
  const [minDiscount, setMinDiscount] = useState<number>(0);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [onlyPanicDeals, setOnlyPanicDeals] = useState(false);
  const [onlyTakeaway, setOnlyTakeaway] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // 15-Minute Squad Hold
  const [squadHold, setSquadHold] = useState<{
    venueName: string;
    expiresAt: number;
    friendsJoined: number;
  } | null>(null);
  const [squadSecondsLeft, setSquadSecondsLeft] = useState<number>(0);

  // Micro-Zones Pass
  const [showPassModal, setShowPassModal] = useState(false);
  const [passEmailInput, setPassEmailInput] = useState("");
  const [verifiedPass, setVerifiedPass] = useState<{
    type: "student" | "office";
    email: string;
  } | null>(null);

  useEffect(() => {
    const savedPass =
      typeof window !== "undefined"
        ? localStorage.getItem("happyseats_microzone_pass")
        : null;

    if (savedPass) {
      try {
        const parsed = JSON.parse(savedPass);
        queueMicrotask(() => {
          setVerifiedPass(parsed);
        });
      } catch {
        // ignore
      }
    }

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!squadHold) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((squadHold.expiresAt - Date.now()) / 1000));
      setSquadSecondsLeft(diff);
      if (diff <= 0) {
        setSquadHold(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [squadHold]);

  useEffect(() => {
    const unsubVenues = onSnapshot(collection(db, "venues"), (snap) => {
      const vArr: VenueDoc[] = [];
      snap.docs.forEach((d, index) => {
        const data = d.data();
        // Αν το κατάστημα έχει τεθεί σε αναστολή συνδρομής από τον Admin, ΔΕΝ εμφανίζεται στους πελάτες!
        if (data.isPublished === false || data.subscriptionStatus === "past_due") {
          return;
        }
        const defaultVibes =
          index % 2 === 0
            ? ["☀️ Έχει ήλιο έξω", "💻 Χαλαρό για δουλειά"]
            : ["🔥 Σόμπες αναμμένες", "⚽ Δείχνει αγώνα"];

        vArr.push({
          id: d.id,
          slug: data.slug || d.id,
          name: data.name || "Κατάστημα",
          category: data.category || "Εστίαση",
          area: data.area || "Αθήνα",
          address: data.address || "",
          image:
            data.image ||
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
          lat: Number(data.lat) || 37.9753,
          lng: Number(data.lng) || 23.7361,
          tableStatus: (data.tableStatus as TableStatus) || "plenty",
          takeawayReady: data.takeawayReady !== undefined ? Boolean(data.takeawayReady) : true,
          panicDealActive: Boolean(data.panicDealActive),
          panicDealText: data.panicDealText || "-30% στα επόμενα 3 τραπέζια (1 ώρα)",
          vibeTags: Array.isArray(data.vibeTags) ? data.vibeTags : defaultVibes,
          microZoneType:
            data.microZoneType || (index % 2 === 0 ? "office" : "student"),
        });
      });
      setVenueList(vArr);
      setLoading(false);
    });

    return () => unsubVenues();
  }, []);

  useEffect(() => {
    const unsubSlots = onSnapshot(collection(db, "slots"), (snap) => {
      const sArr: SlotDeal[] = [];
      snap.forEach((d) => {
        sArr.push({ id: d.id, ...(d.data() as Omit<SlotDeal, "id">) });
      });
      setSlotList(sArr);
    });

    return () => unsubSlots();
  }, []);

  const fullVenues: VenueWithSlots[] = useMemo(() => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const formatTime = (d: Date) =>
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const panicWindow = `${formatTime(now)} - ${formatTime(oneHourLater)}`;

    return venueList.map((v) => {
      const matchedSlots = [
        ...slotList.filter((s) => s.venueName === v.name || s.venueId === v.id),
      ];

      if (v.panicDealActive) {
        matchedSlots.unshift({
          id: `panic-${v.id}`,
          venueId: v.id,
          venueName: v.name,
          timeWindow: panicWindow,
          discount: v.panicDealText || "-30% Flash Fill-the-Table",
          availableTables: 3,
          totalTables: 3,
          isPanicSlot: true,
        });
      }

      if (verifiedPass && v.microZoneType === verifiedPass.type) {
        matchedSlots.push({
          id: `microzone-${v.id}`,
          venueId: v.id,
          venueName: v.name,
          timeWindow:
            verifiedPass.type === "office" ? "13:00 - 16:00" : "12:00 - 20:00",
          discount:
            verifiedPass.type === "office"
              ? "-35% Office Lunch Break (Fast Take-away / Τραπέζι)"
              : "-40% Αποκλειστικό Φοιτητικό Deal",
          availableTables: 4,
          totalTables: 4,
          microZoneOnly: verifiedPass.type,
        });
      }

      return {
        ...v,
        slots: matchedSlots,
      };
    });
  }, [venueList, slotList, verifiedPass]);

  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    venueList.forEach((v) => {
      if (v.area) areas.add(v.area);
    });
    return Array.from(areas);
  }, [venueList]);

  const extractDiscountNumber = (discountStr: string): number => {
    const match = discountStr.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const filteredVenues = useMemo(() => {
    return fullVenues
      .map((venue) => {
        const matchedSlots = venue.slots.filter((slot) => {
          if (minDiscount === 0) return true;
          return extractDiscountNumber(slot.discount) >= minDiscount;
        });

        return {
          ...venue,
          slots: matchedSlots,
        };
      })
      .filter((venue) => {
        const matchesSearch =
          venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          venue.category.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesArea =
          selectedArea === "all" ||
          venue.area.toLowerCase() === selectedArea.toLowerCase();

        const matchesDiscount = minDiscount === 0 || venue.slots.length > 0;
        const matchesVibes =
          selectedVibes.length === 0 ||
          selectedVibes.every((tag) => venue.vibeTags.includes(tag));

        const matchesPanic = !onlyPanicDeals || venue.panicDealActive;
        const matchesTakeaway = !onlyTakeaway || venue.takeawayReady;

        return (
          matchesSearch &&
          matchesArea &&
          matchesDiscount &&
          matchesVibes &&
          matchesPanic &&
          matchesTakeaway
        );
      });
  }, [
    fullVenues,
    searchTerm,
    selectedArea,
    minDiscount,
    selectedVibes,
    onlyPanicDeals,
    onlyTakeaway,
  ]);

  const mapVenuesData = useMemo(() => {
    return filteredVenues.map((v) => {
      const bestDiscount = v.slots.length > 0 ? v.slots[0].discount : "-20%";
      return {
        name: v.name,
        category: v.category,
        area: v.area,
        address: v.address || v.area,
        lat: v.lat,
        lng: v.lng,
        bestDiscount,
        tableStatus: v.tableStatus,
        takeawayReady: v.takeawayReady,
        panicDealActive: v.panicDealActive,
        panicDealText: v.panicDealText,
        vibeTags: v.vibeTags,
        microZoneType: v.microZoneType,
      };
    });
  }, [filteredVenues]);

  const toggleVibeFilter = (tag: string) => {
    setSelectedVibes((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSquadLock = async (
    venue: VenueWithSlots,
    currentTimestamp: number
  ) => {
    const expiresAt = currentTimestamp + 15 * 60 * 1000;
    setSquadHold({
      venueName: venue.name,
      expiresAt,
      friendsJoined: 1,
    });

    const bestDeal = venue.slots[0]?.discount || "-20%";
    const shareText = `🍻 Κλείδωσα τραπέζι για 15 λεπτά στο "${venue.name}" (${venue.area}) με ${bestDeal}! Πατήστε για να επιβεβαιώσουμε την παρέα:`;
    const shareUrl = `${window.location.origin}/?squad=${encodeURIComponent(venue.slug)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `HappySeats Παρέα - ${venue.name}`,
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // ignore
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      alert("⏳ Το τραπέζι κλειδώθηκε για 15 λεπτά! Το link αντιγράφηκε.");
    }
  };

  const handleVerifyPass = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = passEmailInput.trim().toLowerCase();
    if (!clean.includes("@")) {
      alert("Παρακαλώ εισάγετε ένα έγκυρο email.");
      return;
    }

    const isStudent =
      clean.endsWith(".edu.gr") ||
      clean.includes("uni") ||
      clean.includes("student") ||
      clean.endsWith(".gr");

    const passType: "student" | "office" = isStudent ? "student" : "office";
    const newPass = { type: passType, email: clean };
    setVerifiedPass(newPass);
    localStorage.setItem("happyseats_microzone_pass", JSON.stringify(newPass));
    setShowPassModal(false);
    setPassEmailInput("");
  };

  const handleShareCurrentBooking = async () => {
    if (!currentBooking) return;
    const shareText = `🍽️ Έκλεισα τραπέζι στο "${currentBooking.venueName}" μέσω HappySeats!\n📅 Ημερομηνία: ${currentBooking.date}\n⏰ Ώρα: ${currentBooking.timeWindow}\n👥 Άτομα: ${currentBooking.partySize}\n🎁 Έκπτωση: ${currentBooking.discount}\n🎟️ Κωδικός Κράτησης: ${currentBooking.ticketCode}\n\nΡαντεβού εκεί!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Κράτηση HappySeats - ${currentBooking.venueName}`,
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

  const handleBooking = async () => {
    if (!selectedVenue || !selectedSlot) return;

    if (!currentUser) {
      alert("Για να εκδώσετε e-ticket με έκπτωση, πρέπει πρώτα να συνδεθείτε.");
      router.push("/login");
      return;
    }

    if (selectedSlot.availableTables <= 0) {
      alert("Δυστυχώς εξαντλήθηκαν τα τραπέζια!");
      return;
    }

    setIsSubmitting(true);
    const cleanPrefix = selectedVenue.name.substring(0, 3).toUpperCase();
    const code = `${cleanPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    const todayDate = new Date().toLocaleDateString("el-GR");

    try {
      const qExisting = query(
        collection(db, "bookings"),
        where("customerId", "==", currentUser.uid),
        where("date", "==", todayDate)
      );
      const snapExisting = await getDocs(qExisting);
      const userTodayBookings = snapExisting.docs.map((d) => d.data());

      const activeTodayCount = userTodayBookings.filter(
        (b) => b.status === "confirmed"
      ).length;
      if (activeTodayCount >= 2) {
        alert(
          "Έχετε φτάσει το μέγιστο όριο (2 ενεργά tickets ανά ημέρα). Εξαργυρώστε ή ακυρώστε μία κράτηση για να συνεχίσετε."
        );
        setIsSubmitting(false);
        return;
      }

      const hasConflict = userTodayBookings.some(
        (b) =>
          b.status === "confirmed" && b.timeWindow === selectedSlot.timeWindow
      );
      if (hasConflict) {
        alert(
          `Έχετε ήδη κράτηση για τη χρονοθυρίδα "${selectedSlot.timeWindow}".`
        );
        setIsSubmitting(false);
        return;
      }
    } catch (checkErr) {
      console.warn("Booking verification check warning:", checkErr);
    }

    const newBooking: Booking = {
      ticketCode: code,
      venueName: selectedVenue.name,
      timeWindow: selectedSlot.timeWindow,
      discount: selectedSlot.discount,
      partySize,
      date: todayDate,
      orderMode,
    };

    try {
      const bookingsCollectionRef = collection(db, "bookings");
      const newBookingRef = doc(bookingsCollectionRef);

      if (
        selectedSlot.id.startsWith("panic-") ||
        selectedSlot.id.startsWith("microzone-")
      ) {
        await runTransaction(db, async (transaction) => {
          transaction.set(newBookingRef, {
            ...newBooking,
            venueId: selectedVenue.id,
            slotId: selectedSlot.id,
            status: "confirmed",
            customerId: currentUser ? currentUser.uid : "guest",
            customerEmail: currentUser ? currentUser.email : null,
            customerName: currentUser
              ? currentUser.displayName || currentUser.email
              : "Επισκέπτης",
            createdAt: serverTimestamp(),
          });
        });
      } else {
        const slotRef = doc(db, "slots", selectedSlot.id);
        await runTransaction(db, async (transaction) => {
          const slotSnap = await transaction.get(slotRef);
          if (!slotSnap.exists()) throw new Error("Το slot δεν υπάρχει πλέον!");

          const currentTables = slotSnap.data().availableTables ?? 0;
          if (currentTables <= 0) throw new Error("Εξαντλήθηκαν τα τραπέζια!");

          transaction.update(slotRef, {
            availableTables: currentTables - 1,
          });

          transaction.set(newBookingRef, {
            ...newBooking,
            venueId: selectedVenue.id,
            slotId: selectedSlot.id,
            status: "confirmed",
            customerId: currentUser ? currentUser.uid : "guest",
            customerEmail: currentUser ? currentUser.email : null,
            customerName: currentUser
              ? currentUser.displayName || currentUser.email
              : "Επισκέπτης",
            createdAt: serverTimestamp(),
          });
        });
      }

      const stored = localStorage.getItem("happyseats_tickets");
      const existingCodes = stored ? JSON.parse(stored) : [];
      if (!existingCodes.includes(code)) {
        localStorage.setItem(
          "happyseats_tickets",
          JSON.stringify([code, ...existingCodes])
        );
      }

      setCurrentBooking(newBooking);
      setSelectedSlot(null);
      setSquadHold(null);
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Σφάλμα κράτησης.";
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-text-main p-6">
      <header className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-border-theme">
        <div>
          <h1 className="text-2xl font-black text-brand tracking-tight">HappySeats</h1>
          <p className="text-xs text-text-muted">
            Κλείσε τραπέζι ή παραλαβή τις σωστές ώρες, κέρδισε έκπτωση
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowPassModal(true)}
            className={`text-xs font-bold px-3 py-2 rounded-xl transition border flex items-center gap-1.5 cursor-pointer ${
              verifiedPass
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-card hover:bg-subtle text-text-main border-border-theme shadow-sm"
            }`}
          >
            {verifiedPass ? (
              <>
                <span>{verifiedPass.type === "student" ? "🎓" : "💼"}</span>
                <span>
                  {verifiedPass.type === "student"
                    ? "Φοιτητικό Πάσο Ενεργό"
                    : "Office Pass Ενεργό"}
                </span>
              </>
            ) : (
              <>
                <span>🎓/💼</span>
                <span>Πάσο / Office Break</span>
              </>
            )}
          </button>

          <Link
            href="/my-tickets"
            className="text-xs font-semibold px-3 py-2 bg-card hover:bg-subtle text-text-main rounded-xl transition border border-border-theme shadow-sm flex items-center gap-1"
          >
            🎟️ Τα Εισιτήριά μου
          </Link>

          {currentUser ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted hidden sm:inline font-medium">
                👤 {currentUser.displayName || currentUser.email?.split("@")[0]}
              </span>
              <button
                onClick={() => signOut(auth)}
                className="text-xs px-2.5 py-2 bg-card hover:bg-subtle text-text-muted hover:text-red-600 rounded-xl transition border border-border-theme shadow-sm cursor-pointer"
              >
                Έξοδος
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-bold px-3 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl transition shadow-sm"
            >
              Σύνδεση
            </Link>
          )}

          <Link
            href="/merchant/login"
            className="text-xs font-semibold px-3 py-2 bg-card hover:bg-brand-light text-brand-text rounded-xl transition border border-border-theme shadow-sm hidden md:inline-block"
          >
            Συνεργάτες Εστίασης →
          </Link>
          {currentUser?.email &&
          ["skampanar@gmail.com", "olga_dre@yahoo.gr", "tommyanastaso@gmail.com"].includes(
            currentUser.email.toLowerCase().trim()
          ) && (
            <Link
              href="/admin"
              className="text-xs font-bold px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition shadow-sm flex items-center gap-1"
            >
              🛡️ Admin Panel
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-8">
        {squadHold && (
          <div className="mb-6 p-4 bg-gradient-to-r from-brand-light via-card to-card border border-brand-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤝</span>
              <div>
                <div className="text-xs font-bold text-brand-text uppercase tracking-wider">
                  Κρατημενο για την παρεα ({Math.floor(squadSecondsLeft / 60)}:
                  {String(squadSecondsLeft % 60).padStart(2, "0")})
                </div>
                <p className="text-sm font-bold text-text-main">
                  {squadHold.venueName} —{" "}
                  <span className="text-emerald-600">
                    {squadHold.friendsJoined}/3 φίλοι επιβεβαίωσαν
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setSquadHold((prev) =>
                    prev
                      ? { ...prev, friendsJoined: prev.friendsJoined + 1 }
                      : null
                  )
                }
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm"
              >
                + Επιβεβαίωση Φίλου (Demo)
              </button>
              <button
                onClick={() => setSquadHold(null)}
                className="px-2.5 py-1.5 bg-subtle hover:bg-border-theme text-text-muted text-xs rounded-xl transition cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {currentBooking && (
          <div className="mb-10 p-6 bg-card border-2 border-brand rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-widest px-3 py-1 bg-brand-light text-brand-text rounded-full font-bold border border-brand-border">
                ✓ e-Ticket Έτοιμο & Αποθηκευμένο
              </span>
              <h2 className="text-2xl font-bold text-text-main">
                {currentBooking.venueName}
              </h2>
              <p className="text-text-muted text-sm">
                Ώρα:{" "}
                <span className="font-semibold text-text-main">
                  {currentBooking.timeWindow}
                </span>{" "}
                | Ημερομηνία: {currentBooking.date}
              </p>
              <p className="text-text-muted text-sm">
                Τύπος:{" "}
                <span className="font-semibold text-text-main">
                  {currentBooking.orderMode === "takeaway"
                    ? "🛍️ Παραλαβή Take-away"
                    : `🍽️ Τραπέζι (${currentBooking.partySize} άτομα)`}
                </span>{" "}
                | Προσφορά:{" "}
                <span className="text-brand-text font-bold">
                  {currentBooking.discount}
                </span>
              </p>
              <div className="pt-2">
                <button
                  onClick={handleShareCurrentBooking}
                  className="px-4 py-2 bg-subtle hover:bg-border-theme text-text-main border border-border-theme rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>📲</span> Κοινοποίηση στην παρέα
                </button>
              </div>
            </div>

            <div className="bg-subtle border border-border-theme p-4 rounded-2xl flex flex-col items-center">
              <QRCodeSVG
                value={`HAPPYSEATS:${currentBooking.ticketCode}|${currentBooking.venueName}|${currentBooking.partySize}P`}
                size={140}
              />
              <span className="text-text-main font-mono font-bold text-sm mt-2">
                {currentBooking.ticketCode}
              </span>
            </div>
          </div>
        )}

        {/* Μπάρα Αναζήτησης και Φίλτρων */}
        <section className="bg-card border border-border-theme p-5 rounded-3xl mb-8 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                Αναζήτηση
              </label>
              <input
                type="text"
                placeholder="Όνομα μαγαζιού ή κουζίνα..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand placeholder:text-text-muted"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                Περιοχή
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand cursor-pointer"
              >
                <option value="all">Όλες οι περιοχές</option>
                {availableAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                Έκπτωση
              </label>
              <select
                value={minDiscount}
                onChange={(e) => setMinDiscount(Number(e.target.value))}
                className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand cursor-pointer"
              >
                <option value={0}>Όλες οι εκπτώσεις</option>
                <option value={20}>Τουλάχιστον -20%</option>
                <option value={30}>Τουλάχιστον -30%</option>
                <option value={40}>Τουλάχιστον -40%</option>
                <option value={50}>Happy Hour (-50%)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-border-theme space-y-2">
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              Live Vibe & Διαθεσιμοτητα Τωρα
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setOnlyPanicDeals((prev) => !prev)}
                className={`text-xs px-3 py-1.5 rounded-full font-bold border transition cursor-pointer ${
                  onlyPanicDeals
                    ? "bg-red-600 text-white border-red-600 shadow-sm"
                    : "bg-card text-red-600 border-red-200 hover:border-red-400"
                }`}
              >
                🔥 Flash Τραπέζια (-30% Τώρα)
              </button>

              <button
                onClick={() => setOnlyTakeaway((prev) => !prev)}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition cursor-pointer ${
                  onlyTakeaway
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                    : "bg-card text-text-main border-border-theme hover:border-text-muted"
                }`}
              >
                🛍️ Άμεσο Take-away
              </button>

              {VIBE_OPTIONS.map((tag) => {
                const isSelected = selectedVibes.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleVibeFilter(tag)}
                    className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition cursor-pointer ${
                      isSelected
                        ? "bg-brand text-white border-brand shadow-sm"
                        : "bg-card text-text-main border-border-theme hover:border-text-muted"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-border-theme text-xs">
            <span className="text-text-muted">
              Βρέθηκαν{" "}
              <strong className="text-brand-text font-bold">{filteredVenues.length}</strong>{" "}
              καταστήματα
            </span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowMap((prev) => !prev)}
                className="px-3.5 py-1.5 bg-brand-light hover:opacity-90 text-brand-text border border-brand-border rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
              >
                {showMap ? "📋 Προβολή Λίστας" : "🗺️ Προβολή Χάρτη"}
              </button>
              {(searchTerm ||
                selectedArea !== "all" ||
                minDiscount > 0 ||
                selectedVibes.length > 0 ||
                onlyPanicDeals ||
                onlyTakeaway) && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedArea("all");
                    setMinDiscount(0);
                    setSelectedVibes([]);
                    setOnlyPanicDeals(false);
                    setOnlyTakeaway(false);
                  }}
                  className="text-text-muted hover:text-text-main transition underline cursor-pointer"
                >
                  Καθαρισμός
                </button>
              )}
            </div>
          </div>
        </section>

        {showMap && <VenueMap venues={mapVenuesData} />}

        <h2 className="text-xl font-bold text-text-main mb-6">Διαθέσιμες Προσφορές Σήμερα</h2>

        {loading ? (
          <div className="text-center py-20 text-text-muted text-sm">
            Φόρτωση προσφορών...
          </div>
        ) : filteredVenues.length === 0 ? (
          <div className="bg-card border border-border-theme p-12 rounded-3xl text-center space-y-3 shadow-sm">
            <span className="text-3xl">🍽️</span>
            <h3 className="font-bold text-text-main text-base">
              Δεν βρέθηκαν διαθέσιμες προσφορές
            </h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Αυτή τη στιγμή δεν υπάρχουν ενεργά happy hour τραπέζια για τα
              κριτήρια που επιλέξατε.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredVenues.map((venue) => (
              <div
                key={venue.id}
                onClick={() => router.push(`/venue/${venue.slug}`)}
                className={`bg-card rounded-3xl overflow-hidden border shadow-sm hover:shadow-md transition cursor-pointer hover:border-brand ${
                  venue.panicDealActive
                    ? "border-red-400 ring-1 ring-red-400"
                    : "border-border-theme"
                }`}
              >
                <div className="relative w-full h-48">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={venue.image}
                    alt={venue.name}
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />

                  {venue.panicDealActive && (
                    <div className="absolute top-3 left-3 right-3 bg-red-600/95 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl flex items-center justify-between text-xs font-black shadow-md animate-pulse">
                      <span>🔥 FLASH FILL-THE-TABLE</span>
                      <span>{venue.panicDealText}</span>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5">
                    {venue.tableStatus === "plenty" && (
                      <span className="text-[11px] font-bold bg-card/95 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm">
                        🟢 Άνετο για Παρέα
                      </span>
                    )}
                    {venue.tableStatus === "few" && (
                      <span className="text-[11px] font-bold bg-card/95 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm">
                        🟠 1-3 Τραπέζια
                      </span>
                    )}
                    {venue.tableStatus === "full" && (
                      <span className="text-[11px] font-bold bg-card/95 text-red-700 border border-red-200 px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm">
                        🔴 Πλήρες Τραπεζιών
                      </span>
                    )}

                    {venue.takeawayReady && (
                      <span className="text-[11px] font-bold bg-card/95 text-text-main border border-border-theme px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm">
                        🛍️ Take-away Ready
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex justify-between items-start mb-1">
                    <span className="hover:text-brand transition">
                      <h3 className="text-lg font-bold text-text-main">
                        {venue.name} →
                      </h3>
                    </span>
                    <span className="text-xs bg-subtle text-text-main px-2.5 py-1 rounded-lg border border-border-theme font-medium">
                      {venue.area}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mb-3">
                    {venue.category}
                  </p>

                  {venue.vibeTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {venue.vibeTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] bg-subtle text-text-main border border-border-theme px-2.5 py-0.5 rounded-lg font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                        Διαθέσιμες Χρονοθυρίδες
                      </span>

                      {venue.tableStatus !== "full" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSquadLock(venue, Date.now());
                          }}
                          className="text-[11px] font-bold text-brand-text hover:opacity-80 flex items-center gap-1 cursor-pointer"
                        >
                          🤝 Κράτα το για την παρέα (15&apos;)
                        </button>
                      )}
                    </div>

                    {venue.slots.length === 0 ? (
                      <p className="text-xs text-text-muted py-3 italic">
                        Δεν υπάρχουν ενεργές χρονοθυρίδες αυτή τη στιγμή.
                      </p>
                    ) : (
                      venue.slots.map((slot) => (
                        <div
                          key={slot.id}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SlotItem
                            slot={slot}
                            onSelect={() => {
                              setSelectedVenue(venue);
                              setSelectedSlot(slot);
                              setOrderMode(
                                venue.tableStatus === "full"
                                  ? "takeaway"
                                  : "dine-in"
                              );
                            }}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Επαλήθευσης Πάσου */}
      {showPassModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border-theme p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-text-main">
                🎓 / 💼 Ξεκλείδωμα Micro-Zone Deals
              </h3>
              <button
                onClick={() => setShowPassModal(false)}
                className="text-text-muted hover:text-text-main text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Δήλωσε το ακαδημαϊκό σου email (π.χ. <code>.edu.gr</code>) ή εταιρικό email για{" "}
              <strong>Office Lunch Break deals (13:00–16:00)</strong>.
            </p>

            {verifiedPass && (
              <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-indigo-700">
                    Ενεργό:{" "}
                    {verifiedPass.type === "student"
                      ? "🎓 Φοιτητικό Πάσο"
                      : "💼 Office Break Pass"}
                  </div>
                  <div className="text-text-muted">{verifiedPass.email}</div>
                </div>
                <button
                  onClick={() => {
                    setVerifiedPass(null);
                    localStorage.removeItem("happyseats_microzone_pass");
                  }}
                  className="text-red-600 hover:underline font-semibold cursor-pointer"
                >
                  Αφαίρεση
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyPass} className="space-y-3">
              <input
                type="email"
                required
                placeholder="π.χ. name@aegean.gr ή name@company.com"
                value={passEmailInput}
                onChange={(e) => setPassEmailInput(e.target.value)}
                className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPassModal(false)}
                  className="flex-1 py-2.5 bg-subtle rounded-xl text-xs font-semibold hover:bg-border-theme text-text-main transition cursor-pointer"
                >
                  Κλείσιμο
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-hover transition cursor-pointer shadow-sm"
                >
                  Ενεργοποίηση Πάσου
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop-up Επιβεβαίωσης Κράτησης */}
      {selectedSlot && selectedVenue && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border-theme p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-text-main">
              Επιβεβαίωση Κράτησης
            </h3>
            <p className="text-sm text-text-muted">
              {selectedVenue.name} ({selectedSlot.timeWindow})
            </p>
            <div className="text-xs text-brand-text font-bold">
              {selectedSlot.discount}
            </div>

            <div>
              <label className="block text-xs text-text-muted font-medium mb-1">
                Τρόπος Εξυπηρέτησης:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={selectedVenue.tableStatus === "full"}
                  onClick={() => setOrderMode("dine-in")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    orderMode === "dine-in"
                      ? "bg-brand text-white border-brand shadow-sm"
                      : "bg-subtle text-text-main border-border-theme"
                  } disabled:opacity-40`}
                >
                  🍽️ Τραπέζι
                </button>
                <button
                  type="button"
                  disabled={!selectedVenue.takeawayReady}
                  onClick={() => setOrderMode("takeaway")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    orderMode === "takeaway"
                      ? "bg-brand text-white border-brand shadow-sm"
                      : "bg-subtle text-text-main border-border-theme"
                  } disabled:opacity-40`}
                >
                  🛍️ Παραλαβή
                </button>
              </div>
            </div>

            {orderMode === "dine-in" && (
              <div>
                <label className="block text-xs text-text-muted font-medium mb-1">
                  Αριθμός Ατόμων:
                </label>
                <select
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="w-full bg-subtle border border-border-theme rounded-xl p-2.5 text-sm text-text-main focus:outline-none focus:border-brand cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 8].map((num) => (
                    <option key={num} value={num}>
                      {num} άτομα
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="flex-1 py-2.5 bg-subtle rounded-xl text-sm font-semibold hover:bg-border-theme text-text-main transition cursor-pointer"
              >
                Άκυρο
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleBooking}
                className="flex-1 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-hover transition disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isSubmitting ? "Έκδοση..." : "Έκδοση Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}