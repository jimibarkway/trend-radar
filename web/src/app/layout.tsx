import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trend Radar - finds AI topics before mainstream",
  description:
    "Six signal sources. Velocity-scored, not popularity. Surfaces hidden AI and agentic-workflow gems before they hit mainstream feeds. Built for Jack Roberts' Trend Finder competition, May 2026.",
  metadataBase: new URL("https://trendradar.jimibarkway.com"),
  openGraph: {
    title: "Trend Radar",
    description:
      "Finds AI topics before they hit mainstream. Six sources. Velocity-scored.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
