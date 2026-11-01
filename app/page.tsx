"use client";

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
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { TableStatus } from "@/components/VenueMap";

const VenueMap = dynamic(() => import("@/components/VenueMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 bg-neutral-900 rounded-3xl border border-neutral-800 flex items-center justify-center text-xs text-neutral-500 my-6">
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
  // --- ΝΕΑ ΠΕΔΙΑ (2, 4, 6, 7) ---
  tableStatus: TableStatus; // "plenty" | "few" | "full"
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
      className={`p-3 rounded-xl border flex items-center justify-between transition ${
        slot.isPanicSlot
          ? "bg-red-950/30 border-red-500/40"
          : slot.microZoneOnly
          ? "bg-indigo-950/30 border-indigo-500/40"
          : "bg-neutral-950 border-neutral-800"
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-white">{slot.timeWindow}</span>
          {slot.isPanicSlot && (
            <span className="text-[10px] font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">
              🔥 FLASH DEAL
            </span>
          )}
          {slot.microZoneOnly === "student" && (
            <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
              🎓 Φοιτητικό Πάσο
            </span>
          )}
          {slot.microZoneOnly === "office" && (
            <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
              💼 Office Break
            </span>
          )}
          {label && (
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                isExpired
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-amber-400/10 text-amber-300 border border-amber-400/20"
              }`}
            >
              ⏳ {label}
            </span>
          )}
        </div>
        <div className="text-xs text-amber-400 font-medium mt-0.5">
          {slot.discount}
        </div>
        <div className="text-[11px] text-neutral-400">
          {isExpired
            ? "Η προσφορά ολοκληρώθηκε"
            : slot.availableTables > 0
            ? `${slot.availableTables} τραπέζια απομένουν`
            : "Εξαντλήθηκε"}
        </div>
      </div>
      <button
        disabled={!isAvailable}
        onClick={onSelect}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
          isAvailable
            ? slot.isPanicSlot
              ? "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-600/20"
              : "bg-amber-400 hover:bg-amber-300 text-neutral-950"
            : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
        }`}
      >
        {isExpired ? "Έληξε" : slot.availableTables > 0 ? "Κράτηση" : "Full"}
      </button>
    </div>
  );
}

export default function Home() {
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

  // Φίλτρα Αναζήτησης + Νέα Φίλτρα (#2, #4, #7)
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState("all");
  const [minDiscount, setMinDiscount] = useState<number>(0);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [onlyPanicDeals, setOnlyPanicDeals] = useState(false);
  const [onlyTakeaway, setOnlyTakeaway] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // #3: «Κλείδωμα Παρέας» (15-Minute Squad Hold)
  const [squadHold, setSquadHold] = useState<{
    venueName: string;
    expiresAt: number;
    friendsJoined: number;
  } | null>(null);
  const [squadSecondsLeft, setSquadSecondsLeft] = useState<number>(0);

  // #6: Micro-Zones (B2B Office Break & Φοιτητικό Πάσο)
  const [showPassModal, setShowPassModal] = useState(false);
  const [passEmailInput, setPassEmailInput] = useState("");
  const [verifiedPass, setVerifiedPass] = useState<{
    type: "student" | "office";
    email: string;
  } | null>(null);

  // #7: 1-Tap Dashboard Καταστηματάρχη (Γρήγορος έλεγχος βάρδιας)
  const [showShiftPanel, setShowShiftPanel] = useState(false);
  const [activeMerchantVenueId, setActiveMerchantVenueId] = useState<string>("");

  // 1. Παρακολούθηση Auth & ανάκτηση αποθηκευμένου Πάσου (#6)
  useEffect(() => {
    const savedPass = localStorage.getItem("happyseats_microzone_pass");
    if (savedPass) {
      try {
        setVerifiedPass(JSON.parse(savedPass));
      } catch {
        // ignore
      }
    }

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubAuth();
  }, []);

  // Countdown για το 15λεπτο «Κλείδωμα Παρέας» (#3)
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

  // 2. Real-time Subscription Venues (με τα νέα πεδία 2, 4, 6, 7)
  useEffect(() => {
    const unsubVenues = onSnapshot(collection(db, "venues"), (snap) => {
      const vArr: VenueDoc[] = [];
      snap.forEach((d, index) => {
        const data = d.data();
        // Default demo τιμές αν δεν έχουν οριστεί ακόμα στο Firestore
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
      if (vArr.length > 0 && !activeMerchantVenueId) {
        setActiveMerchantVenueId(vArr[0].id);
      }
      setLoading(false);
    });

    return () => unsubVenues();
  }, [activeMerchantVenueId]);

  // 3. Real-time Subscription Slots
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

  // 4. Σύνδεση Venues με τα αντίστοιχα Slots τους (+ δυναμικά Panic Deals #2 & Micro-Zone Deals #6)
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

      // #2: Αν ο καταστηματάρχης έχει ενεργοποιήσει το Panic Button, εμφανίζεται αυτόματο Flash Slot
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

      // #6: Αν ο χρήστης έχει ξεκλειδώσει Φοιτητικό ή Office Pass, εμφανίζεται το αποκλειστικό Micro-Zone Deal
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

        // #4: Φιλτράρισμα με βάση τα επιλεγμένα Vibe & Weather tags
        const matchesVibes =
          selectedVibes.length === 0 ||
          selectedVibes.every((tag) => venue.vibeTags.includes(tag));

        // #2: Φιλτράρισμα μόνο Panic / Flash Deals
        const matchesPanic = !onlyPanicDeals || venue.panicDealActive;

        // #7: Φιλτράρισμα μόνο Take-away Ready
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

  // Πέρασμα όλων των στοιχείων (και των νέων πεδίων 2, 4, 6, 7) στον χάρτη
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

  // #4: Toggle Vibe Tag στο φίλτρο
  const toggleVibeFilter = (tag: string) => {
    setSelectedVibes((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // #3: «Κλείδωμα Παρέας» (Hold 15 mins & Share σε Viber/WhatsApp)
  const handleSquadLock = async (venue: VenueWithSlots) => {
    const expiresAt = Date.now() + 15 * 60 * 1000;
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
        // user closed share
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      alert(
        "⏳ Το τραπέζι κλειδώθηκε για 15 λεπτά! Το link αντιγράφηκε — στείλτο στην παρέα σε Viber/WhatsApp."
      );
    }
  };

  // #6: Επαλήθευση Φοιτητικού (.gr) ή Εταιρικού Email
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

  // #7: 1-Tap Ενημέρωση Καταστήματος στο Firestore (Live Shift View)
  const updateMerchantVenueLive = async (
    venueId: string,
    updates: Partial<VenueDoc>
  ) => {
    try {
      const venueRef = doc(db, "venues", venueId);
      await updateDoc(venueRef, updates);
    } catch (err) {
      console.error("Failed to update venue shift status:", err);
      // Fallback σε local state αν τα Firestore rules δεν επιτρέπουν update χωρίς admin
      setVenueList((prev) =>
        prev.map((v) => (v.id === venueId ? { ...v, ...updates } : v))
      );
    }
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
      alert("Τα στοιχεία της κράτησης αντιγράφηκαν! Μπορείτε να τα στείλετε στην παρέα σας.");
    }
  };

  const handleBooking = async () => {
    if (!selectedVenue || !selectedSlot) return;

    if (selectedSlot.availableTables <= 0) {
      alert("Δυστυχώς εξαντλήθηκαν τα τραπέζια!");
      return;
    }

    setIsSubmitting(true);

    const cleanPrefix = selectedVenue.name.substring(0, 3).toUpperCase();
    const code = `${cleanPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    const todayDate = new Date().toLocaleDateString("el-GR");

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

      // Αν είναι δυναμικό slot (Panic Deal #2 ή Micro-Zone #6), αποθηκεύουμε απευθείας το booking
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

  const activeMerchantVenue = useMemo(
    () => venueList.find((v) => v.id === activeMerchantVenueId) || venueList[0],
    [venueList, activeMerchantVenueId]
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <header className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-neutral-800">
        <div>
          <h1 className="text-2xl font-black text-amber-400">HappySeats</h1>
          <p className="text-xs text-neutral-400">
            Κλείσε τραπέζι ή παραλαβή τις σωστές ώρες, κέρδισε έκπτωση
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* #6: Κουμπί Φοιτητικού / Office Break Πάσου */}
          <button
            onClick={() => setShowPassModal(true)}
            className={`text-xs font-bold px-3 py-2 rounded-xl transition border flex items-center gap-1.5 cursor-pointer ${
              verifiedPass
                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                : "bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-800"
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

          {/* #7: 1-Tap Dashboard Καταστηματάρχη Toggle */}
          <button
            onClick={() => setShowShiftPanel((prev) => !prev)}
            className="text-xs font-bold px-3 py-2 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 rounded-xl transition border border-amber-400/30 flex items-center gap-1 cursor-pointer"
          >
            ⚡ Live Βάρδια (1-Tap)
          </button>

          <Link
            href="/my-tickets"
            className="text-xs font-semibold px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl transition border border-neutral-800 flex items-center gap-1"
          >
            🎟️ Τα Εισιτήριά μου
          </Link>

          {currentUser ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 hidden sm:inline">
                👤 {currentUser.displayName || currentUser.email?.split("@")[0]}
              </span>
              <button
                onClick={() => signOut(auth)}
                className="text-xs px-2.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl transition border border-neutral-800"
              >
                Έξοδος
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-bold px-3 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded-xl transition shadow"
            >
              Σύνδεση
            </Link>
          )}

          <Link
            href="/merchant"
            className="text-xs font-semibold px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-amber-300 rounded-xl transition border border-neutral-800 hidden md:inline-block"
          >
            Για Εστιατόρια →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-8">
        {/* #3: Ενεργό Banner «Κλείδωμα Παρέας» (15-Minute Hold) */}
        {squadHold && (
          <div className="mb-6 p-4 bg-gradient-to-r from-amber-500/20 via-neutral-900 to-neutral-900 border border-amber-400/50 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤝</span>
              <div>
                <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Κρατημενο για την παρεα ({Math.floor(squadSecondsLeft / 60)}:
                  {String(squadSecondsLeft % 60).padStart(2, "0")})
                </div>
                <p className="text-sm font-bold text-white">
                  {squadHold.venueName} —{" "}
                  <span className="text-emerald-400">
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
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                + Επιβεβαίωση Φίλου (Demo)
              </button>
              <button
                onClick={() => setSquadHold(null)}
                className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-xs rounded-xl transition cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* #7 & #2: 1-Tap Dashboard Καταστηματάρχη (Live Shift View) */}
        {showShiftPanel && activeMerchantVenue && (
          <section className="mb-8 p-5 bg-neutral-900 border-2 border-amber-400/60 rounded-3xl shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400 text-neutral-950 px-2 py-0.5 rounded-md">
                  1-TAP ΚΟΝΣΟΛΑ ΒΑΡΔΙΑΣ (#7 & #2)
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  Άμεση Ενημέρωση Πληρότητας & Panic Button
                </h3>
              </div>

              <select
                value={activeMerchantVenue.id}
                onChange={(e) => setActiveMerchantVenueId(e.target.value)}
                className="bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-400"
              >
                {venueList.map((v) => (
                  <option key={v.id} value={v.id}>
                    🏪 {v.name} ({v.area})
                  </option>
                ))}
              </select>
            </div>

            {/* 3 Τεράστια Κουμπιά Πληρότητας */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() =>
                  updateMerchantVenueLive(activeMerchantVenue.id, {
                    tableStatus: "plenty",
                  })
                }
                className={`py-3 px-4 rounded-2xl font-black text-xs border transition cursor-pointer ${
                  activeMerchantVenue.tableStatus === "plenty"
                    ? "bg-emerald-500 text-neutral-950 border-emerald-400 shadow-lg shadow-emerald-500/20"
                    : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-emerald-500/50"
                }`}
              >
                🟢 ΑΝΕΤΟ (Διαθέσιμα Τραπέζια)
              </button>

              <button
                onClick={() =>
                  updateMerchantVenueLive(activeMerchantVenue.id, {
                    tableStatus: "few",
                  })
                }
                className={`py-3 px-4 rounded-2xl font-black text-xs border transition cursor-pointer ${
                  activeMerchantVenue.tableStatus === "few"
                    ? "bg-amber-400 text-neutral-950 border-amber-300 shadow-lg shadow-amber-400/20"
                    : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-amber-400/50"
                }`}
              >
                🟠 1-3 ΤΡΑΠΕΖΙΑ (Σχεδόν Γεμάτο)
              </button>

              <button
                onClick={() =>
                  updateMerchantVenueLive(activeMerchantVenue.id, {
                    tableStatus: "full",
                  })
                }
                className={`py-3 px-4 rounded-2xl font-black text-xs border transition cursor-pointer ${
                  activeMerchantVenue.tableStatus === "full"
                    ? "bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/20"
                    : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-red-500/50"
                }`}
              >
                🔴 ΠΛΗΡΕΣ (Μόνο Αναμονή/Takeaway)
              </button>
            </div>

            {/* Panic Button (#2) & Take-away Toggle (#7) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() =>
                    updateMerchantVenueLive(activeMerchantVenue.id, {
                      panicDealActive: !activeMerchantVenue.panicDealActive,
                    })
                  }
                  className={`px-4 py-2.5 rounded-xl font-black text-xs transition flex items-center gap-1.5 cursor-pointer ${
                    activeMerchantVenue.panicDealActive
                      ? "bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/30"
                      : "bg-neutral-950 hover:bg-red-950/50 text-red-400 border border-red-500/40"
                  }`}
                >
                  🔥{" "}
                  {activeMerchantVenue.panicDealActive
                    ? "PANIC DEAL ΕΝΕΡΓΟ (-30% για 1 ώρα)"
                    : "Ενεργοποίηση Panic Deal (-30% στα επόμενα 3 τραπέζια)"}
                </button>

                <button
                  onClick={() =>
                    updateMerchantVenueLive(activeMerchantVenue.id, {
                      takeawayReady: !activeMerchantVenue.takeawayReady,
                    })
                  }
                  className={`px-3.5 py-2.5 rounded-xl font-bold text-xs border transition cursor-pointer ${
                    activeMerchantVenue.takeawayReady
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-neutral-950 text-neutral-500 border-neutral-800"
                  }`}
                >
                  🛍️ Take-away: {activeMerchantVenue.takeawayReady ? "ON" : "OFF"}
                </button>
              </div>

              {/* #4: Vibe Tags του καταστήματος */}
              <div className="flex flex-wrap items-center gap-1.5">
                {VIBE_OPTIONS.map((tag) => {
                  const hasTag = activeMerchantVenue.vibeTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => {
                        const updatedTags = hasTag
                          ? activeMerchantVenue.vibeTags.filter((t) => t !== tag)
                          : [...activeMerchantVenue.vibeTags, tag];
                        updateMerchantVenueLive(activeMerchantVenue.id, {
                          vibeTags: updatedTags,
                        });
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition cursor-pointer ${
                        hasTag
                          ? "bg-amber-400/20 text-amber-300 border-amber-400/50"
                          : "bg-neutral-950 text-neutral-500 border-neutral-800"
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

        {currentBooking && (
          <div className="mb-10 p-6 bg-neutral-900 border-2 border-amber-400 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-widest px-3 py-1 bg-amber-400/20 text-amber-300 rounded-full font-bold">
                ✓ e-Ticket Έτοιμο & Αποθηκευμένο
              </span>
              <h2 className="text-2xl font-bold text-white">
                {currentBooking.venueName}
              </h2>
              <p className="text-neutral-300 text-sm">
                Ώρα:{" "}
                <span className="font-semibold text-white">
                  {currentBooking.timeWindow}
                </span>{" "}
                | Ημερομηνία: {currentBooking.date}
              </p>
              <p className="text-neutral-300 text-sm">
                Τύπος:{" "}
                <span className="font-semibold text-white">
                  {currentBooking.orderMode === "takeaway"
                    ? "🛍️ Παραλαβή Take-away"
                    : `🍽️ Τραπέζι (${currentBooking.partySize} άτομα)`}
                </span>{" "}
                | Προσφορά:{" "}
                <span className="text-amber-400 font-bold">
                  {currentBooking.discount}
                </span>
              </p>
              <div className="pt-2">
                <button
                  onClick={handleShareCurrentBooking}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <span>📲</span> Κοινοποίηση στην παρέα
                </button>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl flex flex-col items-center">
              <QRCodeSVG
                value={`HAPPYSEATS:${currentBooking.ticketCode}|${currentBooking.venueName}|${currentBooking.partySize}P`}
                size={140}
              />
              <span className="text-black font-mono font-bold text-sm mt-2">
                {currentBooking.ticketCode}
              </span>
            </div>
          </div>
        )}

        {/* Μπάρα Αναζήτησης και Φίλτρων */}
        <section className="bg-neutral-900 border border-neutral-800 p-5 rounded-3xl mb-8 shadow-lg space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                Αναζήτηση
              </label>
              <input
                type="text"
                placeholder="Όνομα μαγαζιού ή κουζίνα..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 placeholder:text-neutral-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                Περιοχή
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
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
              <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                Έκπτωση
              </label>
              <select
                value={minDiscount}
                onChange={(e) => setMinDiscount(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                <option value={0}>Όλες οι εκπτώσεις</option>
                <option value={20}>Τουλάχιστον -20%</option>
                <option value={30}>Τουλάχιστον -30%</option>
                <option value={40}>Τουλάχιστον -40%</option>
                <option value={50}>Happy Hour (-50%)</option>
              </select>
            </div>
          </div>

          {/* #4 & #2 & #7: Live Vibe & Weather Chips + Panic Deal Filter */}
          <div className="pt-2 border-t border-neutral-800/60 space-y-2">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Live Vibe & Διαθεσιμοτητα Τωρα
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setOnlyPanicDeals((prev) => !prev)}
                className={`text-xs px-3 py-1.5 rounded-full font-bold border transition cursor-pointer ${
                  onlyPanicDeals
                    ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/20"
                    : "bg-neutral-950 text-red-400 border-red-500/30 hover:border-red-500/60"
                }`}
              >
                🔥 Flash Τραπέζια (-30% Τώρα)
              </button>

              <button
                onClick={() => setOnlyTakeaway((prev) => !prev)}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition cursor-pointer ${
                  onlyTakeaway
                    ? "bg-emerald-500 text-neutral-950 border-emerald-400"
                    : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
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
                        ? "bg-amber-400 text-neutral-950 border-amber-300"
                        : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-neutral-800/60 text-xs">
            <span className="text-neutral-400">
              Βρέθηκαν{" "}
              <strong className="text-amber-400">{filteredVenues.length}</strong>{" "}
              καταστήματα
            </span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowMap((prev) => !prev)}
                className="px-3 py-1 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer"
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
                  className="text-neutral-400 hover:text-white transition underline cursor-pointer"
                >
                  Καθαρισμός
                </button>
              )}
            </div>
          </div>
        </section>

        {showMap && <VenueMap venues={mapVenuesData} />}

        <h2 className="text-xl font-bold mb-6">Διαθέσιμες Προσφορές Σήμερα</h2>

        {loading ? (
          <div className="text-center py-20 text-neutral-500 text-sm">
            Φόρτωση προσφορών...
          </div>
        ) : filteredVenues.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 p-12 rounded-3xl text-center space-y-3">
            <span className="text-3xl">🍽️</span>
            <h3 className="font-bold text-white text-base">
              Δεν βρέθηκαν διαθέσιμες προσφορές
            </h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Αυτή τη στιγμή δεν υπάρχουν ενεργά happy hour τραπέζια για τα
              κριτήρια που επιλέξατε. Δοκιμάστε να καθαρίσετε τα φίλτρα ή
              ελέγξτε ξανά σε λίγο!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredVenues.map((venue) => (
              <div
                key={venue.id}
                className={`bg-neutral-900 rounded-3xl overflow-hidden border shadow-md transition ${
                  venue.panicDealActive
                    ? "border-red-500/60 shadow-red-950/30"
                    : "border-neutral-800"
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

                  {/* #2: Panic Deal Overlay Banner */}
                  {venue.panicDealActive && (
                    <div className="absolute top-3 left-3 right-3 bg-red-600/95 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl flex items-center justify-between text-xs font-black shadow-lg animate-pulse">
                      <span>🔥 FLASH FILL-THE-TABLE</span>
                      <span>{venue.panicDealText}</span>
                    </div>
                  )}

                  {/* #7: Live Table Status Badge πάνω στη φωτογραφία */}
                  <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5">
                    {venue.tableStatus === "plenty" && (
                      <span className="text-[11px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-full backdrop-blur-sm">
                        🟢 Άνετο για Παρέα
                      </span>
                    )}
                    {venue.tableStatus === "few" && (
                      <span className="text-[11px] font-bold bg-amber-950/90 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-full backdrop-blur-sm">
                        🟠 1-3 Τραπέζια
                      </span>
                    )}
                    {venue.tableStatus === "full" && (
                      <span className="text-[11px] font-bold bg-red-950/90 text-red-300 border border-red-500/40 px-2.5 py-1 rounded-full backdrop-blur-sm">
                        🔴 Πλήρες Τραπεζιών
                      </span>
                    )}

                    {venue.takeawayReady && (
                      <span className="text-[11px] font-bold bg-neutral-950/90 text-neutral-200 border border-neutral-700 px-2.5 py-1 rounded-full backdrop-blur-sm">
                        🛍️ Take-away Ready
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex justify-between items-start mb-1">
                    <Link
                      href={`/venue/${venue.slug}`}
                      className="hover:text-amber-400 transition"
                    >
                      <h3 className="text-lg font-bold text-white">
                        {venue.name} →
                      </h3>
                    </Link>
                    <span className="text-xs bg-neutral-800 text-neutral-300 px-2.5 py-1 rounded-md border border-neutral-700/50">
                      {venue.area}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mb-3">
                    {venue.category}
                  </p>

                  {/* #4: Live Vibe & Weather Tags */}
                  {venue.vibeTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {venue.vibeTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] bg-neutral-950 text-amber-300/90 border border-neutral-800 px-2.5 py-0.5 rounded-lg font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                        Διαθέσιμες Χρονοθυρίδες
                      </span>

                      {/* #3: Κουμπί «Κλείδωμα Παρέας (15')» */}
                      {venue.tableStatus !== "full" && (
                        <button
                          onClick={() => handleSquadLock(venue)}
                          className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                        >
                          🤝 Κράτα το για την παρέα (15&apos;)
                        </button>
                      )}
                    </div>

                    {venue.slots.length === 0 ? (
                      <p className="text-xs text-neutral-500 py-3 italic">
                        Δεν υπάρχουν ενεργές χρονοθυρίδες αυτή τη στιγμή.
                      </p>
                    ) : (
                      venue.slots.map((slot) => (
                        <SlotItem
                          key={slot.id}
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
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* #6: Modal Επαλήθευσης Φοιτητικού / Office Break Πάσου */}
      {showPassModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">
                🎓 / 💼 Ξεκλείδωμα Micro-Zone Deals
              </h3>
              <button
                onClick={() => setShowPassModal(false)}
                className="text-neutral-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Δήλωσε το ακαδημαϊκό σου email (π.χ. <code>.edu.gr</code>) για
              αποκλειστικές φοιτητικές προσφορές ή το εταιρικό σου email για{" "}
              <strong>Office Lunch Break deals (13:00–16:00)</strong> χωρίς
              ουρά.
            </p>

            {verifiedPass && (
              <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-indigo-300">
                    Ενεργό:{" "}
                    {verifiedPass.type === "student"
                      ? "🎓 Φοιτητικό Πάσο"
                      : "💼 Office Break Pass"}
                  </div>
                  <div className="text-neutral-400">{verifiedPass.email}</div>
                </div>
                <button
                  onClick={() => {
                    setVerifiedPass(null);
                    localStorage.removeItem("happyseats_microzone_pass");
                  }}
                  className="text-red-400 hover:underline font-semibold cursor-pointer"
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
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPassModal(false)}
                  className="flex-1 py-2.5 bg-neutral-800 rounded-xl text-xs font-semibold hover:bg-neutral-700 transition cursor-pointer"
                >
                  Κλείσιμο
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-400 text-neutral-950 rounded-xl text-xs font-bold hover:bg-amber-300 transition cursor-pointer"
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
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white">
              Επιβεβαίωση Κράτησης
            </h3>
            <p className="text-sm text-neutral-300">
              {selectedVenue.name} ({selectedSlot.timeWindow})
            </p>
            <div className="text-xs text-amber-400 font-semibold">
              {selectedSlot.discount}
            </div>

            {/* Επιλογή Τραπέζι ή Παραλαβή Take-away */}
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Τρόπος Εξυπηρέτησης:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={selectedVenue.tableStatus === "full"}
                  onClick={() => setOrderMode("dine-in")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    orderMode === "dine-in"
                      ? "bg-amber-400 text-neutral-950 border-amber-300"
                      : "bg-neutral-950 text-neutral-400 border-neutral-800"
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
                      ? "bg-amber-400 text-neutral-950 border-amber-300"
                      : "bg-neutral-950 text-neutral-400 border-neutral-800"
                  } disabled:opacity-40`}
                >
                  🛍️ Παραλαβή
                </button>
              </div>
            </div>

            {orderMode === "dine-in" && (
              <div>
                <label className="block text-xs text-neutral-400 mb-1">
                  Αριθμός Ατόμων:
                </label>
                <select
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-sm text-white focus:outline-none"
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
                className="flex-1 py-2.5 bg-neutral-800 rounded-xl text-sm font-semibold hover:bg-neutral-700 transition cursor-pointer"
              >
                Άκυρο
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleBooking}
                className="flex-1 py-2.5 bg-amber-400 text-neutral-950 rounded-xl text-sm font-bold hover:bg-amber-300 transition disabled:opacity-50 cursor-pointer"
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