"use client";

import { ArrowSquareOut, DiscordLogo, SignOut, SquaresFour, UserCircle } from "@phosphor-icons/react";
import { Avatar, Popover, PopoverContent, PopoverTrigger } from "@nextui-org/react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getBrowserPublicHost, getDashboardHomePath } from "@/lib/publicDashboard";
import type { Language } from "@/locales/landing";

type LandingSessionStatus = {
  authenticated: boolean;
  localOnly: boolean;
  user: {
    id: string | null;
    name: string | null;
    image: string | null;
  } | null;
};

type LandingUserMenuProps = {
  language: Language;
  children: ReactNode;
  className?: string;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
};

const strings = {
  ru: {
    profile: "\u041c\u043e\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c",
    dashboard: "\u041f\u0430\u043d\u0435\u043b\u044c \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f",
    support: "\u0421\u0435\u0440\u0432\u0435\u0440 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0438",
    logout: "\u0412\u044b\u0439\u0442\u0438",
    account: "\u0410\u0434\u043c\u0438\u043d",
    avatar: "\u041c\u0435\u043d\u044e \u043f\u0440\u043e\u0444\u0438\u043b\u044f",
  },
  en: {
    profile: "My profile",
    dashboard: "Dashboard",
    support: "Support server",
    logout: "Log out",
    account: "Admin",
    avatar: "Profile menu",
  },
} as const;

const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_SERVER_URL || "https://discord.gg/overlord";
const subscribeToBrowserHost = () => () => undefined;

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function LandingUserMenu({ language, children, className = "", variant = "desktop", onNavigate }: LandingUserMenuProps) {
  const { data: session, status } = useSession();
  const [sessionStatus, setSessionStatus] = useState<LandingSessionStatus | null>(null);
  const [open, setOpen] = useState(false);
  const browserHost = useSyncExternalStore(subscribeToBrowserHost, getBrowserPublicHost, () => null);
  const dashboardPath = useMemo(() => getDashboardHomePath(browserHost), [browserHost]);

  useEffect(() => {
    let active = true;

    const loadStatus = async () => {
      try {
        const response = await fetch("/api/session-status", {
          cache: "no-store",
          credentials: "include",
        });
        if (!response.ok) {
          if (active) {
            setSessionStatus({ authenticated: false, localOnly: false, user: null });
          }
          return;
        }

        const data = (await response.json()) as LandingSessionStatus;
        if (active) {
          setSessionStatus(data);
        }
      } catch {
        if (active) {
          setSessionStatus({ authenticated: false, localOnly: false, user: null });
        }
      }
    };

    void loadStatus();

    return () => {
      active = false;
    };
  }, []);

  const checking = sessionStatus === null || status === "loading";
  const authenticated = status === "authenticated" || sessionStatus?.authenticated === true;
  const text = strings[language];

  const user = useMemo(() => {
    const sessionUser = session?.user as { id?: string; name?: string | null; image?: string | null } | undefined;
    const statusUser = sessionStatus?.user;
    const name = sessionUser?.name?.trim() || statusUser?.name?.trim() || text.account;
    const image = sessionUser?.image?.trim() || statusUser?.image?.trim() || undefined;
    const id = sessionUser?.id || statusUser?.id || null;

    return { id, name, image };
  }, [session?.user, sessionStatus?.user, text.account]);

  const handleLogout = async () => {
    setOpen(false);
    await fetch("/api/logout", { method: "POST" }).catch(() => null);
    await signOut({ redirect: false }).catch(() => null);
    window.location.assign("/");
  };

  if (checking) {
    return variant === "mobile" ? (
      <div className="h-12 w-full rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.03)]" />
    ) : (
      <div className={`${className} h-11 w-11 rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.06)]`} />
    );
  }

  if (!authenticated) {
    return <>{children}</>;
  }

  const avatar = (
    <Avatar
      src={user.image}
      name={getInitials(user.name)}
      showFallback
      className="h-full w-full rounded-full border border-[rgba(255,255,255,0.18)] bg-[var(--surface-hover)] text-[0.72rem] font-bold text-white"
      imgProps={{ referrerPolicy: "no-referrer" }}
    />
  );

  const profileHref = user.id ? `https://discord.com/users/${user.id}` : dashboardPath;

  const items = (
    <div className="w-full p-2">
      <MenuLink href={profileHref} external={Boolean(user.id)} icon={<UserCircle size={21} />} label={text.profile} onNavigate={onNavigate} />
      <MenuLink href={dashboardPath} icon={<SquaresFour size={21} />} label={text.dashboard} onNavigate={onNavigate} />
      <MenuLink href={supportUrl} external icon={<DiscordLogo size={21} />} label={text.support} onNavigate={onNavigate} />
      <button
        type="button"
        onClick={handleLogout}
        className="mt-2 flex min-h-11 w-full items-center gap-4 rounded-md px-3 text-left text-sm font-medium text-[var(--color-destructive)] transition-colors hover:bg-white/[0.04]"
      >
        <SignOut size={21} />
        <span>{text.logout}</span>
      </button>
    </div>
  );

  if (variant === "mobile") {
    return (
      <div className="rounded-[0.9rem] border border-[var(--landing-line)] bg-[rgba(17,17,17,0.94)] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="flex items-center gap-3 border-b border-[var(--landing-line)] p-3">
          <div className="h-10 w-10 shrink-0 rounded-full">{avatar}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-[var(--landing-text)]">{user.name}</div>
            <div className="mt-0.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[var(--landing-soft)]">Overlord</div>
          </div>
        </div>
        {items}
      </div>
    );
  }

  return (
    <Popover placement="bottom-end" offset={12} isOpen={open} onOpenChange={setOpen} triggerScaleOnOpen={false}>
      <PopoverTrigger>
        <button
          type="button"
          aria-label={text.avatar}
          className={`${className} h-11 w-11 items-center justify-center rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.04)] p-[3px] shadow-[0_14px_34px_rgba(0,0,0,0.28)] transition-transform hover:-translate-y-0.5 hover:border-[rgba(117,241,106,0.28)]`}
        >
          {avatar}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[230px] rounded-[10px] border border-[var(--landing-line)] bg-[rgba(18,18,18,0.98)] p-0 shadow-[0_24px_70px_rgba(0,0,0,0.44)] backdrop-blur-xl">
        {items}
      </PopoverContent>
    </Popover>
  );
}

function MenuLink({
  href,
  icon,
  label,
  external = false,
  onNavigate,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  external?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      onClick={onNavigate}
      className="flex min-h-11 w-full items-center gap-4 rounded-md px-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/[0.04] hover:text-white"
    >
      <span className="text-white/90">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {external ? <ArrowSquareOut size={14} className="text-white/35" /> : null}
    </Link>
  );
}
