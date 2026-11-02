import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { setupProgress } from "@/lib/setupProgress";
import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";

export default function SetupChecklist({ records, now }: { records: CanonicalFinancialRecord[]; now: number }) {
  const progress = setupProgress(records, now);
  return <section className="setup-checklist" aria-labelledby="setup-heading">
    <div className="setup-intro"><div><p className="workspace-eyebrow">Your first steps</p><h2 id="setup-heading">Build a picture you can plan with</h2><p>Add a little at a time. Review every change before it updates your position.</p></div><span className="coverage-label">{progress.recorded} of 3 areas recorded</span></div>
    <progress value={progress.recorded} max={3} aria-label="Financial information coverage" />
    <ol className="setup-checklist-grid">{progress.steps.map((step, index) => <li key={step.id}>
      <span className={`setup-step-number ${step.complete ? "is-complete" : ""}`}>{step.complete ? <Check size={16} aria-hidden="true" /> : index + 1}</span>
      <h3>{step.label}</h3><p>{step.detail}</p><Link href={step.href}>{step.complete ? "Review recorded information" : "Add information"}<ArrowRight size={14} aria-hidden="true" /></Link>
      <span className="setup-step-status">{step.complete ? "Recorded" : "Not recorded yet"}</span>
    </li>)}<li><span className="setup-step-number">4</span><h3>Review your position</h3><p>Check the sources, dates and coverage behind your figures.</p><Link href="/financial-profile">Review position<ArrowRight size={14} aria-hidden="true" /></Link><span className="setup-step-status">{progress.recorded === 3 ? "Ready to review" : "Available at any time"}</span></li></ol>
    <div className="setup-checklist-footer"><p><ShieldCheck size={16} aria-hidden="true" />Progress is saved with your confirmed records. Missing information stays unknown.</p><Link className="workspace-primary" href={progress.next?.href ?? "/financial-profile"}>{progress.recorded ? "Continue your setup" : "Start with income"}<ArrowRight size={16} aria-hidden="true" /></Link></div>
  </section>;
}
