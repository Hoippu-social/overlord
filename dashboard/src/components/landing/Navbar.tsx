"use client";

import { ArrowUpRight, GlobeHemisphereWest, List, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { content, type Language } from "@/locales/landing";

type LandingCopy = (typeof content)[Language];

interface NavbarProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  copy: LandingCopy["nav"];
}

export function Navbar({ language, setLanguage, copy }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;

    if (mobileMenuOpen) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:px-6 sm:pt-4 lg:px-10">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 rounded-full border border-[var(--landing-line)] bg-[rgba(8,10,13,0.82)] px-4 py-3 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:px-6">
          <Link href="#top" className="flex min-w-0 items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.03)]">
              <Image src="/logos/logo-white.svg" alt="Overlord" width={24} height={24} className="h-6 w-6 opacity-90" priority />
            </div>

            <div className="min-w-0">
              <div className="font-akony text-[0.88rem] tracking-[0.26em] text-[var(--landing-text)] sm:text-[1rem]">OVERLORD</div>
              <div className="truncate text-[0.6rem] uppercase tracking-[0.34em] text-[var(--landing-soft)]">{copy.label}</div>
            </div>
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            <Link href="#manifesto" className="text-[0.72rem] uppercase tracking-[0.3em] text-[var(--landing-soft)] transition-colors hover:text-[var(--landing-text)]">
              {copy.manifesto}
            </Link>
            <Link href="#modules" className="text-[0.72rem] uppercase tracking-[0.3em] text-[var(--landing-soft)] transition-colors hover:text-[var(--landing-text)]">
              {copy.modules}
            </Link>
            <Link href="#logic" className="text-[0.72rem] uppercase tracking-[0.3em] text-[var(--landing-soft)] transition-colors hover:text-[var(--landing-text)]">
              {copy.logic}
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.02)] p-1 lg:flex">
              <div className="flex h-9 w-9 items-center justify-center text-[var(--landing-soft)]">
                <GlobeHemisphereWest size={14} weight="bold" />
              </div>

              {(["ru", "en"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={copy.language}
                  onClick={() => setLanguage(value)}
                  className={`rounded-full px-4 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.32em] transition-colors ${
                    value === language
                      ? "bg-[var(--color-primary-1)] text-[#09120a]"
                      : "text-[var(--landing-soft)] hover:text-[var(--landing-text)]"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>

            <Link
              href="/login"
              aria-label={copy.login}
              className="hidden h-11 items-center justify-center gap-2 rounded-full border border-[var(--landing-line-strong)] bg-[rgba(255,255,255,0.03)] px-5 text-[0.68rem] font-bold uppercase tracking-[0.26em] text-[var(--landing-text)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary-1)] hover:text-[var(--landing-accent-strong)] lg:inline-flex"
            >
              {copy.login}
              <ArrowUpRight size={15} weight="bold" />
            </Link>

            <button
              type="button"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.03)] text-[var(--landing-text)] lg:hidden"
            >
              {mobileMenuOpen ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[60] lg:hidden"
          >
            <div className="absolute inset-0 bg-[rgba(3,5,8,0.88)] backdrop-blur-xl" onClick={() => setMobileMenuOpen(false)} />

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
              transition={{ duration: 0.24 }}
              className="relative flex min-h-screen flex-col px-4 pb-8 pt-6 sm:px-6"
            >
              <div className="flex items-center justify-between rounded-full border border-[var(--landing-line)] bg-[rgba(8,10,13,0.82)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.03)]">
                    <Image src="/logos/logo-white.svg" alt="Overlord" width={24} height={24} className="h-6 w-6 opacity-90" />
                  </div>
                  <div>
                    <div className="font-akony text-[0.88rem] tracking-[0.26em] text-[var(--landing-text)]">OVERLORD</div>
                    <div className="text-[0.6rem] uppercase tracking-[0.34em] text-[var(--landing-soft)]">{copy.label}</div>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.03)] text-[var(--landing-text)]"
                >
                  <X size={20} weight="bold" />
                </button>
              </div>

              <div className="flex flex-1 flex-col justify-between py-10">
                <div className="space-y-8">
                  <Link href="#manifesto" onClick={() => setMobileMenuOpen(false)} className="block text-[1.05rem] uppercase tracking-[0.22em] text-[var(--landing-text)]">
                    {copy.manifesto}
                  </Link>
                  <Link href="#modules" onClick={() => setMobileMenuOpen(false)} className="block text-[1.05rem] uppercase tracking-[0.22em] text-[var(--landing-text)]">
                    {copy.modules}
                  </Link>
                  <Link href="#logic" onClick={() => setMobileMenuOpen(false)} className="block text-[1.05rem] uppercase tracking-[0.22em] text-[var(--landing-text)]">
                    {copy.logic}
                  </Link>
                </div>

                <div className="space-y-6 border-t border-[var(--landing-line)] pt-8">
                  <div className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-[var(--landing-line)] bg-[rgba(255,255,255,0.02)] p-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--landing-soft)]">
                      <GlobeHemisphereWest size={16} weight="bold" />
                    </div>

                    <div className="flex flex-1 gap-2">
                      {(["ru", "en"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setLanguage(value)}
                          className={`flex-1 rounded-full px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.26em] transition-colors ${
                            value === language
                              ? "bg-[var(--color-primary-1)] text-[#09120a]"
                              : "text-[var(--landing-soft)] hover:text-[var(--landing-text)]"
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Link href="/login" aria-label={copy.login} onClick={() => setMobileMenuOpen(false)} className="landing-button-primary w-full">
                    {copy.login}
                    <ArrowUpRight size={16} weight="bold" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
