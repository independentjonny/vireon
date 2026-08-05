"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import MobileNav from "./MobileNav";
import {
  BarChart3,
  Bell,
  BookOpenCheck,
  Bot,
  BrainCircuit,
  Building2,
  CalendarClock,
  ChartNoAxesCombined,
  CircleDollarSign,
  Code2,
  FileText,
  Gauge,
  Goal,
  HousePlus,
  Landmark,
  ListChecks,
  LayoutDashboard,
  Lock,
  Network,
  ReceiptText,
  Repeat2,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  UploadCloud,
  WalletCards,
} from "lucide-react";

type ActiveSection = "dashboard" | "financial-vault" | "housing-scenarios" | "digital-twin" | "ai-cfo" | "settings" | "workspace";

const navGroups = [
  {
    label: "Dashboard",
    items: [["Dashboard", "/", LayoutDashboard]],
  },
  {
    label: "Financial",
    items: [
      ["Accounts", "/accounts", WalletCards],
      ["Transactions", "/transactions", SlidersHorizontal],
      ["Cash Flow", "/cash-flow", ChartNoAxesCombined],
      ["Investments", "/investments", Gauge],
      ["Balance Sheet", "/balance-sheet", CircleDollarSign],
      ["Subscriptions", "/subscriptions", Repeat2],
      ["Reports", "/reports", FileText],
    ],
  },
  {
    label: "Planning",
    items: [
      ["Housing", "/housing-scenarios", HousePlus],
      ["Structure Optimiser", "/structure-optimiser", Network],
      ["Goals", "/goals", Goal],
      ["Budgets", "/budgets", ReceiptText],
    ],
  },
  {
    label: "Financial Vault",
    items: [["Document Vault", "/financial-vault", ShieldCheck], ["Import Review", "/financial-vault/imports", UploadCloud]],
  },
  {
    label: "AI",
    items: [
      ["AI CFO", "/ai-cfo", Bot],
      ["Digital Twin", "/digital-twin", BrainCircuit],
      ["Forecast Timeline", "/digital-twin/timeline", CalendarClock],
      ["Adviser Workspace", "/adviser-workspace", Building2],
      ["Action Workflows", "/action-workflows", ListChecks],
      ["Insights", "/insights", Sparkles],
      ["Timeline", "/timeline", BookOpenCheck],
    ],
  },
  {
    label: "Settings",
    items: [["Beta Onboarding", "/beta-onboarding", ShieldCheck], ["Privacy", "/privacy", Lock], ["Settings", "/settings", Settings]],
  },
] as const;

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
        <span className="min-w-0 truncate">Vireon is synced and ready</span>
      </span>
    </div>
  );
}

function isSelected(active: ActiveSection, label: string) {
  return (
    (active === "dashboard" && label === "Dashboard") ||
    (active === "financial-vault" && label === "Document Vault") ||
    (active === "housing-scenarios" && label === "Housing") ||
    (active === "digital-twin" && label === "Digital Twin") ||
    (active === "ai-cfo" && label === "AI CFO") ||
    (active === "settings" && label === "Settings")
  );
}

function Sidebar({
  active,
  developerMode,
  setDeveloperMode,
}: {
  active: ActiveSection;
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
}) {
  return (
    <aside className="hidden w-[268px] shrink-0 bg-[#10243b] px-5 py-7 text-white lg:fixed lg:left-0 lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto">
      <Link href="/" className="flex items-center gap-3 px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-400 text-[#10243b]">
          <Sparkles className="h-5 w-5" fill="currentColor" strokeWidth={1.6} />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal">vireon</h1>
      </Link>

      <nav className="mt-8 flex-1 space-y-6" aria-label="Primary navigation">
        {navGroups.map((group) => (
          <section key={group.label}>
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{group.label}</div>
            <div className="space-y-1">
              {group.items.map(([label, href, Icon]) => (
                <Link
                  key={`${label}-${href}`}
                  href={href}
                  className={
                    "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 " +
                    (isSelected(active, label)
                      ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      : "text-slate-300 hover:bg-white/[0.07] hover:text-white")
                  }
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
                  {label}
                </Link>
              ))}
            </div>
          </section>
        ))}

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

      <div className="mt-6 rounded-lg bg-white/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-3 text-sm font-semibold text-sky-200">
          <ShieldCheck className="h-5 w-5 text-orange-300" />
          Financial Profile
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            ["Docs", "8 / 10"],
            ["Confidence", "93%"],
            ["Readiness", "81"],
            ["Capacity", "$812k"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md bg-white/[0.06] p-2">
              <div className="text-[10px] font-semibold uppercase text-slate-400">{label}</div>
              <div className="mt-1 text-sm font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
        <Link href="/financial-vault" className="mt-4 flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/8 text-sm font-semibold text-white">
          Review Vault
        </Link>
      </div>

      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-slate-200">
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
      <div className="mt-2 px-3 text-[11px] leading-5 text-slate-400">Shortcut: Ctrl+Shift+D</div>
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
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950 font-sans">
      <MobileNav developerMode={developerMode} />
      <RuntimeBanner />

      <div className="min-h-screen lg:pl-[268px]">
        <Sidebar active={active} developerMode={developerMode} setDeveloperMode={setDeveloperMode} />
        <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="w-full space-y-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
