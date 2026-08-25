"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";

const USER_SECTIONS = [
  {
    id: "dashboard",
    label: "Dashboard",
    items: [["Dashboard", "/"]],
  },
  {
    id: "financial",
    label: "Financial",
    items: [
      ["Accounts", "/accounts"],
      ["Transactions", "/transactions"],
      ["Cash Flow", "/cash-flow"],
      ["Investments", "/investments"],
      ["Balance Sheet", "/balance-sheet"],
      ["Subscriptions", "/subscriptions"],
      ["Reports", "/reports"],
    ],
  },
  {
    id: "profile",
    label: "Financial Profile",
    items: [
      ["Financial Position", "/financial-profile"],
      ["Add financial data", "/financial-profile/add-data"],
    ],
  },
  {
    id: "planning",
    label: "Planning",
    items: [
      ["Housing", "/housing-scenarios"],
      ["Structure Optimiser", "/structure-optimiser"],
      ["Integrated Goals", "/goals"],
      ["Budgets", "/budgets"],
    ],
  },
  {
    id: "vault",
    label: "Financial Vault",
    items: [["Document Vault", "/financial-vault"]],
  },
  {
    id: "ai",
    label: "AI",
    items: [
      ["AI CFO", "/ai-cfo"],
      ["Digital Twin", "/digital-twin"],
      ["Insights", "/insights"],
      ["Timeline", "/timeline"],
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [["Settings", "/settings"]],
  },
];

const DEVELOPER_SECTION = {
  id: "developer",
  label: "Developer Mode",
  items: [
    ["Build Automation", "/#build-automation"],
    ["Deployment", "/#deployment"],
    ["Runtime", "/status"],
    ["Architecture Governance", "/#architecture-governance"],
    ["Supervisor Inbox", "/#supervisor-inbox"],
    ["Remote Control", "/#remote-control"],
    ["Telemetry", "/#telemetry"],
    ["Roadmap", "/#roadmap"],
  ],
};

export default function MobileNav({ developerMode = false }: { developerMode?: boolean }) {
  const [open, setOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    dashboard: true,
    financial: true,
    profile: true,
    planning: true,
    vault: false,
    ai: false,
    settings: false,
    developer: false,
  });
  const sections = developerMode ? [...USER_SECTIONS, DEVELOPER_SECTION] : USER_SECTIONS;

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    if (open) document.addEventListener("keydown", handleKeyDown);

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
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onTouchStart={(event) => {
          event.stopPropagation();
        }}
        className={[
          "fixed right-3 top-1 z-[2147483647] flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-[#07111f] text-white shadow-2xl transition-opacity lg:hidden",
          open ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100",
        ].join(" ")}
      >
        <Menu aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[2147483645] bg-black/70 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation backdrop"
            className="absolute inset-y-0 left-0 w-[calc(100%-min(20rem,86vw))] cursor-default"
            onClick={() => setOpen(false)}
          />
        </div>
      )}

      {open && (
        <aside className="fixed inset-y-0 right-0 z-[2147483646] w-80 max-w-[86vw] border-l border-white/10 bg-[#07111f] shadow-2xl lg:hidden">
          <div className="flex items-center justify-between border-b border-white/10 p-5">
            <div>
              <div className="text-lg font-bold text-white">Vireon</div>
              <div className="text-xs text-white/40">AI financial operating system</div>
            </div>

            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white"
            >
              <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>

          <nav className="h-[calc(100vh-82px)] overflow-y-auto bg-[#091525] p-3" aria-label="Mobile navigation">
            {sections.map((section) => {
              const expanded = expandedSections[section.id];

              return (
                <section key={section.id} className="mb-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-2 last:mb-0">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`mobile-nav-${section.id}`}
                    onClick={() =>
                      setExpandedSections((current) => ({
                        ...current,
                        [section.id]: !current[section.id],
                      }))
                    }
                    className="flex min-h-11 w-full items-center justify-between rounded-xl border border-transparent px-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-white/55 transition hover:border-white/[0.08] hover:bg-white/[0.06] hover:text-white/75"
                  >
                    <span>{section.label}</span>
                    <ChevronDown aria-hidden="true" className={["h-4 w-4 transition-transform", expanded ? "rotate-180" : ""].join(" ")} strokeWidth={2} />
                  </button>

                  {expanded && (
                    <div id={`mobile-nav-${section.id}`} className="mt-2 space-y-1.5">
                      {section.items.map(([label, href]) => (
                        <a
                          key={href}
                          href={href}
                          onClick={() => setOpen(false)}
                          className="flex min-h-12 items-center rounded-xl border border-white/[0.075] bg-[#0d1b2c] px-4 text-sm font-medium text-white/78 transition hover:border-white/[0.14] hover:bg-[#13263a] hover:text-white"
                        >
                          {label}
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </nav>
        </aside>
      )}
    </>
  );
}
