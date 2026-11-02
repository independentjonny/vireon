import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import AppShell from "../components/AppShell";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";
const categories = ["All", "Financial records", "AI adviser", "Reviews"] as const;

export default async function TimelinePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const session = await requireServerPageSession("/timeline");
  const params = await searchParams;
  const category = categories.find(value => value === params.category) ?? "All";
  const core = createCoreDecisioningServiceFromEnv();
  const [position, adviser, reviews] = await Promise.all([
    createFinancialPositionReadServiceFromEnv().read(session),
    core.readAICfoState(session), core.readDailyReviews(session),
  ]);
  const events = [
    ...position.confirmedFacts.map(record => ({ id: `fact-${record.id}`, at: record.updatedAt, title: record.label, category: "Financial records", detail: `Confirmed information updated. Source: ${typeof record.value.sourceName === "string" ? record.value.sourceName : record.provenance.sourceType}.`, href: "/financial-profile/add-data" })),
    ...adviser.history.map(result => ({ id: `adviser-${result.request.id}`, at: result.request.createdAt, title: result.request.userQuery, category: "AI adviser", detail: "Saved adviser analysis. Review its evidence and assumptions before acting.", href: "/ai-cfo" })),
    ...reviews.history.map(record => ({ id: `review-${record.review.id}`, at: record.review.createdAt, title: "Financial review saved", category: "Reviews", detail: record.review.overallSummary, href: "/ai-cfo/daily-review" })),
  ].filter(event => Number.isFinite(Date.parse(event.at))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const visible = events.filter(event => category === "All" || event.category === category);
  return <AppShell active="workspace"><main className="workspace-dashboard">
    <header className="workspace-page-heading"><div><p className="workspace-eyebrow">Planning</p><h1>Your financial timeline</h1><p>Saved information and reviews, with dates you can trace.</p></div></header>
    <nav className="flex flex-wrap gap-2" aria-label="Timeline categories">{categories.map(item => <Link key={item} href={item === "All" ? "/timeline" : `/timeline?category=${encodeURIComponent(item)}`} aria-current={category === item ? "page" : undefined} className={category === item ? "workspace-primary" : "workspace-secondary"}>{item}</Link>)}</nav>
    <section className="workspace-panel"><h2>{visible.length ? "Your recorded history" : "No recorded history yet"}</h2><p>Record updates describe when information was confirmed or changed. A change in wealth needs comparable historical balances.</p>{visible.length ? <ol className="workspace-action-list">{visible.slice(0, 100).map(event => <li key={event.id}><div><p className="workspace-eyebrow">{event.category} · <time dateTime={event.at}>{new Date(event.at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" })}</time></p><h3>{event.title}</h3><p>{event.detail}</p></div><Link className="workspace-link" href={event.href}>Review source<ArrowRight size={15} aria-hidden="true" /></Link></li>)}</ol> : <div className="py-6"><Clock3 size={25} className="workspace-accent" aria-hidden="true" /><p>Confirm financial information or save an adviser analysis to begin your history.</p><Link href="/financial-profile/add-data" className="workspace-link">Add financial information<ArrowRight size={15} aria-hidden="true" /></Link></div>}</section>
  </main></AppShell>;
}
