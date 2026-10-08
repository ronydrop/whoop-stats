"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Activity } from "lucide-react";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { SyncButton } from "./SyncButton";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/sign-in") || pathname === "/acesso-negado") return children;
  return <>
    <div className="flex min-h-screen">
      <Suspense><Sidebar /></Suspense>
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <div className="app-topbar">
          <div className="topbar-title"><Activity className="h-5 w-5 text-accent-hover" /> Seu ritmo, em perspectiva</div>
          <div className="flex items-center gap-4"><SyncButton /><UserButton /></div>
        </div>
        {children}
      </main>
    </div>
    <Suspense><MobileNav /></Suspense>
  </>;
}
