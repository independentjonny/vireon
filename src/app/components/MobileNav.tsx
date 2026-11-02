"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { workspaceNavigation, selectedWorkspaceHref } from "@/lib/workspaceNavigation";

export default function MobileNav({ developerMode = false }: { developerMode?: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const selected = selectedWorkspaceHref(pathname);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const triggerElement = trigger.current;
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(drawer.current?.querySelectorAll<HTMLElement>("a[href], button, summary") ?? []).filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); triggerElement?.focus(); };
  }, [open]);

  return <>
    <button ref={trigger} type="button" aria-label="Open navigation menu" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(true)} className={`workspace-menu-trigger lg:hidden ${open ? "invisible" : ""}`}><Menu size={23} aria-hidden="true" /></button>
    {open && <div className="workspace-mobile-overlay lg:hidden">
      <button type="button" className="workspace-mobile-backdrop" aria-label="Close navigation backdrop" onClick={() => setOpen(false)} />
      <aside ref={drawer} id="mobile-navigation" role="dialog" aria-modal="true" aria-label="Navigation" className="fixed inset-y-0 right-0 workspace-mobile-drawer">
        <header><div><strong>vireon</strong><p>Your financial workspace</p></div><button type="button" aria-label="Close navigation menu" onClick={() => setOpen(false)}><X size={22} aria-hidden="true" /></button></header>
        <nav aria-label="Mobile navigation">{workspaceNavigation.map(group => <details className="workspace-nav-group" key={group.id} open={group.items.some(item => item.href === selected)}>
          <summary><span>{group.label}</span><ChevronDown size={16} aria-hidden="true" /></summary>
          <div>{group.items.map(item => <Link key={item.href} href={item.href} aria-current={selected === item.href ? "page" : undefined} onClick={() => setOpen(false)}>{item.label}</Link>)}</div>
        </details>)}
          <div className="workspace-nav-footer"><Link href="/settings" onClick={() => setOpen(false)}>Settings & privacy</Link>{developerMode && <Link href="/status" onClick={() => setOpen(false)}>Developer runtime</Link>}</div>
        </nav>
      </aside>
    </div>}
  </>;
}
