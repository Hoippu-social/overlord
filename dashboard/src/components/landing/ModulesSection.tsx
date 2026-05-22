"use client";

import { ChartBar, ChatsTeardrop, ShieldCheck } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
import { content, type Language } from "@/locales/landing";

type LandingCopy = (typeof content)[Language];

interface ModulesSectionProps {
  copy: LandingCopy["modules"];
}

const icons = [ShieldCheck, ChartBar, ChatsTeardrop] as const;

export function ModulesSection({ copy }: ModulesSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const easing = [0.16, 1, 0.3, 1] as const;

  const reveal = (delay = 0) => ({
    initial: prefersReducedMotion ? { y: 0 } : { y: 24 },
    whileInView: { y: 0 },
    viewport: { once: true, margin: "-12% 0px" },
    transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.68, delay, ease: easing },
  });

  return (
    <section id="modules" className="relative scroll-mt-24 px-4 py-20 sm:scroll-mt-28 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-[1500px] gap-12 xl:grid-cols-[minmax(320px,28rem)_minmax(0,1fr)] xl:gap-20">
        <motion.div {...reveal()} className="min-w-0 xl:sticky xl:top-28 xl:self-start">
          <p className="landing-kicker">{copy.eyebrow}</p>
          <h2 className="landing-display-title mt-5 max-w-[12ch] font-sans text-[2rem] font-bold uppercase leading-[1.04] tracking-[0.02em] text-[var(--landing-text)] sm:text-[3rem] xl:text-[3.45rem]">
            {copy.title}
          </h2>
          <p className="mt-7 max-w-[27rem] text-base leading-[1.9] text-[var(--landing-muted)] sm:text-lg">{copy.body}</p>
        </motion.div>

        <div className="min-w-0 border-t border-[var(--landing-line)]">
          {copy.items.map((item, index) => {
            const Icon = icons[index] ?? ShieldCheck;

            return (
              <motion.article
                key={item.id}
                {...reveal(index * 0.08)}
                className="group grid min-w-0 gap-5 border-b border-[var(--landing-line)] py-8 md:grid-cols-[86px_minmax(220px,0.45fr)_minmax(0,0.55fr)] md:gap-7 md:py-10"
              >
                <div className="flex items-start gap-4 md:block">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] border border-[var(--landing-line)] bg-[rgba(255,255,255,0.025)] text-[var(--landing-accent)] transition-colors group-hover:border-[rgba(117,241,106,0.28)] group-hover:bg-[rgba(117,241,106,0.08)]">
                    <Icon size={24} weight="bold" />
                  </div>
                  <div className="tabular pt-1 text-[1.15rem] font-bold uppercase tracking-[0.18em] text-[var(--landing-accent-strong)] md:mt-6 md:pt-0">{item.id}</div>
                </div>

                <div className="min-w-0">
                  <div className="text-[0.64rem] font-bold uppercase tracking-[0.26em] text-[var(--landing-soft)]">{item.kicker}</div>
                  <h3 className="mt-4 max-w-[16ch] font-sans text-[1.55rem] font-bold uppercase leading-[1.08] tracking-[0.03em] text-[var(--landing-text)] sm:text-[2rem]">
                    {item.title}
                  </h3>
                  <div className="mt-5 inline-flex rounded-full border border-[var(--landing-line)] px-3 py-2 text-[0.58rem] font-bold uppercase tracking-[0.18em] text-[var(--landing-accent)]">
                    {item.stat}
                  </div>
                </div>

                <div className="min-w-0 md:pt-8">
                  <p className="max-w-[38rem] text-base leading-[1.85] text-[var(--landing-muted)]">{item.body}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {item.points.map((point) => (
                      <span key={point} className="landing-pill rounded-full px-3 py-2 text-[0.62rem] font-bold uppercase leading-none tracking-[0.16em] text-[var(--landing-soft)]">
                        {point}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
