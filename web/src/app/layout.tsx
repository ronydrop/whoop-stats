import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { DashboardShell } from "@/components/dashboard-shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "WHOOP Metrics",
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
        <ClerkProvider localization={ptBR} signInUrl="/sign-in" afterSignOutUrl="/">
          <DashboardShell>{children}</DashboardShell>
          <Toaster theme="dark" position="bottom-right" containerAriaLabel="Notificações" />
        </ClerkProvider>
      </body>
    </html>
  );
}
