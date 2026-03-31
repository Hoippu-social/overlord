"use client";

import { ArrowLeft, ArrowUpRight } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Footer } from "@/components/landing/Footer";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handlePasswordLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        window.location.assign("/dashboard");
        return;
      }

      setErrorMessage("Неверный пароль администратора.");
    } catch {
      setErrorMessage("Не удалось выполнить вход.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-shell min-h-screen text-[var(--landing-text)]">
      <div className="mx-auto flex min-h-screen max-w-[1480px] flex-col px-4 pt-3 sm:px-6 sm:pt-4 lg:px-10">
        <header className="relative z-10 flex items-center justify-between gap-4 rounded-full border border-[var(--landing-line)] bg-[rgba(8,10,13,0.82)] px-4 py-3 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.03)]">
              <Image src="/logos/logo-white.svg" alt="Overlord" width={24} height={24} className="h-6 w-6 opacity-90" priority />
            </div>
            <div className="min-w-0">
              <div className="font-akony text-[0.88rem] tracking-[0.26em] text-[var(--landing-text)] sm:text-[1rem]">OVERLORD</div>
              <div className="text-[0.6rem] uppercase tracking-[0.34em] text-[var(--landing-soft)]">Command Center</div>
            </div>
          </Link>

          <Link href="/" className="landing-inline-link">
            <ArrowLeft size={14} weight="bold" />
            На главную
          </Link>
        </header>

        <main className="relative flex flex-1 items-center py-10 sm:py-14 lg:py-16">
          <div className="pointer-events-none absolute left-[8%] top-[16%] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(117,241,106,0.08),transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute right-[8%] top-[24%] h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(143,94,255,0.08),transparent_70%)] blur-3xl" />

          <div className="relative grid w-full gap-12 lg:grid-cols-[minmax(0,0.6fr)_minmax(320px,0.4fr)] lg:gap-16">
            <section className="min-w-0 max-w-[34rem]">
              <p className="landing-kicker">Admin Access</p>
              <h1 className="landing-balance mt-5 max-w-[10ch] text-[clamp(2.1rem,5.8vw,4.8rem)] font-semibold uppercase leading-[0.96] tracking-[0.05em] text-[var(--landing-text)]">
                Вход в Command Center.
              </h1>
              <p className="mt-7 max-w-[30rem] text-base leading-[1.9] text-[var(--landing-muted)] sm:text-lg">
                Один пароль. Один вход. Без лишних экранов и отвлекающего chrome. После авторизации панель сразу переводит в рабочую зону.
              </p>

              <div className="mt-10 border-t border-[var(--landing-line)]">
                {[
                  "Прямой доступ к dashboard",
                  "Та же продуктовая палитра и ритм",
                  "Мобильный сценарий без лишних шагов",
                ].map((item, index) => (
                  <div key={item} className="grid gap-2 border-b border-[var(--landing-line)] py-4 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-4">
                    <div className="tabular text-[0.9rem] font-semibold uppercase tracking-[0.18em] text-[var(--landing-accent)]">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="text-[0.7rem] uppercase leading-[1.7] tracking-[0.24em] text-[var(--landing-soft)]">{item}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="landing-panel min-w-0 rounded-[2rem] px-5 py-6 sm:px-7 sm:py-7">
              <div className="border-b border-[var(--landing-line)] pb-5">
                <p className="text-[0.72rem] uppercase tracking-[0.34em] text-[var(--landing-accent)]">Secure Entry</p>
                <h2 className="mt-4 text-[1.3rem] font-semibold uppercase tracking-[0.16em] text-[var(--landing-text)] sm:text-[1.55rem]">
                  Администратор
                </h2>
                <p className="mt-3 text-sm leading-[1.8] text-[var(--landing-muted)] sm:text-[0.98rem]">
                  Используйте пароль администратора, чтобы открыть внутреннюю панель без промежуточных экранов.
                </p>
              </div>

              <form onSubmit={handlePasswordLogin} className="mt-6 space-y-5">
                <div className="space-y-3">
                  <label htmlFor="password" className="block text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-[var(--landing-soft)]">
                    Пароль
                  </label>
                  <input
                    id="password"
                    type="password"
                    className="landing-auth-input"
                    placeholder="Введите пароль"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>

                {errorMessage ? (
                  <div className="rounded-[1.25rem] border border-[rgba(244,63,94,0.22)] bg-[rgba(244,63,94,0.08)] px-4 py-3 text-sm leading-[1.7] text-[rgb(255,196,207)]">
                    {errorMessage}
                  </div>
                ) : null}

                <button type="submit" disabled={loading} className="landing-button-primary w-full disabled:cursor-not-allowed disabled:opacity-70">
                  {loading ? "Проверка..." : "Войти"}
                  <ArrowUpRight size={16} weight="bold" />
                </button>
              </form>
            </section>
          </div>
        </main>

        <Footer copy="Precision for communities." />
      </div>
    </div>
  );
}
