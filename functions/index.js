const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

// Αρχικοποίηση του Admin SDK
admin.initializeApp();

// --- ΡΥΘΜΙΣΕΙΣ ---
// Μην ξεχάσεις να βάλεις το δικό σου API Key ανάμεσα στα εισαγωγικά!
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const ATHENS_LAT = "37.9838";
const ATHENS_LON = "23.7275";

// Εκτέλεση κάθε 60 λεπτά (Χρησιμοποιώντας τη νέα σύνταξη v2)
exports.syncWeatherDeals = onSchedule("every 60 minutes", async (event) => {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${ATHENS_LAT}&lon=${ATHENS_LON}&appid=${OPENWEATHER_API_KEY}`;
    
    // Καλούμε το OpenWeather API
    const response = await fetch(url);
    const data = await response.json();

    const weatherId = data.weather[0].id;
    const isRaining = weatherId >= 200 && weatherId < 700;

    // Ενημερώνουμε το Document στο Firestore
    await admin.firestore().collection("settings").doc("system").set(
      { isRaining: isRaining },
      { merge: true } // Το merge δεν πειράζει τις υπόλοιπες ρυθμίσεις σου (π.χ. Miss You)
    );

    console.log(`✅ Ο καιρός συγχρονίστηκε επιτυχώς! Βρέχει: ${isRaining} (Κωδικός: ${weatherId})`);
  } catch (error) {
    console.error("❌ Σφάλμα κατά τον συγχρονισμό του καιρού:", error);
  }
});