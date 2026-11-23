"use client";

import { useState } from "react";
import Link from "next/link";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PLAN_LIST, SUBSCRIPTION_PLANS, SubscriptionPlanId } from "@/lib/plans";

const CATEGORIES = [
  "Ελληνική Ταβέρνα",
  "Εστιατόριο / Bistro",
  "Καφέ / Brunch",
  "Cocktail Bar / Wine Bar",
  "Street Food / Burger",
  "Ιταλικό / Pizza",
  "Ασιατικό / Sushi",
  "Άλλο",
];

export default function PartnerApplyPage() {
  // Στοιχεία Επιχείρησης & Επικοινωνίας
  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Στοιχεία Καταστήματος
  const [venueName, setVenueName] = useState("");
  const [venueArea, setVenueArea] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueCategory, setVenueCategory] = useState(CATEGORIES[0]);
  const [notes, setNotes] = useState("");

  // Πακέτο Συνδρομής
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>("biannual");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanVat = vatNumber.replace(/\D/g, "");
    if (cleanVat.length !== 9) {
      setErrorMsg("Το ΑΦΜ πρέπει να αποτελείται από ακριβώς 9 ψηφία.");
      return;
    }

    setSubmitting(true);
    const cleanEmail = email.trim().toLowerCase();
    const plan = SUBSCRIPTION_PLANS[selectedPlan];
    const paymentReference = `HS-${new Date().getFullYear()}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    try {
      // 1. Αποθήκευση αίτησης στο Firestore
      await addDoc(collection(db, "partner_applications"), {
        companyName: companyName.trim(),
        vatNumber: cleanVat,
        taxOffice: taxOffice.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        email: cleanEmail,
        venueName: venueName.trim(),
        venueArea: venueArea.trim(),
        venueAddress: venueAddress.trim(),
        venueCategory,
        notes: notes.trim(),
        planId: plan.id,
        planLabel: plan.label,
        durationMonths: plan.durationMonths,
        price: plan.price,
        paymentReference,
        status: "pending", // pending -> pre_approved -> active | rejected
        createdAt: serverTimestamp(),
      });

      // 2. Αποστολή επιβεβαιωτικού email στον αιτούντα
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "application_received",
          to: cleanEmail,
          contactName: contactName.trim(),
          companyName: companyName.trim(),
          venueName: venueName.trim(),
          venueArea: venueArea.trim(),
          phone: phone.trim(),
          vatNumber: cleanVat,
          planLabel: plan.label,
          price: plan.price,
          paymentReference,
        }),
      });

      setSubmitted(true);
    } catch (err) {
      console.error("Application submit error:", err);
      setErrorMsg("Προέκυψε σφάλμα κατά την υποβολή. Παρακαλώ δοκιμάστε ξανά.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface text-text-main flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border-theme rounded-3xl p-8 text-center space-y-4 shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl mx-auto">
            ✓
          </div>
          <h1 className="text-xl font-black text-text-main">
            Η αίτησή σας υποβλήθηκε!
          </h1>
          <p className="text-xs text-text-muted leading-relaxed">
            Σας έχουμε αποστείλει επιβεβαιωτικό email στο{" "}
            <strong className="text-text-main">{email}</strong>. Το αρμόδιο τμήμα
            θα εξετάσει την αίτηση για το <strong>{venueName}</strong> και θα σας
            ενημερώσει σύντομα με τους όρους συμμετοχής και τα βήματα ενεργοποίησης.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/"
              className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-xs transition"
            >
              Επιστροφή στην Αρχική
            </Link>
            <Link
              href="/login"
              className="w-full py-2 text-xs font-semibold text-text-muted hover:text-text-main transition"
            >
              Είστε ήδη συνεργάτης; Σύνδεση →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-text-main p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between pb-4 border-b border-border-theme">
          <div>
            <Link href="/" className="text-xl font-black text-brand tracking-tight">
              HappySeats Partners
            </Link>
            <p className="text-xs text-text-muted mt-0.5">
              Αίτηση Συνεργασίας Καταστήματος Εστίασης
            </p>
          </div>
          <Link
            href="/login"
            className="text-xs font-bold px-3.5 py-2 bg-card border border-border-theme rounded-xl hover:bg-subtle transition"
          >
            ← Σύνδεση Συνεργατών
          </Link>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* 1. Επιλογή Πακέτου Συνδρομής */}
          <section className="bg-card border border-border-theme rounded-3xl p-6 space-y-4 shadow-sm">
            <div>
              <h2 className="text-sm font-black text-text-main">
                1. Επιλογή Πακέτου Συνδρομής (ανά κατάστημα)
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Η πληρωμή πραγματοποιείται μόνο μετά την προέγκριση της αίτησης.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PLAN_LIST.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer relative ${
                      isSelected
                        ? "border-brand bg-brand/5 shadow-sm"
                        : "border-border-theme bg-subtle/50 hover:border-text-muted"
                    }`}
                  >
                    {plan.badge && (
                      <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full bg-brand text-white mb-2">
                        {plan.badge}
                      </span>
                    )}
                    <div className="text-sm font-black text-text-main">
                      {plan.label}
                    </div>
                    <div className="text-2xl font-black text-brand mt-1">
                      {plan.price}€
                      <span className="text-[11px] font-medium text-text-muted">
                        {" "}
                        + ΦΠΑ
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-1">
                      ({plan.monthlyEquivalent.toFixed(1)}€ / μήνα)
                    </div>
                    <p className="text-[11px] text-text-muted mt-2 leading-snug">
                      {plan.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. Στοιχεία Επιχείρησης & Επικοινωνίας */}
          <section className="bg-card border border-border-theme rounded-3xl p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-black text-text-main">
              2. Στοιχεία Επιχείρησης & Επικοινωνίας
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Επωνυμία Επιχείρησης *
                </label>
                <input
                  required
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="π.χ. ΓΕΥΣΕΙΣ ΑΘΗΝΩΝ Ι.Κ.Ε."
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  ΑΦΜ (9 ψηφία) *
                </label>
                <input
                  required
                  type="text"
                  maxLength={9}
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="π.χ. 801234567"
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Δ.Ο.Υ. *
                </label>
                <input
                  required
                  type="text"
                  value={taxOffice}
                  onChange={(e) => setTaxOffice(e.target.value)}
                  placeholder="π.χ. ΚΕΦΟΔΕ Αττικής"
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Υπεύθυνος Επικοινωνίας *
                </label>
                <input
                  required
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ονοματεπώνυμο"
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Τηλέφωνο Επικοινωνίας *
                </label>
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="π.χ. 69XXXXXXXX"
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Email Λογαριασμού & Ενημερώσεων *
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@restaurant.gr"
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>
            </div>
          </section>

          {/* 3. Στοιχεία Καταστήματος */}
          <section className="bg-card border border-border-theme rounded-3xl p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-black text-text-main">
              3. Στοιχεία Καταστήματος
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Όνομα Καταστήματος (Διακριτικός Τίτλος) *
                </label>
                <input
                  required
                  type="text"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="π.χ. Το Κουτούκι του Παγκρατίου"
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Κατηγορία *
                </label>
                <select
                  value={venueCategory}
                  onChange={(e) => setVenueCategory(e.target.value)}
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Περιοχή *
                </label>
                <input
                  required
                  type="text"
                  value={venueArea}
                  onChange={(e) => setVenueArea(e.target.value)}
                  placeholder="π.χ. Παγκράτι"
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Διεύθυνση *
                </label>
                <input
                  required
                  type="text"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="π.χ. Υμηττού 120"
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">
                Σχόλια / Επιπλέον Πληροφορίες (προαιρετικό)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="π.χ. Ώρες αιχμής, αριθμός τραπεζιών, αν διαθέτετε 2ο κατάστημα..."
                className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
              />
            </div>
          </section>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-brand hover:bg-brand-hover text-white font-black rounded-2xl text-sm transition cursor-pointer disabled:opacity-50 shadow-md"
          >
            {submitting
              ? "Υποβολή Αίτησης..."
              : "Υποβολή Αίτησης Συνεργασίας →"}
          </button>
        </form>
      </div>
    </div>
  );
}