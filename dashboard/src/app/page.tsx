"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@nextui-org/react";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  ChartBar, ShieldCheck, MusicNote, Ticket,
  Lightning, ArrowRight, SignIn, Coins, Globe,
} from "@phosphor-icons/react";

/* ─── Translations ─────────────────────────────── */

const t = {
  en: {
    badge: "Discord Management System",
    heroSub: "The premium platform for managing your Discord server. Full control, deep analytics, and limitless possibilities.",
    login: "Login",
    capLabel: "Capabilities",
    capH1: "EVERYTHING",
    capH2: "YOU NEED",
    ctaH1: "RULE YOUR",
    ctaH2: "SERVER",
    ctaSub: "Open the dashboard, configure modules for your needs and watch your community thrive.",
    ctaBtn: "Dashboard",
    footerLink: "Go to Dashboard →",
    footerCopy: "Overlord Bot. All rights reserved.",
    caps: [
      { label: "Statistics", desc: "Deep analytics on messages, voice activity, user engagement and server growth — all in real time." },
      { label: "Moderation", desc: "Auto-moderation, anti-spam, raid protection, and a comprehensive audit log to keep your community safe." },
      { label: "Economy", desc: "Custom currency, role shop, rewards and a full-featured economy engine to drive engagement." },
      { label: "Music", desc: "High-quality playback with queue management, search, and seamless voice channel integration." },
      { label: "Tickets", desc: "Structured support system with categories, transcripts, and customizable ticket panels." },
      { label: "Temp Voice", desc: "User-created voice channels with granular permissions, limits, and automatic cleanup." },
    ],
  },
  ru: {
    badge: "Система управления Discord",
    heroSub: "Премиальная платформа для управления вашим Discord сервером. Полный контроль, глубокая аналитика, безграничные возможности.",
    login: "Войти",
    capLabel: "Возможности",
    capH1: "ВСЁ",
    capH2: "ЧТО НУЖНО",
    ctaH1: "УПРАВЛЯЙ",
    ctaH2: "СЕРВЕРОМ",
    ctaSub: "Откройте панель управления, настройте модули под свои нужды и наблюдайте, как ваше сообщество процветает.",
    ctaBtn: "Дашборд",
    footerLink: "В дашборд →",
    footerCopy: "Overlord Bot. Все права защищены.",
    caps: [
      { label: "Статистика", desc: "Глубокая аналитика активности пользователей, сообщений и голосовых каналов в реальном времени." },
      { label: "Модерация", desc: "Автомодерация, защита от спама и рейдов, детальный журнал аудита для безопасности сообщества." },
      { label: "Экономика", desc: "Кастомная валюта, магазин ролей, награды и мощный экономический движок для вовлечения." },
      { label: "Музыка", desc: "Высококачественное воспроизведение с управлением очередью, поиском и интеграцией в голосовые каналы." },
      { label: "Тикеты", desc: "Структурированная система поддержки с категориями, транскриптами и настраиваемыми панелями." },
      { label: "Temp Voice", desc: "Голосовые каналы, создаваемые пользователями, с гибкими разрешениями и автоматической очисткой." },
    ],
  },
} as const;

type Lang = keyof typeof t;
const capIcons = [ChartBar, ShieldCheck, Coins, MusicNote, Ticket, Lightning];

/* ─── Topographic SVG ─────────────────────────── */

function TopoPattern({ color = "#333" }: { color?: string }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 800 600" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <g stroke={color} strokeWidth="1" opacity="0.3">
        <path d="M-50 200 Q100 150 200 200 T400 180 T600 220 T850 170" />
        <path d="M-50 250 Q150 200 250 260 T450 230 T650 280 T850 220" />
        <path d="M-50 300 Q100 350 250 300 T500 320 T700 290 T850 330" />
        <path d="M-50 350 Q200 300 300 370 T550 340 T750 380 T850 350" />
        <path d="M-50 400 Q150 450 300 400 T500 430 T700 390 T850 420" />
        <path d="M-50 150 Q100 100 250 140 T450 120 T650 160 T850 130" />
        <path d="M-50 450 Q100 500 250 460 T500 490 T700 450 T850 470" />
        <path d="M-50 100 Q200  60 350 110 T550  80 T750 120 T850  90" />
        <path d="M-50 500 Q150 540 350 510 T550 540 T750 500 T850 530" />
      </g>
    </svg>
  );
}

/* ─── Page ─────────────────────────────────────── */

export default function Home() {
  const [lang, setLang] = useState<Lang>("ru");
  const tr = t[lang];

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const heroOp = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  return (
    <div className="bg-[#1e1e1e] text-[#e8e8e8] selection:bg-[#8f5eff]/30 overflow-x-hidden">

      {/* ══════════════ NAV ══════════════ */}
      <nav className="fixed top-6 w-full z-50 pointer-events-none">
        <div className="max-w-[1400px] mx-auto px-8 flex items-center justify-between pointer-events-none">
          {/* Logo Block */}
          <div className="flex items-center gap-3 bg-[#141414]/90 backdrop-blur-md border border-white/10 px-5 py-3 rounded-2xl pointer-events-auto shadow-lg">
            <img src="/logos/logo-color.svg" alt="" className="w-8 h-8 object-contain" />
            <span className="font-akony text-[20px] tracking-[.15em] text-white leading-none mt-1">
              OVERLORD
            </span>
          </div>

          {/* Actions Block */}
          <div className="flex items-center gap-4 text-white bg-[#141414]/90 backdrop-blur-md border border-white/10 px-5 py-3 rounded-2xl pointer-events-auto shadow-lg">
            <button
              onClick={() => setLang(lang === "en" ? "ru" : "en")}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-white/50 hover:border-white transition-colors"
              aria-label="Switch language"
            >
              <Globe size={16} weight="bold" />
            </button>
            <Link
              href="/login"
              className="font-futura font-bold text-sm tracking-[.15em] uppercase hover:opacity-70 transition-opacity flex items-center gap-2"
            >
              {tr.login} <ArrowRight size={15} weight="bold" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════════════ HERO ══════════════ */}
      <section ref={heroRef} className="relative h-screen flex items-center overflow-hidden">
        <TopoPattern color="#3a3a3a" />

        {/* Vertical accent line */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 h-32 w-px bg-gradient-to-b from-transparent to-[#75F16A]/60 pointer-events-none" />

        <motion.div
          style={{ y: heroY, opacity: heroOp }}
          className="relative z-10 w-full px-8 md:px-16 max-w-[1400px] mx-auto"
        >
          {/* Badge */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="font-futura text-xs tracking-[.4em] uppercase text-[#75F16A] mb-10"
          >
            {tr.badge}
          </motion.p>

          {/* ── Main title: split-stroke technique ─ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="leading-none select-none"
          >
            {/* Line 1: filled white — left-aligned */}
            <div
              className="font-akony uppercase text-white block"
              style={{ fontSize: "clamp(4rem, 12vw, 10rem)", lineHeight: 0.88, letterSpacing: "-0.01em" }}
            >
              OVER
            </div>

            {/* Line 2: outlined green — right-aligned */}
            <div
              className="font-akony uppercase block text-right"
              style={{
                fontSize: "clamp(4rem, 12vw, 10rem)",
                lineHeight: 0.88,
                letterSpacing: "-0.01em",
                color: "transparent",
                WebkitTextStroke: "2px #75F16A",
                textShadow: "0 0 60px rgba(117,241,106,0.2)",
              }}
            >
              LORD
            </div>
          </motion.div>

          {/* Separator line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
            className="origin-left h-px bg-gradient-to-r from-[#75F16A] via-[#8f5eff] to-transparent mt-10 mb-8"
          />

          {/* Subtitle + CTA — side by side */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8"
          >
            <p className="font-futura text-base md:text-lg text-white/50 max-w-md leading-relaxed">
              {tr.heroSub}
            </p>
            <Link
              href="/login"
              className="bg-[#75F16A] text-[#1e1e1e] font-akony tracking-[.15em] uppercase text-sm px-10 rounded-full hover:scale-105 active:scale-100 transition-transform shadow-[0_0_40px_rgba(117,241,106,.3)] flex-shrink-0 flex items-center gap-2 h-14"
            >
              <span style={{ paddingTop: "3px" }}>{tr.login}</span>
              <SignIn size={18} weight="bold" className="flex-shrink-0" />
            </Link>
          </motion.div>
        </motion.div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#1e1e1e] to-transparent pointer-events-none" />
      </section>

      {/* ══════════════ CAPABILITIES ══════════════ */}
      <section className="relative bg-[#141414] py-32 md:py-44">
        <TopoPattern color="#8f5eff" />

        <div className="relative z-10 max-w-[1400px] mx-auto px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7 }}
            className="mb-20 md:mb-28"
          >
            <p className="font-futura text-xs tracking-[.5em] uppercase text-[#75F16A] mb-4">
              {tr.capLabel}
            </p>
            <h2 className="font-akony text-4xl md:text-6xl lg:text-7xl tracking-tight uppercase leading-[0.9]">
              <span className="text-white">{tr.capH1}</span><br />
              <span
                style={{ color: "transparent", WebkitTextStroke: "1.5px #75F16A" }}
              >{tr.capH2}</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden">
            {tr.caps.map((cap, i) => {
              const Icon = capIcons[i];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.5, delay: i * 0.07 }}
                  className="bg-[#141414] p-10 group hover:bg-[#1a1a1a] transition-colors duration-300"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#75F16A]/10 flex items-center justify-center mb-6 group-hover:bg-[#75F16A]/20 transition-colors">
                    <Icon size={22} weight="duotone" className="text-[#75F16A]" />
                  </div>
                  <h3 className="font-akony text-base tracking-wide uppercase mb-3 text-white">
                    {cap.label}
                  </h3>
                  <p className="font-futura text-white/45 leading-relaxed text-[14px]">
                    {cap.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════ CTA ══════════════ */}
      <section className="relative py-32 md:py-44 overflow-hidden bg-[#1e1e1e]">
        <TopoPattern color="#3a3a3a" />

        <div className="relative z-10 max-w-[1400px] mx-auto px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7 }}
          >
            <h2 className="font-akony text-4xl md:text-6xl lg:text-8xl tracking-tight uppercase leading-[0.85]">
              <span className="text-white">{tr.ctaH1}</span><br />
              <span style={{ color: "transparent", WebkitTextStroke: "2px #9d70ff", textShadow: "0 0 60px rgba(157,112,255,0.2)" }}>
                {tr.ctaH2}
              </span>
            </h2>

            <div className="mt-10 h-px bg-gradient-to-r from-[#9d70ff] via-[#75F16A] to-transparent max-w-xl" />

            <p className="font-futura text-base md:text-lg text-white/45 max-w-xl mt-8 leading-relaxed">
              {tr.ctaSub}
            </p>
            <div className="mt-12">
              <Link
                href="/login"
                className="border border-white/20 bg-white/5 backdrop-blur-sm text-white font-akony tracking-[.12em] uppercase text-sm px-12 rounded-full hover:bg-white/10 hover:scale-105 active:scale-100 transition-all flex items-center gap-2 h-14 w-fit"
              >
                <span style={{ paddingTop: "3px" }}>{tr.ctaBtn}</span>
                <ArrowRight size={18} weight="bold" className="flex-shrink-0" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="relative bg-[#141414] overflow-hidden">
        <TopoPattern color="#8f5eff" />

        {/* wave divider */}
        <div className="absolute -top-1 left-0 w-full overflow-hidden leading-none pointer-events-none">
          <svg viewBox="0 0 1200 60" preserveAspectRatio="none" className="w-full h-12 md:h-16">
            <path d="M0 60 V20 Q300 0 600 20 T1200 20 V60 Z" fill="#1e1e1e" />
          </svg>
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-8 pt-32 pb-12">
          <div className="flex flex-col items-center text-center mb-20">
            <img src="/logos/logo-white.svg" alt="Overlord" className="w-16 h-16 object-contain mb-6 opacity-60" />
            <span
              className="font-akony text-5xl md:text-7xl tracking-[.1em] uppercase leading-none"
              style={{ color: "transparent", WebkitTextStroke: "1px rgba(117,241,106,0.6)" }}
            >
              OVERLORD
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-t border-white/10 pt-8">
            <p className="font-futura text-sm text-white/40 tracking-wide">
              © {new Date().getFullYear()} {tr.footerCopy}
            </p>
            <Link
              href="/login"
              className="font-futura font-bold text-sm tracking-[.15em] uppercase text-[#75F16A] hover:opacity-70 transition-opacity"
            >
              {tr.footerLink}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
