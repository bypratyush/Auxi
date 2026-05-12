import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-typewriter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AUXI · Usability Auditor",
  description: "Audit any website. Ask it questions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={plexMono.variable}>{children}</body>
    </html>
  );
}
