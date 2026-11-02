"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import MobileNav from "./MobileNav";
import { workspaceNavigation, selectedWorkspaceHref } from "@/lib/workspaceNavigation";
import {
  ChevronDown,
  BarChart3,
  Bell,
  Bot,
  BrainCircuit,
  Building2,
  Code2,
  Gauge,
  Goal,
  Landmark,
  LayoutDashboard,
  Lock,
  Network,
  Scale,
  Search,
  ShieldCheck,
  TerminalSquare,
  UploadCloud,
  WalletCards,
} from "lucide-react";

type ActiveSection = "dashboard" | "financial-position" | "financial-data" | "financial-vault" | "housing-scenarios" | "digital-twin" | "ai-cfo" | "settings" | "workspace";

const groupIcons = { dashboard: LayoutDashboard, money: WalletCards, planning: Goal, adviser: Bot, documents: ShieldCheck };

const developerItems = [
  ["Build Automation", "/#build-automation", TerminalSquare],
  ["Deployment", "/#deployment", UploadCloud],
  ["Production Readiness", "/production-readiness", ShieldCheck],
  ["Autonomous Operations", "/autonomous-operations", BrainCircuit],
  ["Model Orchestrator", "/model-orchestrator", Network],
  ["Model Evaluation", "/model-evaluation", Scale],
  ["Runtime", "/status", Gauge],
  ["Architecture Governance", "/#architecture-governance", Building2],
  ["Supervisor Inbox", "/#supervisor-inbox", Bell],
  ["Remote Control", "/#remote-control", Landmark],
  ["Telemetry", "/#telemetry", BarChart3],
  ["Roadmap", "/#roadmap", Search],
] as const;

const developerModeStorageKey = "vireon-developer-mode";
const developerModeChangeEvent = "vireon-developer-mode-change";

function readDeveloperMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(developerModeStorageKey) === "true";
}

function subscribeDeveloperMode(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(developerModeChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(developerModeChangeEvent, onChange);
  };
}

function RuntimeBanner() {
  return (
    <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/82 px-4 py-2 pr-20 text-xs text-slate-500 backdrop-blur-xl lg:hidden">
      <span className="flex min-w-0 items-center gap-2 font-medium">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        <span className="min-w-0 truncate">Your financial workspace</span>
      </span>
    </div>
  );
}

function Sidebar({
  developerMode,
  setDeveloperMode,
  pathname,
}: {
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
  pathname: string;
}) {
  return (
    <aside className="hidden w-[268px] shrink-0 bg-[#10243b] px-5 py-7 text-white lg:fixed lg:left-0 lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto">
      <Link href="/" className="flex items-center gap-3 px-1">
        <div className="relative h-12 w-12 shrink-0" aria-hidden="true">
          <Image src="/vireon2-white.png" alt="" fill sizes="48px" className="object-contain" priority />
        </div>
        <span className="text-2xl font-semibold tracking-normal">vireon</span>
      </Link>

      <nav className="mt-8 flex-1 space-y-2" aria-label="Primary navigation">
        {workspaceNavigation.map((group) => {
          const Icon = groupIcons[group.id];
          const selected = selectedWorkspaceHref(pathname);
          const current = group.items.some(item => item.href === selected);
          if (group.id === "dashboard") return <Link key={group.id} href={group.items[0].href} className="workspace-nav-direct" aria-current={current ? "page" : undefined}><Icon size={19} aria-hidden="true" /><span>{group.label}</span></Link>;
          return <details className="workspace-nav-group" key={group.id + pathname} open={current}>
            <summary><Icon size={19} aria-hidden="true" /><span>{group.label}</span><ChevronDown size={16} aria-hidden="true" /></summary>
            <div>{group.items.map(item => <Link key={item.href} href={item.href} aria-current={selected === item.href ? "page" : undefined}>{item.label}</Link>)}</div>
          </details>;
        })}

        {developerMode && (
          <section>
            <div className="mb-2 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-200">
              <Code2 className="h-3.5 w-3.5" />
              Developer Mode
            </div>
            <div className="space-y-1">
              {developerItems.map(([label, href, Icon]) => (
                <Link key={`${label}-${href}`} href={href} className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.07] hover:text-white">
                  <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
                  {label}
                </Link>
              ))}
            </div>
          </section>
        )}
      </nav>

      <div className="workspace-nav-footer"><Link href="/settings" aria-current={pathname === "/settings" ? "page" : undefined}><Lock size={17} aria-hidden="true" />Settings & privacy</Link></div>
      {developerMode && <><label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-slate-200">
        <span className="inline-flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Developer Mode
        </span>
        <input
          type="checkbox"
          checked={developerMode}
          onChange={(event) => setDeveloperMode(event.target.checked)}
          className="h-4 w-4 accent-orange-400"
          aria-label="Enable Developer Mode"
        />
      </label>
      <div className="mt-2 px-3 text-[11px] leading-5 text-slate-400">Shortcut: Ctrl+Shift+D</div></>}
    </aside>
  );
}

export default function AppShell({
  active,
  children,
}: {
  active: ActiveSection;
  children: React.ReactNode;
}) {
  const developerMode = useSyncExternalStore(subscribeDeveloperMode, readDeveloperMode, () => false);
  const pathname = usePathname();

  function setDeveloperMode(enabled: boolean) {
    window.localStorage.setItem(developerModeStorageKey, enabled ? "true" : "false");
    window.dispatchEvent(new CustomEvent(developerModeChangeEvent, { detail: enabled }));
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setDeveloperMode(window.localStorage.getItem(developerModeStorageKey) !== "true");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div data-active-workspace={active} className="min-h-screen bg-[#f7f8fb] text-slate-950 font-sans">
      <MobileNav developerMode={developerMode} />
      <RuntimeBanner />

      <div className="min-h-screen lg:pl-[268px]">
        <Sidebar developerMode={developerMode} setDeveloperMode={setDeveloperMode} pathname={pathname} />
        <a href="#workspace-content" className="workspace-skip">Skip to main content</a>
        <section id="workspace-content" tabIndex={-1} className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="w-full space-y-8">{children}</div>
        </section>
      </div>
    </div>
  );
}
