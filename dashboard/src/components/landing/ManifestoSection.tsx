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
    initial: prefersReducedMotion ? { y: 0 } : { y: 24 },
    whileInView: { y: 0 },
    viewport: { once: true, margin: "-12% 0px" },
    transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.68, delay, ease: easing },
  });

  return (
    <section id="manifesto" className="relative scroll-mt-24 border-b border-[var(--landing-line)] px-4 py-20 sm:scroll-mt-28 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[minmax(0,0.74fr)_minmax(320px,0.48fr)] lg:gap-16 xl:gap-24">
        <motion.div {...reveal()} className="min-w-0">
          <p className="landing-kicker">{copy.eyebrow}</p>
          <h2 className="landing-display-title mt-5 max-w-[14ch] font-sans text-[2rem] font-bold uppercase leading-[1.04] tracking-[0.02em] text-[var(--landing-text)] sm:text-[3.1rem] lg:text-[4.1rem]">
            {copy.title}
          </h2>
        </motion.div>

        <motion.div {...reveal(0.08)} className="min-w-0 self-end border-t border-[var(--landing-line)] pt-5">
          <p className="text-base leading-[1.9] text-[var(--landing-muted)] sm:text-lg">{copy.body}</p>
          <p className="mt-6 text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[var(--landing-accent)]">{copy.quote}</p>
        </motion.div>
      </div>

      <div className="mx-auto mt-14 grid max-w-[1500px] border-t border-[var(--landing-line)] lg:grid-cols-3">
        {copy.principles.map((principle, index) => (
          <motion.article
            key={principle.id}
            {...reveal(index * 0.06)}
            className="min-w-0 border-b border-[var(--landing-line)] py-7 lg:border-b-0 lg:border-r lg:px-7 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="tabular text-[1.55rem] font-bold uppercase tracking-[0.12em] text-[var(--landing-accent-strong)]">{principle.id}</div>
              <div className="rounded-full border border-[var(--landing-line)] px-3 py-2 text-[0.58rem] font-bold uppercase tracking-[0.18em] text-[var(--landing-soft)]">
                {principle.metric}
              </div>
            </div>

            <h3 className="mt-7 max-w-[14ch] font-sans text-[1.22rem] font-bold uppercase leading-[1.12] tracking-[0.04em] text-[var(--landing-text)] sm:text-[1.45rem]">
              {principle.title}
            </h3>
            <p className="mt-4 max-w-[28rem] text-sm leading-[1.85] text-[var(--landing-muted)] sm:text-[0.98rem]">{principle.body}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
