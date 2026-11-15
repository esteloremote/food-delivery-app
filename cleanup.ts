import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "./lib/firebase";

async function clearCollection(collectionName: string) {
  const snap = await getDocs(collection(db, collectionName));
  const deletes = snap.docs.map((d) => deleteDoc(doc(db, collectionName, d.id)));
  await Promise.all(deletes);
  console.log(`Καθαρίστηκε η συλλογή: ${collectionName}`);
}

async function resetDatabase() {
  console.log("Ξεκινάει ο καθαρισμός της βάσης...");
  await clearCollection("venues");
  await clearCollection("merchants");
  await clearCollection("slots");
  await clearCollection("bookings");
  console.log("Η βάση καθαρίστηκε επιτυχώς!");
}

resetDatabase();