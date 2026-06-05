"use client";

import {
  ArrowUpRight,
  ChartLineUp,
  CheckCircle,
  DiscordLogo,
  DotsThreeOutline,
  GlobeHemisphereWest,
  Graph,
  List,
  LockKey,
  Pulse,
  ShieldCheck,
  Sparkle,
  Ticket,
  Waveform,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { LandingUserMenu } from "@/components/landing/LandingUserMenu";
import { OverlordOrbitalScene } from "@/components/landing/OverlordOrbitalScene";
import type { Language } from "@/locales/landing";

type PhosphorIcon = ComponentType<{
  size?: number;
  weight?: "regular" | "bold" | "fill" | "duotone";
  className?: string;
}>;

const copy = {
  ru: {
    nav: {
      label: "Command Center",
      pulse: "Пульс",
      map: "Карта",
      systems: "Системы",
      route: "Маршрут",
      login: "Войти",
      language: "Сменить язык",
      menu: "Открыть меню",
      close: "Закрыть меню",
    },
    hero: {
      eyebrow: "Discord operations layer",
      brand: "OVERLORD",
      title: "Операционный слой для Discord-сервера, где сигнал сразу превращается в действие.",
      body: "Модерация, аналитика, тикеты, роли и голосовые сцены собраны в один контур: команда видит напряжение сервера, понимает контекст и закрывает решение без лишних экранов.",
      primary: "Открыть dashboard",
      secondary: "Разобрать систему",
      status: "Live guild posture",
      command: "command mesh armed",
      metrics: [
        { value: "18 ms", label: "отклик панели" },
        { value: "360", label: "обзор сервера" },
        { value: "24/7", label: "дежурный слой" },
      ],
    },
    pulse: {
      eyebrow: "Guild Pulse",
      title: "Первый экран теперь работает как радар, а не как витрина.",
      body: "Overlord показывает состояние сервера через живую карту: пики активности, очередь поддержки, голосовые комнаты и риск доступа читаются как единая оперативная картина.",
      signals: [
        { label: "raid pressure", value: "72", tone: "danger" },
        { label: "ticket queue", value: "07", tone: "violet" },
        { label: "voice load", value: "41", tone: "green" },
      ],
    },
    map: {
      eyebrow: "Control Map",
      title: "Системы связаны линией решения.",
      body: "Каждый модуль оставлен на своем месте, но лендинг объясняет не список функций, а маршрут управления: обнаружить, понять, применить политику, записать след.",
      nodes: [
        { icon: Pulse, label: "Detect", title: "Поймать сигнал", body: "Рейд, жалоба, роль или перегрузка тикетов попадает в общий поток событий." },
        { icon: Graph, label: "Correlate", title: "Собрать контекст", body: "История участника, канал, права, прошлые кейсы и активность раскрываются рядом." },
        { icon: LockKey, label: "Authorize", title: "Проверить правило", body: "Политика сервера показывает допустимые действия без ручной сверки настроек." },
        { icon: CheckCircle, label: "Record", title: "Закрыть действие", body: "Ответ, санкция, маршрут или изменение доступа фиксируются в памяти сервера." },
      ],
    },
    systems: {
      eyebrow: "Core Systems",
      title: "Модули стали не карточками, а рабочими полосами управления.",
      body: "Каждая полоса показывает назначение системы, ее оперативный сигнал и то, что команда получает на выходе.",
      rows: [
        {
          icon: ShieldCheck,
          name: "Moderation",
          title: "Модерация и доступы",
          body: "Anti-raid, санкции, роли, исключения и аудит решений в одном политическом контуре.",
          output: "policy grid",
          points: ["санкции", "roles", "audit"],
        },
        {
          icon: ChartLineUp,
          name: "Analytics",
          title: "Аналитика активности",
          body: "Сообщения, участники, каналы и голосовые сессии превращаются в понятный ритм сервера.",
          output: "live pulse",
          points: ["messages", "members", "voice"],
        },
        {
          icon: Ticket,
          name: "Tickets",
          title: "Тикеты и маршруты",
          body: "Очереди поддержки, SLA, эскалации и ответы остаются рядом с контекстом сервера.",
          output: "fast route",
          points: ["queue", "cases", "routing"],
        },
        {
          icon: Waveform,
          name: "Voice",
          title: "Голос и сцены",
          body: "Временные комнаты, музыка и голосовые события входят в общий диспетчерский слой.",
          output: "voice reactor",
          points: ["rooms", "music", "events"],
        },
      ],
    },
    route: {
      eyebrow: "Operator Route",
      title: "Администратор видит следующий шаг сразу.",
      body: "Лендинг ведет к продукту через сценарий работы: где сервер напряжен, кто отвечает, какое действие уже доступно и что попадет в аудит.",
      stages: ["signal", "context", "policy", "action", "memory"],
      ctaTitle: "Запусти Overlord как командный слой своего Discord.",
      ctaBody: "Войди в dashboard и собери модерацию, аналитику, тикеты и голос в один премиальный центр управления.",
      primary: "Войти в dashboard",
      secondary: "К началу",
    },
    footer: "Precision for communities",
  },
  en: {
    nav: {
      label: "Command Center",
      pulse: "Pulse",
      map: "Map",
      systems: "Systems",
      route: "Route",
      login: "Login",
      language: "Switch language",
      menu: "Open menu",
      close: "Close menu",
    },
    hero: {
      eyebrow: "Discord operations layer",
      brand: "OVERLORD",
      title: "An operating layer for Discord where signal becomes action immediately.",
      body: "Moderation, analytics, tickets, roles, and voice scenes are pulled into one control loop: the team sees server pressure, reads context, and closes the move without extra screens.",
      primary: "Open dashboard",
      secondary: "Map the system",
      status: "Live guild posture",
      command: "command mesh armed",
      metrics: [
        { value: "18 ms", label: "panel response" },
        { value: "360", label: "server visibility" },
        { value: "24/7", label: "watch layer" },
      ],
    },
    pulse: {
      eyebrow: "Guild Pulse",
      title: "The first screen now behaves like a radar, not a showcase.",
      body: "Overlord expresses server state through a living map: activity spikes, support queue, voice rooms, and access risk read as one operational picture.",
      signals: [
        { label: "raid pressure", value: "72", tone: "danger" },
        { label: "ticket queue", value: "07", tone: "violet" },
        { label: "voice load", value: "41", tone: "green" },
      ],
    },
    map: {
      eyebrow: "Control Map",
      title: "Systems are connected by the decision line.",
      body: "Every module keeps its depth, but the landing explains the management route instead of a feature list: detect, understand, apply policy, and write the trail.",
      nodes: [
        { icon: Pulse, label: "Detect", title: "Catch the signal", body: "A raid, report, role, or ticket overload lands in the shared event stream." },
        { icon: Graph, label: "Correlate", title: "Gather context", body: "Member history, channel, permissions, previous cases, and activity open beside it." },
        { icon: LockKey, label: "Authorize", title: "Check the rule", body: "Server policy shows allowed actions without manually hunting through settings." },
        { icon: CheckCircle, label: "Record", title: "Close the action", body: "Reply, sanction, route, or access change is written into server memory." },
      ],
    },
    systems: {
      eyebrow: "Core Systems",
      title: "Modules are no longer cards. They are working control bands.",
      body: "Each band shows what the system is for, what signal it carries, and what the team gets out of it.",
      rows: [
        {
          icon: ShieldCheck,
          name: "Moderation",
          title: "Moderation and access",
          body: "Anti-raid, sanctions, roles, exceptions, and audit history in one policy loop.",
          output: "policy grid",
          points: ["sanctions", "roles", "audit"],
        },
        {
          icon: ChartLineUp,
          name: "Analytics",
          title: "Activity analytics",
          body: "Messages, members, channels, and voice sessions become a readable server rhythm.",
          output: "live pulse",
          points: ["messages", "members", "voice"],
        },
        {
          icon: Ticket,
          name: "Tickets",
          title: "Tickets and routing",
          body: "Support queues, SLA, escalations, and replies stay beside server context.",
          output: "fast route",
          points: ["queue", "cases", "routing"],
        },
        {
          icon: Waveform,
          name: "Voice",
          title: "Voice and scenes",
          body: "Temporary rooms, music, and voice events become part of the dispatch layer.",
          output: "voice reactor",
          points: ["rooms", "music", "events"],
        },
      ],
    },
    route: {
      eyebrow: "Operator Route",
      title: "The administrator sees the next step immediately.",
      body: "The landing leads to the product through the work scenario: where the server is tense, who owns it, what action is available, and what enters audit.",
      stages: ["signal", "context", "policy", "action", "memory"],
      ctaTitle: "Run Overlord as the command layer for your Discord.",
      ctaBody: "Enter the dashboard and bring moderation, analytics, tickets, and voice into one premium control center.",
      primary: "Enter dashboard",
      secondary: "Back to top",
    },
    footer: "Precision for communities",
  },
} as const;

const navItems = [
  { href: "#pulse", key: "pulse" },
  { href: "#map", key: "map" },
  { href: "#systems", key: "systems" },
  { href: "#route", key: "route" },
] as const;

export function LandingExperience() {
  const [language, setLanguage] = useState<Language>("ru");
  const [menuOpen, setMenuOpen] = useState(false);
  const text = copy[language];
  const { scrollYProgress } = useScroll();
  const progressScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  useEffect(() => {
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;

    if (menuOpen) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, [menuOpen]);

  return (
    <div id="top" className="landing-cinematic relative min-h-screen overflow-x-hidden text-[var(--landing-text)]">
      <motion.div
        aria-hidden="true"
        className="fixed left-0 top-0 z-[70] h-px w-full origin-left bg-[var(--color-primary-1)] shadow-[0_0_24px_rgba(117,241,106,0.55)]"
        style={{ scaleX: progressScale }}
      />
      <LandingNav language={language} setLanguage={setLanguage} menuOpen={menuOpen} setMenuOpen={setMenuOpen} text={text.nav} />
      <main>
        <Hero text={text} />
        <PulseSection text={text} />
        <MapSection text={text} />
        <SystemsSection text={text} />
        <RouteSection text={text} />
      </main>
      <LandingFooter text={text} />
    </div>
  );
}

function LandingNav({
  language,
  setLanguage,
  menuOpen,
  setMenuOpen,
  text,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  text: (typeof copy)[Language]["nav"];
}) {
  const closeMenu = () => setMenuOpen(false);
  const prefersReducedMotion = useReducedMotion();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 lg:px-8">
        <nav className="mx-auto grid max-w-[1540px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-full border border-[var(--landing-line)] bg-[rgba(6,6,6,0.76)] px-3 py-2.5 shadow-[0_24px_90px_rgba(14,14,14,0.42)] backdrop-blur-2xl lg:grid-cols-[1fr_auto_1fr]">
          <Link href="#top" onClick={closeMenu} className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--landing-line)] bg-[rgba(244,241,238,0.04)]">
              <Image src="/logos/logo-white.svg" alt="Overlord" width={24} height={24} priority className="h-6 w-6 opacity-90" />
            </span>
            <span className="min-w-0">
              <span className="block font-akony text-[0.8rem] tracking-[0.22em] text-[var(--landing-text)] sm:text-[0.95rem]">OVERLORD</span>
              <span className="block truncate text-[0.54rem] uppercase tracking-[0.28em] text-[var(--landing-soft)] sm:text-[0.6rem]">{text.label}</span>
            </span>
          </Link>

          <ul className="hidden items-center gap-1 rounded-full border border-[var(--landing-line)] bg-[rgba(244,241,238,0.025)] p-1 lg:flex">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-full px-4 py-2.5 text-[0.64rem] font-bold uppercase tracking-[0.24em] text-[var(--landing-soft)] transition-colors hover:bg-[rgba(244,241,238,0.04)] hover:text-[var(--landing-text)]"
                >
                  {text[item.key]}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex shrink-0 items-center justify-end gap-2">
            <LanguageSwitch language={language} setLanguage={setLanguage} label={text.language} className="hidden lg:flex" />
            <LandingUserMenu language={language} className="hidden lg:flex">
              <Link href="/login" className="landing-premium-button hidden min-h-11 px-5 text-[0.66rem] lg:inline-flex">
                {text.login}
                <ArrowUpRight size={15} weight="bold" />
              </Link>
            </LandingUserMenu>
            <button
              type="button"
              aria-label={menuOpen ? text.close : text.menu}
              onClick={() => setMenuOpen(!menuOpen)}
              className="grid h-11 w-11 place-items-center rounded-full border border-[var(--landing-line)] bg-[rgba(244,241,238,0.04)] text-[var(--landing-text)] lg:hidden"
            >
              {menuOpen ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] bg-[rgba(3,5,4,0.92)] px-3 pb-8 pt-3 backdrop-blur-2xl lg:hidden"
          >
            <div className="flex min-h-full flex-col">
              <div className="flex items-center justify-between rounded-full border border-[var(--landing-line)] bg-[rgba(6,6,6,0.82)] px-3 py-2.5">
                <Link href="#top" onClick={closeMenu} className="flex items-center gap-3">
                  <Image src="/logos/logo-white.svg" alt="Overlord" width={24} height={24} className="h-6 w-6 opacity-90" />
                  <span className="font-akony text-[0.86rem] tracking-[0.24em] text-[var(--landing-text)]">OVERLORD</span>
                </Link>
                <button type="button" aria-label={text.close} onClick={closeMenu} className="grid h-11 w-11 place-items-center rounded-full border border-[var(--landing-line)] text-[var(--landing-text)]">
                  <X size={20} weight="bold" />
                </button>
              </div>

              <div className="flex flex-1 flex-col justify-between py-10">
                <ul className="space-y-7">
                  {navItems.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} onClick={closeMenu} className="block text-[1.08rem] font-black uppercase tracking-[0.18em] text-[var(--landing-text)]">
                        {text[item.key]}
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="space-y-5 border-t border-[var(--landing-line)] pt-7">
                  <LanguageSwitch language={language} setLanguage={setLanguage} label={text.language} className="flex" />
                  <LandingUserMenu language={language} variant="mobile" onNavigate={closeMenu}>
                    <Link href="/login" onClick={closeMenu} className="landing-premium-button w-full">
                      {text.login}
                      <ArrowUpRight size={16} weight="bold" />
                    </Link>
                  </LandingUserMenu>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function LanguageSwitch({
  language,
  setLanguage,
  label,
  className,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={`${className ?? ""} items-center rounded-full border border-[var(--landing-line)] bg-[rgba(244,241,238,0.025)] p-1`}>
      <span className="grid h-9 w-9 place-items-center text-[var(--landing-soft)]">
        <GlobeHemisphereWest size={15} weight="bold" />
      </span>
      {(["ru", "en"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          onClick={() => setLanguage(value)}
          className={`h-9 rounded-full px-4 text-[0.62rem] font-bold uppercase tracking-[0.22em] transition-colors ${
            value === language ? "bg-[var(--color-primary-1)] text-[#07110a]" : "text-[var(--landing-soft)] hover:text-[var(--landing-text)]"
          }`}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function Hero({ text }: { text: (typeof copy)[Language] }) {
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const sceneY = useTransform(scrollYProgress, [0, 0.35], [0, 90]);
  const titleY = useTransform(scrollYProgress, [0, 0.28], [0, 42]);

  return (
    <section className="relative min-h-[100svh] overflow-hidden px-4 pb-16 pt-28 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 landing-cinematic-grid" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_34%,rgba(117,241,106,0.2),transparent_34rem),radial-gradient(circle_at_86%_10%,rgba(143,94,255,0.15),transparent_30rem)]" />

      <motion.div
        aria-hidden="true"
        style={{ y: prefersReducedMotion ? 0 : sceneY }}
        className="absolute bottom-[10rem] right-[-21rem] top-[21rem] z-0 w-[42rem] opacity-45 sm:right-[-12rem] sm:top-[12rem] sm:w-[52rem] sm:opacity-65 lg:inset-y-20 lg:right-[-4rem] lg:w-[66rem] lg:opacity-95 xl:right-[4rem]"
      >
        <OverlordOrbitalScene />
      </motion.div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-7rem)] max-w-[1540px] items-center gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(360px,0.5fr)]">
        <motion.div
          style={{ y: prefersReducedMotion ? 0 : titleY }}
          initial={prefersReducedMotion ? false : { y: 24 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[calc(100vw-2rem)] sm:max-w-[54rem]"
        >
          <p className="landing-kicker">{text.hero.eyebrow}</p>
          <div className="mt-5 max-w-full overflow-hidden whitespace-nowrap font-akony text-[1.35rem] leading-[0.84] tracking-[0.05em] text-[var(--landing-text)] min-[430px]:text-[1.7rem] sm:text-[5rem] lg:text-[6.7rem] xl:text-[7.6rem]">
            {text.hero.brand}
          </div>
          <h1 className="landing-display-title mt-6 max-w-[14ch] break-words font-sans text-[1.3rem] font-black uppercase leading-[1.08] text-[var(--landing-text)] min-[430px]:text-[1.55rem] sm:max-w-[16ch] sm:text-[3rem] sm:leading-[1.04] lg:text-[4.2rem] xl:text-[5.1rem]">
            {text.hero.title}
          </h1>
          <p className="landing-pretty mt-6 max-w-[42rem] text-[0.98rem] leading-[1.75] text-[var(--landing-muted)] sm:text-lg">{text.hero.body}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="landing-premium-button w-full sm:w-auto">
              {text.hero.primary}
              <ArrowUpRight size={16} weight="bold" />
            </Link>
            <Link href="#pulse" className="landing-ghost-button w-full sm:w-auto">
              {text.hero.secondary}
            </Link>
          </div>
        </motion.div>

        <Reveal className="relative z-10 lg:pt-24">
          <aside className="landing-glass-panel ml-auto max-w-[29rem] rounded-[2rem] border border-[var(--landing-line)] p-4">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--landing-line)] pb-4">
              <div>
                <p className="text-[0.58rem] font-bold uppercase tracking-[0.24em] text-[var(--landing-soft)]">{text.hero.status}</p>
                <p className="mt-2 text-lg font-black uppercase text-[var(--landing-text)]">{text.hero.command}</p>
              </div>
              <Sparkle size={22} weight="fill" className="shrink-0 text-[var(--landing-accent)]" />
            </div>
            <dl className="mt-4 grid grid-cols-3 border-y border-[var(--landing-line)]">
              {text.hero.metrics.map((item) => (
                <div key={item.value} className="border-r border-[var(--landing-line)] px-2 py-4 last:border-r-0">
                  <dt className="sr-only">{item.label}</dt>
                  <dd className="tabular text-[1rem] font-black uppercase text-[var(--landing-accent-strong)] sm:text-[1.45rem]">{item.value}</dd>
                  <dd className="mt-2 text-[0.54rem] font-bold uppercase leading-[1.45] tracking-[0.14em] text-[var(--landing-soft)]">{item.label}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-3 rounded-[1.4rem] border border-[rgba(117,241,106,0.24)] bg-[rgba(117,241,106,0.065)] p-4">
              <DiscordLogo size={22} weight="fill" className="text-[var(--landing-accent)]" />
              <p className="text-[0.72rem] font-black uppercase tracking-[0.15em] text-[var(--landing-text)]">Discord-native control plane</p>
            </div>
          </aside>
        </Reveal>
      </div>
    </section>
  );
}

function PulseSection({ text }: { text: (typeof copy)[Language] }) {
  return (
    <section id="pulse" className="landing-deferred relative scroll-mt-24 border-t border-[var(--landing-line)] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto grid max-w-[1540px] gap-12 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] lg:items-end">
        <SectionIntro eyebrow={text.pulse.eyebrow} title={text.pulse.title} body={text.pulse.body} />
        <Reveal>
          <div className="relative min-h-[30rem] overflow-hidden rounded-[2.4rem] border border-[var(--landing-line)] bg-[rgba(244,241,238,0.025)] p-4 sm:min-h-[35rem] sm:p-6">
            <div className="absolute inset-0 landing-console-grid opacity-80" />
            <div className="absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(117,241,106,0.18)]" />
            <div className="absolute left-1/2 top-1/2 h-[17rem] w-[17rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(143,94,255,0.2)]" />
            <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[rgba(117,241,106,0.34)] bg-[rgba(8,9,8,0.76)] shadow-[0_0_80px_rgba(117,241,106,0.22)]">
              <Image src="/logos/logo-white.svg" alt="" width={38} height={38} className="h-10 w-10 opacity-90" />
            </div>
            {text.pulse.signals.map((signal, index) => (
              <div key={signal.label} className={`absolute ${index === 0 ? "left-5 top-8 sm:left-10 sm:top-12" : index === 1 ? "bottom-8 right-5 sm:bottom-12 sm:right-10" : "bottom-12 left-5 sm:bottom-16 sm:left-12"} max-w-[12rem] rounded-[1.5rem] border border-[var(--landing-line)] bg-[rgba(8,9,8,0.78)] p-4 backdrop-blur-xl`}>
                <div className="flex items-center justify-between gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${toneClass(signal.tone)}`} />
                  <span className="tabular text-2xl font-black text-[var(--landing-text)]">{signal.value}</span>
                </div>
                <p className="mt-5 text-[0.58rem] font-black uppercase tracking-[0.18em] text-[var(--landing-soft)]">{signal.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function MapSection({ text }: { text: (typeof copy)[Language] }) {
  return (
    <section id="map" className="landing-deferred relative scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1540px]">
        <SectionIntro eyebrow={text.map.eyebrow} title={text.map.title} body={text.map.body} wide />
        <div className="mt-12 grid gap-4 lg:grid-cols-4">
          {text.map.nodes.map((node, index) => {
            const IconComponent = node.icon as PhosphorIcon;
            return (
              <Reveal key={node.label} delay={index * 0.06}>
                <article className="group relative min-h-[22rem] overflow-hidden border-y border-[var(--landing-line)] bg-[rgba(244,241,238,0.018)] px-2 py-6 transition-colors hover:border-[rgba(117,241,106,0.35)] sm:px-4">
                  <div className="flex items-start justify-between">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[var(--landing-line)] bg-[rgba(117,241,106,0.07)] text-[var(--landing-accent)]">
                      <IconComponent size={24} weight="bold" />
                    </div>
                    <span className="tabular text-[1.7rem] font-black uppercase tracking-[0.12em] text-[var(--landing-accent-strong)]">0{index + 1}</span>
                  </div>
                  <p className="mt-12 text-[0.62rem] font-black uppercase tracking-[0.24em] text-[var(--landing-accent)]">{node.label}</p>
                  <h3 className="mt-4 max-w-[13ch] font-sans text-[1.65rem] font-black uppercase leading-[1.04] text-[var(--landing-text)]">{node.title}</h3>
                  <p className="landing-pretty mt-5 text-sm leading-[1.75] text-[var(--landing-muted)]">{node.body}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SystemsSection({ text }: { text: (typeof copy)[Language] }) {
  return (
    <section id="systems" className="landing-deferred relative scroll-mt-24 border-y border-[var(--landing-line)] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1540px]">
        <SectionIntro eyebrow={text.systems.eyebrow} title={text.systems.title} body={text.systems.body} wide />
        <div className="mt-12 divide-y divide-[var(--landing-line)] border-y border-[var(--landing-line)]">
          {text.systems.rows.map((row, index) => {
            const IconComponent = row.icon as PhosphorIcon;
            return (
              <Reveal key={row.name} delay={index * 0.04}>
                <article className="grid gap-6 py-7 lg:grid-cols-[0.22fr_0.38fr_0.25fr_0.15fr] lg:items-center">
                  <div className="flex items-center gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[var(--landing-line)] bg-[rgba(244,241,238,0.025)] text-[var(--landing-accent)]">
                      <IconComponent size={23} weight="bold" />
                    </div>
                    <div>
                      <p className="tabular text-[0.58rem] font-bold uppercase tracking-[0.2em] text-[var(--landing-soft)]">0{index + 1}</p>
                      <h3 className="mt-1 font-akony text-[0.98rem] tracking-[0.18em] text-[var(--landing-text)]">{row.name}</h3>
                    </div>
                  </div>
                  <div>
                    <p className="text-[0.64rem] font-black uppercase tracking-[0.22em] text-[var(--landing-accent)]">{row.output}</p>
                    <h4 className="mt-3 font-sans text-[1.55rem] font-black uppercase leading-[1.05] text-[var(--landing-text)]">{row.title}</h4>
                    <p className="landing-pretty mt-3 max-w-[40rem] text-sm leading-[1.75] text-[var(--landing-muted)]">{row.body}</p>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {row.points.map((point) => (
                      <li key={point} className="rounded-full border border-[var(--landing-line)] px-3 py-1.5 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[var(--landing-soft)]">
                        {point}
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" className="landing-inline-link justify-start lg:justify-end">
                    deploy
                    <ArrowUpRight size={14} weight="bold" />
                  </Link>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RouteSection({ text }: { text: (typeof copy)[Language] }) {
  return (
    <section id="route" className="landing-deferred relative scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-[1540px]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)] lg:items-end">
          <SectionIntro eyebrow={text.route.eyebrow} title={text.route.title} body={text.route.body} />
          <Reveal>
            <ol className="grid gap-3 sm:grid-cols-5">
              {text.route.stages.map((stage, index) => (
                <li key={stage} className="relative min-h-28 border-t border-[var(--landing-line)] pt-4">
                  <span className="tabular text-[0.6rem] font-black uppercase tracking-[0.18em] text-[var(--landing-accent)]">0{index + 1}</span>
                  <p className="mt-5 text-[0.72rem] font-black uppercase tracking-[0.16em] text-[var(--landing-text)]">{stage}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>

        <Reveal>
          <div className="landing-final-callout mt-16 overflow-hidden rounded-[2.5rem] border border-[rgba(117,241,106,0.22)] p-6 sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="max-w-[58rem]">
                <p className="landing-kicker">{text.route.eyebrow}</p>
                <h2 className="landing-display-title mt-5 font-sans text-[2.2rem] font-black uppercase leading-[1] text-[var(--landing-text)] sm:text-[3.5rem] lg:text-[5rem]">{text.route.ctaTitle}</h2>
                <p className="landing-pretty mt-6 max-w-[40rem] text-base leading-[1.8] text-[var(--landing-muted)] sm:text-lg">{text.route.ctaBody}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="/login" className="landing-premium-button">
                  {text.route.primary}
                  <ArrowUpRight size={16} weight="bold" />
                </Link>
                <Link href="#top" className="landing-ghost-button">
                  {text.route.secondary}
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function SectionIntro({
  eyebrow,
  title,
  body,
  wide = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  wide?: boolean;
}) {
  return (
    <Reveal>
      <div className={wide ? "grid gap-6 lg:grid-cols-[minmax(0,0.68fr)_minmax(300px,0.32fr)] lg:items-end" : "max-w-[48rem]"}>
        <div>
          <p className="landing-kicker">{eyebrow}</p>
          <h2 className="landing-display-title mt-5 max-w-[15ch] font-sans text-[2.12rem] font-black uppercase leading-[1] text-[var(--landing-text)] sm:text-[3.25rem] lg:text-[4.65rem]">{title}</h2>
        </div>
        <p className="landing-pretty max-w-[38rem] text-base leading-[1.85] text-[var(--landing-muted)] sm:text-lg">{body}</p>
      </div>
    </Reveal>
  );
}

function LandingFooter({ text }: { text: (typeof copy)[Language] }) {
  return (
    <footer className="relative border-t border-[var(--landing-line)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1540px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logos/logo-white.svg" alt="Overlord" width={24} height={24} className="h-6 w-6 opacity-80" />
          <div className="font-akony text-[0.95rem] tracking-[0.24em] text-[var(--landing-text)]">OVERLORD</div>
        </div>
        <div className="flex items-center gap-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--landing-soft)]">
          <DotsThreeOutline size={18} weight="fill" className="text-[var(--landing-accent)]" />
          {new Date().getFullYear()} / {text.footer}
        </div>
      </div>
    </footer>
  );
}

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { y: 28 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.72, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function toneClass(tone: string) {
  if (tone === "danger") return "bg-[var(--color-destructive)] shadow-[0_0_24px_rgba(244,63,94,0.38)]";
  if (tone === "violet") return "bg-[var(--color-primary-2)] shadow-[0_0_24px_rgba(143,94,255,0.38)]";
  return "bg-[var(--color-primary-1)] shadow-[0_0_24px_rgba(117,241,106,0.42)]";
}
