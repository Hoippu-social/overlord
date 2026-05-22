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
    initial: prefersReducedMotion ? { y: 0 } : { y: 24 },
    whileInView: { y: 0 },
    viewport: { once: true, margin: "-12% 0px" },
    transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.68, delay, ease: easing },
  });

  return (
    <section id="logic" className="relative scroll-mt-24 px-4 pb-20 sm:scroll-mt-28 sm:px-6 sm:pb-24 lg:px-8 lg:pb-28">
      <div className="mx-auto max-w-[1500px]">
        <div className="grid gap-12 xl:grid-cols-[minmax(320px,30rem)_minmax(0,1fr)] xl:gap-20">
          <motion.div {...reveal()} className="min-w-0 xl:sticky xl:top-28 xl:self-start">
            <p className="landing-kicker">{copy.eyebrow}</p>
            <h2 className="landing-display-title mt-5 max-w-[12ch] font-sans text-[2rem] font-bold uppercase leading-[1.04] tracking-[0.02em] text-[var(--landing-text)] sm:text-[3rem] xl:text-[3.45rem]">
              {copy.title}
            </h2>
            <p className="mt-7 max-w-[28rem] text-base leading-[1.9] text-[var(--landing-muted)] sm:text-lg">{copy.body}</p>
          </motion.div>

          <div className="min-w-0 border-t border-[var(--landing-line)]">
            {copy.steps.map((step, index) => (
              <motion.article
                key={step.step}
                {...reveal(index * 0.08)}
                className="grid min-w-0 gap-5 border-b border-[var(--landing-line)] py-8 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-7 sm:py-10"
              >
                <div className="min-w-0">
                  <div className="tabular text-[2rem] font-bold uppercase tracking-[0.14em] text-[var(--landing-accent-strong)] sm:text-[2.7rem]">{step.step}</div>
                  <div className="mt-2 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-[var(--landing-accent)]">{step.label}</div>
                </div>

                <div className="min-w-0 sm:pt-2">
                  <h3 className="max-w-[18ch] font-sans text-[1.45rem] font-bold uppercase leading-[1.08] tracking-[0.03em] text-[var(--landing-text)] sm:text-[2rem]">
                    {step.title}
                  </h3>
                  <p className="mt-4 max-w-[42rem] text-base leading-[1.85] text-[var(--landing-muted)]">{step.body}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>

        <motion.div {...reveal(0.12)} className="landing-panel relative mt-16 overflow-hidden rounded-[2rem] px-5 py-7 sm:px-8 sm:py-10 lg:mt-20 lg:px-10 lg:py-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(117,241,106,0.5),transparent)]" />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0 max-w-[46rem]">
              <p className="landing-kicker">{ctaCopy.eyebrow}</p>
              <h3 className="landing-display-title mt-5 max-w-[16ch] font-sans text-[2rem] font-bold uppercase leading-[1.04] tracking-[0.02em] text-[var(--landing-text)] sm:text-[3.2rem] lg:text-[4.1rem]">
                {ctaCopy.title}
              </h3>
              <p className="mt-6 max-w-[36rem] text-base leading-[1.85] text-[var(--landing-muted)] sm:text-lg">{ctaCopy.body}</p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:flex-col">
              <Link href="/login" aria-label={ctaCopy.primary} className="landing-button-primary w-full sm:w-auto">
                {ctaCopy.primary}
                <ArrowUpRight size={16} weight="bold" />
              </Link>
              <Link href="#modules" aria-label={ctaCopy.secondary} className="landing-button-secondary w-full sm:w-auto">
                {ctaCopy.secondary}
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
