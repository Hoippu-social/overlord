"use client";

import { ArrowUpRight } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { content, type Language } from "@/locales/landing";

type LandingCopy = (typeof content)[Language];

interface LogicSectionProps {
  copy: LandingCopy["logic"];
  ctaCopy: LandingCopy["cta"];
}

export function LogicSection({ copy, ctaCopy }: LogicSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const easing = [0.16, 1, 0.3, 1] as const;

  const reveal = (delay = 0) => ({
    initial: prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-10% 0px" },
    transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.68, delay, ease: easing },
  });

  return (
    <section id="logic" className="relative scroll-mt-24 px-4 pb-20 sm:scroll-mt-28 sm:px-6 sm:pb-24 lg:px-10 lg:pb-28">
      <div className="pointer-events-none absolute left-[12%] top-[22%] h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(117,241,106,0.08),transparent_70%)] blur-3xl" />

      <div className="relative mx-auto max-w-[1480px]">
        <div className="grid gap-12 xl:grid-cols-[minmax(300px,26rem)_minmax(0,1fr)] xl:gap-28 2xl:gap-32">
          <motion.div {...reveal()} className="min-w-0 max-w-[24rem] xl:sticky xl:top-28 xl:self-start">
            <p className="landing-kicker">{copy.eyebrow}</p>
            <h2 className="landing-display-title mt-5 max-w-full text-[clamp(1.5rem,5.6vw,2.55rem)] font-semibold uppercase leading-[0.98] tracking-[0.04em] text-[var(--landing-text)] lg:max-w-[7ch] lg:text-[clamp(1.55rem,2.45vw,2.2rem)] xl:max-w-[6ch]">
              {copy.title}
            </h2>
            <p className="mt-7 max-w-[26rem] text-base leading-[1.9] text-[var(--landing-muted)] sm:text-lg">{copy.body}</p>
          </motion.div>

          <div className="border-t border-[var(--landing-line)] xl:pl-12 2xl:pl-16">
            {copy.steps.map((step, index) => (
              <motion.article
                key={step.step}
                {...reveal(index * 0.08)}
                className="grid gap-4 border-b border-[var(--landing-line)] py-7 sm:grid-cols-[90px_minmax(0,1fr)] sm:gap-6 sm:py-8"
              >
                <div className="tabular text-[1.8rem] font-semibold uppercase tracking-[0.16em] text-[var(--landing-accent-strong)] sm:text-[2.4rem]">
                  {step.step}
                </div>

                <div className="min-w-0">
                  <h3 className="text-[1.12rem] font-semibold uppercase tracking-[0.14em] text-[var(--landing-text)] sm:text-[1.45rem]">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-[38rem] text-sm leading-[1.9] text-[var(--landing-muted)] sm:text-[1rem]">{step.body}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>

        <motion.div
          {...reveal(0.12)}
          className="landing-panel relative mt-16 overflow-hidden rounded-[2rem] px-6 py-8 sm:px-8 sm:py-10 lg:mt-20 lg:px-10 lg:py-12"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(117,241,106,0.36),transparent)]" />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0 max-w-[38rem]">
              <p className="text-[0.72rem] uppercase tracking-[0.38em] text-[var(--landing-soft)]">{ctaCopy.eyebrow}</p>
              <h3 className="landing-display-title mt-4 max-w-full text-[clamp(1.45rem,5.4vw,2.6rem)] font-semibold uppercase leading-[0.96] tracking-[0.04em] text-[var(--landing-text)] lg:max-w-[11ch] lg:text-[clamp(1.85rem,3.8vw,3.8rem)]">
                {ctaCopy.title}
              </h3>
              <p className="mt-5 max-w-[32rem] text-base leading-[1.9] text-[var(--landing-muted)] sm:text-lg">{ctaCopy.body}</p>
            </div>

            <div className="flex w-full flex-col gap-4 sm:w-auto sm:items-start">
              <Link href="/login" aria-label={ctaCopy.primary} className="landing-button-primary w-full sm:w-auto">
                {ctaCopy.primary}
                <ArrowUpRight size={16} weight="bold" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
