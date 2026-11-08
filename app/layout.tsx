import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HappySeats - Happy Hour Dining & Deals",
  description: "Κλείσε τραπέζι τις σωστές ώρες, κέρδισε έκπτωση έως και 50%",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-surface text-text-main min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}