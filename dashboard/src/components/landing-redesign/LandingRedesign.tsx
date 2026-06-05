"use client";

import { ArrowUpRight, ChartBar, GlobeHemisphereWest, List, ShieldCheck, Ticket, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { LandingUserMenu } from "@/components/landing/LandingUserMenu";

type Language = "ru" | "en";

const copy = {
  ru: {
    nav: {
      label: "Ops landing v2",
      control: "Контроль",
      systems: "Системы",
      route: "Маршрут",
      login: "Войти",
      menu: "Меню",
      close: "Закрыть меню",
      language: "Сменить язык",
    },
    hero: {
      eyebrow: "Discord operations system",
      title: "OVERLORD",
      subtitle: "Сервер под контролем, когда поток событий становится громким.",
      body: "Overlord собирает модерацию, аналитику, тикеты, роли и voice-сцены в один командный контур для владельцев Discord-сообществ.",
      primary: "Открыть dashboard",
      secondary: "Посмотреть маршрут",
      live: "Live posture",
      guild: "North Star Community",
      stable: "Стабильно",
    },
    metrics: [
      { value: "18s", label: "до первого ответа" },
      { value: "3", label: "сигнала требуют решения" },
      { value: "24/7", label: "контур наблюдения" },
    ],
    flow: {
      eyebrow: "Control plane",
      title: "Не экран ради красоты. Рабочий маршрут от сигнала к решению.",
      body: "Вместо разрозненных страниц Overlord показывает, где возник риск, какой контекст важен и какое действие закрывает ситуацию.",
      stages: [
        { label: "Detect", title: "Сигнал", body: "Рейд, очередь тикетов, роль, жалоба или провал правила попадают в общий поток." },
        { label: "Decide", title: "Контекст", body: "Рядом видны история, каналы, участники, политики и предыдущие действия команды." },
        { label: "Act", title: "Действие", body: "Санкция, ответ, маршрут или настройка фиксируются в памяти сервера." },
      ],
    },
    systems: {
      eyebrow: "Core systems",
      title: "Три операционные системы вместо набора кнопок.",
      items: [
        {
          title: "Govern",
          text: "Anti-raid, санкции, роли и аудит держат правила сервера в едином контуре.",
          meta: "policy armed",
        },
        {
          title: "Observe",
          text: "Сообщения, voice, участники и каналы собираются в читаемую картину активности.",
          meta: "live pulse",
        },
        {
          title: "Respond",
          text: "Тикеты, обращения, временные комнаты и музыка становятся частью общего управления.",
          meta: "fast route",
        },
      ],
    },
    final: {
      eyebrow: "Command center",
      title: "Зайди в dashboard и собери сервер в управляемый контур.",
      body: "Новая версия лендинга живет отдельно от текущей страницы и показывает более продуктовый, плотный Overlord.",
      primary: "Войти в dashboard",
    },
  },
  en: {
    nav: {
      label: "Ops landing v2",
      control: "Control",
      systems: "Systems",
      route: "Route",
      login: "Login",
      menu: "Menu",
      close: "Close menu",
      language: "Switch language",
    },
    hero: {
      eyebrow: "Discord operations system",
      title: "OVERLORD",
      subtitle: "Your server stays controlled when the event stream gets loud.",
      body: "Overlord brings moderation, analytics, tickets, roles, and voice scenes into one command loop for Discord community owners.",
      primary: "Open dashboard",
      secondary: "View route",
      live: "Live posture",
      guild: "North Star Community",
      stable: "Stable",
    },
    metrics: [
      { value: "18s", label: "to first response" },
      { value: "3", label: "signals need a decision" },
      { value: "24/7", label: "observation loop" },
    ],
    flow: {
      eyebrow: "Control plane",
      title: "Not a decorative screen. A working route from signal to decision.",
      body: "Instead of disconnected pages, Overlord shows where risk appeared, which context matters, and which action closes the situation.",
      stages: [
        { label: "Detect", title: "Signal", body: "Raid pressure, ticket queues, roles, reports, and rule gaps land in one stream." },
        { label: "Decide", title: "Context", body: "History, channels, members, policy, and prior team actions sit next to the signal." },
        { label: "Act", title: "Action", body: "A sanction, response, route, or setting is recorded into server memory." },
      ],
    },
    systems: {
      eyebrow: "Core systems",
      title: "Three operating systems instead of a pile of buttons.",
      items: [
        {
          title: "Govern",
          text: "Anti-raid, sanctions, roles, and audit keep server policy in one controlled loop.",
          meta: "policy armed",
        },
        {
          title: "Observe",
          text: "Messages, voice, members, and channels form a readable picture of activity.",
          meta: "live pulse",
        },
        {
          title: "Respond",
          text: "Tickets, support, temporary rooms, and music become part of the same control layer.",
          meta: "fast route",
        },
      ],
    },
    final: {
      eyebrow: "Command center",
      title: "Enter the dashboard and put the server into one managed loop.",
      body: "This new landing version lives separately from the current page and presents a denser, more product-led Overlord.",
      primary: "Enter dashboard",
    },
  },
} as const;

const navItems = [
  { href: "#control", key: "control" },
  { href: "#systems", key: "systems" },
  { href: "#route", key: "route" },
] as const;

const systemIcons = [ShieldCheck, ChartBar, Ticket] as const;

export function LandingRedesign() {
  const [language, setLanguage] = useState<Language>("ru");
  const [mobileOpen, setMobileOpen] = useState(false);
  const c = copy[language];

  useEffect(() => {
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;

    if (mobileOpen) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, [mobileOpen]);

  const closeMenu = () => setMobileOpen(false);

  return (
    <div id="top" className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(117,241,106,0.16),transparent_30rem),radial-gradient(circle_at_18%_46%,rgba(143,94,255,0.12),transparent_28rem),linear-gradient(180deg,var(--bg-base),#050505)]" />
      <NavBar c={c} language={language} setLanguage={setLanguage} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} closeMenu={closeMenu} />

      <main className="relative z-10">
        <Hero c={c} />
        <ControlSection c={c} />
        <SystemsSection c={c} />
        <FinalSection c={c} />
      </main>
    </div>
  );
}

function NavBar({
  c,
  language,
  setLanguage,
  mobileOpen,
  setMobileOpen,
  closeMenu,
}: {
  c: (typeof copy)[Language];
  language: Language;
  setLanguage: (language: Language) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  closeMenu: () => void;
}) {
  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 lg:px-8">
        <div className="mx-auto flex max-w-[1540px] items-center justify-between gap-3 rounded-full border border-divider bg-[rgba(6,6,6,0.72)] px-3 py-2.5 shadow-[0_18px_60px_rgba(14,14,14,0.34)] backdrop-blur-2xl sm:px-4">
          <Link href="#top" className="flex min-w-0 items-center gap-3" onClick={closeMenu}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-divider bg-[rgba(244,241,238,0.04)]">
              <Image src="/logos/logo-white.svg" alt="Overlord" width={24} height={24} className="h-6 w-6 opacity-90" priority />
            </span>
            <span className="min-w-0">
              <span className="block font-akony text-[0.88rem] tracking-[0.24em]">OVERLORD</span>
              <span className="block truncate text-[0.58rem] uppercase tracking-[0.28em] text-[var(--text-muted)]">{c.nav.label}</span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="text-[0.68rem] font-bold uppercase tracking-[0.26em] text-[var(--text-secondary)] transition-colors hover:text-foreground">
                {c.nav[item.key]}
              </Link>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <LanguageToggle c={c} language={language} setLanguage={setLanguage} className="hidden lg:flex" />
            <LandingUserMenu language={language} className="hidden lg:flex">
              <Link href="/login" className="hidden min-h-11 items-center justify-center gap-2 rounded-full border border-[rgba(117,241,106,0.24)] bg-primary px-5 text-[0.66rem] font-bold uppercase tracking-[0.24em] text-black shadow-[0_12px_34px_rgba(117,241,106,0.16)] transition-transform hover:-translate-y-0.5 lg:inline-flex">
                {c.nav.login}
                <ArrowUpRight size={15} weight="bold" />
              </Link>
            </LandingUserMenu>
            <button
              type="button"
              aria-label={mobileOpen ? c.nav.close : c.nav.menu}
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-divider bg-[rgba(244,241,238,0.04)] text-foreground lg:hidden"
            >
              {mobileOpen ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[rgba(3,3,3,0.92)] px-3 pb-8 pt-3 backdrop-blur-xl lg:hidden"
          >
            <div className="flex items-center justify-between rounded-full border border-divider bg-[rgba(6,6,6,0.82)] px-3 py-2.5">
              <Link href="#top" onClick={closeMenu} className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-divider bg-[rgba(244,241,238,0.04)]">
                  <Image src="/logos/logo-white.svg" alt="Overlord" width={24} height={24} className="h-6 w-6 opacity-90" />
                </span>
                <span className="font-akony text-[0.88rem] tracking-[0.24em]">OVERLORD</span>
              </Link>
              <button type="button" aria-label={c.nav.close} onClick={closeMenu} className="flex h-11 w-11 items-center justify-center rounded-full border border-divider text-foreground">
                <X size={20} weight="bold" />
              </button>
            </div>

            <div className="flex min-h-[calc(100svh-5.5rem)] flex-col justify-between py-10">
              <div className="space-y-8">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} onClick={closeMenu} className="block text-[1.12rem] font-bold uppercase tracking-[0.18em] text-foreground">
                    {c.nav[item.key]}
                  </Link>
                ))}
              </div>
              <div className="space-y-5 border-t border-divider pt-7">
                <LanguageToggle c={c} language={language} setLanguage={setLanguage} className="flex" />
                <LandingUserMenu language={language} variant="mobile" onNavigate={closeMenu}>
                  <Link href="/login" onClick={closeMenu} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[0.72rem] font-bold uppercase tracking-[0.22em] text-black">
                    {c.nav.login}
                    <ArrowUpRight size={16} weight="bold" />
                  </Link>
                </LandingUserMenu>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function LanguageToggle({
  c,
  language,
  setLanguage,
  className,
}: {
  c: (typeof copy)[Language];
  language: Language;
  setLanguage: (language: Language) => void;
  className?: string;
}) {
  return (
    <div className={`items-center rounded-full border border-divider bg-[rgba(244,241,238,0.03)] p-1 ${className ?? ""}`}>
      <span className="flex h-9 w-9 items-center justify-center text-[var(--text-secondary)]">
        <GlobeHemisphereWest size={15} weight="bold" />
      </span>
      {(["ru", "en"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-label={c.nav.language}
          onClick={() => setLanguage(value)}
          className={`h-9 rounded-full px-4 text-[0.62rem] font-bold uppercase tracking-[0.22em] transition-colors ${
            value === language ? "bg-primary text-black" : "text-[var(--text-secondary)] hover:text-foreground"
          }`}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function Hero({ c }: { c: (typeof copy)[Language] }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative min-h-[100svh] overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <OpsCanvas c={c} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-9rem)] max-w-[1540px] items-center lg:items-end">
        <div className="w-[22.5rem] min-w-0 max-w-[calc(100vw-2rem)] overflow-hidden pb-8 pt-14 sm:w-full sm:max-w-[54rem] sm:pb-12 lg:pb-16 lg:pt-0">
          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
            className="text-[0.72rem] uppercase tracking-[0.38em] text-primary"
          >
            {c.hero.eyebrow}
          </motion.p>
          <motion.h1
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="mt-5 font-akony text-[1.72rem] leading-[0.88] tracking-[0.04em] text-foreground min-[390px]:text-[1.82rem] sm:text-[5rem] lg:text-[7.2rem]"
          >
            {c.hero.title}
          </motion.h1>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.74, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="mt-7 w-full min-w-0 max-w-full sm:max-w-[48rem]"
          >
            <h2 className="font-sans text-[1.72rem] font-bold uppercase leading-[1.04] tracking-[0.02em] text-foreground sm:text-[2.45rem] lg:text-[3.25rem]">
              {c.hero.subtitle}
            </h2>
            <p className="mt-6 max-w-full break-words text-base leading-[1.85] text-[var(--text-secondary)] sm:max-w-[38rem] sm:text-lg">{c.hero.body}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full border border-[rgba(117,241,106,0.24)] bg-primary px-5 text-[0.66rem] font-bold uppercase tracking-[0.16em] text-black shadow-[0_16px_42px_rgba(117,241,106,0.18)] transition-transform hover:-translate-y-0.5 sm:w-auto sm:px-7 sm:text-[0.72rem] sm:tracking-[0.24em]">
                {c.hero.primary}
                <ArrowUpRight size={16} weight="bold" />
              </Link>
              <Link href="#control" className="inline-flex min-h-14 w-full items-center justify-center rounded-full border border-[rgba(244,241,238,0.14)] bg-[rgba(244,241,238,0.03)] px-5 text-[0.66rem] font-bold uppercase tracking-[0.16em] text-foreground transition-colors hover:border-[rgba(117,241,106,0.38)] hover:text-primary sm:w-auto sm:px-7 sm:text-[0.72rem] sm:tracking-[0.24em]">
                {c.hero.secondary}
              </Link>
            </div>
            <MobilePosturePanel c={c} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function OpsCanvas({ c }: { c: (typeof copy)[Language] }) {
  const signals = [
    { name: "anti-raid", value: "armed", tone: "green" },
    { name: "ticket sla", value: "2 wait", tone: "violet" },
    { name: "voice hub", value: "18 live", tone: "green" },
    { name: "audit trail", value: "synced", tone: "green" },
  ];

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(244,241,238,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(244,241,238,0.045)_1px,transparent_1px)] bg-[size:76px_76px] [mask-image:linear-gradient(90deg,transparent,#0e0e0e_18%,#0e0e0e_88%,transparent)]" />
      <div className="absolute inset-y-24 right-[-8rem] hidden w-[58rem] rotate-[-7deg] rounded-[3rem] border border-[rgba(244,241,238,0.08)] bg-[linear-gradient(180deg,rgba(17,17,17,0.84),rgba(6,6,6,0.92))] shadow-[0_40px_140px_rgba(14,14,14,0.48)] lg:block" />
      <div className="absolute right-8 top-32 hidden w-[45rem] rotate-[-7deg] lg:block xl:right-20">
        <div className="flex items-center justify-between border-b border-divider pb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-divider bg-[rgba(117,241,106,0.08)]">
              <Image src="/logos/logo-color.svg" alt="" width={28} height={28} className="h-7 w-7" />
            </span>
            <span>
              <span className="block text-[0.62rem] uppercase tracking-[0.28em] text-primary">{c.hero.live}</span>
              <span className="mt-1 block text-lg font-bold text-foreground">{c.hero.guild}</span>
            </span>
          </div>
          <span className="rounded-full border border-[rgba(117,241,106,0.28)] bg-[rgba(117,241,106,0.1)] px-4 py-2 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-primary">
            {c.hero.stable}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 py-5">
          {c.metrics.map((metric) => (
            <div key={metric.value} className="rounded-[1.3rem] border border-divider bg-[rgba(244,241,238,0.025)] p-4">
              <div className="tabular text-2xl font-bold text-primary">{metric.value}</div>
              <div className="mt-3 text-[0.62rem] uppercase leading-[1.55] tracking-[0.18em] text-[var(--text-muted)]">{metric.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[0.82fr_1.18fr] gap-4">
          <div className="rounded-[1.5rem] border border-divider bg-[rgba(6,6,6,0.46)] p-4">
            <div className="mb-5 text-[0.62rem] uppercase tracking-[0.26em] text-[var(--text-muted)]">system map</div>
            <div className="space-y-3">
              {["moderation", "analytics", "tickets", "voice"].map((label, index) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-divider bg-[rgba(244,241,238,0.025)] px-3 py-3">
                  <span className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-foreground">{label}</span>
                  <span className={`h-2 w-8 rounded-full ${index === 2 ? "bg-[var(--color-primary-2)]" : "bg-primary"}`} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-divider bg-[rgba(6,6,6,0.42)] p-4">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-[0.62rem] uppercase tracking-[0.26em] text-[var(--text-muted)]">signal stream</span>
              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_18px_rgba(117,241,106,0.58)]" />
            </div>
            <div className="space-y-2">
              {signals.map((signal) => (
                <div key={signal.name} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-divider bg-[rgba(244,241,238,0.025)] px-3 py-3">
                  <span className="text-sm font-bold uppercase tracking-[0.1em] text-foreground">{signal.name}</span>
                  <span className={signal.tone === "violet" ? "text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[var(--color-primary-2)]" : "text-[0.62rem] font-bold uppercase tracking-[0.16em] text-primary"}>
                    {signal.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function MobilePosturePanel({ c }: { c: (typeof copy)[Language] }) {
  return (
    <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-divider bg-[rgba(17,17,17,0.72)] p-4 shadow-[0_24px_70px_rgba(14,14,14,0.32)] backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/logos/logo-color.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
          <div className="min-w-0">
            <div className="text-[0.62rem] uppercase tracking-[0.22em] text-primary">{c.hero.live}</div>
            <div className="truncate text-sm font-bold text-foreground">{c.hero.guild}</div>
          </div>
        </div>
        <span className="max-w-[6.8rem] shrink-0 truncate rounded-full bg-[rgba(117,241,106,0.12)] px-3 py-2 text-[0.58rem] font-bold uppercase tracking-[0.16em] text-primary">{c.hero.stable}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {c.metrics.map((metric) => (
          <div key={metric.value} className="min-w-0 rounded-2xl border border-divider bg-[rgba(244,241,238,0.025)] p-3">
            <div className="tabular text-lg font-bold text-primary">{metric.value}</div>
            <div className="mt-2 truncate text-[0.56rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">{metric.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ControlSection({ c }: { c: (typeof copy)[Language] }) {
  return (
    <section id="control" className="relative scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-[1540px]">
        <SectionHeader eyebrow={c.flow.eyebrow} title={c.flow.title} body={c.flow.body} />
        <div className="mt-12 grid border-y border-divider lg:grid-cols-3">
          {c.flow.stages.map((stage, index) => (
            <Reveal key={stage.label} delay={index * 0.08}>
              <div className="relative min-h-[20rem] border-divider py-8 lg:border-r lg:px-8">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-[0.68rem] font-bold uppercase tracking-[0.26em] text-primary">{stage.label}</span>
                  <span className="tabular text-[0.72rem] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">0{index + 1}</span>
                </div>
                <h3 className="mt-16 font-sans text-[2rem] font-bold uppercase leading-[1.04] tracking-[0.02em] text-foreground sm:text-[2.4rem]">{stage.title}</h3>
                <p className="mt-5 max-w-[27rem] text-base leading-[1.8] text-[var(--text-secondary)]">{stage.body}</p>
                <div className="absolute bottom-8 right-0 hidden h-px w-24 bg-[linear-gradient(90deg,var(--color-primary),transparent)] lg:block" />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function SystemsSection({ c }: { c: (typeof copy)[Language] }) {
  return (
    <section id="systems" className="relative scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto grid max-w-[1540px] gap-12 lg:grid-cols-[minmax(280px,0.35fr)_minmax(0,0.65fr)] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-[0.72rem] uppercase tracking-[0.38em] text-primary">{c.systems.eyebrow}</p>
          <h2 className="mt-5 max-w-[13ch] font-sans text-[2rem] font-bold uppercase leading-[1.04] tracking-[0.02em] text-foreground sm:text-[3rem]">
            {c.systems.title}
          </h2>
        </div>

        <div className="border-t border-divider">
          {c.systems.items.map((item, index) => {
            const Icon = systemIcons[index] ?? ShieldCheck;

            return (
              <Reveal key={item.title} delay={index * 0.08}>
                <article className="group grid gap-6 border-b border-divider py-9 md:grid-cols-[4.5rem_minmax(0,0.36fr)_minmax(0,0.64fr)] md:py-11">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-divider bg-[rgba(244,241,238,0.025)] text-primary transition-colors group-hover:border-[rgba(117,241,106,0.28)] group-hover:bg-[rgba(117,241,106,0.08)]">
                    <Icon size={24} weight="bold" />
                  </div>
                  <div>
                    <div className="text-[0.62rem] font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">{item.meta}</div>
                    <h3 className="mt-4 font-sans text-[1.8rem] font-bold uppercase leading-[1.05] tracking-[0.02em] text-foreground">{item.title}</h3>
                  </div>
                  <p className="max-w-[40rem] text-base leading-[1.85] text-[var(--text-secondary)] md:pt-8">{item.text}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalSection({ c }: { c: (typeof copy)[Language] }) {
  return (
    <section id="route" className="relative px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-[1540px] border-t border-divider pt-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(280px,0.28fr)] lg:items-end">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.38em] text-primary">{c.final.eyebrow}</p>
            <h2 className="mt-5 max-w-[17ch] font-sans text-[2.35rem] font-bold uppercase leading-[1.02] tracking-[0.02em] text-foreground sm:text-[3.5rem] lg:text-[4.35rem]">
              {c.final.title}
            </h2>
          </div>
          <div>
            <p className="text-base leading-[1.85] text-[var(--text-secondary)]">{c.final.body}</p>
            <Link href="/login" className="mt-7 inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-primary px-7 text-[0.72rem] font-bold uppercase tracking-[0.22em] text-black transition-transform hover:-translate-y-0.5">
              {c.final.primary}
              <ArrowUpRight size={16} weight="bold" />
            </Link>
          </div>
        </div>
        <footer className="mt-16 flex flex-col gap-4 border-t border-divider py-8 text-[0.62rem] uppercase tracking-[0.24em] text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span className="font-akony text-[0.82rem] tracking-[0.24em] text-foreground">OVERLORD</span>
          <span>Parallel landing route /landing-v2</span>
        </footer>
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,0.68fr)_minmax(280px,0.32fr)] lg:items-end">
      <div>
        <p className="text-[0.72rem] uppercase tracking-[0.38em] text-primary">{eyebrow}</p>
        <h2 className="mt-5 max-w-[18ch] font-sans text-[2rem] font-bold uppercase leading-[1.04] tracking-[0.02em] text-foreground sm:text-[3rem] lg:text-[3.6rem]">{title}</h2>
      </div>
      <p className="max-w-[34rem] text-base leading-[1.85] text-[var(--text-secondary)] lg:pb-2">{body}</p>
    </div>
  );
}

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.62, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
