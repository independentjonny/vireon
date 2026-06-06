"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SAMPLE_CSV = `date,description,amount
2026-05-01,Salary,6420.00
2026-05-02,Woolworths,-85.00
2026-05-03,Netflix,-23.99
2026-05-04,Spotify,-14.99
2026-05-05,Shell,-65.00
2026-05-06,Medibank,-165.00
2026-05-07,JB Hi-Fi,-249.00
2026-05-01,Netflix,-23.99`;

type PreviewTx = {
  merchant: string;
  amount: number;
  category: string;
  date: string;
  recurring: boolean;
  duplicate: boolean;
};

type IngestResponse = {
  ok: boolean;
  persisted?: boolean;
  persistedCount?: number;
  persistMessage?: string;
  ingestion?: {
    totalRows: number;
    processedRows: number;
    duplicateCount: number;
    recurringCount: number;
    healthScore: number;
    healthGrade: string;
    issues: string[];
  };
  transactions?: PreviewTx[];
  recurringCandidates?: PreviewTx[];
  duplicateCandidates?: PreviewTx[];
  errors?: string[];
};

function parseCSVToRows(text: string): Array<Record<string, string>> {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

export default function ImportWorkflow() {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [previewResult, setPreviewResult] = useState<IngestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handlePreview() {
    if (!csvText.trim()) { setError("Paste CSV data or load the sample CSV first."); return; }
    setLoading(true); setError(null); setSuccessMessage(null);
    try {
      const rows = parseCSVToRows(csvText);
      if (rows.length === 0) { setError("No valid rows found. Expected format: date,description,amount"); setLoading(false); return; }
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mode: "dryRun" }),
      });
      const data = (await res.json()) as IngestResponse;
      setPreviewResult(data);
      if (data.errors && data.errors.length > 0) setError(`Preview completed with ${data.errors.length} validation error(s).`);
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }

  async function handlePersist() {
    if (!previewResult || !csvText.trim()) { setError("Run a preview first before persisting."); return; }
    setLoading(true); setError(null);
    try {
      const rows = parseCSVToRows(csvText);
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mode: "persist" }),
      });
      const data = (await res.json()) as IngestResponse;
      setPreviewResult(data);
      if (data.persisted) {
        setSuccessMessage(
          data.persistMessage ?? `${data.persistedCount ?? 0} transactions saved.`
        );
        router.refresh();
      }
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }

  const ing = previewResult?.ingestion;
  const txs = previewResult?.transactions ?? [];
  const dupes = previewResult?.duplicateCandidates ?? [];
  const recurring = previewResult?.recurringCandidates ?? [];

  return (
    <div className="space-y-5">
      {/* Input Area */}
      <div className="rounded-2xl border border-white/[0.1] bg-white/[0.045] p-4 shadow-xl shadow-black/20 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Import Transactions</h3>
            <span className="text-xs text-white/35">Paste CSV — columns: date, description, amount</span>
          </div>
          <button
            className="shrink-0 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-400/20 transition"
            onClick={() => { setCsvText(SAMPLE_CSV); setPreviewResult(null); setSuccessMessage(null); setError(null); }}
          >
            Load Sample CSV
          </button>
        </div>
        <textarea
          className="w-full rounded-xl border border-white/[0.12] bg-black/20 px-4 py-3 text-sm font-mono leading-6 text-white/82 placeholder:text-white/32 focus:outline-none focus:border-emerald-300/50 resize-none"
          rows={7}
          placeholder={"date,description,amount\n2026-05-01,Salary,6420.00\n2026-05-02,Woolworths,-85.00\n2026-05-03,Netflix,-23.99"}
          value={csvText}
          onChange={(e) => { setCsvText(e.target.value); setPreviewResult(null); setSuccessMessage(null); }}
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#07111f] transition hover:bg-emerald-300 disabled:opacity-50"
            onClick={handlePreview}
            disabled={loading || !csvText.trim()}
          >
            {loading ? "Processing..." : "Preview Import"}
          </button>
          {previewResult && (
            <button
              className="rounded-2xl border border-white/[0.12] bg-white/10 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/15 disabled:opacity-50"
              onClick={handlePersist}
              disabled={loading}
            >
              {loading ? "Saving..." : "Persist to Local Storage"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200">{error}</div>
      )}
      {successMessage && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-xs text-emerald-300">✓ {successMessage}</div>
      )}

      {/* Preview Results */}
      {ing && (
        <div className="rounded-2xl border border-white/[0.1] bg-white/[0.045] p-4 shadow-xl shadow-black/20 space-y-5 sm:p-5">
          <div>
            <div className="flex flex-wrap items-baseline gap-2 mb-3">
              <h4 className="text-base font-semibold text-white">Preview Results</h4>
              <span className="text-xs text-white/35">{ing.processedRows} rows processed · Grade {ing.healthGrade} · Score {ing.healthScore}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Total Rows", value: ing.totalRows, cls: "border-white/[0.07] bg-white/[0.03]", vc: "text-white/80" },
                { label: "Processed", value: ing.processedRows, cls: "border-emerald-400/20 bg-emerald-400/5", vc: "text-emerald-400" },
                { label: "Duplicates", value: ing.duplicateCount, cls: ing.duplicateCount > 0 ? "border-amber-400/20 bg-amber-400/5" : "border-white/[0.07] bg-white/[0.03]", vc: ing.duplicateCount > 0 ? "text-amber-400" : "text-white/80" },
                { label: "Recurring", value: ing.recurringCount, cls: "border-sky-400/20 bg-sky-400/5", vc: "text-sky-400" },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border px-3 py-3 ${s.cls}`}>
                  <div className="text-xs text-white/55">{s.label}</div>
                  <div className={`mt-1 text-2xl font-bold ${s.vc}`}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {previewResult?.errors && previewResult.errors.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-red-400 mb-1">Validation Errors</div>
              {previewResult.errors.map((e, i) => (
                <div key={i} className="text-xs text-red-300/70">{e}</div>
              ))}
            </div>
          )}

          {dupes.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-amber-400 mb-2">Duplicate Warnings ({dupes.length})</div>
              <div className="space-y-1">
                {dupes.slice(0, 5).map((t, i) => (
                  <div key={i} className="flex justify-between text-xs rounded-lg border border-amber-400/10 bg-amber-400/5 px-3 py-1.5">
                    <span className="text-white/60">{t.merchant}</span>
                    <span className="text-amber-400 tabular-nums">${Math.abs(t.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recurring.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-sky-400 mb-2">Recurring Candidates ({recurring.length})</div>
              <div className="space-y-1">
                {recurring.slice(0, 5).map((t, i) => (
                  <div key={i} className="flex justify-between text-xs rounded-lg border border-sky-400/10 bg-sky-400/5 px-3 py-1.5">
                    <span className="text-white/60">{t.merchant}</span>
                    <span className="text-sky-400 tabular-nums">${Math.abs(t.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {txs.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-white/72 mb-3">Transaction Preview ({txs.length} rows)</div>
              <div className="overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.02]">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.07]">
                      {["Merchant", "Amount", "Category", "Date", "Flags"].map((h) => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-white/52">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txs.slice(0, 12).map((t, i) => (
                      <tr key={i} className={`border-b border-white/[0.05] ${t.duplicate ? "bg-amber-400/5" : ""}`}>
                        <td className="px-3 py-3 font-semibold text-white/82">{t.merchant}</td>
                        <td className={`px-3 py-3 tabular-nums font-bold ${t.amount >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                          {t.amount >= 0 ? "+" : ""}${Math.abs(t.amount).toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-white/55">{t.category}</td>
                        <td className="px-3 py-3 text-white/50 font-mono">{new Date(t.date).toLocaleDateString()}</td>
                        <td className="px-3 py-3 space-x-1">
                          {t.recurring && <span className="rounded px-1 py-0.5 text-[9px] font-semibold bg-sky-400/10 text-sky-400">recurring</span>}
                          {t.duplicate && <span className="rounded px-1 py-0.5 text-[9px] font-semibold bg-amber-400/10 text-amber-400">duplicate</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {txs.length > 12 && (
                  <div className="px-3 py-2 text-[10px] text-white/25">{txs.length - 12} more rows not shown in preview</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
