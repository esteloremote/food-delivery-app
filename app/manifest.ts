import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HappySeats - Yield Dining Deals",
    short_name: "HappySeats",
    description: "Κλείσε τραπέζι τις σωστές ώρες, κέρδισε έκπτωση",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#f97316",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/favicon.ico",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/favicon.ico",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}