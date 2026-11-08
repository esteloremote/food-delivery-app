"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function CustomerLoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      await setDoc(
        doc(db, "users", user.uid),
        {
          name: user.displayName || "Πελάτης",
          email: user.email,
          role: "customer",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      router.push("/my-tickets");
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Σφάλμα κατά τη σύνδεση με Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg("Παρακαλώ εισάγετε το email σας.");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = cred.user;

        if (fullName.trim()) {
          await updateProfile(user, { displayName: fullName.trim() });
        }

        try {
          await sendEmailVerification(user);
        } catch (verErr) {
          console.warn("Verification error:", verErr);
        }

        await setDoc(doc(db, "users", user.uid), {
          name: fullName.trim() || "Πελάτης",
          email: user.email,
          role: "customer",
          createdAt: serverTimestamp(),
        });

        setInfoMsg("Ο λογαριασμός δημιουργήθηκε! Σας στείλαμε email επιβεβαίωσης.");
        setIsRegister(false);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        router.push("/my-tickets");
      }
    } catch (err: unknown) {
      console.error(err);
      const code = (err as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        setErrorMsg("Αυτό το email χρησιμοποιείται ήδη.");
      } else if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        setErrorMsg("Λανθασμένο email ή κωδικός πρόσβασης.");
      } else if (code === "auth/weak-password") {
        setErrorMsg("Ο κωδικός πρέπει να περιέχει τουλάχιστον 6 χαρακτήρες.");
      } else {
        setErrorMsg("Παρουσιάστηκε σφάλμα. Παρακαλώ δοκιμάστε ξανά.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-text-main flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block text-3xl font-black text-brand tracking-tight">
            HappySeats
          </Link>
          <h1 className="text-xl font-bold text-text-main">
            {isForgotMode
              ? "Επαναφορά Κωδικού"
              : isRegister
              ? "Δημιουργία Λογαριασμού Πελάτη"
              : "Σύνδεση Πελάτη"}
          </h1>
          <p className="text-xs text-text-muted">
            {isForgotMode
              ? "Συμπληρώστε το email σας για να λάβετε σύνδεσμο επαναφοράς."
              : isRegister
              ? "Φτιάξτε λογαριασμό για να παρακολουθείτε τα e-tickets σας."
              : "Συνδεθείτε για να κλείσετε τραπέζι με έκπτωση."}
          </p>
        </div>

        <div className="bg-card border border-border-theme p-6 md:p-8 rounded-3xl shadow-sm space-y-5">
          {!isForgotMode && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 bg-subtle hover:bg-border-theme text-text-main font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 border border-border-theme disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Συνέχεια με Google
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border-theme" />
                <span className="text-[10px] uppercase font-bold text-text-muted">ή με email</span>
                <div className="flex-1 h-px bg-border-theme" />
              </div>

              <div className="grid grid-cols-2 p-1 bg-subtle rounded-xl text-xs font-bold border border-border-theme">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className={`py-2 rounded-lg transition cursor-pointer ${
                    !isRegister ? "bg-card text-brand-text shadow-sm" : "text-text-muted hover:text-text-main"
                  }`}
                >
                  Σύνδεση
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className={`py-2 rounded-lg transition cursor-pointer ${
                    isRegister ? "bg-card text-brand-text shadow-sm" : "text-text-muted hover:text-text-main"
                  }`}
                >
                  Εγγραφή
                </button>
              </div>
            </>
          )}

          {isForgotMode ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted font-semibold mb-1">
                  Email Λογαριασμού *
                </label>
                <input
                  required
                  type="email"
                  placeholder="you@example.com"
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
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div>
                  <label className="block text-xs text-text-muted font-semibold mb-1">
                    Ονοματεπώνυμο *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="π.χ. Νίκος Παπαδόπουλος"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-text-muted font-semibold mb-1">
                  Email *
                </label>
                <input
                  required
                  type="email"
                  placeholder="you@example.com"
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
                  {!isRegister && (
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
                  )}
                </div>

                <div className="relative">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="Τουλάχιστον 6 χαρακτήρες"
                    minLength={6}
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
                {loading
                  ? "Παρακαλώ περιμένετε..."
                  : isRegister
                  ? "Δημιουργία Λογαριασμού"
                  : "Σύνδεση"}
              </button>
            </form>
          )}
        </div>

        <div className="text-center text-xs text-text-muted">
          <Link href="/" className="hover:text-text-main transition">
            ← Επιστροφή στην Αρχική
          </Link>
        </div>
      </div>
    </div>
  );
}