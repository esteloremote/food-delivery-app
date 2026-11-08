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
  getDocs,
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

export default function MerchantProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorizedMerchant, setIsAuthorizedMerchant] = useState(false);

  const [existingVenues, setExistingVenues] = useState<VenueItem[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");
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

  const loadVenueDetails = useCallback(async (venueId: string) => {
    if (!venueId) return;
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
          image:
            data.image ||
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAuthorizedMerchant(false);
        setAuthLoading(false);
        router.push("/merchant/login");
        return;
      }

      try {
        const mSnap = await getDoc(doc(db, "merchants", user.uid));
        const qEmail = query(
          collection(db, "merchants"),
          where("email", "==", user.email?.toLowerCase() || "")
        );
        const emailSnap = await getDocs(qEmail);

        if (!mSnap.exists() && emailSnap.empty) {
          setIsAuthorizedMerchant(false);
          setAuthLoading(false);
          return;
        }

        setCurrentUser(user);
        setIsAuthorizedMerchant(true);
      } catch (err) {
        console.error(err);
        setIsAuthorizedMerchant(false);
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "venues"),
      where("ownerEmail", "==", currentUser.email?.toLowerCase() || "")
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
        const savedId =
          typeof window !== "undefined"
            ? localStorage.getItem("happyseats_merchant_venueId")
            : null;
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
        alert(
          `Βρέθηκε η τοποθεσία!\nΠλάτος (Lat): ${newLat.toFixed(5)}, Μήκος (Lng): ${newLng.toFixed(5)}`
        );
      } else {
        alert("Δεν βρέθηκαν ακριβείς συντεταγμένες για τη διεύθυνση αυτή.");
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
    if (!currentUser || !selectedVenueId) return;

    setSaving(true);
    setMessage(null);

    const highlightsArray = formData.highlights
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const latNum = parseFloat(String(formData.lat)) || 37.9753;
    const lngNum = parseFloat(String(formData.lng)) || 23.7361;

    try {
      await setDoc(
        doc(db, "venues", selectedVenueId),
        {
          name: formData.name.trim(),
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

      setMessage({
        type: "success",
        text: "✓ Τα στοιχεία του καταστήματος αποθηκεύτηκαν επιτυχώς!",
      });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Παρουσιάστηκε σφάλμα κατά την αποθήκευση." });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface text-text-muted flex items-center justify-center text-sm">
        Έλεγχος διαπιστευτηρίων...
      </div>
    );
  }

  if (!isAuthorizedMerchant) {
    return (
      <div className="min-h-screen bg-surface text-text-main flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center text-2xl font-bold">
          🚫
        </div>
        <h1 className="text-xl font-black">Μη Εξουσιοδοτημένη Πρόσβαση</h1>
        <Link
          href="/merchant/login"
          className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold shadow-sm"
        >
          Σύνδεση Συνεργάτη →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-text-main p-6 flex flex-col items-center">
      <header className="w-full max-w-2xl flex justify-between items-center pb-6 border-b border-border-theme mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-brand-text">
            Merchant Studio
          </span>
          <h1 className="text-2xl font-black text-text-main">Στοιχεία Καταστήματος & Μενού</h1>
          <p className="text-xs text-text-muted mt-1">
            Συνδεδεμένος ως: <strong className="text-text-main">{currentUser?.email}</strong>
          </p>
        </div>
        <Link
          href="/merchant"
          className="text-xs bg-card hover:bg-subtle px-3.5 py-2 rounded-xl transition text-text-main border border-border-theme shadow-sm"
        >
          ← Merchant Portal
        </Link>
      </header>

      <main className="w-full max-w-2xl bg-card border border-border-theme p-6 md:p-8 rounded-3xl shadow-sm space-y-6">
        <div className="bg-subtle p-4 rounded-2xl border border-border-theme space-y-2">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
              Επιλεγμένο Κατάστημα
            </label>
            <span className="text-[11px] text-text-muted">
              Για προσθήκη νέου υποκαταστήματος επικοινωνήστε με το Admin
            </span>
          </div>
          <select
            value={selectedVenueId}
            onChange={(e) => handleSelectVenue(e.target.value)}
            className="w-full bg-card border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-brand-text font-bold focus:outline-none focus:border-brand cursor-pointer shadow-sm"
          >
            {existingVenues.map((v) => (
              <option key={v.id} value={v.id}>
                📍 {v.name} (/{v.slug})
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-text-muted text-sm">Φόρτωση στοιχείων...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Όνομα Καταστήματος *</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">URL ID (Slug - Κλειδωμένο)</label>
                <input
                  disabled
                  type="text"
                  value={formData.slug}
                  className="w-full bg-subtle/60 border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-muted font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Κατηγορία / Κουζίνα *</label>
                <input
                  required
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Περιοχή *</label>
                <input
                  required
                  type="text"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">
                Ακριβής Διεύθυνση (Οδός, Αριθμός, ΤΚ) *
              </label>
              <input
                required
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Τηλέφωνο Επικοινωνίας *</label>
                <input
                  required
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Ωράριο Λειτουργίας *</label>
                <input
                  required
                  type="text"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">URL Φωτογραφίας Καταστήματος *</label>
              <input
                required
                type="url"
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">Περιγραφή Καταστήματος</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">
                Highlights / Signature Πιάτα (χωρισμένα με κόμμα)
              </label>
              <input
                type="text"
                value={formData.highlights}
                onChange={(e) => setFormData({ ...formData, highlights: e.target.value })}
                className="w-full bg-subtle border border-border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-brand"
              />
            </div>

            <div className="bg-subtle p-4 rounded-2xl border border-border-theme space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-semibold text-brand-text block">
                  📍 Συντεταγμένες για τον Χάρτη Πελάτη
                </span>
                <button
                  type="button"
                  onClick={handleGeocodeAddress}
                  disabled={geocoding}
                  className="text-[11px] bg-card hover:bg-subtle text-brand-text font-bold px-3 py-1.5 rounded-lg border border-border-theme transition disabled:opacity-50 self-start sm:self-auto cursor-pointer shadow-sm"
                >
                  {geocoding ? "Αναζήτηση..." : "🔍 Αυτόματος Εντοπισμός από Διεύθυνση"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-text-muted mb-1">Πλάτος (Lat)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lat}
                    onChange={(e) =>
                      setFormData({ ...formData, lat: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-card border border-border-theme rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-text-muted mb-1">Μήκος (Lng)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lng}
                    onChange={(e) =>
                      setFormData({ ...formData, lng: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-card border border-border-theme rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-brand"
                  />
                </div>
              </div>
            </div>

            {message && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold text-center ${
                  message.type === "success"
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                    : "bg-red-50 border border-red-200 text-red-600"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {saving ? "Αποθήκευση..." : "Αποθήκευση Προφίλ & Μενού"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}