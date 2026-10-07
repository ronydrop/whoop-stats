import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "WHOOP em Português",
  description:
    "Acompanhe seu esforço, recuperação, sono e treinos em português brasileiro.",
};

export const viewport: Viewport = {
  themeColor: "#09090B",
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
          <Sidebar />
          <main className="flex-1 min-w-0 pb-20 md:pb-0">
            {children}
          </main>
        </div>
        <MobileNav />
        <Toaster theme="dark" position="bottom-right" containerAriaLabel="Notificações" />
      </body>
    </html>
  );
}
