"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

const NAV_ITEMS = [
  ["Overview", "#overview"],
  ["Transactions", "#transactions"],
  ["Subscriptions", "#subscriptions"],
  ["Financial Intelligence", "#financial-intelligence"],
  ["AI Copilot", "#ai-copilot"],
  ["Analytics", "#analytics"],
  ["Roadmap", "#roadmap"],
  ["Telemetry", "#telemetry"],
  ["Deployment", "#deployment"],
  ["Remote Control", "#remote-control"],
  ["Build Automation", "#build-automation"],
  ["Architecture Governance", "#architecture-governance"],
  ["Settings", "#settings"],
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            return;
          }
          setOpen((v) => !v);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          if (!open) {
            suppressNextClickRef.current = true;
            setOpen(true);
          }
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.pointerType !== "mouse" && !open) {
            suppressNextClickRef.current = true;
            setOpen(true);
          }
        }}
        className={[
          "fixed right-4 top-4 z-[2147483647] flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-[#07111f] text-white shadow-2xl transition-opacity lg:hidden [&>span]:hidden",
          open ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100",
        ].join(" ")}
        style={{
          pointerEvents: open ? "none" : "auto",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <Menu aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
        <span className="text-2xl leading-none">☰</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[2147483645] bg-black/70 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-y-0 left-0 w-[calc(100%-min(20rem,86vw))] cursor-default"
            onClick={() => setOpen(false)}
          />
        </div>
      )}

      <aside
        className={[
          "fixed inset-y-0 right-0 z-[2147483646] w-80 max-w-[86vw] border-l border-white/10 bg-[#07111f] shadow-2xl transition-transform duration-300 lg:hidden",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        style={{ pointerEvents: open ? "auto" : "none" }}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div>
            <div className="text-lg font-bold text-white">Neven</div>
            <div className="text-xs text-white/40">Autonomous financial OS</div>
          </div>

          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[0] text-white"
          >
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
            ✕
          </button>
        </div>

        <nav className="h-[calc(100vh-82px)] overflow-y-auto p-3">
          {NAV_ITEMS.map(([label, href], i) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={[
                "flex min-h-12 items-center rounded-xl px-4 text-sm",
                i === 0
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "text-white/70 hover:bg-white/[0.06] hover:text-white",
              ].join(" ")}
            >
              {label}
            </a>
          ))}
        </nav>
      </aside>
    </>
  );
}
