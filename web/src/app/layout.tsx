import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SyncButton } from "@/components/SyncButton";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { Activity } from "lucide-react";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "WHOOP em Português",
  description:
    "Acompanhe seu esforço, recuperação, sono e treinos em português brasileiro.",
};

export const viewport: Viewport = {
  themeColor: "#0D0D0D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body
        className={`${inter.variable} font-sans min-h-screen bg-background text-text-primary selection:bg-accent/20`}
      >
        <div className="flex min-h-screen">
          <Suspense><Sidebar /></Suspense>
          <main className="flex-1 min-w-0 pb-20 md:pb-0">
            <div className="app-topbar"><div className="topbar-title"><Activity className="h-5 w-5 text-accent-hover" /> Seu ritmo, em perspectiva</div><SyncButton /></div>
            {children}
          </main>
        </div>
        <Suspense><MobileNav /></Suspense>
        <Toaster theme="dark" position="bottom-right" containerAriaLabel="Notificações" />
      </body>
    </html>
  );
}
