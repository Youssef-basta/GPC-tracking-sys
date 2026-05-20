"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Reading {
  created_at: string;
  fuel_percent: number | null;
  temp_celsius: number | null;
  voltage_v: number | null;
  engine_rpm: number | null;
  odometer_km: number | null;
}

function toPoints(rows: Reading[], key: keyof Reading) {
  return rows
    .filter((r) => r[key] != null)
    .map((r) => ({
      t: new Date(r.created_at).getTime(),
      v: Number(r[key]),
    }));
}

function ChartCard({
  title,
  data,
  color,
  unit,
  ref,
  refLabel,
  domain,
}: {
  title: string;
  data: { t: number; v: number }[];
  color: string;
  unit: string;
  ref?: number;
  refLabel?: string;
  domain?: [number | string, number | string];
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {data.length} point{data.length === 1 ? "" : "s"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-48 w-full">
          {data.length < 2 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Not enough data in this range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  scale="time"
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <YAxis
                  domain={domain ?? ["auto", "auto"]}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
                  formatter={(value: number) => [`${value.toFixed(2)} ${unit}`, title]}
                />
                {ref != null && (
                  <ReferenceLine
                    y={ref}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{
                      value: refLabel,
                      position: "insideTopRight",
                      fontSize: 10,
                      fill: "#ef4444",
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={color}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SensorHistoryCharts({
  vehicleId,
  initial,
  fromIso,
}: {
  vehicleId: string;
  initial: Reading[];
  fromIso: string;
}) {
  const [rows, setRows] = useState<Reading[]>(initial);

  // Live-extend: append new sensor rows for this vehicle inside the
  // current time window.
  useEffect(() => {
    const supabase = createClient();
    const fromMs = new Date(fromIso).getTime();
    const channel = supabase
      .channel(`sensor-history-${vehicleId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sensor_readings",
          filter: `vehicle_id=eq.${vehicleId}`,
        },
        (payload) => {
          const row = payload.new as Reading;
          if (new Date(row.created_at).getTime() < fromMs) return;
          setRows((prev) => [...prev, row]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [vehicleId, fromIso]);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <ChartCard
        title="Fuel level"
        data={toPoints(rows, "fuel_percent")}
        color="#10b981"
        unit="%"
        ref={15}
        refLabel="Low fuel"
        domain={[0, 100]}
      />
      <ChartCard
        title="Engine temperature"
        data={toPoints(rows, "temp_celsius")}
        color="#f59e0b"
        unit="°C"
        ref={105}
        refLabel="Critical"
      />
      <ChartCard
        title="Battery voltage"
        data={toPoints(rows, "voltage_v")}
        color="#0ea5e9"
        unit="V"
        ref={11.8}
        refLabel="Low voltage"
      />
      <ChartCard
        title="Engine RPM"
        data={toPoints(rows, "engine_rpm")}
        color="#a855f7"
        unit="rpm"
      />
      <ChartCard
        title="Odometer"
        data={toPoints(rows, "odometer_km")}
        color="#64748b"
        unit="km"
      />
    </div>
  );
}
