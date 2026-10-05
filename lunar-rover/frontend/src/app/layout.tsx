import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Lunar Rover - Drive the real Moon",
  description: "Drive a rover across the lunar south pole, built entirely from NASA LRO laser-altimeter data, with a GPS to find water ice, craters and sunlit ridges.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#05070d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
