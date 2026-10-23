"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function MerchantLoginPage() {
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [venueName, setVenueName] = useState("");
  const [category, setCategory] = useState("Εστιατόριο");
  const [area, setArea] = useState("Κέντρο");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (isRegistering) {
        if (!venueName.trim()) {
          throw new Error("Παρακαλώ εισάγετε το όνομα του καταστήματος.");
        }

        // 1. Δημιουργία λογαριασμού καταστήματος
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Ενημέρωση displayName με το όνομα του καταστήματος
        await updateProfile(user, { displayName: venueName });

        // 3. Αποθήκευση στοιχείων επιχείρησης στο Firestore
        await setDoc(doc(db, "venues", user.uid), {
          ownerUid: user.uid,
          name: venueName,
          category,
          area,
          email,
          createdAt: new Date().toISOString(),
        });
      } else {
        // Είσοδος υπάρχοντος καταστήματος
        await signInWithEmailAndPassword(auth, email, password);
      }

      router.push("/merchant");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setErrorMsg("Το email χρησιμοποιείται ήδη.");
      } else if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        setErrorMsg("Λανθασμένο email ή κωδικός πρόσβασης.");
      } else if (err.code === "auth/weak-password") {
        setErrorMsg("Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.");
      } else {
        setErrorMsg(err.message || "Παρουσιάστηκε σφάλμα κατά τη σύνδεση.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            HappySeats Business
          </span>
          <h1 className="text-2xl font-black text-white mt-1">
            {isRegistering ? "Εγγραφή Επιχείρησης" : "Σύνδεση Καταστήματος"}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isRegistering
              ? "Καταχωρίστε το κατάστημά σας και ξεκινήστε να γεμίζετε τα τραπέζια σας."
              : "Συνδεθείτε για να διαχειριστείτε τα happy hour slots και τις κρατήσεις σας."}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-medium text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Όνομα Καταστήματος / Επιχείρησης:</label>
                <input
                  type="text"
                  required
                  placeholder="π.χ. Ταβέρνα Ο Κουκούτσης"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Κατηγορία:</label>
                  <input
                    type="text"
                    required
                    placeholder="π.χ. Burger, Ιταλικό"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Περιοχή:</label>
                  <input
                    type="text"
                    required
                    placeholder="π.χ. Κέντρο, Γλυφάδα"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">Email Επιχείρησης:</label>
            <input
              type="email"
              required
              placeholder="name@restaurant.gr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Κωδικός Πρόσβασης:</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-sm transition disabled:opacity-50"
          >
            {isLoading
              ? "Παρακαλώ περιμένετε..."
              : isRegistering
              ? "Δημιουργία Λογαριασμού"
              : "Σύνδεση στο Portal"}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setErrorMsg(null);
            }}
            className="text-xs text-slate-400 hover:text-amber-400 transition"
          >
            {isRegistering
              ? "Έχετε ήδη λογαριασμό; Συνδεθείτε εδώ."
              : "Νέα επιχείρηση; Κάντε εγγραφή εδώ."}
          </button>
        </div>

        <div className="text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition">
            ← Επιστροφή στην Αρχική Πελατών
          </Link>
        </div>
      </div>
    </div>
  );
}