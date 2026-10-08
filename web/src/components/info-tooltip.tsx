"use client";

import { useId, useState } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { Info } from "lucide-react";

export function InfoTooltip({ title, description }: { title: string; description: string }) {
  const triggerId = useId();
  const descriptionId = `${triggerId}-description`;
  const [open, setOpen] = useState(false);

  return <Tooltip.Root open={open} triggerId={triggerId} onOpenChange={(next, details) => {
    if (details.reason === "trigger-press") { details.cancel(); return; }
    setOpen(next);
  }}>
    <Tooltip.Trigger
      id={triggerId}
      type="button"
      delay={200}
      aria-label={`Sobre ${title}`}
      aria-describedby={open ? descriptionId : undefined}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-hover"
      onClick={event => { event.stopPropagation(); setOpen(true); }}
      onKeyDown={event => { if (event.key === "Enter" || event.key === " ") event.stopPropagation(); }}
    ><Info className="size-3.5" aria-hidden="true" /></Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner side="top" align="start" sideOffset={8} collisionPadding={16} className="z-50">
        <Tooltip.Popup id={descriptionId} role="tooltip" className="max-w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-border-default bg-surface-1 px-3 py-2.5 text-xs leading-relaxed text-text-primary shadow-xl">
          {description}
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>;
}
