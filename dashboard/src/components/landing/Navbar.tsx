"use client";

import { ArrowUpRight, GlobeHemisphereWest, List, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LandingUserMenu } from "@/components/landing/LandingUserMenu";
import { content, type Language } from "@/locales/landing";

type LandingCopy = (typeof content)[Language];

interface NavbarProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  copy: LandingCopy["nav"];
}

const navItems = [
  { href: "#manifesto", key: "manifesto" },
  { href: "#modules", key: "modules" },
  { href: "#logic", key: "logic" },
] as const;

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

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 rounded-full border border-[var(--landing-line)] bg-[rgba(6,6,6,0.78)] px-3 py-2.5 shadow-[0_18px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:px-4">
          <Link href="#top" onClick={closeMenu} className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.03)]">
              <Image src="/logos/logo-white.svg" alt="Overlord" width={24} height={24} className="h-6 w-6 opacity-90" priority />
            </span>
            <span className="min-w-0">
              <span className="block font-akony text-[0.86rem] tracking-[0.24em] text-[var(--landing-text)] sm:text-[0.96rem]">OVERLORD</span>
              <span className="block truncate text-[0.58rem] uppercase tracking-[0.3em] text-[var(--landing-soft)]">{copy.label}</span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-[var(--landing-soft)] transition-colors hover:text-[var(--landing-text)]"
              >
                {copy[item.key]}
              </Link>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.02)] p-1 lg:flex">
              <span className="flex h-9 w-9 items-center justify-center text-[var(--landing-soft)]">
                <GlobeHemisphereWest size={15} weight="bold" />
              </span>
              {(["ru", "en"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={copy.language}
                  onClick={() => setLanguage(value)}
                  className={`h-9 rounded-full px-4 text-[0.62rem] font-bold uppercase tracking-[0.24em] transition-colors ${
                    value === language
                      ? "bg-[var(--color-primary-1)] text-[#07110a]"
                      : "text-[var(--landing-soft)] hover:text-[var(--landing-text)]"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>

            <LandingUserMenu language={language} className="hidden lg:flex">
              <Link href="/login" aria-label={copy.login} className="landing-button-secondary hidden min-h-11 px-5 text-[0.66rem] lg:inline-flex">
                {copy.login}
                <ArrowUpRight size={15} weight="bold" />
              </Link>
            </LandingUserMenu>

            <button
              type="button"
              aria-label={mobileMenuOpen ? copy.close : copy.menu}
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.03)] text-[var(--landing-text)] lg:hidden"
            >
              {mobileMenuOpen ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileMenuOpen ? (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[60] lg:hidden"
          >
            <button type="button" aria-label={copy.close} className="absolute inset-0 h-full w-full bg-[rgba(3,5,8,0.9)] backdrop-blur-xl" onClick={closeMenu} />

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: 18 }}
              transition={{ duration: 0.22 }}
              className="relative flex min-h-screen flex-col px-3 pb-8 pt-3 sm:px-5"
            >
              <div className="flex items-center justify-between rounded-full border border-[var(--landing-line)] bg-[rgba(6,6,6,0.82)] px-3 py-2.5">
                <Link href="#top" onClick={closeMenu} className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.03)]">
                    <Image src="/logos/logo-white.svg" alt="Overlord" width={24} height={24} className="h-6 w-6 opacity-90" />
                  </span>
                  <span>
                    <span className="block font-akony text-[0.86rem] tracking-[0.24em] text-[var(--landing-text)]">OVERLORD</span>
                    <span className="block text-[0.58rem] uppercase tracking-[0.3em] text-[var(--landing-soft)]">{copy.label}</span>
                  </span>
                </Link>

                <button type="button" aria-label={copy.close} onClick={closeMenu} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.03)] text-[var(--landing-text)]">
                  <X size={20} weight="bold" />
                </button>
              </div>

              <div className="flex flex-1 flex-col justify-between py-10">
                <div className="space-y-8">
                  {navItems.map((item) => (
                    <Link key={item.href} href={item.href} onClick={closeMenu} className="block text-[1.08rem] font-bold uppercase tracking-[0.18em] text-[var(--landing-text)]">
                      {copy[item.key]}
                    </Link>
                  ))}
                </div>

                <div className="space-y-5 border-t border-[var(--landing-line)] pt-7">
                  <div className="flex items-center gap-2 rounded-[1.5rem] border border-[var(--landing-line)] bg-[rgba(255,255,255,0.02)] p-2">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--landing-soft)]">
                      <GlobeHemisphereWest size={16} weight="bold" />
                    </span>
                    {(["ru", "en"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLanguage(value)}
                        className={`h-11 flex-1 rounded-full px-4 text-[0.68rem] font-bold uppercase tracking-[0.22em] transition-colors ${
                          value === language
                            ? "bg-[var(--color-primary-1)] text-[#07110a]"
                            : "text-[var(--landing-soft)] hover:text-[var(--landing-text)]"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>

                  <LandingUserMenu language={language} variant="mobile" onNavigate={closeMenu}>
                    <Link href="/login" aria-label={copy.login} onClick={closeMenu} className="landing-button-primary w-full">
                      {copy.login}
                      <ArrowUpRight size={16} weight="bold" />
                    </Link>
                  </LandingUserMenu>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
