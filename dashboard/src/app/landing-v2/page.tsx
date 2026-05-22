import type { Metadata } from "next";
import { LandingRedesign } from "@/components/landing-redesign/LandingRedesign";

export const metadata: Metadata = {
  title: "Overlord - Landing V2",
  description: "Parallel Overlord landing page redesign for Discord operations.",
};

export default function LandingV2Page() {
  return <LandingRedesign />;
}
