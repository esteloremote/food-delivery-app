"use client";

import Link from "next/link";

export default function MerchantOnboardingLockedPage() {
  return (
    <div className="min-h-screen bg-surface text-text-main flex flex-col items-center justify-center p-6 space-y-4">
      <div className="bg-card border border-border-theme p-8 rounded-3xl max-w-md w-full text-center space-y-4 shadow-sm">
        <span className="text-4xl block">🔒</span>
        <h1 className="text-xl font-black text-text-main">
          Καταχώριση μέσω Διαχειριστή
        </h1>
        <p className="text-xs text-text-muted leading-relaxed">
          Η προσθήκη νέου καταστήματος στο HappySeats πραγματοποιείται αποκλειστικά από τη διαχείριση της πλατφόρμας κατόπιν ενεργοποίησης της μηνιαίας συνδρομής καταστήματος.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href="/merchant"
            className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            ← Επιστροφή στο Merchant Dashboard
          </Link>
          <a
            href="mailto:partners@happyseats.gr?subject=Προσθήκη%20Νέου%20Καταστήματος"
            className="w-full py-2.5 bg-subtle hover:bg-border-theme text-text-main rounded-xl text-xs font-semibold transition border border-border-theme"
          >
            Επικοινωνία με το Τμήμα Συνεργατών
          </a>
        </div>
      </div>
    </div>
  );
}