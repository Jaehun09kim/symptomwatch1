"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

// Distinct ink/teal series with a dashed completion line; tables remain available.
const SERIES = { opened: "#20332f", completed: "#39705c" } as const;
const GRID = "#e2e4dc";
const AXIS_TEXT = "#59645f";
const SURFACE = "#fbfaf7";

function ChartTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
      <p className="mb-1 font-medium text-navy">{label}</p>
      <ul className="space-y-0.5">
        {payload.map((item) => (
          <li key={String(item.dataKey)} className="flex items-center gap-2 text-body">
            <span className="size-2 rounded-full" style={{ background: item.color }} aria-hidden />
            <span>{item.name}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums text-navy">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: Array<Array<string | number>> }) {
  return (
    <details className="mt-3 text-xs text-slate-600">
      <summary className="cursor-pointer select-none font-medium text-brand hover:underline">Show data table</summary>
      <table className="mt-2 w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => <th key={column} className="py-1.5 pr-3 font-medium">{column}</th>)}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row) => (
            <tr key={String(row[0])} className="border-b border-border/60">
              {row.map((cell, index) => <td key={index} className="py-1.5 pr-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

const weekLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function WeeklyTrendChart({ data }: { data: Array<{ weekStart: string; opened: number; completed: number }> }) {
  // The final week is still in progress; label it so its lower count doesn't read as a decline.
  const rows = data.map((week, index) => ({ ...week, label: index === data.length - 1 ? "This week" : weekLabel(week.weekStart) }));
  const last = rows.at(-1);
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-4 text-xs text-body" aria-label="Legend">
        <li className="flex items-center gap-2"><span className="h-0.5 w-4 rounded" style={{ background: SERIES.opened }} aria-hidden />Opened</li>
        <li className="flex items-center gap-2"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: SERIES.completed }} aria-hidden />Completed</li>
      </ul>
      <div className="h-60" role="img" aria-label={`Follow-up tasks opened and completed per week for the last 8 weeks. Latest week: ${last?.opened ?? 0} opened, ${last?.completed ?? 0} completed.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 40, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS_TEXT, fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT, fontSize: 12 }} width={44} />
            <Tooltip content={ChartTooltip} cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }} />
            {(["opened", "completed"] as const).map((key) => (
              <Line
                key={key}
                type="linear"
                dataKey={key}
                name={key === "opened" ? "Opened" : "Completed"}
                stroke={SERIES[key]}
                strokeDasharray={key === "completed" ? "4 3" : undefined}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey={key}
                  content={({ x, y, value, index }) =>
                    index === rows.length - 1 ? (
                      <g>
                        <circle cx={Number(x)} cy={Number(y)} r={4} fill={SERIES[key]} stroke={SURFACE} strokeWidth={1.5} />
                        <text x={Number(x) + 9} y={Number(y) + 4} fontSize={12} fill="#20332f" fontWeight={500}>{value}</text>
                      </g>
                    ) : null
                  }
                />
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        caption="Tasks opened and completed per week"
        columns={["Week of", "Opened", "Completed"]}
        rows={rows.map((row) => [row.label, row.opened, row.completed])}
      />
    </div>
  );
}

/** Single-series magnitude bars (one hue, value at the tip). */
export function HorizontalBarChart({
  data,
  color = SERIES.opened,
  label,
  valueLabel = "Count",
}: {
  data: Array<{ name: string; value: number }>;
  color?: string;
  label: string;
  valueLabel?: string;
}) {
  const height = Math.max(120, data.length * 40 + 16);
  return (
    <div>
      <div style={{ height }} role="img" aria-label={`${label}: ${data.map((row) => `${row.name} ${row.value}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }} barCategoryGap={8}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} hide />
            <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fill: "#3d4d46", fontSize: 12 }} />
            <Tooltip content={ChartTooltip} cursor={{ fill: "rgb(23 102 91 / 0.06)" }} />
            <Bar dataKey="value" name={valueLabel} fill={color} maxBarSize={10} radius={[0, 1, 1, 0]} isAnimationActive={false}>
              <LabelList dataKey="value" position="right" fill="#20332f" fontSize={12} fontWeight={500} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable caption={label} columns={["Category", valueLabel]} rows={data.map((row) => [row.name, row.value])} />
    </div>
  );
}
