import type { Metadata } from "next";
import { AboutPanel } from "@/ui/about/AboutPanel";

export const metadata: Metadata = { title: "About - Lunar Rover" };

export default function AboutPage() {
  return <AboutPanel />;
}
