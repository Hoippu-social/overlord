"use client";

import { motion, useReducedMotion } from "framer-motion";
import { content, type Language } from "@/locales/landing";

type LandingCopy = (typeof content)[Language];

interface ManifestoSectionProps {
  copy: LandingCopy["manifesto"];
}

export function ManifestoSection({ copy }: ManifestoSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const easing = [0.16, 1, 0.3, 1] as const;

  const reveal = (delay = 0) => ({
    initial: prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-10% 0px" },
    transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.68, delay, ease: easing },
  });

  return (
    <section id="manifesto" className="relative scroll-mt-24 border-y border-[var(--landing-line)] px-4 py-20 sm:scroll-mt-28 sm:px-6 sm:py-24 lg:px-10 lg:py-28">
      <div className="pointer-events-none absolute left-[8%] top-[18%] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(117,241,106,0.08),transparent_70%)] blur-3xl" />

      <div className="relative mx-auto grid max-w-[1480px] gap-12 lg:grid-cols-[minmax(0,0.5fr)_minmax(0,0.5fr)] lg:gap-20 xl:gap-24">
        <motion.div {...reveal()} className="min-w-0 max-w-[38rem]">
          <p className="landing-kicker">{copy.eyebrow}</p>
          <h2 className="landing-display-title mt-5 max-w-full text-[clamp(1.5rem,5.6vw,2.5rem)] font-semibold uppercase leading-[0.98] tracking-[0.04em] text-[var(--landing-text)] lg:max-w-[9ch] lg:text-[clamp(1.8rem,3.25vw,3.1rem)] xl:max-w-[10ch]">
            {copy.title}
          </h2>
          <p className="mt-7 max-w-[38rem] text-base leading-[1.9] text-[var(--landing-muted)] sm:text-lg lg:text-[1.08rem]">
            {copy.body}
          </p>
          <div className="mt-10 border-t border-[var(--landing-line)] pt-5">
            <div className="text-[0.72rem] uppercase tracking-[0.32em] text-[var(--landing-accent)]">{copy.quote}</div>
          </div>
        </motion.div>

        <div className="border-t border-[var(--landing-line)]">
          {copy.principles.map((principle, index) => (
            <motion.article
              key={principle.id}
              {...reveal(index * 0.06)}
              className="grid gap-3 border-b border-[var(--landing-line)] py-6 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-5 sm:py-7"
            >
              <div className="tabular text-[1.05rem] font-semibold uppercase tracking-[0.18em] text-[var(--landing-accent)] sm:text-[1.25rem]">
                {principle.id}
              </div>
              <div className="min-w-0">
                <h3 className="text-[1.02rem] font-semibold uppercase tracking-[0.14em] text-[var(--landing-text)] sm:text-[1.18rem]">
                  {principle.title}
                </h3>
                <p className="mt-3 text-sm leading-[1.85] text-[var(--landing-muted)] sm:text-[0.98rem]">{principle.body}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
