import Image from "next/image";

interface FooterProps {
  copy: string;
}

export function Footer({ copy }: FooterProps) {
  return (
    <footer className="relative z-10 border-t border-[var(--landing-line)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--landing-line)] bg-[rgba(255,255,255,0.02)]">
            <Image src="/logos/logo-white.svg" alt="Overlord" width={22} height={22} className="h-5 w-5 opacity-85" />
          </div>

          <div className="min-w-0">
            <div className="font-akony text-[0.95rem] tracking-[0.24em] text-[var(--landing-text)]">OVERLORD</div>
            <div className="truncate text-[0.6rem] uppercase tracking-[0.3em] text-[var(--landing-soft)]">Command Center</div>
          </div>
        </div>

        <div className="text-[0.66rem] font-bold uppercase leading-[1.6] tracking-[0.2em] text-[var(--landing-soft)]">
          {new Date().getFullYear()} / {copy}
        </div>
      </div>
    </footer>
  );
}
