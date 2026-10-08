"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, HeartPulse, Moon, Flame, Dumbbell, Activity, ShieldCheck, NotebookPen, TrendingUp, Radio } from "lucide-react";

const items = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/recovery", label: "Recuperação", icon: HeartPulse },
  { href: "/sleep", label: "Sono", icon: Moon },
  { href: "/strain", label: "Esforço", icon: Flame },
  { href: "/stress", label: "Estresse", icon: Activity },
  { href: "/workouts", label: "Treinos", icon: Dumbbell },
  { href: "/journal", label: "Diário", icon: NotebookPen },
  { href: "/fitness", label: "Condicionamento", icon: TrendingUp },
  { href: "/live", label: "Ao vivo", icon: Radio },
];
export function Sidebar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const selection = new URLSearchParams();
  for (const key of ["start", "end", "first", "compare"]) { const value = search.get(key); if (value) selection.set(key, value); }
  return <aside className="hidden md:flex sticky top-0 h-screen w-[112px] shrink-0 flex-col items-center border-r border-border-subtle bg-[#141414] py-6 z-30">
    <div className="flex flex-col items-center gap-2 mb-10" aria-label="WHOOP pessoal"><div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-white"><Activity className="size-6" /></div><span className="text-[10px] font-semibold tracking-[.18em]">WHOOP</span></div>
    <nav aria-label="Navegação principal" className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-y-auto px-3 [color-scheme:dark] [scrollbar-width:thin]">{items.map(item => <Link key={item.href} href={`${item.href}${selection.size ? `?${selection}` : ""}`} aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined} className="flex shrink-0 flex-col items-center gap-2 rounded-2xl py-3 text-text-muted transition-colors hover:bg-surface-1 hover:text-text-primary aria-[current=page]:bg-accent-muted aria-[current=page]:text-accent-hover"><item.icon className="size-5" /><span className="text-[10px] font-medium">{item.label}</span></Link>)}</nav>
    <div className="flex flex-col items-center gap-2 text-text-muted"><ShieldCheck className="size-4" /><span className="text-[9px]">Pessoal · Local</span></div>
  </aside>;
}
