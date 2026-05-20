"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, YAxis, Tooltip } from "recharts";
import { createClient } from "@/lib/supabase/client";

type SensorKey = "fuel_percent" | "temp_celsius" | "voltage_v" | "engine_rpm";

interface Point {
  ts: string;
  value: number;
}

const SENSOR_LABELS: Record<SensorKey, string> = {
  fuel_percent: "Fuel %",
  temp_celsius: "Temp °C",
  voltage_v: "Voltage V",
  engine_rpm: "RPM",
};

export function SensorSparkline({
  vehicleId,
  sensor,
  color,
  points = 30,
}: {
  vehicleId: string;
  sensor: SensorKey;
  color: string;
  points?: number;
}) {
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const { data: rows } = await supabase
        .from("sensor_readings")
        .select(`created_at, ${sensor}`)
        .eq("vehicle_id", vehicleId)
        .not(sensor, "is", null)
        .order("created_at", { ascending: false })
        .limit(points);
      if (cancelled) return;
      const parsed =
        (rows ?? [])
          .slice()
          .reverse()
          .map((r: Record<string, unknown>) => ({
            ts: r.created_at as string,
            value: Number(r[sensor]),
          }))
          .filter((p) => !isNaN(p.value));
      setData(parsed);
      setLoading(false);
    }
    load();

    // Live-extend: append to data on every new sensor row
    const channel = supabase
      .channel(`sensor-sparkline-${vehicleId}-${sensor}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sensor_readings",
          filter: `vehicle_id=eq.${vehicleId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const v = row[sensor];
          if (v == null) return;
          setData((prev) => {
            const next = [
              ...prev,
              { ts: row.created_at as string, value: Number(v) },
            ];
            return next.length > points ? next.slice(-points) : next;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [vehicleId, sensor, points]);

  if (loading || data.length < 2) {
    return <div className="h-10" />;
  }

  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            cursor={{ stroke: color, strokeOpacity: 0.3 }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 4,
              fontSize: 11,
              padding: "2px 6px",
            }}
            labelFormatter={() => SENSOR_LABELS[sensor]}
            formatter={(value: number) => [value.toFixed(2), ""]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
