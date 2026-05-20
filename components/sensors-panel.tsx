import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { Fuel, Thermometer, Zap, Gauge, Activity } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { cn } from "@/lib/utils";

function fuelTone(p: number | null) {
  if (p == null) return "text-muted-foreground";
  if (p < 15) return "text-red-600 dark:text-red-400";
  if (p < 30) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}
function tempTone(t: number | null) {
  if (t == null) return "text-muted-foreground";
  if (t < 40 || t > 105) return "text-red-600 dark:text-red-400";
  if (t > 95) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}
function voltageTone(v: number | null) {
  if (v == null) return "text-muted-foreground";
  if (v < 11.8 || v > 14.7) return "text-red-600 dark:text-red-400";
  if (v < 12.2) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

export function SensorsPanel({ vehicle }: { vehicle: Vehicle }) {
  const allNull =
    vehicle.last_fuel_percent == null &&
    vehicle.last_temp_celsius == null &&
    vehicle.last_voltage_v == null &&
    vehicle.last_engine_rpm == null &&
    vehicle.last_odometer_km == null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Activity className="size-4 text-primary" />
            Sensors
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {allNull
              ? "No sensor data yet — the simulator and /api/ingest both write to sensor_readings."
              : vehicle.last_sensor_at
                ? `Updated ${formatDistanceToNow(new Date(vehicle.last_sensor_at), { addSuffix: true })}`
                : "Latest reading"}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Metric
            icon={<Fuel className="size-4" />}
            label="Fuel"
            value={
              vehicle.last_fuel_percent != null
                ? `${vehicle.last_fuel_percent.toFixed(0)}%`
                : "—"
            }
            tone={fuelTone(vehicle.last_fuel_percent)}
          />
          <Metric
            icon={<Thermometer className="size-4" />}
            label="Engine temp"
            value={
              vehicle.last_temp_celsius != null
                ? `${vehicle.last_temp_celsius.toFixed(0)}°C`
                : "—"
            }
            tone={tempTone(vehicle.last_temp_celsius)}
          />
          <Metric
            icon={<Zap className="size-4" />}
            label="Voltage"
            value={
              vehicle.last_voltage_v != null
                ? `${vehicle.last_voltage_v.toFixed(1)} V`
                : "—"
            }
            tone={voltageTone(vehicle.last_voltage_v)}
          />
          <Metric
            icon={<Gauge className="size-4" />}
            label="RPM"
            value={
              vehicle.last_engine_rpm != null
                ? vehicle.last_engine_rpm.toLocaleString()
                : "—"
            }
            tone="text-foreground"
          />
          <Metric
            icon={<Gauge className="size-4" />}
            label="Odometer"
            value={
              vehicle.last_odometer_km != null
                ? `${vehicle.last_odometer_km.toFixed(0)} km`
                : "—"
            }
            tone="text-foreground"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("text-xl font-semibold tabular-nums", tone)}>
        {value}
      </div>
    </div>
  );
}
