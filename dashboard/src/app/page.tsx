"use client";

import { useState } from "react";
import { Footer } from "@/components/landing/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { LogicSection } from "@/components/landing/LogicSection";
import { ManifestoSection } from "@/components/landing/ManifestoSection";
import { ModulesSection } from "@/components/landing/ModulesSection";
import { Navbar } from "@/components/landing/Navbar";
import { content, type Language } from "@/locales/landing";

export default function Home() {
  const [language, setLanguage] = useState<Language>("ru");
  const copy = content[language];

  return (
    <div id="top" className="landing-shell relative min-h-screen overflow-x-hidden text-[var(--landing-text)]">
      <Navbar language={language} setLanguage={setLanguage} copy={copy.nav} />

      <main className="relative z-10">
        <HeroSection copy={copy.hero} />
        <ManifestoSection copy={copy.manifesto} />
        <ModulesSection copy={copy.modules} />
        <LogicSection copy={copy.logic} ctaCopy={copy.cta} />
      </main>

      <Footer copy={copy.footer} />
    </div>
  );
}
