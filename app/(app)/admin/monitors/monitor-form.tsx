"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Monitor, Vehicle, Zone } from "@/lib/types";
import type { MonitorCondition } from "@/lib/monitors";

type CondType =
  | "speed_above"
  | "speed_below"
  | "idle_above"
  | "in_zone"
  | "out_of_zone";

const COND_LABELS: Record<CondType, string> = {
  speed_above: "Speed above (km/h)",
  speed_below: "Speed below (km/h)",
  idle_above: "Idle longer than (seconds)",
  in_zone: "Inside any of the selected zones",
  out_of_zone: "Outside all of the selected zones",
};

interface DraftCondition {
  type: CondType;
  kmh?: number;
  seconds?: number;
  zone_ids?: string[];
}

function condToDraft(c: MonitorCondition): DraftCondition {
  if (c.type === "speed_above" || c.type === "speed_below")
    return { type: c.type, kmh: c.kmh };
  if (c.type === "idle_above") return { type: c.type, seconds: c.seconds };
  return { type: c.type, zone_ids: c.zone_ids };
}

function draftToCond(d: DraftCondition): MonitorCondition | null {
  if (d.type === "speed_above" || d.type === "speed_below") {
    if (d.kmh == null || isNaN(d.kmh)) return null;
    return { type: d.type, kmh: Number(d.kmh) };
  }
  if (d.type === "idle_above") {
    if (d.seconds == null || isNaN(d.seconds)) return null;
    return { type: "idle_above", seconds: Number(d.seconds) };
  }
  if (d.type === "in_zone" || d.type === "out_of_zone") {
    if (!d.zone_ids || d.zone_ids.length === 0) return null;
    return { type: d.type, zone_ids: d.zone_ids };
  }
  return null;
}

export function MonitorForm({
  mode,
  monitor,
  vehicles,
  zones,
}: {
  mode: "create" | "edit";
  monitor?: Monitor;
  vehicles: Pick<Vehicle, "id" | "plate" | "label">[];
  zones: Pick<Zone, "id" | "name">[];
}) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [name, setName] = useState(monitor?.name ?? "");
  const [description, setDescription] = useState(monitor?.description ?? "");
  const [isActive, setIsActive] = useState(monitor?.is_active ?? true);
  const [scope, setScope] = useState<"all" | "specific">(
    monitor?.vehicle_ids && monitor.vehicle_ids.length > 0 ? "specific" : "all",
  );
  const [vehicleIds, setVehicleIds] = useState<string[]>(
    monitor?.vehicle_ids ?? [],
  );
  const [conditions, setConditions] = useState<DraftCondition[]>(
    (monitor?.conditions as MonitorCondition[] | undefined)?.map(condToDraft) ?? [
      { type: "speed_above", kmh: 80 },
    ],
  );
  const [submitting, setSubmitting] = useState(false);

  function addCondition() {
    setConditions((prev) => [...prev, { type: "speed_above", kmh: 80 }]);
  }
  function removeCondition(i: number) {
    setConditions((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateCondition(i: number, patch: Partial<DraftCondition>) {
    setConditions((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    );
  }
  function changeCondType(i: number, newType: CondType) {
    const defaults: Record<CondType, DraftCondition> = {
      speed_above: { type: "speed_above", kmh: 80 },
      speed_below: { type: "speed_below", kmh: 5 },
      idle_above: { type: "idle_above", seconds: 600 },
      in_zone: { type: "in_zone", zone_ids: [] },
      out_of_zone: { type: "out_of_zone", zone_ids: [] },
    };
    updateCondition(i, defaults[newType]);
  }

  function toggleVehicle(id: string) {
    setVehicleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  function toggleZoneInCondition(i: number, zid: string) {
    const c = conditions[i];
    if (c.type !== "in_zone" && c.type !== "out_of_zone") return;
    const current = c.zone_ids || [];
    const next = current.includes(zid)
      ? current.filter((x) => x !== zid)
      : [...current, zid];
    updateCondition(i, { zone_ids: next });
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const parsed: MonitorCondition[] = [];
    for (const d of conditions) {
      const c = draftToCond(d);
      if (!c) {
        toast.error(`Condition ${parsed.length + 1} is incomplete`);
        return;
      }
      parsed.push(c);
    }
    if (parsed.length === 0) {
      toast.error("Add at least one condition");
      return;
    }
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || (isEdit ? null : undefined),
      is_active: isActive,
      vehicle_ids: scope === "all" ? null : vehicleIds,
      conditions: parsed,
      actions: [{ type: "notify_admins" }],
    };
    const url = isEdit
      ? `/api/admin/monitors/${monitor!.id}`
      : "/api/admin/monitors";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(isEdit ? "Monitor updated" : "Monitor created");
    router.push("/admin/monitors");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Speed > 80 outside city limits"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>State</Label>
          <div className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-sm text-muted-foreground">
              {isActive ? "Active — evaluates on every ping" : "Paused"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Why this monitor exists / what it watches for"
        />
      </div>

      {/* Vehicle scope */}
      <div className="space-y-2 rounded-md border bg-muted/10 p-3">
        <Label>Applies to</Label>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={scope === "all"}
              onChange={() => setScope("all")}
            />
            All vehicles
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={scope === "specific"}
              onChange={() => setScope("specific")}
            />
            Selected vehicles
          </label>
        </div>
        {scope === "specific" && (
          <div className="mt-2 max-h-48 overflow-auto rounded border bg-background p-2">
            {vehicles.length === 0 ? (
              <p className="text-xs text-muted-foreground">No vehicles yet.</p>
            ) : (
              vehicles.map((v) => (
                <label
                  key={v.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent/40"
                >
                  <input
                    type="checkbox"
                    checked={vehicleIds.includes(v.id)}
                    onChange={() => toggleVehicle(v.id)}
                  />
                  <span>
                    {v.label}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      {v.plate}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      {/* Conditions */}
      <div className="space-y-2 rounded-md border bg-muted/10 p-3">
        <div className="flex items-center justify-between">
          <Label>Conditions (ALL must match)</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addCondition}
          >
            <Plus className="mr-1 size-3.5" />
            Add condition
          </Button>
        </div>
        {conditions.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Add at least one condition.
          </p>
        )}
        <div className="space-y-2">
          {conditions.map((c, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded border bg-background p-2"
            >
              <Select
                value={c.type}
                onValueChange={(v) => v && changeCondType(i, v as CondType)}
              >
                <SelectTrigger className="h-8 w-56 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(COND_LABELS) as CondType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {COND_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(c.type === "speed_above" || c.type === "speed_below") && (
                <Input
                  type="number"
                  className="h-8 w-28 text-sm"
                  value={c.kmh ?? ""}
                  onChange={(e) =>
                    updateCondition(i, { kmh: Number(e.target.value) })
                  }
                />
              )}
              {c.type === "idle_above" && (
                <Input
                  type="number"
                  className="h-8 w-28 text-sm"
                  value={c.seconds ?? ""}
                  onChange={(e) =>
                    updateCondition(i, { seconds: Number(e.target.value) })
                  }
                />
              )}
              {(c.type === "in_zone" || c.type === "out_of_zone") && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {zones.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No zones defined yet.
                    </span>
                  ) : (
                    zones.map((z) => {
                      const checked = (c.zone_ids || []).includes(z.id);
                      return (
                        <label
                          key={z.id}
                          className={`cursor-pointer rounded px-2 py-0.5 text-xs ${checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() => toggleZoneInCondition(i, z.id)}
                          />
                          {z.name}
                        </label>
                      );
                    })
                  )}
                </div>
              )}

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => removeCondition(i)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border bg-muted/10 p-3">
        <Label>Action</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          When all conditions match, all admins receive an in-app notification
          (with 5-minute cooldown per vehicle to avoid spam).
        </p>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={save} disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 size-3.5" />
          )}
          {isEdit ? "Save changes" : "Create monitor"}
        </Button>
      </div>
    </div>
  );
}
