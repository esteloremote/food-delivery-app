"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, serverTimestamp, collection } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

function generateSlug(text: string): string {
  const greekToLatinMap: Record<string, string> = {
    α: "a", ά: "a", β: "v", γ: "g", δ: "d", ε: "e", έ: "e", ζ: "z", η: "i", ή: "i",
    θ: "th", ι: "i", ί: "i", ϊ: "i", ΐ: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x",
    ο: "o", ό: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", ύ: "y", ϋ: "y",
    ΰ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o", ώ: "o",
  };

  return text
    .toLowerCase()
    .split("")
    .map((char) => greekToLatinMap[char] || char)
    .join("")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function MerchantOnboardingPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    category: "",
    area: "",
    address: "",
    phone: "",
    hours: "13:00 - 00:30 καθημερινά",
    description: "",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    lat: 37.9753,
    lng: 23.7361,
    highlights: "",
  });

  // Έλεγχος ότι ο εστιάτορας είναι συνδεδεμένος
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/merchant/login");
      } else {
        setCurrentUser(user);
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: generateSlug(name),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setSubmitting(true);
    setErrorMsg(null);

    const slug = form.slug.trim() || generateSlug(form.name) || doc(collection(db, "venues")).id;
    const highlightsArray = form.highlights
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    try {
      // Αποθήκευση με ρητό ownerId και ownerEmail
      await setDoc(doc(db, "venues", slug), {
        ownerId: currentUser.uid,
        ownerEmail: currentUser.email,
        name: form.name.trim(),
        slug,
        category: form.category.trim(),
        area: form.area.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        hours: form.hours.trim(),
        description: form.description.trim(),
        image: form.image.trim(),
        lat: Number(form.lat),
        lng: Number(form.lng),
        highlights: highlightsArray,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      localStorage.setItem("happyseats_merchant_venueId", slug);
      localStorage.setItem("happyseats_merchant_venueName", form.name.trim());

      router.push("/merchant");
    } catch (err) {
      console.error(err);
      setErrorMsg("Σφάλμα κατά την καταχώρηση. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm">
        Έλεγχος σύνδεσης...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center">
      <header className="w-full max-w-2xl flex justify-between items-center pb-6 border-b border-slate-800 mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            HappySeats Partners
          </span>
          <h1 className="text-2xl font-black text-white">Καταχώρηση Εστιατορίου</h1>
          <p className="text-xs text-slate-400 mt-1">
            Συνδεδεμένος λογαριασμός: <strong className="text-slate-200">{currentUser?.email}</strong>
          </p>
        </div>
        <Link
          href="/merchant"
          className="text-xs bg-slate-800 hover:bg-slate-700 px-3.5 py-2 rounded-xl transition text-slate-300"
        >
          ← Επιστροφή
        </Link>
      </header>

      <main className="w-full max-w-2xl bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Όνομα Εστιατορίου *
              </label>
              <input
                required
                type="text"
                placeholder="π.χ. Μελίλωτος"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                URL Slug (Αυτόματο)
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-amber-400 font-mono focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Κατηγορία / Είδος Κουζίνας *
              </label>
              <input
                required
                type="text"
                placeholder="π.χ. Μεσογειακή & Θαλασσινά"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Περιοχή / Δήμος *
              </label>
              <input
                required
                type="text"
                placeholder="π.χ. Μοναστηράκι, Αθήνα"
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Ακριβής Διεύθυνση (Οδός & Αριθμός) *
            </label>
            <input
              required
              type="text"
              placeholder="π.χ. Καλαμιώτου 19, Αθήνα 105 60"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Τηλέφωνο Επικοινωνίας *
              </label>
              <input
                required
                type="text"
                placeholder="+30 210 1234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ωράριο Λειτουργίας *
              </label>
              <input
                required
                type="text"
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              URL Κεντρικής Φωτογραφίας *
            </label>
            <input
              required
              type="url"
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Σύντομη Περιγραφή
            </label>
            <textarea
              rows={3}
              placeholder="Περιγράψτε τη φιλοσοφία και τα πιάτα του καταστήματος..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Signature Πιάτα / Highlights (χωρισμένα με κόμμα)
            </label>
            <input
              type="text"
              placeholder="Φρέσκο Λαβράκι, Ριζότο Μανιταριών, Χειροποίητη Πίτα"
              value={form.highlights}
              onChange={(e) => setForm({ ...form, highlights: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Συντεταγμένη Lat
              </label>
              <input
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Συντεταγμένη Lng
              </label>
              <input
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold text-center">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-sm transition disabled:opacity-50 shadow-lg"
          >
            {submitting ? "Καταχώρηση..." : "Ολοκλήρωση & Έναρξη"}
          </button>
        </form>
      </main>
    </div>
  );
}