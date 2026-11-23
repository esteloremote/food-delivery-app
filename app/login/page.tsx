// // "use client";

// // import { useState } from "react";
// // import { useRouter } from "next/navigation";
// // import Link from "next/link";
// // import {
// //   signInWithEmailAndPassword,
// //   createUserWithEmailAndPassword,
// //   signInWithPopup,
// //   GoogleAuthProvider,
// //   OAuthProvider,
// //   updateProfile,
// //   sendPasswordResetEmail,
// //   sendEmailVerification,
// //   signOut,
// //   User,
// // } from "firebase/auth";
// // import { auth, db } from "@/lib/firebase";
// // import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

// // function GoogleIcon() {
// //   return (
// //     <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
// //       <path
// //         fill="#4285F4"
// //         d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
// //       />
// //       <path
// //         fill="#34A853"
// //         d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
// //       />
// //       <path
// //         fill="#FBBC05"
// //         d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
// //       />
// //       <path
// //         fill="#EA4335"
// //         d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
// //       />
// //     </svg>
// //   );
// // }

// // function AppleIcon() {
// //   return (
// //     <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
// //       <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
// //     </svg>
// //   );
// // }

// // function EyeIcon({ visible }: { visible: boolean }) {
// //   if (visible) {
// //     return (
// //       <svg
// //         className="w-4 h-4"
// //         fill="none"
// //         viewBox="0 0 24 24"
// //         stroke="currentColor"
// //         strokeWidth={2}
// //         aria-hidden="true"
// //       >
// //         <path
// //           strokeLinecap="round"
// //           strokeLinejoin="round"
// //           d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
// //         />
// //       </svg>
// //     );
// //   }
// //   return (
// //     <svg
// //       className="w-4 h-4"
// //       fill="none"
// //       viewBox="0 0 24 24"
// //       stroke="currentColor"
// //       strokeWidth={2}
// //       aria-hidden="true"
// //     >
// //       <path
// //         strokeLinecap="round"
// //         strokeLinejoin="round"
// //         d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
// //       />
// //       <path
// //         strokeLinecap="round"
// //         strokeLinejoin="round"
// //         d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
// //       />
// //     </svg>
// //   );
// // }

// // function ArrowLeftIcon() {
// //   return (
// //     <svg
// //       className="w-3.5 h-3.5"
// //       fill="none"
// //       viewBox="0 0 24 24"
// //       stroke="currentColor"
// //       strokeWidth={2.5}
// //       aria-hidden="true"
// //     >
// //       <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
// //     </svg>
// //   );
// // }

// // export default function CustomerLoginPage() {
// //   const router = useRouter();
// //   const [isRegister, setIsRegister] = useState(false);
// //   const [isForgotMode, setIsForgotMode] = useState(false);

// //   // Βήμα συμπλήρωσης ονόματος για νέους χρήστες Google / Apple
// //   const [pendingSocialUser, setPendingSocialUser] = useState<User | null>(null);
// //   const [socialNameInput, setSocialNameInput] = useState("");

// //   // Κουμπί επαναποστολής verification email
// //   const [unverifiedUser, setUnverifiedUser] = useState<User | null>(null);
// //   const [suggestRegister, setSuggestRegister] = useState(false);

// //   const [fullName, setFullName] = useState("");
// //   const [email, setEmail] = useState("");
// //   const [password, setPassword] = useState("");
// //   const [showPassword, setShowPassword] = useState(false);

// //   const [loading, setLoading] = useState(false);
// //   const [errorMsg, setErrorMsg] = useState<string | null>(null);
// //   const [infoMsg, setInfoMsg] = useState<string | null>(null);

// //   const handleSocialSignIn = async (providerType: "google" | "apple") => {
// //     setLoading(true);
// //     setErrorMsg(null);
// //     setInfoMsg(null);
// //     setUnverifiedUser(null);

// //     try {
// //       const provider =
// //         providerType === "google"
// //           ? new GoogleAuthProvider()
// //           : new OAuthProvider("apple.com");

// //       if (providerType === "apple") {
// //         (provider as OAuthProvider).addScope("email");
// //         (provider as OAuthProvider).addScope("name");
// //       }

// //       const result = await signInWithPopup(auth, provider);
// //       const user = result.user;

// //       const userSnap = await getDoc(doc(db, "users", user.uid));
// //       const existingData = userSnap.exists() ? userSnap.data() : null;

// //       if (!existingData || !existingData.profileCompleted) {
// //         setPendingSocialUser(user);
// //         setSocialNameInput(user.displayName || "");
// //         setLoading(false);
// //         return;
// //       }

// //       router.push("/");
// //     } catch (err: unknown) {
// //       console.error(err);
// //       setErrorMsg(
// //         providerType === "google"
// //           ? "Σφάλμα κατά τη σύνδεση με Google."
// //           : "Σφάλμα κατά τη σύνδεση με Apple."
// //       );
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   const handleCompleteSocialProfile = async (e: React.FormEvent) => {
// //     e.preventDefault();
// //     if (!pendingSocialUser) return;
// //     const cleanName = socialNameInput.trim();
// //     if (cleanName.length < 2) {
// //       setErrorMsg("Παρακαλώ εισάγετε ένα έγκυρο όνομα (τουλάχιστον 2 χαρακτήρες).");
// //       return;
// //     }

// //     setLoading(true);
// //     setErrorMsg(null);

// //     try {
// //       await updateProfile(pendingSocialUser, { displayName: cleanName });
// //       await setDoc(
// //         doc(db, "users", pendingSocialUser.uid),
// //         {
// //           name: cleanName,
// //           email: pendingSocialUser.email || "",
// //           role: "customer",
// //           streak: 0,
// //           profileCompleted: true,
// //           createdAt: serverTimestamp(),
// //           updatedAt: serverTimestamp(),
// //         },
// //         { merge: true }
// //       );

// //       setPendingSocialUser(null);
// //       router.push("/");
// //     } catch (err) {
// //       console.error(err);
// //       setErrorMsg("Σφάλμα κατά την αποθήκευση του ονόματος.");
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   const handleForgotPassword = async (e: React.FormEvent) => {
// //     e.preventDefault();
// //     if (!email.trim()) {
// //       setErrorMsg("Παρακαλώ εισάγετε το email σας.");
// //       return;
// //     }

// //     setLoading(true);
// //     setErrorMsg(null);
// //     setInfoMsg(null);

// //     try {
// //       await sendPasswordResetEmail(auth, email.trim(), {
// //         url: `${window.location.origin}/login`,
// //         handleCodeInApp: false,
// //       });
// //       setInfoMsg("Σας στάλθηκε email επαναφοράς κωδικού. Ελέγξτε τα εισερχόμενά σας.");
// //     } catch (err: unknown) {
// //       console.error(err);
// //       setErrorMsg("Σφάλμα κατά την αποστολή email επαναφοράς.");
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   const handleResendVerification = async () => {
// //     if (!unverifiedUser) return;
// //     setLoading(true);
// //     try {
// //       const actionCodeSettings = {
// //         // Προωθεί στην αρχική σελίδα (ή βάλε "/login" αν θέλεις να πηγαίνει κατευθείαν στη σύνδεση)
// //         url: `${window.location.origin}/login`,
// //         handleCodeInApp: false,
// //       };
// //       await sendEmailVerification(unverifiedUser, {
// //         url: `${window.location.origin}/`,
// //         handleCodeInApp: false,
// //       });
// //       setInfoMsg("Στάλθηκε νέο email επιβεβαίωσης! Ελέγξτε τα εισερχόμενα ή τα Spam.");
// //       setErrorMsg(null);
// //     } catch {
// //       setErrorMsg("Περιμένετε λίγο πριν ζητήσετε νέο email επιβεβαίωσης.");
// //     } finally {
// //       await signOut(auth);
// //       setUnverifiedUser(null);
// //       setLoading(false);
// //     }
// //   };

// //   const handleSubmit = async (e: React.FormEvent) => {
// //     e.preventDefault();
// //     setLoading(true);
// //     setErrorMsg(null);
// //     setSuggestRegister(false);
// //     setInfoMsg(null);
// //     setUnverifiedUser(null);

// //     try {
// //       if (isRegister) {
// //         if (fullName.trim().length < 2) {
// //           setErrorMsg("Παρακαλώ συμπληρώστε το όνομά σας.");
// //           setLoading(false);
// //           return;
// //         }

// //         const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
// //         const user = cred.user;
// //         const actionCodeSettings = {
// //           // Προωθεί στην αρχική σελίδα (ή βάλε "/login" αν θέλεις να πηγαίνει κατευθείαν στη σύνδεση)
// //           url: `${window.location.origin}/`,
// //           handleCodeInApp: false,
// //         };
// //         await updateProfile(user, { displayName: fullName.trim() });
// //         await sendEmailVerification(user, {
// //           url: `${window.location.origin}/login`,
// //           handleCodeInApp: false,
// //         });

// //         await setDoc(doc(db, "users", user.uid), {
// //           name: fullName.trim(),
// //           email: user.email,
// //           role: "customer",
// //           streak: 0,
// //           profileCompleted: true,
// //           createdAt: serverTimestamp(),
// //         });

// //         await signOut(auth);

// //         setInfoMsg(
// //           "Σας στείλαμε email επιβεβαίωσης! Πατήστε τον σύνδεσμο στο email σας για να ενεργοποιηθεί ο λογαριασμός και μετά συνδεθείτε."
// //         );
// //         setIsRegister(false);
// //         setPassword("");
// //       } else {
// //         const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
// //         const user = cred.user;

// //         if (!user.emailVerified) {
// //           setUnverifiedUser(user);
// //           setErrorMsg(
// //             "Το email σας δεν έχει επιβεβαιωθεί ακόμα. Ελέγξτε τα εισερχόμενά σας (ή τα Spam) και πατήστε τον σύνδεσμο."
// //           );
// //           await signOut(auth);
// //           setLoading(false);
// //           return;
// //         }

// //         router.push("/");
// //       }
// //     } catch (err: unknown) {
// //       const code = (err as { code?: string })?.code;

// //       if (code === "auth/email-already-in-use") {
// //         setErrorMsg("Αυτό το email χρησιμοποιείται ήδη. Δοκίμασε να συνδεθείς.");
// //       } else if (code === "auth/user-not-found") {
// //         setErrorMsg("Δεν βρέθηκε λογαριασμός με αυτό το email.");
// //         setSuggestRegister(true);
// //       } else if (
// //         code === "auth/invalid-credential" ||
// //         code === "auth/invalid-login-credentials"
// //       ) {
// //         setErrorMsg(
// //           "Λάθος email ή κωδικός πρόσβασης. Αν δεν έχεις λογαριασμό, κάνε εγγραφή."
// //         );
// //         setSuggestRegister(true);
// //       } else if (code === "auth/wrong-password") {
// //         setErrorMsg("Ο κωδικός πρόσβασης είναι λανθασμένος.");
// //       } else if (code === "auth/invalid-email") {
// //         setErrorMsg("Η διεύθυνση email δεν είναι έγκυρη.");
// //       } else if (code === "auth/weak-password") {
// //         setErrorMsg("Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.");
// //       } else if (code === "auth/too-many-requests") {
// //         setErrorMsg("Πολλές αποτυχημένες προσπάθειες. Δοκίμασε ξανά σε λίγα λεπτά.");
// //       } else {
// //         console.warn("Login error:", code, err);
// //         setErrorMsg("Προέκυψε σφάλμα. Δοκιμάστε ξανά.");
// //       }
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   // ΟΘΟΝΗ 1: Συμπλήρωση ονόματος μετά από Google/Apple εγγραφή
// //   if (pendingSocialUser) {
// //     return (
// //       <div className="min-h-screen bg-surface text-text-main flex flex-col items-center justify-center p-6">
// //         <div className="w-full max-w-md space-y-4">
// //           <Link
// //             href="/"
// //             className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-main transition"
// //           >
// //             <ArrowLeftIcon />
// //             Επιστροφή στην Αρχική
// //           </Link>

// //           <div className="bg-card border border-border-theme rounded-3xl p-8 shadow-lg space-y-5">
// //             <div className="text-center space-y-1.5">
// //               <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center text-2xl mx-auto">
// //                 👋
// //               </div>
// //               <h1 className="text-xl font-black text-text-main">Ένα τελευταίο βήμα!</h1>
// //               <p className="text-xs text-text-muted">
// //                 Πώς να σε αποκαλούμε στις κρατήσεις σου;
// //               </p>
// //             </div>

// //             {errorMsg && (
// //               <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold">
// //                 {errorMsg}
// //               </div>
// //             )}

// //             <form onSubmit={handleCompleteSocialProfile} className="space-y-4">
// //               <div>
// //                 <label className="block text-xs font-semibold text-text-muted mb-1.5">
// //                   Ονοματεπώνυμο
// //                 </label>
// //                 <input
// //                   type="text"
// //                   required
// //                   value={socialNameInput}
// //                   onChange={(e) => setSocialNameInput(e.target.value)}
// //                   placeholder="π.χ. Γιώργος Παπαδόπουλος"
// //                   className="w-full bg-subtle border border-border-theme rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition"
// //                 />
// //               </div>

// //               <button
// //                 type="submit"
// //                 disabled={loading}
// //                 className="w-full py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition cursor-pointer disabled:opacity-50 shadow-sm"
// //               >
// //                 {loading ? "Ενεργοποίηση..." : "Ενεργοποίηση Λογαριασμού →"}
// //               </button>

// //               <button
// //                 type="button"
// //                 onClick={async () => {
// //                   await signOut(auth);
// //                   setPendingSocialUser(null);
// //                 }}
// //                 className="w-full py-2 text-xs font-medium text-text-muted hover:text-text-main transition cursor-pointer"
// //               >
// //                 Ακύρωση
// //               </button>
// //             </form>
// //           </div>
// //         </div>
// //       </div>
// //     );
// //   }

// //   // ΟΘΟΝΗ 2: Κλασική Σύνδεση / Εγγραφή / Επαναφορά Κωδικού
// //   return (
// //     <div className="min-h-screen bg-surface text-text-main flex flex-col items-center justify-center p-6">
// //       <div className="w-full max-w-md space-y-4">
// //         {/* Επιστροφή στην Αρχική */}
// //         <Link
// //           href="/"
// //           className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-main transition"
// //         >
// //           <ArrowLeftIcon />
// //           Επιστροφή στην Αρχική
// //         </Link>

// //         <div className="bg-card border border-border-theme rounded-3xl p-7 sm:p-8 shadow-lg space-y-6">
// //           {/* Header & Brand */}
// //           <div className="text-center space-y-1">
// //             <Link href="/" className="text-2xl font-black text-brand tracking-tight inline-block">
// //               HappySeats
// //             </Link>
// //             <p className="text-xs text-text-muted">
// //               {isForgotMode
// //                 ? "Εισάγετε το email σας για να επαναφέρετε τον κωδικό σας"
// //                 : isRegister
// //                 ? "Δημιουργήστε λογαριασμό για κρατήσεις & VIP προνόμια"
// //                 : "Καλώς ήρθατε ξανά! Συνδεθείτε στον λογαριασμό σας"}
// //             </p>
// //           </div>

// //           {/* Segmented Tabs (Σύνδεση / Εγγραφή) */}
// //           {!isForgotMode && (
// //             <div className="grid grid-cols-2 p-1 bg-subtle rounded-2xl border border-border-theme">
// //               <button
// //                 type="button"
// //                 onClick={() => {
// //                   setIsRegister(false);
// //                   setErrorMsg(null);
// //                   setInfoMsg(null);
// //                 }}
// //                 className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
// //                   !isRegister
// //                     ? "bg-card text-text-main shadow-sm"
// //                     : "text-text-muted hover:text-text-main"
// //                 }`}
// //               >
// //                 Σύνδεση
// //               </button>
// //               <button
// //                 type="button"
// //                 onClick={() => {
// //                   setIsRegister(true);
// //                   setErrorMsg(null);
// //                   setInfoMsg(null);
// //                 }}
// //                 className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
// //                   isRegister
// //                     ? "bg-card text-text-main shadow-sm"
// //                     : "text-text-muted hover:text-text-main"
// //                 }`}
// //               >
// //                 Εγγραφή
// //               </button>
// //             </div>
// //           )}

// //           {/* Alerts */}
// //           {errorMsg && (
// //             <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold space-y-2">
// //               <p>{errorMsg}</p>
// //               {unverifiedUser && (
// //                 <button
// //                   type="button"
// //                   onClick={handleResendVerification}
// //                   className="underline font-bold text-red-800 hover:text-red-900 cursor-pointer block"
// //                 >
// //                   Επαναποστολή email επιβεβαίωσης
// //                 </button>
// //               )}
// //               {suggestRegister && !isRegister && (
// //                 <button
// //                   type="button"
// //                   onClick={() => {
// //                     setIsRegister(true);
// //                     setErrorMsg(null);
// //                     setSuggestRegister(false);
// //                   }}
// //                   className="underline font-bold text-red-800 hover:text-red-900 cursor-pointer block"
// //                 >
// //                   Δημιουργία νέου λογαριασμού με αυτό το email →
// //                 </button>
// //               )}
// //             </div>
// //           )}

// //           {infoMsg && (
// //             <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold">
// //               {infoMsg}
// //             </div>
// //           )}

// //           {/* Social Login Buttons */}
// //           {!isForgotMode && (
// //             <div className="space-y-2.5">
// //               <button
// //                 type="button"
// //                 disabled={loading}
// //                 onClick={() => handleSocialSignIn("google")}
// //                 className="w-full py-2.5 px-4 bg-card hover:bg-subtle border border-border-theme rounded-xl text-xs font-bold text-text-main transition flex items-center justify-center gap-2.5 cursor-pointer shadow-sm"
// //               >
// //                 <GoogleIcon />
// //                 <span>Συνέχεια με Google</span>
// //               </button>

// //               <button
// //                 type="button"
// //                 disabled={loading}
// //                 onClick={() => handleSocialSignIn("apple")}
// //                 className="w-full py-2.5 px-4 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2.5 cursor-pointer shadow-sm"
// //               >
// //                 <AppleIcon />
// //                 <span>Συνέχεια με Apple</span>
// //               </button>

// //               <div className="relative flex items-center py-2">
// //                 <div className="flex-grow border-t border-border-theme" />
// //                 <span className="flex-shrink mx-3 text-[11px] font-medium text-text-muted">
// //                   ή με email
// //                 </span>
// //                 <div className="flex-grow border-t border-border-theme" />
// //               </div>
// //             </div>
// //           )}

// //           {/* Email Form */}
// //           <form onSubmit={isForgotMode ? handleForgotPassword : handleSubmit} className="space-y-4">
// //             {isRegister && !isForgotMode && (
// //               <div>
// //                 <label className="block text-xs font-semibold text-text-muted mb-1.5">
// //                   Ονοματεπώνυμο
// //                 </label>
// //                 <input
// //                   type="text"
// //                   required
// //                   value={fullName}
// //                   onChange={(e) => setFullName(e.target.value)}
// //                   placeholder="π.χ. Μαρία Κωνσταντίνου"
// //                   className="w-full bg-subtle border border-border-theme rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition"
// //                 />
// //               </div>
// //             )}

// //             <div>
// //               <label className="block text-xs font-semibold text-text-muted mb-1.5">Email</label>
// //               <input
// //                 type="email"
// //                 required
// //                 value={email}
// //                 onChange={(e) => setEmail(e.target.value)}
// //                 placeholder="name@example.com"
// //                 className="w-full bg-subtle border border-border-theme rounded-xl px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition"
// //               />
// //             </div>

// //             {!isForgotMode && (
// //               <div>
// //                 <div className="flex items-center justify-between mb-1.5">
// //                   <label className="block text-xs font-semibold text-text-muted">
// //                     Κωδικός Πρόσβασης
// //                   </label>
// //                   {!isRegister && (
// //                     <button
// //                       type="button"
// //                       onClick={() => {
// //                         setIsForgotMode(true);
// //                         setErrorMsg(null);
// //                         setInfoMsg(null);
// //                       }}
// //                       className="text-[11px] font-semibold text-brand-text hover:underline cursor-pointer"
// //                     >
// //                       Ξέχασες τον κωδικό;
// //                     </button>
// //                   )}
// //                 </div>
// //                 <div className="relative">
// //                   <input
// //                     type={showPassword ? "text" : "password"}
// //                     required
// //                     minLength={6}
// //                     value={password}
// //                     onChange={(e) => setPassword(e.target.value)}
// //                     placeholder="••••••••"
// //                     className="w-full bg-subtle border border-border-theme rounded-xl px-4 py-2.5 pr-11 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition"
// //                   />
// //                   <button
// //                     type="button"
// //                     onClick={() => setShowPassword((prev) => !prev)}
// //                     aria-label={showPassword ? "Απόκρυψη κωδικού" : "Εμφάνιση κωδικού"}
// //                     className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-main transition cursor-pointer"
// //                   >
// //                     <EyeIcon visible={showPassword} />
// //                   </button>
// //                 </div>
// //               </div>
// //             )}

// //             <button
// //               type="submit"
// //               disabled={loading}
// //               className="w-full py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition cursor-pointer disabled:opacity-50 shadow-sm"
// //             >
// //               {loading
// //                 ? "Παρακαλώ περιμένετε..."
// //                 : isForgotMode
// //                 ? "Αποστολή Email Επαναφοράς"
// //                 : isRegister
// //                 ? "Εγγραφή & Επιβεβαίωση Email"
// //                 : "Σύνδεση"}
// //             </button>
// //           </form>

// //           {isForgotMode && (
// //             <div className="text-center pt-1">
// //               <button
// //                 type="button"
// //                 onClick={() => {
// //                   setIsForgotMode(false);
// //                   setErrorMsg(null);
// //                   setInfoMsg(null);
// //                 }}
// //                 className="text-xs text-brand-text font-bold hover:underline cursor-pointer"
// //               >
// //                 ← Επιστροφή στη Σύνδεση
// //               </button>
// //             </div>
// //           )}
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }

// "use client";

// import { useState, useEffect, Suspense } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import Link from "next/link";
// import {
//   signInWithEmailAndPassword,
//   createUserWithEmailAndPassword,
//   signInWithPopup,
//   GoogleAuthProvider,
//   onAuthStateChanged,
//   sendPasswordResetEmail,
// } from "firebase/auth";
// import {
//   doc,
//   getDoc,
//   setDoc,
//   collection,
//   query,
//   where,
//   getDocs,
//   serverTimestamp,
// } from "firebase/firestore";
// import { auth, db } from "@/lib/firebase";

// type UserRole = "customer" | "merchant";
// type AuthMode = "signin" | "signup";

// async function checkIsMerchant(uid: string, email?: string | null): Promise<boolean> {
//   const mSnap = await getDoc(doc(db, "merchants", uid));
//   if (mSnap.exists()) return true;

//   if (email) {
//     const q = query(
//       collection(db, "merchants"),
//       where("email", "==", email.toLowerCase().trim())
//     );
//     const snap = await getDocs(q);
//     if (!snap.empty) return true;
//   }
//   return false;
// }

// function LampLoginContent() {
//   const router = useRouter();
//   const searchParams = useSearchParams();

//   const [checkingAuth, setCheckingAuth] = useState(true);
//   const [lampOn, setLampOn] = useState(true);
//   const [pullingCord, setPullingCord] = useState(false);

//   const initialRole: UserRole =
//     searchParams.get("role") === "merchant" ? "merchant" : "customer";
//   const [role, setRole] = useState<UserRole>(initialRole);
//   const [mode, setMode] = useState<AuthMode>("signin");

//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [errorMsg, setErrorMsg] = useState<string | null>(null);
//   const [infoMsg, setInfoMsg] = useState<string | null>(null);

//   // Αν ο χρήστης είναι ήδη συνδεδεμένος, τον κατευθύνουμε αυτόματα
//   useEffect(() => {
//     const unsub = onAuthStateChanged(auth, async (user) => {
//       if (!user) {
//         setCheckingAuth(false);
//         return;
//       }
//       try {
//         const isMerch = await checkIsMerchant(user.uid, user.email);
//         if (isMerch && role === "merchant") {
//           router.replace("/merchant");
//         } else {
//           router.replace("/");
//         }
//       } catch {
//         setCheckingAuth(false);
//       }
//     });
//     return () => unsub();
//   }, [router, role]);

//   // Κίνηση κορδονιού λάμπας με ήχο "κλικ"
//   const handleToggleLamp = () => {
//     setPullingCord(true);
//     try {
//       const ctx = new (window.AudioContext ||
//         (window as unknown as { webkitAudioContext: typeof AudioContext })
//           .webkitAudioContext)();
//       const osc = ctx.createOscillator();
//       const gain = ctx.createGain();
//       osc.type = "triangle";
//       osc.frequency.setValueAtTime(lampOn ? 240 : 420, ctx.currentTime);
//       gain.gain.setValueAtTime(0.08, ctx.currentTime);
//       gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
//       osc.connect(gain);
//       gain.connect(ctx.destination);
//       osc.start();
//       osc.stop(ctx.currentTime + 0.06);
//     } catch {
//       // ignore
//     }

//     setTimeout(() => {
//       setLampOn((prev) => !prev);
//       setPullingCord(false);
//     }, 160);
//   };

//   // Επαναφορά κωδικού με επιστροφή στο /login
//   const handleForgotPassword = async () => {
//     setErrorMsg(null);
//     setInfoMsg(null);
//     if (!email.trim()) {
//       setErrorMsg("Συμπλήρωσε πρώτα το email σου για να σου στείλουμε link επαναφοράς.");
//       return;
//     }
//     setLoading(true);
//     try {
//       await sendPasswordResetEmail(auth, email.trim(), {
//         url: `${window.location.origin}/login`,
//         handleCodeInApp: false,
//       });
//       setInfoMsg(
//         "✓ Σας στάλθηκε email επαναφοράς κωδικού. Ελέγξτε τα εισερχόμενά σας (ή τα Spam)."
//       );
//     } catch {
//       setErrorMsg("Αδυναμία αποστολής email επαναφοράς. Έλεγξε τη διεύθυνση email.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Υποβολή Email / Password
//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setErrorMsg(null);
//     setInfoMsg(null);
//     setLoading(true);

//     try {
//       if (mode === "signin") {
//         const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

//         if (role === "merchant") {
//           const isMerch = await checkIsMerchant(cred.user.uid, cred.user.email);
//           if (!isMerch) {
//             setErrorMsg(
//               "Αυτός ο λογαριασμός δεν είναι ενεργός Συνεργάτης. Άλλαξε σε «Πελάτης» ή υπέβαλε Αίτηση Συνεργασίας."
//             );
//             setLoading(false);
//             return;
//           }
//           router.push("/merchant");
//         } else {
//           router.push("/");
//         }
//       } else {
//         // ΕΓΓΡΑΦΗ (Μόνο για Πελάτες — οι Μαγαζάτορες περνούν από /merchant/apply)
//         const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
//         await setDoc(doc(db, "users", cred.user.uid), {
//           email: cred.user.email?.toLowerCase(),
//           displayName: name.trim() || "Επισκέπτης",
//           streak: 0,
//           favorites: [],
//           createdAt: serverTimestamp(),
//         });
//         router.push("/");
//       }
//     } catch (err: unknown) {
//       const code = (err as { code?: string })?.code || "";
//       if (code.includes("invalid-credential") || code.includes("wrong-password")) {
//         setErrorMsg("Λάθος email ή κωδικός πρόσβασης.");
//       } else if (code.includes("email-already-in-use")) {
//         setErrorMsg("Υπάρχει ήδη λογαριασμός με αυτό το email.");
//       } else if (code.includes("weak-password")) {
//         setErrorMsg("Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.");
//       } else {
//         setErrorMsg("Παρουσιάστηκε σφάλμα. Δοκίμασε ξανά.");
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Σύνδεση με Google
//   const handleGoogleAuth = async () => {
//     setErrorMsg(null);
//     setInfoMsg(null);
//     setLoading(true);
//     try {
//       const provider = new GoogleAuthProvider();
//       const cred = await signInWithPopup(auth, provider);

//       if (role === "merchant") {
//         const isMerch = await checkIsMerchant(cred.user.uid, cred.user.email);
//         if (!isMerch) {
//           setErrorMsg(
//             "Δεν βρέθηκε ενεργός λογαριασμός Συνεργάτη για αυτό το Google email. Υπέβαλε πρώτα Αίτηση Συνεργασίας."
//           );
//           setLoading(false);
//           return;
//         }
//         router.push("/merchant");
//       } else {
//         await setDoc(
//           doc(db, "users", cred.user.uid),
//           {
//             email: cred.user.email?.toLowerCase(),
//             displayName: cred.user.displayName || "Επισκέπτης",
//           },
//           { merge: true }
//         );
//         router.push("/");
//       }
//     } catch {
//       setErrorMsg("Η σύνδεση με Google ακυρώθηκε.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (checkingAuth) {
//     return <div className="min-h-screen bg-[#070b10]" />;
//   }

//   const isMerchant = role === "merchant";
//   const glowColor = isMerchant ? "rgba(56, 189, 248, 0.32)" : "rgba(249, 115, 22, 0.32)";
//   const bulbFill = !lampOn ? "#1e293b" : isMerchant ? "#7dd3fc" : "#fdba74";
//   const accentBg = isMerchant
//     ? "bg-sky-500 hover:bg-sky-400 text-slate-950"
//     : "bg-orange-500 hover:bg-orange-400 text-white";

//   return (
//     <div className="min-h-screen bg-[#070b10] text-slate-100 flex flex-col justify-between relative overflow-hidden select-none">
//       {/* Ambient Background Glow */}
//       <div
//         className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[780px] h-[520px] rounded-full blur-[130px] transition-all duration-700"
//         style={{
//           background: lampOn ? glowColor : "rgba(15, 23, 42, 0.2)",
//         }}
//       />

//       {/* Top Bar */}
//       <header className="relative z-10 max-w-6xl w-full mx-auto px-6 pt-6 flex items-center justify-between">
//         <Link href="/" className="flex items-center gap-2.5">
//           <span className="text-2xl font-black tracking-tight text-white">
//             <span className={isMerchant ? "text-sky-400" : "text-orange-500"}>
//               Happy
//             </span>
//             Seats
//           </span>
//           <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
//             {isMerchant ? "B2B Partner Portal" : "Είσοδος"}
//           </span>
//         </Link>

//         <div className="flex items-center gap-2">
//           <Link
//             href="/"
//             className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition"
//           >
//             ← Αρχική
//           </Link>
//           <button
//             type="button"
//             onClick={handleToggleLamp}
//             className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition cursor-pointer"
//           >
//             {lampOn ? "💡 Σβήσε το φως" : "🔦 Άναψε το φως"}
//           </button>
//         </div>
//       </header>

//       {/* Main Split Area */}
//       <main className="relative z-10 max-w-5xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
//         {/* ΑΡΙΣΤΕΡΑ: ΔΙΑΔΡΑΣΤΙΚΗ ΛΑΜΠΑ */}
//         <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
//           <div className="relative w-72 h-80 flex items-center justify-center">
//             <div
//               className={`absolute top-24 left-28 w-72 h-64 origin-top-left pointer-events-none transition-opacity duration-500 ${
//                 lampOn ? "opacity-100" : "opacity-0"
//               }`}
//               style={{
//                 background: isMerchant
//                   ? "linear-gradient(135deg, rgba(56,189,248,0.35) 0%, rgba(56,189,248,0.02) 75%, transparent 100%)"
//                   : "linear-gradient(135deg, rgba(249,115,22,0.35) 0%, rgba(249,115,22,0.02) 75%, transparent 100%)",
//                 clipPath: "polygon(15% 0%, 45% 0%, 100% 100%, 0% 100%)",
//                 filter: "blur(10px)",
//               }}
//             />

//             <svg
//               viewBox="0 0 260 320"
//               className="w-full h-full drop-shadow-2xl overflow-visible"
//             >
//               <ellipse cx="95" cy="296" rx="52" ry="12" fill="#1e293b" />
//               <ellipse cx="95" cy="292" rx="44" ry="9" fill="#334155" />
//               <line x1="95" y1="290" x2="62" y2="185" stroke="#475569" strokeWidth="8" strokeLinecap="round" />
//               <circle cx="62" cy="185" r="9" fill="#f59e0b" />
//               <circle cx="62" cy="185" r="4" fill="#0f172a" />
//               <line x1="62" y1="185" x2="118" y2="92" stroke="#64748b" strokeWidth="7" strokeLinecap="round" />
//               <circle cx="118" cy="92" r="8" fill="#f59e0b" />
//               <path
//                 d="M 105 85 C 125 62, 168 68, 182 104 L 112 134 C 98 114, 96 96, 105 85 Z"
//                 fill="#1e293b"
//                 stroke="#334155"
//                 strokeWidth="2"
//               />
//               <ellipse
//                 cx="148"
//                 cy="120"
//                 rx="24"
//                 ry="11"
//                 transform="rotate(-23 148 120)"
//                 fill={bulbFill}
//                 className="transition-colors duration-300"
//               />
//               <g
//                 onClick={handleToggleLamp}
//                 className="cursor-pointer group"
//                 style={{
//                   transform: pullingCord ? "translateY(14px)" : "translateY(0px)",
//                   transition: "transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1)",
//                 }}
//               >
//                 <rect x="130" y="122" width="36" height="75" fill="transparent" />
//                 <line
//                   x1="148"
//                   y1="124"
//                   x2="148"
//                   y2="178"
//                   stroke="#94a3b8"
//                   strokeWidth="2.5"
//                   strokeDasharray="3 2"
//                 />
//                 <circle
//                   cx="148"
//                   cy="183"
//                   r="7"
//                   fill={isMerchant ? "#38bdf8" : "#f97316"}
//                   className="group-hover:scale-125 transition-transform origin-center"
//                 />
//               </g>
//             </svg>
//           </div>

//           <p className="text-xs text-slate-400 text-center max-w-xs mt-1">
//             Τράβηξε το <span className="text-white font-bold">κορδόνι της λάμπας</span> για να ανάψεις ή να σβήσεις τον φωτισμό.
//           </p>
//         </div>

//         {/* ΔΕΞΙΑ: ΚΑΡΤΑ ΕΙΣΟΔΟΥ / ΕΓΓΡΑΦΗΣ */}
//         <div className="lg:col-span-7">
//           <div
//             className={`rounded-3xl p-6 sm:p-8 border transition-all duration-500 backdrop-blur-xl ${
//               lampOn
//                 ? "bg-[#111822]/90 border-white/15 shadow-[0_0_60px_-15px_rgba(0,0,0,0.8)] opacity-100"
//                 : "bg-[#0b0f17]/70 border-white/5 opacity-45 hover:opacity-85"
//             }`}
//           >
//             {/* ΕΠΙΛΟΓΗ ΡΟΛΟΥ */}
//             <div className="mb-6">
//               <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
//                 1. Επίλεξε Περιβάλλον Εισόδου
//               </label>
//               <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-black/40 border border-white/10">
//                 <button
//                   type="button"
//                   onClick={() => {
//                     setRole("customer");
//                     setLampOn(true);
//                     setErrorMsg(null);
//                     setInfoMsg(null);
//                   }}
//                   className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer ${
//                     role === "customer"
//                       ? "bg-orange-500 text-white shadow-lg"
//                       : "text-slate-400 hover:text-white"
//                   }`}
//                 >
//                   <span>🍽️</span> Είμαι Πελάτης
//                 </button>

//                 <button
//                   type="button"
//                   onClick={() => {
//                     setRole("merchant");
//                     setLampOn(true);
//                     setErrorMsg(null);
//                     setInfoMsg(null);
//                   }}
//                   className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer ${
//                     role === "merchant"
//                       ? "bg-sky-500 text-slate-950 shadow-lg"
//                       : "text-slate-400 hover:text-white"
//                   }`}
//                 >
//                   <span>🏪</span> Είμαι Μαγαζάτορας
//                 </button>
//               </div>
//             </div>

//             <div className="mb-5">
//               <h1 className="text-2xl font-black text-white">
//                 {isMerchant
//                   ? mode === "signin"
//                     ? "Πύλη Συνεργατών Εστίασης"
//                     : "Γίνε Συνεργάτης HappySeats"
//                   : mode === "signin"
//                   ? "Καλώς ήρθες στο HappySeats"
//                   : "Δημιούργησε Λογαριασμό"}
//               </h1>
//               <p className="text-xs text-slate-400 mt-1">
//                 {isMerchant
//                   ? "Διαχειρίσου τραπέζια, Flash Deals και κρατήσεις σε πραγματικό χρόνο."
//                   : "Κλείσε τραπέζι τις σωστές ώρες και κέρδισε έως -50% έκπτωση."}
//               </p>
//             </div>

//             {/* Tabs: Sign In / Sign Up */}
//             <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-5">
//               <button
//                 type="button"
//                 onClick={() => {
//                   setMode("signin");
//                   setErrorMsg(null);
//                   setInfoMsg(null);
//                 }}
//                 className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
//                   mode === "signin"
//                     ? "bg-white/15 text-white"
//                     : "text-slate-400 hover:text-white"
//                 }`}
//               >
//                 Είσοδος (Sign In)
//               </button>
//               <button
//                 type="button"
//                 onClick={() => {
//                   setMode("signup");
//                   setErrorMsg(null);
//                   setInfoMsg(null);
//                 }}
//                 className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
//                   mode === "signup"
//                     ? "bg-white/15 text-white"
//                     : "text-slate-400 hover:text-white"
//                 }`}
//               >
//                 {isMerchant ? "Αίτηση Συνεργασίας" : "Εγγραφή (Sign Up)"}
//               </button>
//             </div>

//             {errorMsg && (
//               <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold">
//                 ⚠️ {errorMsg}
//               </div>
//             )}

//             {infoMsg && (
//               <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
//                 {infoMsg}
//               </div>
//             )}

//             {/* Αν είναι Μαγαζάτορας + Sign Up → οδηγούμε στο δικό μας B2B /merchant/apply */}
//             {isMerchant && mode === "signup" ? (
//               <div className="space-y-4 py-2">
//                 <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-400/25 text-xs text-slate-200 space-y-2 leading-relaxed">
//                   <p className="font-bold text-sky-300">
//                     Πώς λειτουργεί η εγγραφή καταστήματος:
//                   </p>
//                   <ol className="list-decimal list-inside space-y-1 text-slate-300">
//                     <li>Υποβάλλεις τα στοιχεία επιχείρησης (ΑΦΜ) &amp; καταστήματος.</li>
//                     <li>Επιλέγεις πακέτο συνδρομής (Μήνας / 6μηνο / Έτος).</li>
//                     <li>Η ομάδα μας ελέγχει την αίτηση &amp; ενεργοποιεί τον λογαριασμό σου.</li>
//                   </ol>
//                 </div>

//                 <Link
//                   href="/merchant/apply"
//                   className="block w-full text-center py-3.5 rounded-xl font-black text-sm bg-sky-500 hover:bg-sky-400 text-slate-950 transition shadow-lg"
//                 >
//                   Υποβολή Αίτησης Συνεργασίας →
//                 </Link>
//               </div>
//             ) : (
//               <>
//                 <form onSubmit={handleSubmit} className="space-y-4">
//                   {mode === "signup" && !isMerchant && (
//                     <div>
//                       <label className="block text-[11px] font-bold text-slate-300 mb-1">
//                         Ονοματεπώνυμο
//                       </label>
//                       <input
//                         type="text"
//                         required
//                         value={name}
//                         onChange={(e) => setName(e.target.value)}
//                         placeholder="π.χ. Γιάννης Παπαδόπουλος"
//                         className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/40"
//                       />
//                     </div>
//                   )}

//                   <div>
//                     <label className="block text-[11px] font-bold text-slate-300 mb-1">
//                       {isMerchant ? "Εταιρικό Email" : "Email"}
//                     </label>
//                     <input
//                       type="email"
//                       required
//                       value={email}
//                       onChange={(e) => setEmail(e.target.value)}
//                       placeholder={isMerchant ? "info@restaurant.gr" : "you@example.com"}
//                       className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/40"
//                     />
//                   </div>

//                   <div>
//                     <div className="flex items-center justify-between mb-1">
//                       <label className="block text-[11px] font-bold text-slate-300">
//                         Κωδικός Πρόσβασης
//                       </label>
//                       {mode === "signin" && (
//                         <button
//                           type="button"
//                           onClick={handleForgotPassword}
//                           className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
//                         >
//                           Ξέχασες τον κωδικό;
//                         </button>
//                       )}
//                     </div>
//                     <div className="relative">
//                       <input
//                         type={showPassword ? "text" : "password"}
//                         required
//                         value={password}
//                         onChange={(e) => setPassword(e.target.value)}
//                         placeholder="••••••••"
//                         className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/40 pr-12"
//                       />
//                       <button
//                         type="button"
//                         onClick={() => setShowPassword((prev) => !prev)}
//                         className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white cursor-pointer"
//                       >
//                         {showPassword ? "🙈" : "👁️"}
//                       </button>
//                     </div>
//                   </div>

//                   <button
//                     type="submit"
//                     disabled={loading}
//                     className={`w-full py-3.5 rounded-xl font-black text-sm transition shadow-lg cursor-pointer disabled:opacity-50 ${accentBg}`}
//                   >
//                     {loading
//                       ? "Σύνδεση..."
//                       : isMerchant
//                       ? "Είσοδος στο Merchant Dashboard →"
//                       : mode === "signin"
//                       ? "Είσοδος στο HappySeats →"
//                       : "Εγγραφή & Είσοδος →"}
//                   </button>
//                 </form>

//                 {/* Divider & Google Sign-In */}
//                 <div className="my-5 flex items-center gap-3">
//                   <div className="h-px flex-1 bg-white/10" />
//                   <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
//                     ή συνέχεια με
//                   </span>
//                   <div className="h-px flex-1 bg-white/10" />
//                 </div>

//                 <button
//                   type="button"
//                   onClick={handleGoogleAuth}
//                   disabled={loading}
//                   className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-2.5 transition cursor-pointer"
//                 >
//                   <span className="text-base">G</span> Συνέχεια με Google (
//                   {isMerchant ? "Ενεργός Συνεργάτης" : "Πελάτης"})
//                 </button>
//               </>
//             )}
//           </div>
//         </div>
//       </main>

//       <footer className="relative z-10 text-center pb-5 text-[11px] text-slate-500">
//         HappySeats Platform • Διαχωρισμένο περιβάλλον Επισκεπτών &amp; Επιχειρήσεων Εστίασης
//       </footer>
//     </div>
//   );
// }

// export default function LoginPage() {
//   return (
//     <Suspense fallback={<div className="min-h-screen bg-[#070b10]" />}>
//       <LampLoginContent />
//     </Suspense>
//   );
// }

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type UserRole = "customer" | "merchant";
type AuthMode = "signin" | "signup";

async function checkIsMerchant(uid: string, email?: string | null): Promise<boolean> {
  const mSnap = await getDoc(doc(db, "merchants", uid));
  if (mSnap.exists()) return true;

  if (email) {
    const q = query(
      collection(db, "merchants"),
      where("email", "==", email.toLowerCase().trim())
    );
    const snap = await getDocs(q);
    if (!snap.empty) return true;
  }
  return false;
}

function LampLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [lampOn, setLampOn] = useState(true);
  const [pullingCord, setPullingCord] = useState(false);

  const initialRole: UserRole =
    searchParams.get("role") === "merchant" ? "merchant" : "customer";
  const [role, setRole] = useState<UserRole>(initialRole);
  const [mode, setMode] = useState<AuthMode>("signin");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Συγχρονισμός με το αποθηκευμένο Light / Dark theme της εφαρμογής
  useEffect(() => {
    const savedTheme = localStorage.getItem("happyseats_theme");
    if (
      savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCheckingAuth(false);
        return;
      }
      try {
        const isMerch = await checkIsMerchant(user.uid, user.email);
        if (isMerch && role === "merchant") {
          router.replace("/merchant");
        } else {
          router.replace("/");
        }
      } catch {
        setCheckingAuth(false);
      }
    });
    return () => unsub();
  }, [router, role]);

  const handleToggleLamp = () => {
    setPullingCord(true);
    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(lampOn ? 240 : 420, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // ignore
    }

    setTimeout(() => {
      setLampOn((prev) => !prev);
      setPullingCord(false);
    }, 160);
  };

  const handleForgotPassword = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email.trim()) {
      setErrorMsg("Συμπλήρωσε πρώτα το email σου για να σου στείλουμε link επαναφοράς.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim(), {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      setInfoMsg(
        "✓ Σας στάλθηκε email επαναφοράς κωδικού. Ελέγξτε τα εισερχόμενά σας (ή τα Spam)."
      );
    } catch {
      setErrorMsg("Αδυναμία αποστολής email επαναφοράς. Έλεγξε τη διεύθυνση email.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

        if (role === "merchant") {
          const isMerch = await checkIsMerchant(cred.user.uid, cred.user.email);
          if (!isMerch) {
            setErrorMsg(
              "Αυτός ο λογαριασμός δεν είναι ενεργός Συνεργάτης. Άλλαξε σε «Πελάτης» ή υπέβαλε Αίτηση Συνεργασίας."
            );
            setLoading(false);
            return;
          }
          router.push("/merchant");
        } else {
          router.push("/");
        }
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await setDoc(doc(db, "users", cred.user.uid), {
          email: cred.user.email?.toLowerCase(),
          displayName: name.trim() || "Επισκέπτης",
          streak: 0,
          favorites: [],
          createdAt: serverTimestamp(),
        });
        router.push("/");
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code.includes("invalid-credential") || code.includes("wrong-password")) {
        setErrorMsg("Λάθος email ή κωδικός πρόσβασης.");
      } else if (code.includes("email-already-in-use")) {
        setErrorMsg("Υπάρχει ήδη λογαριασμός με αυτό το email.");
      } else if (code.includes("weak-password")) {
        setErrorMsg("Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.");
      } else {
        setErrorMsg("Παρουσιάστηκε σφάλμα. Δοκίμασε ξανά.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);

      if (role === "merchant") {
        const isMerch = await checkIsMerchant(cred.user.uid, cred.user.email);
        if (!isMerch) {
          setErrorMsg(
            "Δεν βρέθηκε ενεργός λογαριασμός Συνεργάτη για αυτό το Google email. Υπέβαλε πρώτα Αίτηση Συνεργασίας."
          );
          setLoading(false);
          return;
        }
        router.push("/merchant");
      } else {
        await setDoc(
          doc(db, "users", cred.user.uid),
          {
            email: cred.user.email?.toLowerCase(),
            displayName: cred.user.displayName || "Επισκέπτης",
          },
          { merge: true }
        );
        router.push("/");
      }
    } catch {
      setErrorMsg("Η σύνδεση με Google ακυρώθηκε.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return <div className="min-h-screen bg-surface" />;
  }

  const isMerchant = role === "merchant";
  const glowColor = isMerchant ? "rgba(14, 165, 233, 0.22)" : "rgba(249, 115, 22, 0.22)";
  const bulbFill = !lampOn ? "#475569" : isMerchant ? "#38bdf8" : "#fb923c";
  const accentBg = isMerchant
    ? "bg-sky-600 hover:bg-sky-700 text-white"
    : "bg-brand hover:bg-brand-hover text-white";

  return (
    <div className="min-h-screen bg-surface text-text-main flex flex-col justify-between relative overflow-hidden select-none transition-colors duration-300">
      {/* Ambient Background Glow */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[780px] h-[520px] rounded-full blur-[130px] transition-all duration-700"
        style={{
          background: lampOn ? glowColor : "transparent",
        }}
      />

      {/* Top Bar */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-6 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="text-2xl font-black tracking-tight text-text-main">
            <span className={isMerchant ? "text-sky-600" : "text-brand"}>
              Happy
            </span>
            Seats
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-subtle border border-border-theme text-text-muted">
            {isMerchant ? "B2B Partner Portal" : "Είσοδος"}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-card hover:bg-subtle border border-border-theme text-text-main transition shadow-sm"
          >
            ← Αρχική
          </Link>
          <button
            type="button"
            onClick={handleToggleLamp}
            className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-card hover:bg-subtle border border-border-theme text-text-main transition cursor-pointer shadow-sm"
          >
            {lampOn ? "💡 Σβήσε το φως" : "🔦 Άναψε το φως"}
          </button>
        </div>
      </header>

      {/* Main Split Area */}
      <main className="relative z-10 max-w-5xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* ΑΡΙΣΤΕΡΑ: ΔΙΑΔΡΑΣΤΙΚΗ ΛΑΜΠΑ */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
          <div className="relative w-72 h-80 flex items-center justify-center">
            <div
              className={`absolute top-24 left-28 w-72 h-64 origin-top-left pointer-events-none transition-opacity duration-500 ${
                lampOn ? "opacity-100" : "opacity-0"
              }`}
              style={{
                background: isMerchant
                  ? "linear-gradient(135deg, rgba(14,165,233,0.3) 0%, rgba(14,165,233,0.02) 75%, transparent 100%)"
                  : "linear-gradient(135deg, rgba(249,115,22,0.3) 0%, rgba(249,115,22,0.02) 75%, transparent 100%)",
                clipPath: "polygon(15% 0%, 45% 0%, 100% 100%, 0% 100%)",
                filter: "blur(10px)",
              }}
            />

            <svg
              viewBox="0 0 260 320"
              className="w-full h-full drop-shadow-xl overflow-visible"
            >
              <ellipse cx="95" cy="296" rx="52" ry="12" fill="#334155" />
              <ellipse cx="95" cy="292" rx="44" ry="9" fill="#475569" />
              <line x1="95" y1="290" x2="62" y2="185" stroke="#64748b" strokeWidth="8" strokeLinecap="round" />
              <circle cx="62" cy="185" r="9" fill="#f59e0b" />
              <circle cx="62" cy="185" r="4" fill="#1e293b" />
              <line x1="62" y1="185" x2="118" y2="92" stroke="#64748b" strokeWidth="7" strokeLinecap="round" />
              <circle cx="118" cy="92" r="8" fill="#f59e0b" />
              <path
                d="M 105 85 C 125 62, 168 68, 182 104 L 112 134 C 98 114, 96 96, 105 85 Z"
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="2"
              />
              <ellipse
                cx="148"
                cy="120"
                rx="24"
                ry="11"
                transform="rotate(-23 148 120)"
                fill={bulbFill}
                className="transition-colors duration-300"
              />
              <g
                onClick={handleToggleLamp}
                className="cursor-pointer group"
                style={{
                  transform: pullingCord ? "translateY(14px)" : "translateY(0px)",
                  transition: "transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                <rect x="130" y="122" width="36" height="75" fill="transparent" />
                <line
                  x1="148"
                  y1="124"
                  x2="148"
                  y2="178"
                  stroke="#94a3b8"
                  strokeWidth="2.5"
                  strokeDasharray="3 2"
                />
                <circle
                  cx="148"
                  cy="183"
                  r="7"
                  fill={isMerchant ? "#0284c7" : "#f97316"}
                  className="group-hover:scale-125 transition-transform origin-center"
                />
              </g>
            </svg>
          </div>

          <p className="text-xs text-text-muted text-center max-w-xs mt-1">
            Τράβηξε το <span className="text-text-main font-bold">κορδόνι της λάμπας</span> για να ανάψεις ή να σβήσεις τον φωτισμό.
          </p>
        </div>

        {/* ΔΕΞΙΑ: ΚΑΡΤΑ ΕΙΣΟΔΟΥ / ΕΓΓΡΑΦΗΣ (με tokens από globals.css) */}
        <div className="lg:col-span-7">
          <div
            className={`rounded-3xl p-6 sm:p-8 border transition-all duration-500 bg-card border-border-theme shadow-lg ${
              lampOn ? "opacity-100" : "opacity-55 hover:opacity-90"
            }`}
          >
            {/* ΕΠΙΛΟΓΗ ΡΟΛΟΥ */}
            <div className="mb-6">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">
                1. Επίλεξε Περιβάλλον Εισόδου
              </label>
              <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-subtle border border-border-theme">
                <button
                  type="button"
                  onClick={() => {
                    setRole("customer");
                    setLampOn(true);
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                    role === "customer"
                      ? "bg-brand text-white shadow-sm"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  <span>🍽️</span> Είμαι Πελάτης
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRole("merchant");
                    setLampOn(true);
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                    role === "merchant"
                      ? "bg-sky-600 text-white shadow-sm"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  <span>🏪</span> Είμαι Μαγαζάτορας
                </button>
              </div>
            </div>

            <div className="mb-5">
              <h1 className="text-2xl font-black text-text-main">
                {isMerchant
                  ? mode === "signin"
                    ? "Πύλη Συνεργατών Εστίασης"
                    : "Γίνε Συνεργάτης HappySeats"
                  : mode === "signin"
                  ? "Καλώς ήρθες στο HappySeats"
                  : "Δημιούργησε Λογαριασμό"}
              </h1>
              <p className="text-xs text-text-muted mt-1">
                {isMerchant
                  ? "Διαχειρίσου τραπέζια, Flash Deals και κρατήσεις σε πραγματικό χρόνο."
                  : "Κλείσε τραπέζι τις σωστές ώρες και κέρδισε έως -50% έκπτωση."}
              </p>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-subtle border border-border-theme mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  mode === "signin"
                    ? "bg-card text-text-main shadow-sm"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                Είσοδος (Sign In)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  mode === "signup"
                    ? "bg-card text-text-main shadow-sm"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                {isMerchant ? "Αίτηση Συνεργασίας" : "Εγγραφή (Sign Up)"}
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                ⚠️ {errorMsg}
              </div>
            )}

            {infoMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                {infoMsg}
              </div>
            )}

            {isMerchant && mode === "signup" ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-subtle border border-border-theme text-xs text-text-main space-y-2 leading-relaxed">
                  <p className="font-bold text-sky-600">
                    Πώς λειτουργεί η εγγραφή καταστήματος:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-text-muted">
                    <li>Υποβάλλεις τα στοιχεία επιχείρησης (ΑΦΜ) &amp; καταστήματος.</li>
                    <li>Επιλέγεις πακέτο συνδρομής (Μήνας / 6μηνο / Έτος).</li>
                    <li>Η ομάδα μας ελέγχει την αίτηση &amp; ενεργοποιεί τον λογαριασμό σου.</li>
                  </ol>
                </div>

                <Link
                  href="/merchant/apply"
                  className="block w-full text-center py-3.5 rounded-xl font-black text-sm bg-sky-600 hover:bg-sky-700 text-white transition shadow-sm"
                >
                  Υποβολή Αίτησης Συνεργασίας →
                </Link>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "signup" && !isMerchant && (
                    <div>
                      <label className="block text-[11px] font-bold text-text-muted mb-1">
                        Ονοματεπώνυμο
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="π.χ. Γιάννης Παπαδόπουλος"
                        className="w-full px-4 py-3 rounded-xl bg-subtle border border-border-theme text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-text-muted mb-1">
                      {isMerchant ? "Εταιρικό Email" : "Email"}
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={isMerchant ? "info@restaurant.gr" : "you@example.com"}
                      className="w-full px-4 py-3 rounded-xl bg-subtle border border-border-theme text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-text-muted">
                        Κωδικός Πρόσβασης
                      </label>
                      {mode === "signin" && (
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          className="text-[11px] text-text-muted hover:text-text-main underline cursor-pointer"
                        >
                          Ξέχασες τον κωδικό;
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 rounded-xl bg-subtle border border-border-theme text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-main cursor-pointer"
                      >
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-3.5 rounded-xl font-black text-sm transition shadow-sm cursor-pointer disabled:opacity-50 ${accentBg}`}
                  >
                    {loading
                      ? "Σύνδεση..."
                      : isMerchant
                      ? "Είσοδος στο Merchant Dashboard →"
                      : mode === "signin"
                      ? "Είσοδος στο HappySeats →"
                      : "Εγγραφή & Είσοδος →"}
                  </button>
                </form>

                {/* Divider & Google Sign-In */}
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border-theme" />
                  <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">
                    ή συνέχεια με
                  </span>
                  <div className="h-px flex-1 bg-border-theme" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-subtle hover:bg-border-theme border border-border-theme text-xs font-bold text-text-main flex items-center justify-center gap-2.5 transition cursor-pointer"
                >
                  <span className="text-base">G</span> Συνέχεια με Google (
                  {isMerchant ? "Ενεργός Συνεργάτης" : "Πελάτης"})
                </button>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center pb-5 text-[11px] text-text-muted">
        HappySeats Platform • Διαχωρισμένο περιβάλλον Επισκεπτών &amp; Επιχειρήσεων Εστίασης
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <LampLoginContent />
    </Suspense>
  );
}