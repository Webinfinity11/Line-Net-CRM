"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function StatusDonut({ data, total }: { data: { name: string; value: number; color: string }[]; total: number }) {
  const rows = data.filter((d) => d.value > 0);
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {rows.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [String(v), ""]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-semibold leading-none">{total}</div>
          <div className="text-[11px] text-muted-foreground">სულ</div>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5 text-sm">
        {rows.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 text-neutral-700 dark:text-neutral-300">{d.name}</span>
            <span className="font-medium">{d.value}</span>
            <span className="w-10 text-right text-xs text-muted-foreground">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WeeklyBars({ data, height = 192 }: { data: { label: string; created: number; completed: number }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="created" name="შექმნილი" fill="#a5b5ed" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="completed" name="შესრულებული" fill="#3457d5" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
