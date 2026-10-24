import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HappySeats - Yield Dining Deals",
    short_name: "HappySeats",
    description: "Κλείσε τραπέζι τις σωστές ώρες, κέρδισε έκπτωση",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#f59e0b",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}