import { format } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ClicksChart({ data }: { data: { date: string; clicks: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="clickFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "IBM Plex Mono" }}
            tickFormatter={(d) => format(new Date(d), "d MMM")}
            minTickGap={32}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "IBM Plex Mono" }}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: "var(--subtle)", strokeDasharray: "3 3" }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              fontSize: 12,
              boxShadow: "none",
            }}
            labelFormatter={(d) => format(new Date(d), "EEE d MMM yyyy")}
            formatter={(v: number) => [v.toLocaleString(), "Clicks"]}
          />
          <Area
            type="monotone"
            dataKey="clicks"
            stroke="var(--chart-1)"
            strokeWidth={1.75}
            fill="url(#clickFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BreakdownList({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number }[];
}) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <section className="panel">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="eyebrow">Share</span>
      </div>
      <ul className="space-y-0.5 p-3">
        {data.map((d) => (
          <li
            key={d.name}
            className="relative flex items-center justify-between rounded-sm px-2 py-1.5 text-sm"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-sm bg-signal-soft"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
            <span className="relative">{d.name}</span>
            <span className="relative flex gap-3">
              <span className="num text-muted-foreground">{d.value.toLocaleString()}</span>
              <span className="num w-12 text-right">{((d.value / total) * 100).toFixed(1)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className="num mt-1.5 text-2xl font-medium">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
