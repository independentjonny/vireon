"use client";
import { useState } from "react";
import type { ReactNode } from "react";

export default function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  id,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  id?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={id}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 border-b border-white/[0.06] pb-3 group"
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <h3 className="text-base font-semibold shrink-0">{title}</h3>
          {subtitle && (
            <span className="text-xs text-white/35 truncate hidden sm:block">{subtitle}</span>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1.5 text-[10px] text-white/20 group-hover:text-white/50 transition font-mono">
          <span>{open ? "collapse" : "expand"}</span>
          <span
            className="text-xs transition-transform duration-200"
            style={{ display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ▾
          </span>
        </div>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
