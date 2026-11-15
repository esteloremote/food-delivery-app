"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// Δυναμική φόρτωση του χάρτη ΜΟΝΟ στον browser (λύνει οριστικά το "window is not defined")
const VenueMap = dynamic(() => import("@/components/VenueMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-xs text-text-muted">
      Φόρτωση διαδραστικού χάρτη...
    </div>
  ),
});

// --- ΤΥΠΟΙ ΔΕΔΟΜΕΝΩΝ ---
export type TableStatus = "plenty" | "few" | "full";

interface VenueDoc {
  id: string;
  name: string;
  slug: string;
  category?: string;
  area?: string;
  address?: string;
  imageUrl?: string;
  tableStatus?: TableStatus;
  takeawayReady?: boolean;
  panicDealActive?: boolean;
  panicDealText?: string;
  vibeTags?: string[];
  lat?: number;
  lng?: number;
  rainAutoDeal?: boolean;
  missYouCampaign?: boolean;
  bountyActive?: boolean;
  bountyText?: string;
}

interface SlotDeal {
  id: string;
  venueId?: string;
  venueName: string;
  timeWindow: string;
  discount: string;
  availableTables: number;
  totalTables: number;
  isVipOnly?: boolean;
  isBounty?: boolean;
  isRainDeal?: boolean;
  bonusPerk?: string;
}

export const VIBE_OPTIONS = [
  "☀️ Έχει ήλιο έξω",
  "🔥 Σόμπες αναμμένες",
  "💻 Χαλαρό για δουλειά",
  "⚽ Δείχνει αγώνα",
];

const AREAS = [
  "Όλες οι περιοχές",
  "Κολωνάκι",
  "Παγκράτι",
  "Χαλάνδρι",
  "Γλυφάδα",
  "Νίκαια",
];

const AI_QUICK_PROMPTS = [
  {
    label: "🍷 Ραντεβού για 2 (Cozy)",
    query: "Είμαστε 2 άτομα για ραντεβού, θέλουμε ζεστή ατμόσφαιρα με σόμπες",
  },
  {
    label: "💻 Ήσυχο καφέ για laptop",
    query: "Ψάχνω χαλαρό μαγαζί για δουλειά με laptop και καφέ",
  },
  {
    label: "🌧️ Βρέχει! Δείξε μου Weather Deals",
    query: "Πιάσε βροχή, δείξε μου προσφορές καιρού και ζεστά στέκια",
  },
  {
    label: "🎯 Ακυρώσεις Τελευταίας Στιγμής (Bounty)",
    query: "Θέλω No-Show Bounty με -40% και δωρεάν κέρασμα τώρα",
  },
];

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Φίλτρα
  const [selectedArea, setSelectedArea] = useState("all");
  const [minDiscount, setMinDiscount] = useState(0);
  const [activeVibes, setActiveVibes] = useState<string[]>([]);

  // #5, #6, #7 Live States (συγχρονίζονται με το Firebase ΚΑΙ μπορούν να δοκιμαστούν live)
  const [rainModeActive, setRainModeActive] = useState(true); // Ενεργό default για να φαίνεται αμέσως το #5 Weather Deal
  const [showMissYouBanner, setShowMissYouBanner] = useState(true); // Ενεργό για επίδειξη του #6 Auto "Miss You"
  const [demoBountyActive, setDemoBountyActive] = useState(true); // Ενεργό για επίδειξη του #7 No-Show Bounty
  const [bountyCountdown, setBountyCountdown] = useState(599); // 10 λεπτά (599 δευτ.)

  // #9 AI Mood Concierge State
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  // Δυναμικά Δεδομένα (Firebase)
  const [venues, setVenues] = useState<VenueDoc[]>([]);
  const [slots, setSlots] = useState<SlotDeal[]>([]);

  // B2B "Office Break" State
  const [showB2bModal, setShowB2bModal] = useState(false);
  const [b2bEmail, setB2bEmail] = useState("");
  const [isB2bVerified, setIsB2bVerified] = useState(false);

  // Gamification (Streak)
  const [userStreak, setUserStreak] = useState(2);

  // Dark/Light Mode State
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Κλείδωμα Παρέας (15') State
  const [lockingSlotId, setLockingSlotId] = useState<string | null>(null);
  const [lockedSlots, setLockedSlots] = useState<{ [key: string]: number }>({});
  const timerRefs = useRef<{ [key: string]: ReturnType<typeof setInterval> }>({});

  // Κράτηση (Booking Modal) State
  const [bookingSlot, setBookingSlot] = useState<SlotDeal | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [orderMode, setOrderMode] = useState<"dine-in" | "takeaway">("dine-in");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookedTicketCode, setBookedTicketCode] = useState<string | null>(null);

  // 1. Initial Load & Firebase Listeners
  useEffect(() => {
    const savedTheme = localStorage.getItem("happyseats_theme");
    if (
      savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    }

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          if (userSnap.exists()) {
            setUserStreak(userSnap.data().streak || 2);
          }
        } catch (e) {
          console.error(e);
        }
      }
    });

    const unsubVenues = onSnapshot(collection(db, "venues"), (snap) => {
      const list: VenueDoc[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...(docSnap.data() as Omit<VenueDoc, "id">) });
      });
      setVenues(list);
    });

    const unsubSlots = onSnapshot(collection(db, "slots"), (snap) => {
      const list: SlotDeal[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...(docSnap.data() as Omit<SlotDeal, "id">) });
      });
      setSlots(list);
    });

    return () => {
      unsubAuth();
      unsubVenues();
      unsubSlots();
    };
  }, []);

  // Χρονόμετρο αντίστροφης μέτρησης για τα No-Show Bounties (10')
  useEffect(() => {
    const interval = setInterval(() => {
      setBountyCountdown((prev) => (prev > 1 ? prev - 1 : 599));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Toggle Dark Mode
  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("happyseats_theme", "light");
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("happyseats_theme", "dark");
      setIsDarkMode(true);
    }
  };

  // 3. #9 AI Mood Concierge Logic (Έξυπνη ανάλυση φυσικής γλώσσας)
  const runAiConcierge = (inputQuery: string) => {
    const text = inputQuery.toLowerCase();
    let detectedArea = "all";
    const detectedVibes: string[] = [];
    let detectedDiscount = 0;
    const notes: string[] = [];

    // Έλεγχος αν η περιοχή που έγραψε ο χρήστης υπάρχει όντως στα καταστήματα της βάσης
    const availableAreasInDb = venues
      .map((v) => v.area)
      .filter((a): a is string => Boolean(a));

    const areaKeywords = [
      { key: "παγκράτι", alt: "παγκρατι", name: "Παγκράτι" },
      { key: "κολωνάκι", alt: "κολωνακι", name: "Κολωνάκι" },
      { key: "χαλάνδρι", alt: "χαλανδρι", name: "Χαλάνδρι" },
      { key: "γλυφάδα", alt: "γλυφαδα", name: "Γλυφάδα" },
      { key: "νίκαια", alt: "νικαια", name: "Νίκαια" },
    ];

    let requestedAreaName: string | null = null;
    for (const a of areaKeywords) {
      if (text.includes(a.key) || text.includes(a.alt)) {
        requestedAreaName = a.name;
        if (availableAreasInDb.includes(a.name)) {
          detectedArea = a.name;
          notes.push(`περιοχή ${a.name}`);
        }
        break;
      }
    }

    if (
      text.includes("δουλειά") ||
      text.includes("laptop") ||
      text.includes("διάβασμα") ||
      text.includes("ήσυχο") ||
      text.includes("χαλαρό") ||
      text.includes("πρωινό") ||
      text.includes("καφέ")
    ) {
      if (venues.some((v) => (v.vibeTags || []).includes("💻 Χαλαρό για δουλειά"))) {
        detectedVibes.push("💻 Χαλαρό για δουλειά");
      }
      notes.push("ιδανικό για καφέ/πρωινό ή laptop");
    }

    if (
      text.includes("ραντεβού") ||
      text.includes("ζεστ") ||
      text.includes("σόμπ") ||
      text.includes("βροχ") ||
      text.includes("weather")
    ) {
      setRainModeActive(true);
      notes.push("🌧️ ενεργοποίηση Weather Auto-Deals (-20%)");
    }

    if (text.includes("αγών") || text.includes("μπύρ") || text.includes("μπάλα")) {
      if (venues.some((v) => (v.vibeTags || []).includes("⚽ Δείχνει αγώνα"))) {
        detectedVibes.push("⚽ Δείχνει αγώνα");
      }
      notes.push("προβολή αγώνα & μπύρες");
    }

    if (
      text.includes("bounty") ||
      text.includes("ακύρωσ") ||
      text.includes("μεγάλη έκπτωση")
    ) {
      setDemoBountyActive(true);
      detectedDiscount = 30;
      notes.push("🎯 No-Show Bounties (-40% + Κέρασμα)");
    }

    setSelectedArea(detectedArea);
    setActiveVibes(detectedVibes);
    setMinDiscount(detectedDiscount);

    const bestVenueName = venues[0]?.name || "Estelo";
    if (requestedAreaName && detectedArea === "all") {
      setAiResponse(
        `✨ Ο AI Μετρ είδε ότι ψάχνεις για «${requestedAreaName}». Επειδή δεν υπάρχει διαθέσιμο τραπέζι εκεί αυτή τη στιγμή, σου βρήκε τις καλύτερες εναλλακτικές προσφορές (π.χ. στο ${bestVenueName} έως -50%)!`
      );
    } else if (notes.length > 0) {
      setAiResponse(
        `✨ Ο AI Μετρ ρύθμισε αυτόματα την αναζήτηση για: ${notes.join(", ")}. Κορυφαία πρόταση: ${bestVenueName}!`
      );
    } else {
      setAiResponse(
        `✨ Ο AI Μετρ ανέλυσε το αίτημά σου («${inputQuery}») και ξεχώρισε τα τραπέζια με τη μεγαλύτερη έκπτωση αυτή τη στιγμή!`
      );
    }
  };

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    runAiConcierge(aiPrompt);
  };

  const resetAiConcierge = () => {
    setAiPrompt("");
    setAiResponse(null);
    setSelectedArea("all");
    setActiveVibes([]);
    setMinDiscount(0);
  };

  // 4. B2B Verification Logic
  const handleB2bVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (b2bEmail.endsWith(".gr") || b2bEmail.endsWith(".com")) {
      setIsB2bVerified(true);
      setShowB2bModal(false);
    } else {
      alert("Παρακαλούμε εισάγετε ένα έγκυρο εταιρικό ή ακαδημαϊκό email.");
    }
  };

  // 5. Squad Lock Logic (15')
  const handleSquadLock = (slotId: string, venueName: string) => {
    if (lockedSlots[slotId]) return;
    setLockingSlotId(slotId);
    setLockedSlots((prev) => ({ ...prev, [slotId]: 900 }));

    timerRefs.current[slotId] = setInterval(() => {
      setLockedSlots((prev) => {
        const current = prev[slotId];
        if (current <= 1) {
          clearInterval(timerRefs.current[slotId]);
          const newState = { ...prev };
          delete newState[slotId];
          return newState;
        }
        return { ...prev, [slotId]: current - 1 };
      });
    }, 1000);

    const shareText = `Έκλεισα προσωρινά τραπέζι στο ${venueName} για τα επόμενα 15 λεπτά μέσω HappySeats! Μπες να επιβεβαιώσεις για να το κρατήσουμε.`;
    if (navigator.share) {
      navigator
        .share({
          title: "HappySeats Κράτηση Παρέας",
          text: shareText,
          url: window.location.href,
        })
        .catch(console.error);
    } else {
      navigator.clipboard.writeText(shareText);
      alert(`Αντιγράφηκε στο πρόχειρο:\n\n${shareText}`);
    }

    setTimeout(() => setLockingSlotId(null), 600);
  };

  // 6. Ολοκλήρωση Κράτησης (Αποθήκευση στο Firebase)
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingSlot) return;
    setIsSubmittingBooking(true);

    try {
      const randomCode = `HS-${Math.floor(1000 + Math.random() * 9000)}`;
      const todayStr = new Date().toLocaleDateString("el-GR");

      await addDoc(collection(db, "bookings"), {
        ticketCode: randomCode,
        venueName: bookingSlot.venueName,
        timeWindow: bookingSlot.timeWindow,
        discount: bookingSlot.discount,
        partySize: Number(partySize),
        orderMode,
        date: todayStr,
        status: "confirmed",
        userId: currentUser?.uid || "guest",
        userEmail: currentUser?.email || "guest@happyseats.gr",
        createdAt: serverTimestamp(),
      });

      // Αν είναι κανονικό slot στη βάση, μειώνουμε τα διαθέσιμα τραπέζια κατά 1
      if (
        !bookingSlot.id.startsWith("bounty-") &&
        !bookingSlot.id.startsWith("rain-") &&
        !bookingSlot.id.startsWith("panic-") &&
        bookingSlot.availableTables > 0
      ) {
        await updateDoc(doc(db, "slots", bookingSlot.id), {
          availableTables: Math.max(0, bookingSlot.availableTables - 1),
        });
      }

      setBookedTicketCode(randomCode);
    } catch (err) {
      console.error("Σφάλμα κράτησης:", err);
      alert("Παρουσιάστηκε σφάλμα κατά την κράτηση.");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // 7. Φιλτράρισμα Μαγαζιών
  const filteredVenues = useMemo(() => {
    return venues.filter((v) => {
      const areaMatch = selectedArea === "all" || v.area === selectedArea;
      const vibeMatch =
        activeVibes.length === 0 ||
        activeVibes.every((tag) => (v.vibeTags || []).includes(tag));
      return areaMatch && vibeMatch;
    });
  }, [venues, selectedArea, activeVibes]);

  // Εμπλουτισμός των Venues με bestDiscount & συντεταγμένες για να ΜΗΝ γράφει "undefined" ο χάρτης!
  const mapVenues = useMemo(() => {
    return filteredVenues.map((v, index) => {
      const venueSlots = slots.filter((s) => s.venueName === v.name);
      let maxDisc = 30;
      venueSlots.forEach((s) => {
        const num = parseInt(s.discount.replace("-", "").replace("%", ""), 10);
        if (!isNaN(num) && num > maxDisc) maxDisc = num;
      });
      if (v.bountyActive || (demoBountyActive && index === 0)) {
        maxDisc = Math.max(maxDisc, 40);
      }

      const bestDiscountStr = `-${maxDisc}%`;

      return {
        ...v,
        name: v.name || "Κατάστημα",
        category: v.category || "All Day Cafe & Bar",
        area: v.area || "Αθήνα",
        lat: v.lat || 37.9755 + index * 0.006,
        lng: v.lng || 23.7348 + index * 0.006,
        bestDiscount: bestDiscountStr,
        discount: bestDiscountStr,
      };
    });
  }, [filteredVenues, slots, demoBountyActive]);

  // 8. Δημιουργία Λίστας Προσφορών (Κανονικά Slots + #7 Bounties + #5 Weather Deals + Flash Deals)
  const displaySlots = useMemo(() => {
    let result: SlotDeal[] = [...slots];

    filteredVenues.forEach((v, idx) => {
      // #7 No-Show Bounty (από το Firebase του καταστηματάρχη Ή από το Live Demo toggle)
      if (v.bountyActive || (demoBountyActive && idx === 0)) {
        result.unshift({
          id: `bounty-${v.id}`,
          venueId: v.id,
          venueName: v.name,
          timeWindow: `Άφιξη σε ${formatTime(bountyCountdown)} (Bounty)`,
          discount: "-40%",
          availableTables: 1,
          totalTables: 1,
          isBounty: true,
          bonusPerk: "🎁 + Δωρεάν Ορεκτικό / Κέρασμα",
        });
      }

      // #5 Weather-Triggered Deal (όταν βρέχει ή το έχει ενεργοποιήσει το μαγαζί)
      if (v.rainAutoDeal || rainModeActive) {
        result.push({
          id: `rain-${v.id}`,
          venueId: v.id,
          venueName: v.name,
          timeWindow: "Weather Auto-Deal (Τώρα)",
          discount: "-20%",
          availableTables: 3,
          totalTables: 4,
          isRainDeal: true,
          bonusPerk: "🌧️ Rainy Day Deal (Ζεστά Ροφήματα & Σόμπες)",
        });
      }

      // Flash / Panic Deal
      if (v.panicDealActive) {
        result.unshift({
          id: `panic-${v.id}`,
          venueId: v.id,
          venueName: v.name,
          timeWindow: "Επόμενα 30'",
          discount: "-30%",
          availableTables: 3,
          totalTables: 3,
        });
      }
    });

    if (minDiscount > 0) {
      result = result.filter((s) => {
        const d = parseInt(s.discount.replace("-", "").replace("%", ""), 10);
        return d >= minDiscount;
      });
    }

    const validVenueNames = filteredVenues.map((v) => v.name);
    result = result.filter((s) => validVenueNames.includes(s.venueName));

    return result;
  }, [slots, filteredVenues, minDiscount, rainModeActive, demoBountyActive, bountyCountdown]);

  return (
    <div className="min-h-screen bg-surface text-text-main font-sans transition-colors duration-200">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-border-theme px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black tracking-tight text-brand-text flex items-center gap-2">
              <span className="text-brand">Happy</span>Seats
            </h1>
            <p className="text-[10px] sm:text-xs font-semibold text-text-muted mt-0.5 max-w-xs">
              Κλείσε τραπέζι ή παραλαβή τις σωστές ώρες, κέρδισε έκπτωση.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Dark/Light Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2.5 rounded-xl bg-card border border-border-theme text-text-main hover:bg-subtle transition cursor-pointer shadow-sm flex items-center justify-center"
              aria-label="Toggle Dark Mode"
              title="Εναλλαγή Dark / Light Mode"
            >
              {isDarkMode ? "🌞" : "🌙"}
            </button>

            {!isB2bVerified ? (
              <button
                onClick={() => setShowB2bModal(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition cursor-pointer"
              >
                <span>💼</span> Office/Student Pass
              </button>
            ) : (
              <span className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                <span>✓</span> Pass Ενεργό
              </span>
            )}

            {currentUser ? (
              <>
                <div className="hidden sm:flex items-center gap-1 px-3 py-2 bg-brand/10 rounded-xl border border-brand/20">
                  <span className="text-xs font-bold text-brand-text">VIP Streak:</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={`text-sm ${
                          i <= userStreak ? "opacity-100" : "opacity-30 grayscale"
                        }`}
                      >
                        ☕
                      </span>
                    ))}
                  </div>
                </div>
                <Link
                  href="/my-tickets"
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-sm cursor-pointer"
                >
                  🎟️ Τα Εισιτήριά μου
                </Link>
                <button
                  onClick={() => signOut(auth)}
                  className="px-3 py-2 text-text-muted hover:text-text-main text-xs font-semibold cursor-pointer"
                >
                  Έξοδος
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-sm cursor-pointer"
                >
                  Σύνδεση
                </Link>
                <Link
                  href="/merchant/login"
                  className="px-3 py-2 text-text-muted hover:text-text-main text-xs font-semibold cursor-pointer"
                >
                  Συνεργάτες Εστίασης →
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* #5, #6, #7 LIVE SMART RADAR BAR (Καιρός, Miss You Campaign & No-Show Bounty) */}
        <section className="bg-card border border-border-theme rounded-3xl p-4 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-xl shrink-0">
              {rainModeActive ? "🌧️" : "☀️"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-sky-600 text-white px-2 py-0.5 rounded-md">
                  #5 LIVE WEATHER RADAR
                </span>
                <span className="text-xs font-bold text-text-main">
                  {rainModeActive
                    ? "Εντοπίστηκε Βροχόπτωση — Ενεργά τα Weather Auto-Deals (-20%)"
                    : "Καθαρός Καιρός — Κανονική ροή προσφορών"}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                Ο αλγόριθμος ενεργοποιεί αυτόματα εκπτώσεις σε κοντινά στεγασμένα στέκια μόλις χαλάσει ο καιρός.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setRainModeActive(!rainModeActive)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                rainModeActive
                  ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                  : "bg-subtle text-text-muted border-border-theme"
              }`}
            >
              🌧️ Weather Deals: {rainModeActive ? "ON" : "OFF"}
            </button>

            <button
              type="button"
              onClick={() => setDemoBountyActive(!demoBountyActive)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                demoBountyActive
                  ? "bg-amber-400 text-neutral-950 border-amber-500 shadow-sm"
                  : "bg-subtle text-text-muted border-border-theme"
              }`}
            >
              🎯 No-Show Bounty: {demoBountyActive ? "ON" : "OFF"}
            </button>

            <button
              type="button"
              onClick={() => setShowMissYouBanner(!showMissYouBanner)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                showMissYouBanner
                  ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                  : "bg-subtle text-text-muted border-border-theme"
              }`}
            >
              💌 &ldquo;Miss You&rdquo; Κουπόνι: {showMissYouBanner ? "ON" : "OFF"}
            </button>
          </div>
        </section>

        {/* #6 AUTO "MISS YOU" CAMPAIGN BANNER */}
        {showMissYouBanner && (
          <section className="p-4 rounded-3xl bg-purple-500/10 border-2 border-purple-400/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💌</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white px-2 py-0.5 rounded-md">
                    #6 AUTO &ldquo;MISS YOU&rdquo; REWARD
                  </span>
                  <h3 className="text-xs sm:text-sm font-black text-text-main">
                    Μας έλειψες! Έχεις 14 μέρες να επισκεφτείς το αγαπημένο σου στέκι
                  </h3>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  Κλείσε τραπέζι σήμερα σε οποιοδήποτε συνεργαζόμενο κατάστημα και <strong>ο 1ος καφές ή το γλυκό είναι κερασμένα από εμάς!</strong>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowMissYouBanner(false)}
              className="text-xs font-bold text-text-muted hover:text-text-main px-2 py-1 cursor-pointer self-end sm:self-center"
            >
              ✕
            </button>
          </section>
        )}

        {/* #9 AI MOOD CONCIERGE (Ο ΨΗΦΙΑΚΟΣ ΜΕΤΡ) */}
        <section className="bg-card border-2 border-brand rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest bg-brand text-white px-2.5 py-1 rounded-full">
                ✨ #9 AI MOOD CONCIERGE
              </span>
              <h2 className="text-base sm:text-lg font-black text-text-main mt-1.5">
                Πες στον ψηφιακό Μετρ τι ψάχνεις σήμερα
              </h2>
            </div>
            {aiResponse && (
              <button
                onClick={resetAiConcierge}
                className="text-xs font-bold text-text-muted hover:text-text-main underline cursor-pointer self-start sm:self-auto"
              >
                Καθαρισμός AI φίλτρων
              </button>
            )}
          </div>

          <form onSubmit={handleAiSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="π.χ. Είμαστε 2 άτομα, θέλουμε κάτι χαλαρό για πρωινό ή ραντεβού..."
              className="flex-1 bg-subtle border border-border-theme text-text-main text-xs sm:text-sm rounded-2xl px-4 py-3 focus:outline-none focus:border-brand"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-brand hover:bg-brand-hover text-white font-black text-xs sm:text-sm rounded-2xl transition shadow-sm cursor-pointer shrink-0"
            >
              ✨ Βρες μου Τραπέζι
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {AI_QUICK_PROMPTS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setAiPrompt(item.query);
                  runAiConcierge(item.query);
                }}
                className="text-[11px] font-semibold bg-subtle hover:bg-brand-light hover:text-brand-text text-text-muted border border-border-theme px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {aiResponse && (
            <div className="p-3.5 bg-brand-light border border-brand-border text-brand-text rounded-2xl text-xs font-bold flex items-center justify-between">
              <span>{aiResponse}</span>
            </div>
          )}
        </section>

        {/* FILTERS */}
        <section className="bg-card border border-border-theme p-4 sm:p-6 rounded-3xl shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider pl-1">
                Πού ψάχνεις;
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full bg-subtle border border-border-theme text-text-main font-bold text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-brand cursor-pointer shadow-inner"
              >
                {AREAS.map((a) => (
                  <option key={a} value={a === "Όλες οι περιοχές" ? "all" : a}>
                    📍 {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider pl-1">
                Ελάχιστη Έκπτωση
              </label>
              <select
                value={minDiscount}
                onChange={(e) => setMinDiscount(Number(e.target.value))}
                className="w-full bg-subtle border border-border-theme text-text-main font-bold text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-brand cursor-pointer shadow-inner"
              >
                <option value={0}>Όλες οι εκπτώσεις</option>
                <option value={20}>Τουλάχιστον -20%</option>
                <option value={30}>Τουλάχιστον -30%</option>
                <option value={40}>Τουλάχιστον -40%</option>
                <option value={50}>Happy Hour (-50%)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-border-theme">
            <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider pl-1 block mb-2">
              Τι φάση ψάχνεις τώρα; (Live Vibes)
            </label>
            <div className="flex flex-wrap gap-2">
              {VIBE_OPTIONS.map((vibe) => (
                <button
                  key={vibe}
                  onClick={() =>
                    setActiveVibes((prev) =>
                      prev.includes(vibe)
                        ? prev.filter((v) => v !== vibe)
                        : [...prev, vibe]
                    )
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                    activeVibes.includes(vibe)
                      ? "bg-brand text-white border-brand shadow-sm"
                      : "bg-subtle text-text-muted border-border-theme hover:bg-card"
                  }`}
                >
                  {vibe}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* MAP & LIST SPLIT */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[620px]">
          <div className="lg:col-span-2 bg-card border border-border-theme rounded-3xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-border-theme bg-subtle flex justify-between items-center shrink-0">
              <h2 className="font-black text-text-main flex items-center gap-2">
                <span>📍</span> Χάρτης & Live Vibe
              </h2>
            </div>
            <div className="flex-1 bg-surface relative z-0">
              <VenueMap venues={mapVenues} />
            </div>
          </div>

          <div className="lg:col-span-3 bg-card border border-border-theme rounded-3xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-border-theme bg-subtle flex justify-between items-center shrink-0">
              <h2 className="font-black text-text-main flex items-center gap-2">
                <span>🔥</span> Διαθέσιμες Προσφορές, Weather Deals & Bounties
              </h2>
              <span className="text-xs bg-brand/10 text-brand-text px-3 py-1 rounded-full font-bold border border-brand/20">
                Βρέθηκαν {displaySlots.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {displaySlots.length === 0 ? (
                <div className="text-center py-12 text-sm text-text-muted italic h-full flex flex-col items-center justify-center">
                  <span className="text-4xl mb-3">🧐</span>
                  Δεν βρέθηκαν προσφορές με αυτά τα φίλτρα. Πατήστε «Όλες οι περιοχές» για να δείτε όλα τα διαθέσιμα καταστήματα.
                </div>
              ) : (
                displaySlots.map((slot) => {
                  const venue = venues.find((v) => v.name === slot.venueName);
                  const isPanic = slot.id.startsWith("panic-");
                  const isBounty = Boolean(slot.isBounty);
                  const isRainDeal = Boolean(slot.isRainDeal);
                  const isLocked = !!lockedSlots[slot.id];

                  return (
                    <div
                      key={slot.id}
                      className={`relative flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl border transition shadow-sm group ${
                        isBounty
                          ? "bg-amber-400/15 border-2 border-amber-500"
                          : isPanic
                            ? "bg-red-50/50 border-red-200"
                            : isRainDeal
                              ? "bg-sky-500/10 border-2 border-sky-400"
                              : "bg-surface border-border-theme hover:border-brand"
                      }`}
                    >
                      <div className="flex-1 w-full text-left">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-base font-black text-text-main">
                            {slot.venueName}
                          </h3>
                          {isBounty && (
                            <span className="text-[10px] bg-amber-400 text-neutral-950 font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                              🎯 #7 NO-SHOW BOUNTY ({formatTime(bountyCountdown)})
                            </span>
                          )}
                          {isPanic && (
                            <span className="text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded-md animate-pulse uppercase tracking-widest">
                              Flash Deal
                            </span>
                          )}
                          {isRainDeal && (
                            <span className="text-[10px] bg-sky-600 text-white font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                              🌧️ #5 WEATHER AUTO-DEAL
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-text-muted mb-2">
                          <span className="flex items-center gap-1">
                            🕒 {slot.timeWindow}
                          </span>
                          <span className="flex items-center gap-1">
                            🪑 {slot.availableTables} τραπέζια
                          </span>
                          {slot.bonusPerk && (
                            <span className="text-brand-text font-bold">
                              {slot.bonusPerk}
                            </span>
                          )}
                        </div>

                        {venue?.vibeTags && venue.vibeTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {venue.vibeTags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] bg-subtle text-text-muted px-2 py-0.5 rounded border border-border-theme"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {isLocked && (
                          <div className="text-[11px] text-amber-600 font-bold flex items-center gap-1 mb-2 bg-amber-50 inline-block px-2 py-1 rounded-md border border-amber-200">
                            🔒 Κρατημένο για την παρέα: {formatTime(lockedSlots[slot.id])}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-2 shrink-0 mt-4 sm:mt-0 sm:ml-4 border-t sm:border-t-0 sm:border-l border-border-theme pt-4 sm:pt-0 sm:pl-4 w-full sm:w-auto">
                        <div
                          className={`text-2xl font-black ${
                            isBounty
                              ? "text-amber-500"
                              : isRainDeal
                                ? "text-sky-500"
                                : isPanic
                                  ? "text-red-600"
                                  : "text-brand-text"
                          }`}
                        >
                          {slot.discount}
                        </div>

                        <div className="flex flex-col gap-2 w-full">
                          <button
                            disabled={isLocked}
                            onClick={() => {
                              setBookingSlot(slot);
                              setBookedTicketCode(null);
                            }}
                            className={`w-full px-5 py-2.5 font-black text-xs rounded-xl transition shadow-sm cursor-pointer ${
                              isLocked
                                ? "bg-subtle text-text-muted cursor-not-allowed border border-border-theme"
                                : isBounty
                                  ? "bg-amber-400 hover:bg-amber-500 text-neutral-950"
                                  : isRainDeal
                                    ? "bg-sky-600 hover:bg-sky-700 text-white"
                                    : isPanic
                                      ? "bg-red-600 hover:bg-red-700 text-white"
                                      : "bg-brand hover:bg-brand-hover text-white"
                            }`}
                          >
                            {isLocked
                              ? "Σε Κράτηση"
                              : isBounty
                                ? "🎯 Άρπαξε το Bounty"
                                : "Κράτηση"}
                          </button>

                          {!isLocked && (
                            <button
                              onClick={() => handleSquadLock(slot.id, slot.venueName)}
                              disabled={lockingSlotId === slot.id}
                              className="w-full px-3 py-1.5 bg-card hover:bg-subtle text-text-main border border-border-theme text-[10px] font-bold rounded-lg transition cursor-pointer"
                            >
                              {lockingSlotId === slot.id ? "..." : "🤝 Κράτα το (15')"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </main>

      {/* B2B MODAL */}
      {showB2bModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border-theme rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-black text-text-main mb-2">
              Ξεκλείδωσε Secret Deals 💼
            </h3>
            <p className="text-xs text-text-muted mb-4">
              Εισήγαγε το εταιρικό (.com/.gr) ή φοιτητικό σου email για να βλέπεις προσφορές για μεσημεριανά διαλείμματα και φοιτητικά στέκια.
            </p>
            <form onSubmit={handleB2bVerify} className="space-y-3">
              <input
                type="email"
                required
                placeholder="π.χ. name@company.gr"
                value={b2bEmail}
                onChange={(e) => setB2bEmail(e.target.value)}
                className="w-full bg-card border border-border-theme text-text-main px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-brand"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowB2bModal(false)}
                  className="flex-1 py-2 text-xs font-bold text-text-muted bg-subtle rounded-xl cursor-pointer"
                >
                  Ακύρωση
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                >
                  Επαλήθευση
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOOKING MODAL (Επιβεβαίωση Κράτησης & Έκδοση Εισιτηρίου) */}
      {bookingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border-2 border-brand rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            {!bookedTicketCode ? (
              <form onSubmit={handleConfirmBooking} className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-brand text-white px-2.5 py-0.5 rounded-full">
                      ΑΜΕΣΗ ΚΡΑΤΗΣΗ HAPPYSEATS
                    </span>
                    <h3 className="text-xl font-black text-text-main mt-1">
                      {bookingSlot.venueName}
                    </h3>
                    <p className="text-xs text-text-muted">
                      🕒 {bookingSlot.timeWindow} • Έκπτωση{" "}
                      <strong className="text-brand-text">{bookingSlot.discount}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBookingSlot(null)}
                    className="text-sm text-text-muted hover:text-text-main cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {bookingSlot.bonusPerk && (
                  <div className="p-3 rounded-2xl bg-amber-400/15 border border-amber-400 text-xs font-bold text-text-main">
                    {bookingSlot.bonusPerk}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">
                    Αριθμός Ατόμων
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setPartySize(num)}
                        className={`py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                          partySize === num
                            ? "bg-brand text-white border-brand"
                            : "bg-subtle text-text-main border-border-theme"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1.5">
                    Τρόπος Εξυπηρέτησης
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOrderMode("dine-in")}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        orderMode === "dine-in"
                          ? "bg-brand text-white border-brand"
                          : "bg-subtle text-text-main border-border-theme"
                      }`}
                    >
                      🍽️ Κράτηση Τραπεζιού
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderMode("takeaway")}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        orderMode === "takeaway"
                          ? "bg-brand text-white border-brand"
                          : "bg-subtle text-text-main border-border-theme"
                      }`}
                    >
                      🛍️ Take-away Παραλαβή
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBookingSlot(null)}
                    className="flex-1 py-3 rounded-xl bg-subtle text-text-muted font-bold text-xs cursor-pointer"
                  >
                    Ακύρωση
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingBooking}
                    className="flex-1 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white font-black text-xs shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingBooking
                      ? "Καταχώρηση..."
                      : `✓ Κλείδωμα (${bookingSlot.discount})`}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 rounded-3xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-3xl mx-auto">
                  ✓
                </div>
                <h3 className="text-lg font-black text-text-main">
                  Η Κράτησή σου Επιβεβαιώθηκε!
                </h3>
                <p className="text-xs text-text-muted">
                  Δείξε τον παρακάτω κωδικό στο κατάστημα <strong>{bookingSlot.venueName}</strong>:
                </p>
                <div className="p-4 rounded-2xl bg-subtle border-2 border-dashed border-brand font-mono text-2xl font-black text-brand-text tracking-widest">
                  {bookedTicketCode}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBookingSlot(null)}
                    className="flex-1 py-2.5 rounded-xl bg-subtle text-text-main font-bold text-xs cursor-pointer"
                  >
                    Κλείσιμο
                  </button>
                  <Link
                    href="/my-tickets"
                    className="flex-1 py-2.5 rounded-xl bg-brand text-white font-black text-xs flex items-center justify-center"
                  >
                    🎟️ Τα Εισιτήριά μου →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}