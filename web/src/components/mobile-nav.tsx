"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, HeartPulse, Moon, Flame, Dumbbell, Activity } from "lucide-react";

const tabs = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/recovery", label: "Recuperação", icon: HeartPulse },
  { href: "/sleep", label: "Sono", icon: Moon },
  { href: "/strain", label: "Esforço", icon: Flame },
  { href: "/stress", label: "Estresse", icon: Activity },
  { href: "/workouts", label: "Treinos", icon: Dumbbell },
];

export function MobileNav() {
  const pathname = usePathname();
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => { navigation.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" }); }, [pathname]);
  const search = useSearchParams();
  const period = new URLSearchParams();
  for (const key of ["start", "end", "first", "compare"]) { const value = search.get(key); if (value) period.set(key, value); }

  return (
    <nav ref={navigation} aria-label="Navegação principal móvel" className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-surface-0/90 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-1 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={period.size ? `${tab.href}?${period}` : tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex shrink-0 flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors min-w-[68px]",
                isActive ? "text-accent-hover" : "text-text-tertiary"
              )}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
