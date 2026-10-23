import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA8CusO48An4uzbB47m-F9Ml2JKlgbnRgY",
  authDomain: "my-efood-clone.firebaseapp.com",
  projectId: "my-efood-clone",
  storageBucket: "my-efood-clone.firebasestorage.app",
  messagingSenderId: "837401736820",
  appId: "1:837401736820:web:00b79359c38e08ab7d8321",
  measurementId: "G-30PN0D882Y"
};

// Αρχικοποίηση Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);