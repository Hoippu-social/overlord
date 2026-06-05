"use client";

import { ArrowUpRight, ChartBar, ChatsTeardrop, Scroll, ShieldCheck, Ticket } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { content, type Language } from "@/locales/landing";

type LandingCopy = (typeof content)[Language];

interface HeroSectionProps {
  copy: LandingCopy["hero"];
}

const moduleIcons = [ShieldCheck, ChartBar, Ticket, ChatsTeardrop] as const;

export function HeroSection({ copy }: HeroSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const easing = [0.16, 1, 0.3, 1] as const;

  return (
    <section
      id="hero"
      className="landing-hero-plane relative min-h-[88svh] overflow-hidden px-4 pb-12 pt-28 sm:px-6 sm:pb-14 sm:pt-32 lg:px-8"
    >
      <div className="pointer-events-none absolute inset-0 landing-grid" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,var(--landing-line-strong),transparent)]" />

      <div className="relative z-10 mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.72fr)] lg:items-end lg:gap-12 xl:gap-16">
        <div className="min-w-0">
          <motion.div
            initial={prefersReducedMotion ? false : { y: 20 }}
            animate={{ y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.72, ease: easing }}
            className="max-w-full overflow-hidden"
          >
            <p className="landing-kicker">{copy.eyebrow}</p>
            <div className="mt-5 max-w-full font-akony text-[2.35rem] leading-[0.82] tracking-[0.04em] text-[var(--landing-text)] min-[380px]:text-[2.85rem] sm:text-[3.4rem] md:text-[4.35rem] lg:text-[5.35rem] xl:text-[6rem]">
              {copy.brand}
            </div>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { y: 24 }}
            animate={{ y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.82, delay: 0.08, ease: easing }}
            className="mt-8 max-w-[44rem]"
          >
            <h1 className="landing-display-title font-sans text-[1.9rem] font-bold uppercase leading-[1.04] tracking-[0.02em] text-[var(--landing-text)] sm:text-[2.45rem] lg:text-[3.4rem] xl:text-[3.9rem]">
              {copy.title}
            </h1>

            <p className="mt-7 max-w-[39rem] text-base leading-[1.85] text-[var(--landing-muted)] sm:text-lg">
              {copy.body}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" aria-label={copy.primary} className="landing-button-primary w-full sm:w-auto">
                {copy.primary}
                <ArrowUpRight size={16} weight="bold" />
              </Link>
              <Link href="#modules" aria-label={copy.secondary} className="landing-button-secondary w-full sm:w-auto">
                {copy.secondary}
              </Link>
            </div>

            <div className="mt-10 hidden gap-4 border-t border-[var(--landing-line)] pt-5 lg:grid lg:grid-cols-3">
              {copy.metrics.map((metric) => (
                <div key={metric.value} className="min-w-0">
                  <div className="tabular text-[1.55rem] font-bold uppercase tracking-[0.08em] text-[var(--landing-accent-strong)] sm:text-[1.9rem]">
                    {metric.value}
                  </div>
                  <div className="mt-2 max-w-[19ch] text-[0.68rem] uppercase leading-[1.65] tracking-[0.2em] text-[var(--landing-soft)]">
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={prefersReducedMotion ? false : { y: 28 }}
          animate={{ y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.88, delay: 0.16, ease: easing }}
          className="min-w-0 lg:justify-self-end"
        >
          <CommandSurface copy={copy} />
        </motion.div>
      </div>
    </section>
  );
}

function CommandSurface({ copy }: HeroSectionProps) {
  return (
    <div className="landing-panel relative mx-auto w-full max-w-[34rem] overflow-hidden rounded-[2rem] p-4 sm:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(117,241,106,0.46),transparent)]" />

      <div className="flex items-center justify-between gap-4 border-b border-[var(--landing-line)] pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--landing-line)] bg-[rgba(117,241,106,0.08)]">
            <Image src="/logos/logo-color.svg" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
          </div>
          <div className="min-w-0">
            <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[var(--landing-accent)]">{copy.preview.eyebrow}</div>
            <div className="mt-1 truncate text-[1rem] font-bold text-[var(--landing-text)] sm:text-[1.12rem]">{copy.preview.title}</div>
          </div>
        </div>
        <div className="shrink-0 rounded-full border border-[rgba(117,241,106,0.28)] bg-[rgba(117,241,106,0.1)] px-3 py-2 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--landing-accent-strong)]">
          {copy.preview.load}
        </div>
      </div>

      <div className="grid gap-3 py-4 sm:grid-cols-3">
        {[
          { label: copy.preview.incidents, icon: ShieldCheck },
          { label: copy.preview.response, icon: Scroll },
          { label: copy.preview.queue, icon: Ticket },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="min-w-0 rounded-2xl border border-[var(--landing-line)] bg-[rgba(244,241,238,0.025)] p-3">
              <Icon size={18} weight="bold" className="text-[var(--landing-accent)]" />
              <div className="mt-4 truncate text-sm font-bold text-[var(--landing-text)]">{item.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="min-w-0 rounded-[1.4rem] border border-[var(--landing-line)] bg-[rgba(244,241,238,0.02)] p-4">
          <div className="mb-4 text-[0.62rem] uppercase tracking-[0.26em] text-[var(--landing-soft)]">system map</div>
          <div className="grid grid-cols-2 gap-2">
            {copy.rail.map((label, index) => {
              const Icon = moduleIcons[index] ?? ShieldCheck;

              return (
                <div key={label} className="min-w-0 rounded-2xl border border-[var(--landing-line)] bg-[rgba(6,6,6,0.44)] p-3">
                  <Icon size={17} weight="bold" className="text-[var(--landing-accent)]" />
                  <div className="mt-3 truncate text-[0.66rem] font-bold uppercase tracking-[0.16em] text-[var(--landing-text)]">{label}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 rounded-[1.4rem] border border-[var(--landing-line)] bg-[rgba(6,6,6,0.36)] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-[0.62rem] uppercase tracking-[0.26em] text-[var(--landing-soft)]">signal stream</div>
            <div className="h-2 w-2 rounded-full bg-[var(--color-primary-1)] shadow-[0_0_18px_rgba(117,241,106,0.58)]" />
          </div>

          <div className="space-y-2">
            {copy.signals.map((signal) => (
              <div key={signal.title} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-[var(--landing-line)] bg-[rgba(244,241,238,0.025)] px-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-[var(--landing-text)]">{signal.title}</div>
                  <div className="mt-1 truncate text-[0.62rem] uppercase tracking-[0.16em] text-[var(--landing-soft)]">{signal.meta}</div>
                </div>
                <div
                  className={`h-8 w-1.5 shrink-0 rounded-full ${
                    signal.tone === "violet"
                      ? "bg-[var(--color-primary-2)] shadow-[0_0_16px_rgba(143,94,255,0.36)]"
                      : "bg-[var(--color-primary-1)] shadow-[0_0_16px_rgba(117,241,106,0.36)]"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--landing-line)] pt-4">
        {copy.preview.channels.map((channel) => (
          <span key={channel} className="landing-pill rounded-full px-3 py-2 text-[0.62rem] font-bold uppercase leading-none tracking-[0.16em] text-[var(--landing-soft)]">
            {channel}
          </span>
        ))}
      </div>
    </div>
  );
}
