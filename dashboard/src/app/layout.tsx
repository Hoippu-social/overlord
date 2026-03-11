import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

const outfit = Outfit({ subsets: ["latin"], variable: '--font-outfit' });

const akony = localFont({
  src: '../fonts/AKONY.ttf',
  variable: '--font-akony',
  display: 'swap',
});

const futura = localFont({
  src: [
    { path: '../fonts/FuturaCyrillicLight.ttf', weight: '300', style: 'normal' },
    { path: '../fonts/FuturaCyrillicBook.ttf', weight: '400', style: 'normal' },
    { path: '../fonts/FuturaCyrillicMedium.ttf', weight: '500', style: 'normal' },
    { path: '../fonts/FuturaCyrillicDemi.ttf', weight: '600', style: 'normal' },
    { path: '../fonts/FuturaCyrillicBold.ttf', weight: '700', style: 'normal' },
    { path: '../fonts/FuturaCyrillicExtraBold.ttf', weight: '800', style: 'normal' },
    { path: '../fonts/FuturaCyrillicHeavy.ttf', weight: '900', style: 'normal' },
  ],
  variable: '--font-futura',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Discord Bot Dashboard",
  description: "Advanced Discord Bot Management",
  icons: {
    icon: "/icon-default.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${outfit.variable} ${akony.variable} ${futura.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
