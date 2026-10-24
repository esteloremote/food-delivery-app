import fs from "fs";
import path from "path";

// SVG γραφικό για το HappySeats: Σκούρο στρογγυλεμένο φόντο, χρυσός κύκλος, μαχαιροπίρουνο & εισιτήριο
const createSvgIcon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="100" fill="#0a0a0a"/>
  <circle cx="256" cy="256" r="200" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-width="16"/>
  <!-- Seat / Dining / Ticket Symbol -->
  <path d="M170 330V240C170 210 190 190 220 190H292C322 190 342 210 342 240V330" stroke="#f59e0b" stroke-width="28" stroke-linecap="round"/>
  <path d="M150 330H362" stroke="#f59e0b" stroke-width="28" stroke-linecap="round"/>
  <circle cx="256" cy="140" r="28" fill="#f59e0b"/>
  <text x="256" y="420" font-family="system-ui, sans-serif" font-weight="900" font-size="52" fill="#f59e0b" text-anchor="middle" letter-spacing="2">HAPPYSEATS</text>
</svg>
`;

const publicDir = path.join(process.cwd(), "public");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Αποθήκευση SVG icon
fs.writeFileSync(path.join(publicDir, "icon.svg"), createSvgIcon(512));
console.log("✓ icon.svg δημιουργήθηκε επιτυχώς!");