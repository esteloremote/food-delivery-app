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
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function CustomerLoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Σύνδεση με Google (1-Click)
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Καταχώρηση ή ενημέρωση στο users collection
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = cred.user;

        if (fullName.trim()) {
          await updateProfile(user, { displayName: fullName.trim() });
        }

        await setDoc(doc(db, "users", user.uid), {
          name: fullName.trim() || "Πελάτης",
          email: user.email,
          role: "customer",
          createdAt: serverTimestamp(),
        });

        router.push("/my-tickets");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        router.push("/my-tickets");
      }
    } catch (err: unknown) {
      console.error(err);
      const code = (err as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        setErrorMsg("Αυτό το email χρησιμοποιείται ήδη. Δοκιμάστε να συνδεθείτε.");
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block text-3xl font-black text-amber-400">
            HappySeats
          </Link>
          <h1 className="text-xl font-bold text-white">
            {isRegister ? "Δημιουργία Λογαριασμού Πελάτη" : "Σύνδεση Πελάτη"}
          </h1>
          <p className="text-xs text-neutral-400">
            {isRegister
              ? "Φτιάξε λογαριασμό για να έχεις πρόσβαση σε όλα τα e-tickets και το ιστορικό σου από κάθε συσκευή."
              : "Συνδέσου για να δεις τα ενεργά σου εισιτήρια και να κλείσεις τραπέζι με ένα κλικ."}
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-6 md:p-8 rounded-3xl shadow-2xl space-y-5">
          {/* 1-Click Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 bg-white hover:bg-neutral-100 text-neutral-900 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Συνέχεια με Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-neutral-800" />
            <span className="text-[10px] uppercase font-bold text-neutral-500">ή με email</span>
            <div className="flex-1 h-px bg-neutral-800" />
          </div>

          {/* Tabs: Σύνδεση / Εγγραφή */}
          <div className="grid grid-cols-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setErrorMsg(null);
              }}
              className={`py-2 rounded-lg transition ${
                !isRegister ? "bg-amber-400 text-neutral-950" : "text-neutral-400 hover:text-white"
              }`}
            >
              Σύνδεση
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setErrorMsg(null);
              }}
              className={`py-2 rounded-lg transition ${
                isRegister ? "bg-amber-400 text-neutral-950" : "text-neutral-400 hover:text-white"
              }`}
            >
              Εγγραφή
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs text-neutral-300 font-semibold mb-1">
                  Ονοματεπώνυμο *
                </label>
                <input
                  required
                  type="text"
                  placeholder="π.χ. Νίκος Παπαδόπουλος"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-neutral-300 font-semibold mb-1">Email *</label>
              <input
                required
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-300 font-semibold mb-1">
                Κωδικός Πρόσβασης *
              </label>
              <input
                required
                type="password"
                placeholder="Τουλάχιστον 6 χαρακτήρες"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold text-center">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-sm transition disabled:opacity-50 shadow-lg mt-2"
            >
              {loading
                ? "Παρακαλώ περιμένετε..."
                : isRegister
                ? "Δημιουργία Λογαριασμού"
                : "Σύνδεση"}
            </button>
          </form>
        </div>

        <div className="text-center text-xs text-neutral-500">
          <Link href="/" className="hover:text-neutral-300 transition">
            ← Επιστροφή στην Αρχική
          </Link>
        </div>
      </div>
    </div>
  );
}