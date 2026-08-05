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
  error?: string;
};

function parseCSVToRows(text: string): Array<Record<string, string>> {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
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
    if (!csvText.trim()) {
      setError("Paste CSV data or load the sample CSV first.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const rows = parseCSVToRows(csvText);
      if (rows.length === 0) {
        setError("No valid rows found. Expected format: date,description,amount");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mode: "dryRun" }),
      });
      const data = (await res.json()) as IngestResponse;
      setPreviewResult(data);
      if (!res.ok || !data.ok) setError(data.error ?? data.errors?.[0] ?? "PostgreSQL import preview failed.");
      if (data.errors && data.errors.length > 0) setError(`Preview completed with ${data.errors.length} validation error(s).`);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  async function handlePersist() {
    if (!previewResult || !csvText.trim()) {
      setError("Run a preview first before persisting.");
      return;
    }
    setLoading(true);
    setError(null);
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
        setSuccessMessage(data.persistMessage ?? `${data.persistedCount ?? 0} transactions saved.`);
        router.refresh();
      } else {
        setError(data.error ?? data.errors?.[0] ?? data.persistMessage ?? "PostgreSQL import failed.");
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  const ing = previewResult?.ingestion;
  const txs = previewResult?.transactions ?? [];
  const dupes = previewResult?.duplicateCandidates ?? [];
  const recurring = previewResult?.recurringCandidates ?? [];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Import Transactions</h3>
            <span className="text-xs text-slate-500">Paste CSV - columns: date, description, amount</span>
          </div>
          <button
            className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
            onClick={() => {
              setCsvText(SAMPLE_CSV);
              setPreviewResult(null);
              setSuccessMessage(null);
              setError(null);
            }}
          >
            Load Sample CSV
          </button>
        </div>
        <textarea
          suppressHydrationWarning
          className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm leading-6 text-slate-950 placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:outline-none"
          rows={7}
          placeholder={"date,description,amount\n2026-05-01,Salary,6420.00\n2026-05-02,Woolworths,-85.00\n2026-05-03,Netflix,-23.99"}
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            setPreviewResult(null);
            setSuccessMessage(null);
          }}
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            onClick={handlePreview}
            disabled={loading || !csvText.trim()}
          >
            {loading ? "Processing..." : "Preview Import"}
          </button>
          {previewResult && (
            <button
              className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-50 disabled:opacity-50"
              onClick={handlePersist}
              disabled={loading}
            >
              {loading ? "Saving..." : "Persist to PostgreSQL"}
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {successMessage && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">{successMessage}</div>}

      {ing && (
        <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <div>
            <div className="mb-3 flex flex-wrap items-baseline gap-2">
              <h4 className="text-base font-semibold text-slate-950">Preview Results</h4>
              <span className="text-xs text-slate-500">
                {ing.processedRows} rows processed - Grade {ing.healthGrade} - Score {ing.healthScore}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Total Rows", value: ing.totalRows, cls: "border-slate-200 bg-white", vc: "text-slate-950" },
                { label: "Processed", value: ing.processedRows, cls: "border-emerald-100 bg-emerald-50", vc: "text-emerald-700" },
                { label: "Duplicates", value: ing.duplicateCount, cls: ing.duplicateCount > 0 ? "border-amber-100 bg-amber-50" : "border-slate-200 bg-white", vc: ing.duplicateCount > 0 ? "text-amber-700" : "text-slate-950" },
                { label: "Recurring", value: ing.recurringCount, cls: "border-blue-100 bg-blue-50", vc: "text-blue-700" },
              ].map((s) => (
                <div key={s.label} className={`rounded-lg border px-3 py-3 ${s.cls}`}>
                  <div className="text-xs text-slate-500">{s.label}</div>
                  <div className={`mt-1 text-2xl font-semibold ${s.vc}`}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {previewResult?.errors && previewResult.errors.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold text-red-700">Validation Errors</div>
              {previewResult.errors.map((e, i) => (
                <div key={i} className="text-xs text-red-600">{e}</div>
              ))}
            </div>
          )}

          {dupes.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold text-amber-700">Duplicate Warnings ({dupes.length})</div>
              <div className="space-y-1">
                {dupes.slice(0, 5).map((t, i) => (
                  <div key={i} className="flex justify-between rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs">
                    <span className="text-slate-700">{t.merchant}</span>
                    <span className="tabular-nums text-amber-700">${Math.abs(t.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recurring.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold text-blue-700">Recurring Candidates ({recurring.length})</div>
              <div className="space-y-1">
                {recurring.slice(0, 5).map((t, i) => (
                  <div key={i} className="flex justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs">
                    <span className="text-slate-700">{t.merchant}</span>
                    <span className="tabular-nums text-blue-700">${Math.abs(t.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {txs.length > 0 && (
            <div>
              <div className="mb-3 text-sm font-semibold text-slate-950">Transaction Preview ({txs.length} rows)</div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {["Merchant", "Amount", "Category", "Date", "Flags"].map((h) => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txs.slice(0, 12).map((t, i) => (
                      <tr key={i} className={`border-b border-slate-100 ${t.duplicate ? "bg-amber-50" : ""}`}>
                        <td className="px-3 py-3 font-semibold text-slate-950">{t.merchant}</td>
                        <td className={`px-3 py-3 font-semibold tabular-nums ${t.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {t.amount >= 0 ? "+" : ""}${Math.abs(t.amount).toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{t.category}</td>
                        <td className="px-3 py-3 font-mono text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                        <td className="space-x-1 px-3 py-3">
                          {t.recurring && <span className="rounded bg-blue-50 px-1 py-0.5 text-[9px] font-semibold text-blue-700">recurring</span>}
                          {t.duplicate && <span className="rounded bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700">duplicate</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {txs.length > 12 && (
                  <div className="px-3 py-2 text-[10px] text-slate-400">{txs.length - 12} more rows not shown in preview</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
