"use client";

import { motion, useReducedMotion } from "framer-motion";
import { content, type Language } from "@/locales/landing";

type LandingCopy = (typeof content)[Language];

interface ModulesSectionProps {
  copy: LandingCopy["modules"];
}

export function ModulesSection({ copy }: ModulesSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const easing = [0.16, 1, 0.3, 1] as const;

  const reveal = (delay = 0) => ({
    initial: prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-10% 0px" },
    transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.68, delay, ease: easing },
  });

  return (
    <section id="modules" className="relative scroll-mt-24 px-4 py-20 sm:scroll-mt-28 sm:px-6 sm:py-24 lg:px-10 lg:py-28">
      <div className="pointer-events-none absolute right-[8%] top-[18%] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(143,94,255,0.1),transparent_70%)] blur-3xl" />

      <div className="relative mx-auto grid max-w-[1480px] gap-12 xl:grid-cols-[minmax(360px,30rem)_minmax(0,1fr)] xl:gap-24 2xl:gap-28">
        <motion.div {...reveal()} className="min-w-0 xl:sticky xl:top-28 xl:self-start">
          <p className="landing-kicker">{copy.eyebrow}</p>
          <h2 className="landing-display-title mt-5 max-w-full text-[clamp(1.5rem,5.6vw,2.55rem)] font-semibold uppercase leading-[0.98] tracking-[0.04em] text-[var(--landing-text)] lg:max-w-[9ch] xl:max-w-[8ch] xl:text-[clamp(1.8rem,2.65vw,2.85rem)]">
            {copy.title}
          </h2>
          <p className="mt-7 max-w-[26rem] text-base leading-[1.9] text-[var(--landing-muted)] sm:text-lg">{copy.body}</p>
        </motion.div>

        <div className="border-t border-[var(--landing-line)]">
          {copy.items.map((item, index) => (
            <motion.article
              key={item.id}
              {...reveal(index * 0.07)}
              className="grid gap-5 border-b border-[var(--landing-line)] py-8 sm:py-10 lg:grid-cols-[82px_minmax(0,1fr)] lg:gap-8"
            >
              <div className="tabular text-[1.2rem] font-semibold uppercase tracking-[0.18em] text-[var(--landing-accent)] sm:text-[1.45rem]">
                {item.id}
              </div>

              <div className="min-w-0 lg:grid lg:grid-cols-[minmax(260px,18rem)_minmax(0,1fr)] lg:gap-10 xl:gap-12">
                <div className="min-w-0">
                  <div className="text-[0.66rem] uppercase tracking-[0.34em] text-[var(--landing-soft)]">{item.kicker}</div>
                  <h3 className="landing-display-title mt-4 max-w-full text-[clamp(1.15rem,4.8vw,1.6rem)] font-semibold uppercase leading-[0.98] tracking-[0.04em] text-[var(--landing-text)] lg:text-[clamp(1.15rem,1.45vw,1.45rem)] xl:text-[clamp(1.2rem,1.55vw,1.55rem)]">
                    {item.title}
                  </h3>
                </div>

                <div className="min-w-0 pt-4 lg:pt-0">
                  <p className="max-w-[38rem] text-base leading-[1.9] text-[var(--landing-muted)] sm:text-[1rem]">{item.body}</p>

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--landing-line)] pt-4">
                    {item.points.map((point) => (
                      <div
                        key={point}
                        className="landing-pill rounded-full px-3 py-2 text-[0.62rem] uppercase leading-[1.5] tracking-[0.22em] text-[var(--landing-soft)]"
                      >
                        {point}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
