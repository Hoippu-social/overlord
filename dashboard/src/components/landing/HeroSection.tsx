"use client";

import { ArrowUpRight } from "@phosphor-icons/react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { content, type Language } from "@/locales/landing";

type LandingCopy = (typeof content)[Language];

interface HeroSectionProps {
  copy: LandingCopy["hero"];
}

export function HeroSection({ copy }: HeroSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement | null>(null);
  const easing = [0.16, 1, 0.3, 1] as const;

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const contentY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : -32]);
  const asideY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : 48]);

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="relative min-h-[100svh] scroll-mt-24 px-4 pb-14 pt-28 sm:scroll-mt-28 sm:px-6 sm:pb-16 sm:pt-32 lg:px-10 lg:pb-20"
    >
      <div className="pointer-events-none absolute right-[4%] top-[16%] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(117,241,106,0.16),rgba(143,94,255,0.08),transparent_72%)] blur-3xl sm:h-80 sm:w-80" />
      <div className="pointer-events-none absolute inset-x-0 top-[33%] h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)]" />

      <div className="mx-auto flex min-h-[calc(100svh-8rem)] max-w-[1480px] flex-col justify-end">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.78, ease: easing }}
          style={prefersReducedMotion ? undefined : { y: contentY }}
          className="max-w-full overflow-hidden"
        >
          <p className="landing-kicker">{copy.eyebrow}</p>
          <div className="mt-6 font-akony text-[clamp(1.8rem,7vw,2.5rem)] leading-[0.82] tracking-[0.08em] text-[var(--landing-text)] sm:text-[clamp(2.55rem,9.1vw,7rem)]">
            {copy.brand}
          </div>
        </motion.div>

        <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,0.74fr)_minmax(19rem,0.26fr)] lg:items-end lg:gap-14">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.85, ease: easing }}
            style={prefersReducedMotion ? undefined : { y: contentY }}
            className="min-w-0 max-w-[38rem]"
          >
            <h1 className="landing-display-title max-w-full text-[clamp(1.55rem,5.2vw,2.6rem)] font-semibold uppercase leading-[0.96] tracking-[0.04em] text-[var(--landing-text)] sm:max-w-[10ch] sm:text-[clamp(1.95rem,6vw,4.8rem)]">
              {copy.title}
            </h1>

            <p className="mt-8 max-w-[34rem] text-base leading-[1.9] text-[var(--landing-muted)] sm:text-lg lg:text-[1.08rem]">
              {copy.body}
            </p>
            <p className="mt-5 text-[0.72rem] uppercase tracking-[0.3em] text-[var(--landing-soft)] sm:text-[0.8rem]">
              {copy.note}
            </p>
            <p className="mt-4 text-[0.62rem] uppercase tracking-[0.34em] text-[var(--landing-soft)]">{copy.rail.join(" / ")}</p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" aria-label={copy.primary} className="landing-button-primary w-full sm:w-auto">
                {copy.primary}
                <ArrowUpRight size={16} weight="bold" />
              </Link>
            </div>

            <div className="mt-12 grid gap-4 border-t border-[var(--landing-line)] pt-6 sm:grid-cols-3">
              {copy.stats.map((item) => (
                <div key={item.label} className="min-w-0">
                  <div className="tabular text-[1.8rem] font-semibold uppercase tracking-[0.08em] text-[var(--landing-accent-strong)] sm:text-[2.2rem]">
                    {item.value}
                  </div>
                  <div className="mt-2 max-w-[18ch] text-[0.68rem] uppercase leading-[1.7] tracking-[0.26em] text-[var(--landing-soft)]">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.aside
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.92, delay: 0.12, ease: easing }}
            style={prefersReducedMotion ? undefined : { y: asideY }}
            className="min-w-0 lg:justify-self-end"
          >
            <div className="max-w-[24rem] border-t border-[var(--landing-line)] pt-5">
              <p className="text-[0.62rem] uppercase tracking-[0.34em] text-[var(--landing-accent)]">{copy.plaqueEyebrow}</p>
              <h2 className="landing-display-title mt-3 max-w-[12ch] text-[1.15rem] font-semibold uppercase leading-[1.12] tracking-[0.14em] text-[var(--landing-text)] sm:text-[1.35rem]">
                {copy.plaqueTitle}
              </h2>
              <p className="mt-4 text-sm leading-[1.85] text-[var(--landing-muted)] sm:text-[0.98rem]">{copy.plaqueBody}</p>
            </div>

            <div className="mt-6 border-t border-[var(--landing-line)]">
              {copy.plaquePoints.map((point, index) => (
                <div key={point} className="grid gap-2 border-b border-[var(--landing-line)] py-4 sm:grid-cols-[60px_minmax(0,1fr)] sm:gap-4">
                  <div className="tabular text-[0.9rem] font-semibold uppercase tracking-[0.18em] text-[var(--landing-accent)]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="text-[0.68rem] uppercase leading-[1.8] tracking-[0.24em] text-[var(--landing-soft)]">{point}</div>
                </div>
              ))}
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  );
}
