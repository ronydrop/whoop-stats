"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";

export function useChartTooltip<T>() {
  const id = useId();
  const [active, setActive] = useState<{ key: string; data: T; anchor: Element; pinned: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const keep = () => { if (timer.current) clearTimeout(timer.current); };
  const close = () => { keep(); setActive(null); };
  const leave = () => { keep(); timer.current = setTimeout(() => setActive(current => current?.pinned ? current : null), 150); };

  useEffect(() => {
    if (!active) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !active.anchor.contains(event.target) && !popup.current?.contains(event.target)) setActive(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setActive(null); };
    const hide = () => setActive(null);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [active]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const bind = (key: string, data: T) => {
    const open = (event: SyntheticEvent<Element>, pinned = false) => {
      keep();
      setActive({ key, data, anchor: event.currentTarget, pinned });
    };
    return {
      role: "button", tabIndex: 0,
      "aria-describedby": active?.key === key ? id : undefined,
      onPointerEnter: (event: React.PointerEvent<Element>) => { if (event.pointerType !== "touch") open(event); },
      onPointerLeave: leave,
      onFocus: (event: React.FocusEvent<Element>) => open(event),
      onBlur: close,
      onClick: (event: React.MouseEvent<Element>) => { event.stopPropagation(); open(event, true); },
      onKeyDown: (event: React.KeyboardEvent<Element>) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); open(event, true); }
        if (event.key === "Escape") { event.stopPropagation(); close(); }
      },
    };
  };
  return { id, active, popup, bind, keep, leave };
}

export function ChartTooltip<T>({ tooltip, children }: { tooltip: ReturnType<typeof useChartTooltip<T>>; children: ReactNode }) {
  const { active, popup, id, keep, leave } = tooltip;
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!active || !popup.current) return;
    const anchor = active.anchor.getBoundingClientRect();
    const box = popup.current.getBoundingClientRect();
    const left = Math.max(12, Math.min(anchor.left + anchor.width / 2 - box.width / 2, window.innerWidth - box.width - 12));
    const above = anchor.top - box.height - 12;
    const top = Math.max(12, Math.min(above >= 12 ? above : anchor.bottom + 12, window.innerHeight - box.height - 12));
    setPosition({ left, top });
  }, [active, popup]);
  if (!active) return null;
  return createPortal(<div ref={popup} id={id} role="tooltip" className="chart-tooltip" style={position} onPointerEnter={keep} onPointerLeave={leave}>{children}</div>, document.body);
}
