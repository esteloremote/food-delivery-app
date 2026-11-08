"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function MerchantAuthPage() {
  const router = useRouter();
  const [isForgotMode, setIsForgotMode] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg("Παρακαλώ συμπληρώστε το εταιρικό σας email.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfoMsg("Σας στάλθηκε email επαναφοράς κωδικού. Ελέγξτε τα εισερχόμενά σας.");
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Σφάλμα κατά την αποστολή email επαναφοράς.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Έλεγχος ότι ο λογαριασμός είναι όντως merchant
      const merchantDoc = await getDoc(doc(db, "merchants", user.uid));
      if (!merchantDoc.exists()) {
        setErrorMsg("Δεν βρέθηκε εγκεκριμένος λογαριασμός συνεργάτη με αυτά τα στοιχεία.");
        setLoading(false);
        return;
      }

      router.push("/merchant");
    } catch (err: unknown) {
      console.error(err);
      const code = (err as { code?: string })?.code;
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        setErrorMsg("Λανθασμένο email ή κωδικός πρόσβασης.");
      } else {
        setErrorMsg("Παρουσιάστηκε σφάλμα κατά τη σύνδεση. Παρακαλώ δοκιμάστε ξανά.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-text-main flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block text-2xl font-black text-brand tracking-tight">
            HappySeats
          </Link>
          <div className="inline-block bg-brand-light text-brand-text text-[11px] font-bold px-3 py-1 rounded-full border border-brand-border block w-fit mx-auto">
            Πύλη Συνεργατών Εστίασης
          </div>
          <h1 className="text-xl font-bold text-text-main">
            {isForgotMode ? "Επαναφορά Κωδικού Συνεργάτη" : "Είσοδος Υπευθύνου Καταστήματος"}
          </h1>
          <p className="text-xs text-text-muted">
            {isForgotMode
              ? "Εισάγετε το εταιρικό email διαχείρισης για να λάβετε σύνδεσμο επαναφοράς."
              : "Συνδεθείτε με τα διαπιστευτήρια που σας παραχώρησε η διαχείριση της πλατφόρμας."}
          </p>
        </div>

        <div className="bg-card border border-border-theme p-6 md:p-8 rounded-3xl shadow-sm space-y-5">
          {isForgotMode ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted font-semibold mb-1">
                  Εταιρικό Email *
                </label>
                <input
                  required
                  type="email"
                  placeholder="manager@restaurant.gr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold text-center">
                  {errorMsg}
                </div>
              )}

              {infoMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold text-center">
                  {infoMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {loading ? "Αποστολή..." : "Αποστολή Συνδέσμου Επαναφοράς"}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotMode(false);
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className="text-xs text-text-muted hover:text-brand transition cursor-pointer underline"
                >
                  ← Επιστροφή στη Σύνδεση
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted font-semibold mb-1">
                  Εταιρικό Email *
                </label>
                <input
                  required
                  type="email"
                  placeholder="manager@restaurant.gr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs text-text-muted font-semibold">
                    Κωδικός Πρόσβασης *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(true);
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className="text-[11px] text-brand-text hover:underline cursor-pointer font-medium"
                  >
                    Ξέχασα τον κωδικό μου
                  </button>
                </div>

                <div className="relative">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="Κωδικός πρόσβασης"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 pr-10 text-sm text-text-main focus:outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-1 cursor-pointer"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold text-center">
                  {errorMsg}
                </div>
              )}

              {infoMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold text-center">
                  {infoMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition disabled:opacity-50 shadow-sm mt-2 cursor-pointer"
              >
                {loading ? "Σύνδεση..." : "Είσοδος στο Merchant Portal"}
              </button>
            </form>
          )}

          <div className="p-4 bg-subtle border border-border-theme rounded-2xl text-xs text-text-muted space-y-2 text-center">
            <p className="font-semibold text-text-main">Είστε επιχείρηση εστίασης και θέλετε να ενταχθείτε;</p>
            <p className="text-[11px] leading-relaxed">
              Η εγγραφή νέων καταστημάτων γίνεται αποκλειστικά κατόπιν επικοινωνίας, ελέγχου στοιχείων και ενεργοποίησης μηνιαίας συνδρομής από την ομάδα μας.
            </p>
            <a
              href="mailto:partners@happyseats.gr?subject=Αίτηση%20Συνεργασίας%20HappySeats"
              className="inline-block text-brand-text font-bold hover:underline text-xs pt-1"
            >
              Αίτηση Συνεργασίας μέσω Email →
            </a>
          </div>
        </div>

        <div className="text-center text-xs text-text-muted">
          <Link href="/" className="hover:text-text-main transition">
            ← Επιστροφή στην Αρχική Σελίδα Πελατών
          </Link>
        </div>
      </div>
    </div>
  );
}