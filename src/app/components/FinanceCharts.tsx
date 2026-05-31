"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

interface CategoryData {
  cat: string;
  spend: number;
  count: number;
}

interface MonthData {
  month: string;
  income: number;
  spend: number;
  net: number;
}

interface ForecastData {
  month: string;
  forecastIncome: number;
  forecastSpend: number;
  forecastNet: number;
}

interface Props {
  categories: CategoryData[];
  months: MonthData[];
  forecast: ForecastData[];
}

const CATEGORY_COLORS = [
  "#34d399", // emerald
  "#38bdf8", // sky
  "#fb923c", // orange
  "#a78bfa", // violet
  "#f472b6", // pink
  "#facc15", // yellow
];

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1f35] px-3 py-2 shadow-xl text-xs">
      <div className="font-semibold text-white/70 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white/50">{p.name}:</span>
          <span className="font-semibold text-white/85">${p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export default function FinanceCharts({ categories, months, forecast }: Props) {
  const hasCategories = categories.length > 0;
  const hasMonths = months.length > 0;
  const hasForecast = forecast.length > 0;

  const allMonths = hasMonths
    ? [
        ...months.map((m) => ({
          month: m.month,
          Income: m.income,
          Spend: m.spend,
          _forecast: false,
        })),
        ...(hasForecast
          ? forecast.map((f) => ({
              month: f.month + " (est)",
              Income: f.forecastIncome,
              Spend: f.forecastSpend,
              _forecast: true,
            }))
          : []),
      ]
    : [];

  const catData = categories.map((c) => ({ name: c.cat, Spend: Math.round(c.spend) }));

  return (
    <div className="space-y-4">
      {/* Category Spend Chart */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-4">
          Category Spend — Bar Chart
        </div>
        {hasCategories ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={catData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis
                dataKey="name"
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="Spend" radius={[4, 4, 0, 0]}>
                {catData.map((_, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[220px] text-sm text-white/30">
            Import transactions to see category spend chart
          </div>
        )}
      </div>

      {/* Monthly Cashflow + Forecast Chart */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/40">
            Monthly Cashflow {hasForecast ? "+ 3-Month Forecast" : ""}
          </div>
          {hasForecast && (
            <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-sky-400/10 text-sky-400 border border-sky-400/20">
              forecast
            </span>
          )}
        </div>
        {hasMonths ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={allMonths} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis
                dataKey="month"
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Legend
                wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.4)", paddingTop: 8 }}
              />
              <Bar dataKey="Income" fill="#34d399" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Spend" fill="#f87171" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[220px] text-sm text-white/30">
            Import 1+ months of transactions to see cashflow chart
          </div>
        )}
      </div>
    </div>
  );
}
