import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { ensureStatsAutoSyncStarted } from '@/lib/statsAutoSync';

const futura = localFont({
  src: [
    { path: "../../fonts/FuturaCyrillicBook.ttf", weight: "400", style: "normal" },
    { path: "../../fonts/FuturaCyrillicMedium.ttf", weight: "500", style: "normal" },
    { path: "../../fonts/FuturaCyrillicDemi.ttf", weight: "600", style: "normal" },
    { path: "../../fonts/FuturaCyrillicBold.ttf", weight: "700", style: "normal" },
    { path: "../../fonts/FuturaCyrillicExtraBold.ttf", weight: "800", style: "normal" },
    { path: "../../fonts/FuturaCyrillicHeavy.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-futura",
  display: "swap",
});

const akony = localFont({
  src: "../../fonts/AKONY.ttf",
  variable: "--font-akony",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Overlord - Command Center",
  description: "Premium Discord operations surface for moderation, analytics, tickets, and voice systems.",
  icons: { icon: "/logos/logo-color.svg" },
};

const devChunkCacheBustScript = `
(function () {
  var version = "tour-mobile-gap-20260710-3";
  var key = "overlord-dev-cache-bust";
  try {
    if (window.localStorage.getItem(key) === version) return;
    window.localStorage.setItem(key, version);
    window.addEventListener("load", function () {
      var scripts = Array.prototype.slice.call(document.scripts)
        .map(function (script) { return script.src; })
        .filter(function (src) { return src.indexOf("/_next/static/chunks/") !== -1; });
      Promise.allSettled(scripts.map(function (src) {
        return fetch(src, { cache: "reload" });
      })).finally(function () {
        window.location.reload();
      });
    });
  } catch {
    window.location.reload();
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  ensureStatsAutoSyncStarted();

  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <body className={`${futura.variable} ${akony.variable} font-sans bg-[#1a1a1a] text-[#e5e5e5]`}>
        {process.env.NODE_ENV !== "production" ? (
          <script dangerouslySetInnerHTML={{ __html: devChunkCacheBustScript }} />
        ) : null}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
