"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface VenueItem {
  id: string;
  name: string;
  slug: string;
}

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

export default function MerchantProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [existingVenues, setExistingVenues] = useState<VenueItem[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("NEW");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [formData, setFormData] = useState({
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

  // 1. Δήλωση της loadVenueDetails ΠΡΙΝ από τη χρήση της για αποφυγή σφαλμάτων linter
  const loadVenueDetails = useCallback(async (venueId: string) => {
    if (venueId === "NEW") {
      setFormData({
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
      return;
    }

    setLoading(true);
    try {
      const docRef = doc(db, "venues", venueId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({
          name: data.name || "",
          slug: data.slug || docSnap.id,
          category: data.category || "",
          area: data.area || "",
          address: data.address || "",
          phone: data.phone || "",
          hours: data.hours || "13:00 - 00:30 καθημερινά",
          description: data.description || "",
          image: data.image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
          lat: data.lat ?? 37.9753,
          lng: data.lng ?? 23.7361,
          highlights: (data.highlights || []).join(", "),
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Έλεγχος Σύνδεσης Εστιάτορα
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

  // 3. Real-time Subscription μόνο στα καταστήματα του συνδεδεμένου χρήστη
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "venues"),
      where("ownerId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: VenueItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name || d.id,
          slug: data.slug || d.id,
        });
      });
      setExistingVenues(list);

      if (list.length > 0) {
        const savedId = typeof window !== "undefined" ? localStorage.getItem("happyseats_merchant_venueId") : null;
        const targetId = list.find((v) => v.id === savedId)?.id || list[0].id;
        setSelectedVenueId(targetId);
        loadVenueDetails(targetId);
      }
    });

    return () => unsubscribe();
  }, [currentUser, loadVenueDetails]);

  const handleSelectVenue = (venueId: string) => {
    setSelectedVenueId(venueId);
    setMessage(null);
    loadVenueDetails(venueId);
  };

  const handleNameChange = (newName: string) => {
    const autoSlug = generateSlug(newName);
    setFormData((prev) => ({
      ...prev,
      name: newName,
      slug: selectedVenueId === "NEW" ? autoSlug : prev.slug,
    }));
  };

  // Αυτόματος εντοπισμός συντεταγμένων μέσω OpenStreetMap Nominatim
  const handleGeocodeAddress = async () => {
    if (!formData.address.trim()) {
      alert("Παρακαλώ συμπληρώστε πρώτα τη διεύθυνση του καταστήματος.");
      return;
    }

    const queryStr = `${formData.address}, ${formData.area || "Αθήνα"}, Greece`.trim();
    setGeocoding(true);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const newLat = parseFloat(data[0].lat);
        const newLng = parseFloat(data[0].lon);
        setFormData((prev) => ({
          ...prev,
          lat: Number(newLat.toFixed(5)),
          lng: Number(newLng.toFixed(5)),
        }));
        alert(`Βρέθηκε η τοποθεσία!\nΠλάτος (Lat): ${newLat.toFixed(5)}, Μήκος (Lng): ${newLng.toFixed(5)}`);
      } else {
        alert("Δεν βρέθηκαν ακριβείς συντεταγμένες για τη διεύθυνση αυτή. Ελέγξτε την ορθότητα της οδού ή συμπληρώστε χειροκίνητα τις συντεταγμένες.");
      }
    } catch (err) {
      console.error(err);
      alert("Σφάλμα επικοινωνίας κατά την αναζήτηση της διεύθυνσης.");
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setSaving(true);
    setMessage(null);

    let finalDocId = selectedVenueId;
    if (selectedVenueId === "NEW") {
      finalDocId = formData.slug.trim() || generateSlug(formData.name) || doc(collection(db, "venues")).id;
    }

    const highlightsArray = formData.highlights
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const latNum = parseFloat(String(formData.lat)) || 37.9753;
    const lngNum = parseFloat(String(formData.lng)) || 23.7361;

    try {
      await setDoc(
        doc(db, "venues", finalDocId),
        {
          ownerId: currentUser.uid,
          ownerEmail: currentUser.email,
          name: formData.name.trim(),
          slug: formData.slug.trim() || finalDocId,
          category: formData.category.trim(),
          area: formData.area.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim(),
          hours: formData.hours.trim(),
          description: formData.description.trim(),
          image: formData.image.trim(),
          lat: latNum,
          lng: lngNum,
          highlights: highlightsArray,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      localStorage.setItem("happyseats_merchant_venueId", finalDocId);
      localStorage.setItem("happyseats_merchant_venueName", formData.name.trim());

      setMessage({ type: "success", text: "✓ Το προφίλ και η διεύθυνση αποθηκεύτηκαν επιτυχώς!" });
      setSelectedVenueId(finalDocId);
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Παρουσιάστηκε σφάλμα κατά την αποθήκευση. Ελέγξτε τα δικαιώματα." });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm">
        Έλεγχος διαπιστευτηρίων...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center">
      <header className="w-full max-w-2xl flex justify-between items-center pb-6 border-b border-slate-800 mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            Merchant Studio
          </span>
          <h1 className="text-2xl font-black text-white">Διαχείριση Προφίλ & Μενού</h1>
          <p className="text-xs text-slate-400 mt-1">
            Συνδεδεμένος ως: <strong className="text-slate-200">{currentUser?.email}</strong>
          </p>
        </div>
        <Link
          href="/merchant"
          className="text-xs bg-slate-800 hover:bg-slate-700 px-3.5 py-2 rounded-xl transition text-slate-300"
        >
          ← Merchant Portal
        </Link>
      </header>

      <main className="w-full max-w-2xl bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl space-y-6">
        {/* Επιλογέας Καταστήματος */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Επιλογή Καταστήματος προς Επεξεργασία
          </label>
          <select
            value={selectedVenueId}
            onChange={(e) => handleSelectVenue(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-amber-400 font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            {existingVenues.map((v) => (
              <option key={v.id} value={v.id}>
                📍 {v.name} ({v.slug})
              </option>
            ))}
            <option value="NEW">+ Δημιουργία Νέου Καταστήματος</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Φόρτωση στοιχείων...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Όνομα Καταστήματος *</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="π.χ. Ταβέρνα ο Πέτρος"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">URL ID (Slug)</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="taverna-o-petros"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-300 font-mono focus:outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  URL: /venue/{formData.slug || "..."}
                </span>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Κατηγορία / Κουζίνα *</label>
                <input
                  required
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="π.χ. Ελληνική Ταβέρνα, Ψησταριά"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Περιοχή *</label>
                <input
                  required
                  type="text"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  placeholder="π.χ. Πλάκα, Κολωνάκι, Γλυφάδα"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Ακριβής Διεύθυνση (Οδός, Αριθμός, ΤΚ) *
              </label>
              <input
                required
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="π.χ. Αδριανού 12, Αθήνα"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Τηλέφωνο Επικοινωνίας *</label>
                <input
                  required
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+30 210 1234567"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Ωράριο Λειτουργίας *</label>
                <input
                  required
                  type="text"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  placeholder="13:00 - 00:30 καθημερινά"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">URL Φωτογραφίας Καταστήματος *</label>
              <input
                required
                type="url"
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Περιγραφή Καταστήματος</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Λίγα λόγια για την ατμόσφαιρα, τη φιλοσοφία και το μενού..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Highlights / Signature Πιάτα (χωρισμένα με κόμμα)
              </label>
              <input
                type="text"
                value={formData.highlights}
                onChange={(e) => setFormData({ ...formData, highlights: e.target.value })}
                placeholder="Αρνί στο φούρνο, Χωριάτικη σαλάτα, Τζατζίκι"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Συντεταγμένες και Αυτόματος Εντοπισμός */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-semibold text-amber-400 block">
                  📍 Συντεταγμένες για τον Χάρτη Πελάτη
                </span>
                <button
                  type="button"
                  onClick={handleGeocodeAddress}
                  disabled={geocoding}
                  className="text-[11px] bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold px-3 py-1.5 rounded-lg border border-slate-700 transition disabled:opacity-50 self-start sm:self-auto"
                >
                  {geocoding ? "Αναζήτηση..." : "🔍 Αυτόματος Εντοπισμός από Διεύθυνση"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Πλάτος (Lat) - π.χ. 37.9753</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Μήκος (Lng) - π.χ. 23.7361</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {message && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold text-center ${
                  message.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/10 border border-red-500/30 text-red-300"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-sm transition disabled:opacity-50 shadow-lg"
            >
              {saving ? "Αποθήκευση..." : "Αποθήκευση Προφίλ & Μενού"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}