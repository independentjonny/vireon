import Link from "next/link";
import { ArrowRight, FileCheck2 } from "lucide-react";
import SetupChecklist from "./SetupChecklist";

export default function EmptyFinancialDashboard({ now }: { now: number }) {
  return <main className="workspace-dashboard">
    <header className="workspace-page-heading"><div><p className="workspace-eyebrow">Overview</p><h1>Your financial picture starts here</h1><p>See what you own, owe and have available each month.</p></div></header>
    <SetupChecklist records={[]} now={now} />
    <div className="workspace-two-columns">
      <section className="workspace-panel"><h2>A useful overview, built from your records</h2><p>Your net position, monthly cash flow and cash buffer will appear as you confirm information.</p><p className="workspace-muted">Not added means unknown. A confirmed zero balance will appear as $0.</p><Link className="workspace-link" href="/financial-profile">See your financial position<ArrowRight size={15} aria-hidden="true" /></Link></section>
      <section className="workspace-panel"><FileCheck2 size={23} className="workspace-accent" aria-hidden="true" /><h2>Have a statement handy?</h2><p>Upload a document to suggest amounts, then check its date, ownership and values before confirming.</p><Link className="workspace-link" href="/financial-vault">Open Document vault<ArrowRight size={15} aria-hidden="true" /></Link></section>
    </div>
  </main>;
}
