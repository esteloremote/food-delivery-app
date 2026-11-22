"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  deleteUser,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface MicroZonePass {
  type: "student" | "office";
  email: string;
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [streak, setStreak] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [passwordResetMsg, setPasswordResetMsg] = useState<{
    type: "success" | "error";
    text: string;
    } | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  // Micro-Zone Pass (Φοιτητικό / Office Break)
  const [verifiedPass, setVerifiedPass] = useState<MicroZonePass | null>(null);
  const [passEmailInput, setPassEmailInput] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  // GDPR Account Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let unsubUserDoc = () => {};

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }
      setUser(currentUser);
      setDisplayName(currentUser.displayName || "");

      unsubUserDoc = onSnapshot(
        doc(db, "users", currentUser.uid),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.name && !currentUser.displayName) setDisplayName(data.name);
            setStreak(data.streak ?? 0);
            setVerifiedPass(data.microZonePass || null);
          }
          setLoading(false);
        },
        (err) => {
          if (err.code !== "permission-denied") console.error(err);
        }
      );
    });

    return () => {
      unsubAuth();
      unsubUserDoc();
    };
  }, [router]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || displayName.trim().length < 2) return;

    setSaving(true);
    setMessage(null);
    try {
      const cleanName = displayName.trim();
      await updateProfile(user, { displayName: cleanName });
      await setDoc(
        doc(db, "users", user.uid),
        { name: cleanName, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setMessage("✓ Το όνομά σου ενημερώθηκε επιτυχώς!");
    } catch (err) {
      console.error(err);
      setMessage("✕ Σφάλμα κατά την αποθήκευση.");
    } finally {
      setSaving(false);
    }
  };

  const handleActivatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const clean = passEmailInput.trim().toLowerCase();
    if (!clean.includes("@")) {
      setMessage("✕ Παρακαλώ εισάγετε ένα έγκυρο email.");
      return;
    }

    const isStudent =
      clean.endsWith(".edu.gr") ||
      clean.includes("uni") ||
      clean.includes("student") ||
      clean.endsWith(".gr");

    const newPass: MicroZonePass = {
      type: isStudent ? "student" : "office",
      email: clean,
    };

    setSavingPass(true);
    setMessage(null);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { microZonePass: newPass, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setPassEmailInput("");
      setMessage(
        newPass.type === "student"
          ? "✓ Το Φοιτητικό Πάσο ενεργοποιήθηκε! Τα αποκλειστικά deals εμφανίζονται πλέον στην αρχική."
          : "✓ Το Office Break Pass ενεργοποιήθηκε! Τα lunch deals (13:00–16:00) εμφανίζονται πλέον στην αρχική."
      );
    } catch (err) {
      console.error(err);
      setMessage("✕ Σφάλμα κατά την ενεργοποίηση του πάσου.");
    } finally {
      setSavingPass(false);
    }
  };

  const handleRemovePass = async () => {
    if (!user) return;
    setSavingPass(true);
    setMessage(null);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { microZonePass: null, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setMessage("✓ Το πάσο αφαιρέθηκε από τον λογαριασμό σου.");
    } catch (err) {
      console.error(err);
      setMessage("✕ Σφάλμα κατά την αφαίρεση του πάσου.");
    } finally {
      setSavingPass(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    setPasswordResetMsg(null);
    try {
      await sendPasswordResetEmail(auth, user.email, {
        url: `${window.location.origin}/`,
        handleCodeInApp: false,
      });
      setPasswordResetMsg({
        type: "success",
        text: "✓ Σας στάλθηκε email επαναφοράς κωδικού. Ελέγξτε τα εισερχόμενά σας (ή τα Spam).",
      });
    } catch {
      setPasswordResetMsg({
        type: "error",
        text: "✕ Αδυναμία αποστολής email αλλαγής κωδικού. Δοκιμάστε ξανά σε λίγο.",
      });
    } finally {
      setSendingReset(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText.trim().toUpperCase() !== "ΔΙΑΓΡΑΦΗ") return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Έλεγχος αν ο χρήστης είναι και ενεργός Συνεργάτης (Merchant)
      const merchantSnap = await getDoc(doc(db, "merchants", user.uid));
      if (merchantSnap.exists()) {
        setDeleteError(
          "Ο λογαριασμός σου συνδέεται με προφίλ Συνεργάτη (Επιχείρηση). Για ακύρωση συνδρομής και διαγραφή, επικοινώνησε με την υποστήριξη του HappySeats."
        );
        setIsDeleting(false);
        return;
      }

      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);

      localStorage.removeItem("happyseats_tickets");
      localStorage.removeItem("happyseats_microzone_pass");

      router.replace("/");
    } catch (err: unknown) {
      console.error("Account deletion error:", err);
      const code = (err as { code?: string })?.code;
      if (code === "auth/requires-recent-login") {
        setDeleteError(
          "Για λόγους ασφαλείας, πρέπει να κάνεις αποσύνδεση και ξανά σύνδεση πριν διαγράψεις τον λογαριασμό σου."
        );
      } else {
        setDeleteError("Παρουσιάστηκε σφάλμα κατά τη διαγραφή. Δοκίμασε ξανά.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center text-sm text-text-muted">
        Φόρτωση ρυθμίσεων...
      </div>
    );
  }

  const isPasswordProvider = user.providerData.some((p) => p.providerId === "password");

  return (
    <div className="min-h-screen bg-surface text-text-main p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <header className="flex items-center justify-between pb-4 border-b border-border-theme">
          <div>
            <h1 className="text-xl font-black text-text-main">Ρυθμίσεις Λογαριασμού</h1>
            <p className="text-xs text-text-muted">Διαχείριση προφίλ, πάσου & ασφάλειας</p>
          </div>
          <Link
            href="/"
            className="text-xs font-bold px-3 py-2 bg-card border border-border-theme rounded-xl hover:bg-subtle transition"
          >
            ← Αρχική
          </Link>
        </header>

        {message && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold">
            {message}
          </div>
        )}

        {/* Κάρτα VIP Streak */}
        <section className="bg-card border border-border-theme rounded-3xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Το VIP Streak σου
            </div>
            <div className="text-sm font-bold text-text-main mt-1">
              {streak >= 3
                ? "⭐ Είσαι VIP! Έχεις πρόσβαση στα Secret Deals."
                : `Χρειάζεσαι ${3 - streak} ακόμα check-in για VIP status.`}
            </div>
          </div>
          <div className="flex gap-1 text-2xl">
            {[1, 2, 3].map((i) => (
              <span key={i} className={i <= streak ? "opacity-100" : "opacity-25 grayscale"}>
                ☕
              </span>
            ))}
          </div>
        </section>

        {/* 🎓 / 💼 Πάσο / Office Break (Micro-Zone Deals) */}
        <section className="bg-card border border-border-theme rounded-3xl p-6 space-y-4 shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
              <span>🎓 / 💼</span> Πάσο / Office Break (Micro-Zone Deals)
            </h2>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Δήλωσε το ακαδημαϊκό σου email (π.χ. <code>.edu.gr</code>) ή το εταιρικό σου email
              για να ξεκλειδώσεις αποκλειστικές προσφορές <strong>Φοιτητικού Πάσου</strong> ή{" "}
              <strong>Office Lunch Break (13:00–16:00)</strong>.
            </p>
          </div>

          {verifiedPass && (
            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-indigo-700">
                  Ενεργό:{" "}
                  {verifiedPass.type === "student"
                    ? "🎓 Φοιτητικό Πάσο"
                    : "💼 Office Break Pass"}
                </div>
                <div className="text-text-muted mt-0.5">{verifiedPass.email}</div>
              </div>
              <button
                type="button"
                disabled={savingPass}
                onClick={handleRemovePass}
                className="text-red-600 hover:underline font-semibold cursor-pointer disabled:opacity-50"
              >
                Αφαίρεση
              </button>
            </div>
          )}

          <form onSubmit={handleActivatePass} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="email"
              required
              placeholder="π.χ. name@aegean.gr ή name@company.com"
              value={passEmailInput}
              onChange={(e) => setPassEmailInput(e.target.value)}
              className="flex-1 bg-subtle border border-border-theme rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={savingPass}
              className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50 shrink-0 shadow-sm"
            >
              {savingPass
                ? "Αποθήκευση..."
                : verifiedPass
                ? "Ενημέρωση Πάσου"
                : "Ενεργοποίηση Πάσου"}
            </button>
          </form>
        </section>

        {/* Στοιχεία Προφίλ */}
        <section className="bg-card border border-border-theme rounded-3xl p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-text-main">Προσωπικά Στοιχεία</h2>

          <form onSubmit={handleSaveName} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">
                Ονοματεπώνυμο
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-subtle border border-border-theme rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">
                Email
              </label>
              <div className="flex items-center justify-between bg-subtle border border-border-theme rounded-xl px-4 py-2.5 text-sm text-text-muted">
                <span>{user.email}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  ✓ Επιβεβαιωμένο
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
            >
              {saving ? "Αποθήκευση..." : "Αποθήκευση Αλλαγών"}
            </button>
          </form>
        </section>

        {/* Ασφάλεια & Έξοδος */}
        <section className="bg-card border border-border-theme rounded-3xl p-6 space-y-3 shadow-sm">
          <h2 className="text-sm font-bold text-text-main">Ασφάλεια & Σύνδεση</h2>

          {isPasswordProvider && (
            <div className="space-y-2">
              <button
                type="button"
                disabled={sendingReset}
                onClick={handlePasswordReset}
                className="w-full py-2.5 px-4 bg-subtle hover:bg-border-theme text-text-main font-semibold rounded-xl text-xs transition text-left cursor-pointer disabled:opacity-50"
              >
                {sendingReset
                  ? "⏳ Αποστολή email..."
                  : "🔑 Αποστολή email για αλλαγή κωδικού πρόσβασης"}
              </button>

              {passwordResetMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold border ${
                    passwordResetMsg.type === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-red-50 border-red-200 text-red-700"
                  }`}
                >
                  {passwordResetMsg.text}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={async () => {
              await signOut(auth);
              router.push("/");
            }}
            className="w-full py-2.5 px-4 bg-subtle hover:bg-border-theme text-text-main font-semibold rounded-xl text-xs transition text-left cursor-pointer"
          >
            🚪 Αποσύνδεση από τον λογαριασμό
          </button>
        </section>

        {/* Danger Zone - GDPR Διαγραφή Λογαριασμού */}
        <section className="bg-red-50/60 border border-red-200 rounded-3xl p-6 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-red-700">Διαγραφή Λογαριασμού (GDPR)</h2>
            <p className="text-xs text-red-600/90 mt-1">
              Η διαγραφή είναι οριστική. Θα διαγραφούν το προφίλ σου και το VIP Streak σου και δεν θα μπορείς να τα επαναφέρεις.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setDeleteConfirmText("");
              setDeleteError(null);
              setShowDeleteModal(true);
            }}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-sm"
          >
            🗑️ Οριστική Διαγραφή Λογαριασμού
          </button>
        </section>
      </div>

      {/* Modal Επιβεβαίωσης Διαγραφής */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border-theme rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-red-600">
              Είσαι σίγουρος για τη διαγραφή;
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Αυτή η ενέργεια δεν αναιρείται. Για επιβεβαίωση, πληκτρολόγησε τη λέξη{" "}
              <strong className="text-text-main font-mono">ΔΙΑΓΡΑΦΗ</strong> παρακάτω:
            </p>

            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="ΔΙΑΓΡΑΦΗ"
              className="w-full bg-subtle border border-border-theme rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-red-500"
            />

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                {deleteError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 bg-subtle hover:bg-border-theme text-text-main rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Άκυρο
              </button>
              <button
                type="button"
                disabled={
                  isDeleting || deleteConfirmText.trim().toUpperCase() !== "ΔΙΑΓΡΑΦΗ"
                }
                onClick={handleDeleteAccount}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-40 cursor-pointer"
              >
                {isDeleting ? "Διαγραφή..." : "Οριστική Διαγραφή"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}