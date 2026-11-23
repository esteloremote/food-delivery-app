"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type UserRole = "customer" | "merchant";
type AuthMode = "signin" | "signup";

export default function PreEntryLampGate() {
  const router = useRouter();

  // Έλεγχος αν ο χρήστης είναι ήδη συνδεδεμένος ώστε να μην "αναβοσβήνει" η λάμπα
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Κατάσταση Λάμπας (Αναμμένη / Σβηστή) & Τράβηγμα Κορδονιού
  const [lampOn, setLampOn] = useState(true);
  const [pullingCord, setPullingCord] = useState(false);

  // Επιλογή Ρόλου (Πελάτης vs Μαγαζάτορας) & Mode (Είσοδος vs Εγγραφή)
  const [role, setRole] = useState<UserRole>("customer");
  const [mode, setMode] = useState<AuthMode>("signin");

  // Πεδία Φόρμας
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Αν ο χρήστης είναι ήδη συνδεδεμένος, τον κατευθύνουμε αυτόματα στο σωστό περιβάλλον
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCheckingAuth(false);
        return;
      }
      try {
        const merchantSnap = await getDoc(doc(db, "merchants", user.uid));
        if (merchantSnap.exists()) {
          router.replace("/merchant");
        } else {
          router.replace("/explore");
        }
      } catch {
        setCheckingAuth(false);
      }
    });
    return () => unsub();
  }, [router]);

  // Κίνηση κορδονιού λάμπας με ήχο "κλικ" (Web Audio API)
  const handleToggleLamp = () => {
    setPullingCord(true);
    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(lampOn ? 240 : 420, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // Αγνοούμε αν ο browser μπλοκάρει το audio πριν από interaction
    }

    setTimeout(() => {
      setLampOn((prev) => !prev);
      setPullingCord(false);
    }, 160);
  };

  // Υποβολή Email / Password
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const cred = await signInWithEmailAndPassword(auth, email, password);

        if (role === "merchant") {
          const mSnap = await getDoc(doc(db, "merchants", cred.user.uid));
          if (!mSnap.exists()) {
            setErrorMsg(
              "Αυτός ο λογαριασμός ανήκει σε Πελάτη. Άλλαξε τον διακόπτη σε «Πελάτης» ή κάνε εγγραφή καταστήματος."
            );
            setLoading(false);
            return;
          }
          router.push("/merchant");
        } else {
          router.push("/explore");
        }
      } else {
        // ΕΓΓΡΑΦΗ (Sign Up)
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        if (role === "merchant") {
          await setDoc(doc(db, "merchants", cred.user.uid), {
            email: cred.user.email,
            ownerName: name || "Συνεργάτης",
            createdAt: Date.now(),
            subscription: {
              status: "active",
              planName: "Trial Business",
              validUntil: "30 Ημέρες Δωρεάν",
            },
          });
          router.push("/merchant/onboarding");
        } else {
          await setDoc(doc(db, "users", cred.user.uid), {
            email: cred.user.email,
            displayName: name || "Επισκέπτης",
            streak: 0,
            favorites: [],
            createdAt: Date.now(),
          });
          router.push("/explore");
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code.includes("invalid-credential") || code.includes("wrong-password")) {
        setErrorMsg("Λάθος email ή κωδικός πρόσβασης.");
      } else if (code.includes("email-already-in-use")) {
        setErrorMsg("Υπάρχει ήδη λογαριασμός με αυτό το email.");
      } else if (code.includes("weak-password")) {
        setErrorMsg("Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.");
      } else {
        setErrorMsg("Παρουσιάστηκε σφάλμα. Δοκίμασε ξανά.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Σύνδεση με Google
  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);

      if (role === "merchant") {
        const mSnap = await getDoc(doc(db, "merchants", cred.user.uid));
        if (!mSnap.exists()) {
          await setDoc(doc(db, "merchants", cred.user.uid), {
            email: cred.user.email,
            ownerName: cred.user.displayName || "Συνεργάτης",
            createdAt: Date.now(),
          });
          router.push("/merchant/onboarding");
        } else {
          router.push("/merchant");
        }
      } else {
        await setDoc(
          doc(db, "users", cred.user.uid),
          {
            email: cred.user.email,
            displayName: cred.user.displayName || "Επισκέπτης",
          },
          { merge: true }
        );
        router.push("/explore");
      }
    } catch {
      setErrorMsg("Η σύνδεση με Google ακυρώθηκε.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return <div className="min-h-screen bg-[#070b10]" />;
  }

  // Χρώμα δέσμης φωτός ανάλογα με τον ρόλο (Πορτοκαλί για Πελάτη, Κυανό/Τιρκουάζ για Μαγαζάτορα)
  const isMerchant = role === "merchant";
  const glowColor = isMerchant ? "rgba(56, 189, 248, 0.32)" : "rgba(249, 115, 22, 0.32)";
  const bulbFill = !lampOn ? "#1e293b" : isMerchant ? "#7dd3fc" : "#fdba74";
  const accentBg = isMerchant
    ? "bg-sky-500 hover:bg-sky-400 text-slate-950"
    : "bg-orange-500 hover:bg-orange-400 text-white";

  return (
    <div className="min-h-screen bg-[#070b10] text-slate-100 flex flex-col justify-between relative overflow-hidden select-none">
      {/* Ambient Background Glow */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[780px] h-[520px] rounded-full blur-[130px] transition-all duration-700"
        style={{
          background: lampOn ? glowColor : "rgba(15, 23, 42, 0.2)",
        }}
      />

      {/* Top Bar */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-black tracking-tight text-white">
            <span className={isMerchant ? "text-sky-400" : "text-orange-500"}>
              Happy
            </span>
            Seats
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
            {isMerchant ? "B2B Partner Portal" : "Pre-Entry"}
          </span>
        </div>

        {/* Ενδεικτικό κουμπί για να παίζει ο χρήστης με τη λάμπα */}
        <button
          type="button"
          onClick={handleToggleLamp}
          className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition cursor-pointer"
        >
          {lampOn ? "💡 Σβήσε το φως" : "🔦 Άναψε το φως"}
        </button>
      </header>

      {/* Main Split Area: Interactive Lamp (Left) + Auth Card (Right) */}
      <main className="relative z-10 max-w-5xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* ΑΡΙΣΤΕΡΑ: ΔΙΑΔΡΑΣΤΙΚΗ ΛΑΜΠΑ */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
          <div className="relative w-72 h-80 flex items-center justify-center">
            {/* Κώνος Φωτός όταν η λάμπα είναι αναμμένη */}
            <div
              className={`absolute top-24 left-28 w-72 h-64 origin-top-left pointer-events-none transition-opacity duration-500 ${
                lampOn ? "opacity-100" : "opacity-0"
              }`}
              style={{
                background: isMerchant
                  ? "linear-gradient(135deg, rgba(56,189,248,0.35) 0%, rgba(56,189,248,0.02) 75%, transparent 100%)"
                  : "linear-gradient(135deg, rgba(249,115,22,0.35) 0%, rgba(249,115,22,0.02) 75%, transparent 100%)",
                clipPath: "polygon(15% 0%, 45% 0%, 100% 100%, 0% 100%)",
                filter: "blur(10px)",
              }}
            />

            {/* SVG Επιτραπέζια Λάμπα Αρχιτέκτονα */}
            <svg
              viewBox="0 0 260 320"
              className="w-full h-full drop-shadow-2xl overflow-visible"
            >
              {/* Βάση */}
              <ellipse cx="95" cy="296" rx="52" ry="12" fill="#1e293b" />
              <ellipse cx="95" cy="292" rx="44" ry="9" fill="#334155" />

              {/* Κάτω Βραχίονας */}
              <line
                x1="95"
                y1="290"
                x2="62"
                y2="185"
                stroke="#475569"
                strokeWidth="8"
                strokeLinecap="round"
              />
              {/* Άρθρωση Μέση */}
              <circle cx="62" cy="185" r="9" fill="#f59e0b" />
              <circle cx="62" cy="185" r="4" fill="#0f172a" />

              {/* Πάνω Βραχίονας */}
              <line
                x1="62"
                y1="185"
                x2="118"
                y2="92"
                stroke="#64748b"
                strokeWidth="7"
                strokeLinecap="round"
              />
              {/* Άρθρωση Κορυφή */}
              <circle cx="118" cy="92" r="8" fill="#f59e0b" />

              {/* Καπέλο Λάμπας */}
              <path
                d="M 105 85 C 125 62, 168 68, 182 104 L 112 134 C 98 114, 96 96, 105 85 Z"
                fill="#1e293b"
                stroke="#334155"
                strokeWidth="2"
              />

              {/* Λαμπτήρας */}
              <ellipse
                cx="148"
                cy="120"
                rx="24"
                ry="11"
                transform="rotate(-23 148 120)"
                fill={bulbFill}
                className="transition-colors duration-300"
              />

              {/* Διαδραστικό Κορδόνι Διακόπτη */}
              <g
                onClick={handleToggleLamp}
                className="cursor-pointer group"
                style={{
                  transform: pullingCord ? "translateY(14px)" : "translateY(0px)",
                  transition: "transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                {/* Αόρατη μεγάλη περιοχή κλικ για εύκολο πάτημα */}
                <rect x="130" y="122" width="36" height="75" fill="transparent" />
                <line
                  x1="148"
                  y1="124"
                  x2="148"
                  y2="178"
                  stroke="#94a3b8"
                  strokeWidth="2.5"
                  strokeDasharray="3 2"
                />
                <circle
                  cx="148"
                  cy="183"
                  r="7"
                  fill={isMerchant ? "#38bdf8" : "#f97316"}
                  className="group-hover:scale-125 transition-transform origin-center"
                />
              </g>
            </svg>
          </div>

          <p className="text-xs text-slate-400 text-center max-w-xs mt-1">
            Τράβηξε το <span className="text-white font-bold">κορδόνι της λάμπας</span> για να ανάψεις ή να σβήσεις τον φωτισμό εισόδου.
          </p>
        </div>

        {/* ΔΕΞΙΑ: ΚΑΡΤΑ ΕΙΣΟΔΟΥ / ΕΓΓΡΑΦΗΣ (ΔΙΑΧΩΡΙΣΜΟΣ ΠΕΛΑΤΗ - ΜΑΓΑΖΑΤΟΡΑ) */}
        <div className="lg:col-span-7">
          <div
            className={`rounded-3xl p-6 sm:p-8 border transition-all duration-500 backdrop-blur-xl ${
              lampOn
                ? "bg-[#111822]/90 border-white/15 shadow-[0_0_60px_-15px_rgba(0,0,0,0.8)] opacity-100"
                : "bg-[#0b0f17]/70 border-white/5 opacity-45 hover:opacity-85"
            }`}
          >
            {/* ΕΠΙΛΟΓΗ ΡΟΛΟΥ: ΠΕΛΑΤΗΣ vs ΚΑΤΑΣΤΗΜΑΤΑΡΧΗΣ */}
            <div className="mb-6">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                1. Επίλεξε Περιβάλλον Εισόδου
              </label>
              <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-black/40 border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setRole("customer");
                    setLampOn(true);
                    setErrorMsg(null);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                    role === "customer"
                      ? "bg-orange-500 text-white shadow-lg"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>🍽️</span> Είμαι Πελάτης
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRole("merchant");
                    setLampOn(true);
                    setErrorMsg(null);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                    role === "merchant"
                      ? "bg-sky-500 text-slate-950 shadow-lg"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>🏪</span> Είμαι Μαγαζάτορας
                </button>
              </div>
            </div>

            {/* Τίτλος & Υπότιτλος ανάλογα με τον ρόλο */}
            <div className="mb-5">
              <h1 className="text-2xl font-black text-white">
                {isMerchant
                  ? mode === "signin"
                    ? "Πύλη Συνεργατών Εστίασης"
                    : "Εγγραφή Νέου Καταστήματος"
                  : mode === "signin"
                  ? "Καλώς ήρθες στο HappySeats"
                  : "Δημιούργησε Λογαριασμό"}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {isMerchant
                  ? "Διαχειρίσου τραπέζια, Flash Deals και κρατήσεις σε πραγματικό χρόνο."
                  : "Κλείσε τραπέζι τις σωστές ώρες και κέρδισε έως -50% έκπτωση."}
              </p>
            </div>

            {/* Tabs: Sign In / Sign Up */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  mode === "signin"
                    ? "bg-white/15 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Είσοδος (Sign In)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  mode === "signup"
                    ? "bg-white/15 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Εγγραφή (Sign Up)
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Φόρμα */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    {isMerchant ? "Όνομα Υπευθύνου / Καταστήματος" : "Ονοματεπώνυμο"}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isMerchant ? "π.χ. Νίκος - Bistro Κολωνάκι" : "π.χ. Γιάννης Παπαδόπουλος"}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/40"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  {isMerchant ? "Εταιρικό Email" : "Email"}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isMerchant ? "info@restaurant.gr" : "you@example.com"}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Κωδικός Πρόσβασης
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/40 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 rounded-xl font-black text-sm transition shadow-lg cursor-pointer disabled:opacity-50 ${accentBg}`}
              >
                {loading
                  ? "Σύνδεση..."
                  : isMerchant
                  ? mode === "signin"
                    ? "Είσοδος στο Merchant Dashboard →"
                    : "Δημιουργία Εταιρικού Λογαριασμού →"
                  : mode === "signin"
                  ? "Είσοδος στο HappySeats →"
                  : "Εγγραφή & Είσοδος →"}
              </button>
            </form>

            {/* Divider & Google Sign-In */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                ή συνέχεια με
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-2.5 transition cursor-pointer"
            >
              <span className="text-base">G</span> Συνέχεια με Google (
              {isMerchant ? "Συνεργάτης" : "Πελάτης"})
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center pb-5 text-[11px] text-slate-500">
        HappySeats Platform • Διαχωρισμένο περιβάλλον Επισκεπτών & Επιχειρήσεων Εστίασης
      </footer>
    </div>
  );
}
