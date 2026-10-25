"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function MerchantAuthPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isRegister) {
        // Δημιουργία λογαριασμού στο Firebase Auth
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        const user = cred.user;

        if (companyName.trim()) {
          await updateProfile(user, { displayName: companyName.trim() });
        }

        // Αποθήκευση στοιχείων στη συλλογή merchants
        await setDoc(doc(db, "merchants", user.uid), {
          companyName: companyName.trim() || "Επιχείρηση Εστίασης",
          email: user.email,
          createdAt: serverTimestamp(),
        });

        // Μετά την εγγραφή πηγαίνει στο Onboarding για να δηλώσει το 1ο κατάστημα
        router.push("/merchant/onboarding");
      } else {
        // Σύνδεση υπάρχοντος εστιάτορα
        await signInWithEmailAndPassword(auth, email.trim(), password);
        router.push("/merchant");
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block text-2xl font-black text-amber-400">
            HappySeats
          </Link>
          <h1 className="text-xl font-bold text-white">
            {isRegister ? "Εγγραφή Συνεργάτη Εστίασης" : "Είσοδος Υπευθύνου"}
          </h1>
          <p className="text-xs text-slate-400">
            {isRegister
              ? "Δημιουργήστε λογαριασμό για να καταχωρήσετε και να διαχειρίζεστε τα εστιατόριά σας."
              : "Συνδεθείτε για να διαχειριστείτε τα τραπέζια, τις προσφορές και τα check-in."}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl space-y-5">
          {/* Tabs: Σύνδεση / Εγγραφή */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setErrorMsg(null);
              }}
              className={`py-2 rounded-lg transition ${
                !isRegister
                  ? "bg-amber-400 text-slate-950"
                  : "text-slate-400 hover:text-white"
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
                isRegister
                  ? "bg-amber-400 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Νέα Εγγραφή
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">
                  Επωνυμία Επιχείρησης / Όνομα Υπευθύνου *
                </label>
                <input
                  required
                  type="text"
                  placeholder="π.χ. Όμιλος Εστίασης Αθήνα"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">
                Email *
              </label>
              <input
                required
                type="email"
                placeholder="manager@restaurant.gr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">
                Κωδικός Πρόσβασης *
              </label>
              <input
                required
                type="password"
                placeholder="Τουλάχιστον 6 χαρακτήρες"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
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
              className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-sm transition disabled:opacity-50 shadow-lg mt-2"
            >
              {loading
                ? "Παρακαλώ περιμένετε..."
                : isRegister
                ? "Δημιουργία Λογαριασμού & Συνέχεια"
                : "Σύνδεση στο Portal"}
            </button>
          </form>
        </div>

        <div className="text-center text-xs text-slate-500">
          <Link href="/" className="hover:text-slate-300 transition">
            ← Επιστροφή στην Αρχική Σελίδα
          </Link>
        </div>
      </div>
    </div>
  );
}