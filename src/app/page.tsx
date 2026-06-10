import MobileNav from "./components/MobileNav";
import OverviewV3 from "./components/OverviewV3";
import AutonomousTaskComposer from "./components/AutonomousTaskComposer";
import TransactionsSection from "./components/sections/TransactionsSection";
import SubscriptionsSection from "./components/sections/SubscriptionsSection";

export const dynamic = "force-dynamic";

const navItems = [
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

function RuntimeBanner() {
  return (
    <div className="sticky top-0 z-40 border-b border-emerald-500/[0.15] bg-[#07111f]/85 px-4 py-2 text-xs text-emerald-300/80 backdrop-blur-xl">
      <span className="inline-flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Autonomous AI Runtime Active — Supervisor online • 10 agents nominal • Multi-agent v2
      </span>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl lg:fixed lg:left-0 lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Neven</h1>
        <p className="mt-1 text-xs leading-relaxed text-white/40">
          Autonomous financial operating system
        </p>
      </div>

      <nav className="mt-8 flex-1 space-y-0.5">
        {navItems.map(([label, href], i) => (
          <a
            key={href}
            href={href}
            className={
              "block rounded-xl px-3 py-2.5 text-sm transition " +
              (i === 0
                ? "bg-emerald-400/15 text-emerald-300 font-medium"
                : "text-white/55 hover:bg-white/5 hover:text-white")
            }
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/20 text-xs font-bold text-emerald-300">
            N
          </div>
          <div>
            <div className="text-sm font-medium">Alex Becker</div>
            <div className="text-xs text-white/40">Owner · Premium Plan</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SectionShell({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-4 flex flex-wrap items-baseline gap-3 border-b border-white/[0.07] pb-3">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {subtitle && <span className="text-xs text-white/35">{subtitle}</span>}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
        {children ?? (
          <p className="text-sm text-white/45">
            Section placeholder restored after page recovery. Detailed module can be reattached safely.
          </p>
        )}
      </div>
    </section>
  );
}

function ScreenshotPanel() {
  const paths = [
    "screenshot/fullpage.png",
    "screenshot/overview.png",
    "screenshot/build-automation.png",
    ".ai/screenshots/fullpage.png",
  ];

  return (
    <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-300">
        Latest Screenshot Paths
      </div>
      <div className="space-y-1 font-mono text-xs text-white/55">
        {paths.map((p) => (
          <div key={p}>{p}</div>
        ))}
      </div>
    </div>
  );
}

export default async function HomePage() {
  return (
    <main className="min-h-screen bg-[#07111f] text-white font-sans">
      <MobileNav />
      <RuntimeBanner />

      <div className="flex min-h-screen lg:pl-64">
        <Sidebar />

        <section className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10">
          <div className="w-full space-y-12">
            <OverviewV3
              netWorth="$1.84M"
              netWorthTrend="+4.2% this month"
              cashFlow="+$6,420"
              savingsRate="31%"
              runway="8.4 mo"
              aiConfidence="96%"
              healthScore={93}
              healthLabel="Strong"
              insights={[
                "Offset mortgage by $800/month to save $2,400/year in interest.",
                "AI detected $138/month in recurring cost opportunities.",
                "Property exposure remains your largest concentration risk.",
                "Emergency runway remains strong at 8.4 months.",
                "Subscription intelligence engine identified 3 savings opportunities.",
              ]}
              portfolioAllocation={[
                { label: "Property", pct: 58, color: "bg-emerald-400" },
                { label: "Equities", pct: 22, color: "bg-sky-400" },
                { label: "Cash", pct: 12, color: "bg-amber-400" },
                { label: "Other", pct: 8, color: "bg-purple-400" },
              ]}
              healthScores={[
                { label: "Liquidity", score: 92, note: "Strong" },
                { label: "Diversification", score: 74, note: "Moderate" },
                { label: "Debt Coverage", score: 88, note: "Healthy" },
                { label: "Savings Habit", score: 95, note: "Excellent" },
              ]}
              dateStr="Sunday 31 May 2026"
            />

            <SectionShell id="transactions" title="Transactions" subtitle="Local transaction intelligence">
              <TransactionsSection />
            </SectionShell>

            <SectionShell id="subscriptions" title="Subscriptions" subtitle="Recurring payments and renewal tracking">
              <SubscriptionsSection />
            </SectionShell>

            <SectionShell id="financial-intelligence" title="Financial Intelligence" subtitle="Signals, health, and recommendations" />

            <SectionShell id="ai-copilot" title="AI Copilot" subtitle="Ask questions about your money">
              <div className="space-y-3">
                <p className="text-sm text-white/50">
                  Copilot shell restored. Detailed conversation logic can be reattached safely after modularisation.
                </p>
                <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3 text-xs text-white/35">
                  Ask about subscriptions, cash flow, savings, property, or automation status.
                </div>
              </div>
            </SectionShell>

            <SectionShell id="analytics" title="Analytics" subtitle="Charts and financial trends" />

            <SectionShell id="roadmap" title="Roadmap" subtitle="Autonomous product roadmap" />

            <SectionShell id="telemetry" title="Telemetry" subtitle="Runtime event stream" />

            <SectionShell id="deployment" title="Deployment" subtitle="Local mode readiness">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Build", "Pass"],
                  ["TypeScript", "Pass"],
                  ["Local Mode", "Active"],
                ].map(([label, status]) => (
                  <div key={label} className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
                    <div className="text-xs text-white/35">{label}</div>
                    <div className="mt-1 text-sm font-semibold text-emerald-300">✓ {status}</div>
                  </div>
                ))}
              </div>
            </SectionShell>

            <SectionShell id="remote-control" title="Remote Control" subtitle="Local autonomous controls" />

            <SectionShell id="build-automation" title="Build Automation" subtitle="Submit tasks and monitor local automation">
              <div className="space-y-5">
                <AutonomousTaskComposer
                  suggestedGoal="Stabilise local autonomous execution loop — run one task end-to-end with validation, screenshot capture, and report output."
                />
                <ScreenshotPanel />
              </div>
            </SectionShell>

            <SectionShell id="architecture-governance" title="Architecture Governance" subtitle="Componentisation and runtime structure" />

            <SectionShell id="settings" title="Settings" subtitle="Local preferences and environment">
              <p className="text-sm text-white/45">
                Neven is currently running in local build mode. Supabase, OpenAI, and deployment settings remain optional production integrations.
              </p>
            </SectionShell>
          </div>
        </section>
      </div>
    </main>
  );
}
