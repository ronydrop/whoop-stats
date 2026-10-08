"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { X } from "lucide-react";

interface DetailPopupProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function DetailPopup({ title, children, onClose }: DetailPopupProps) {
  const modal = useModalFocus(onClose);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-border-subtle bg-surface-0/95 backdrop-blur-xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Fechar detalhes"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <h3 className="text-lg font-semibold text-text-primary mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function useModalFocus(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = ref.current;
    panel?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]')];
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return ref;
}

/** Simple row for detail popups */
export function DetailRow({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border-subtle/30 last:border-0">
      <div className="min-w-0">
        <span className="text-sm text-text-secondary">{label}</span>
        {hint && <p className="text-[10px] text-text-muted mt-0.5">{hint}</p>}
      </div>
      <span className="shrink-0 max-w-[45%] text-right text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

/** Hook to manage popup state */
export function useDetailPopup() {
  const [popup, setPopup] = useState<string | null>(null);
  return { popup, open: setPopup, close: () => setPopup(null) };
}
