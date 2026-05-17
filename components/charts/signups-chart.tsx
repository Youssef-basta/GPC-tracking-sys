"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function SignupsChart({
  data,
}: {
  data: { day: string; count: number }[];
}) {
  const normalized = data.map((d) => ({
    day:
      typeof d.day === "string"
        ? new Date(d.day).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
        : d.day,
    count: Number(d.count),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={normalized} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="currentColor" className="fill-primary" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
