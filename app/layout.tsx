import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { AppHeader } from "@/components/layout/app-header";
import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { DueDateBanner } from "@/components/layout/due-date-banner";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dedeağalar Grup",
  description: "Dedeağalar Grup ticaret uygulaması",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dedeağalar",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#166534",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Providers>
          <OfflineBanner />
          <AppHeader />
          <DueDateBanner />
          <main className="pb-20">{children}</main>
          <BottomTabBar />
          <KeyboardShortcuts />
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
