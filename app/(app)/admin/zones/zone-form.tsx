"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Zone, ZoneKind } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).optional(),
  kind: z.enum(["circle", "rectangle", "polygon"]),
  is_prohibited: z.boolean(),
  alert_on: z.enum(["enter", "exit", "both"]),
  // Per-kind fields (all strings, parsed on submit)
  c_lat: z.string().optional(),
  c_lng: z.string().optional(),
  c_radius: z.string().optional(),
  r_north: z.string().optional(),
  r_south: z.string().optional(),
  r_east: z.string().optional(),
  r_west: z.string().optional(),
  p_points: z.string().optional(),
});
type Values = z.infer<typeof schema>;

function shapeFromValues(v: Values) {
  if (v.kind === "circle") {
    return {
      lat: Number(v.c_lat),
      lng: Number(v.c_lng),
      radius_m: Number(v.c_radius),
    };
  }
  if (v.kind === "rectangle") {
    return {
      north: Number(v.r_north),
      south: Number(v.r_south),
      east: Number(v.r_east),
      west: Number(v.r_west),
    };
  }
  // polygon
  const points = JSON.parse(v.p_points || "[]");
  return { points };
}

function defaultsFromZone(z?: Zone): Partial<Values> {
  if (!z) {
    return {
      kind: "circle",
      alert_on: "both",
      is_prohibited: false,
      c_lat: "24.7136",
      c_lng: "46.6753",
      c_radius: "500",
    };
  }
  const base: Partial<Values> = {
    name: z.name,
    description: z.description ?? "",
    kind: z.kind,
    is_prohibited: z.is_prohibited,
    alert_on: z.alert_on,
  };
  const s = z.shape as Record<string, unknown>;
  if (z.kind === "circle") {
    return {
      ...base,
      c_lat: String(s.lat ?? ""),
      c_lng: String(s.lng ?? ""),
      c_radius: String(s.radius_m ?? ""),
    };
  }
  if (z.kind === "rectangle") {
    return {
      ...base,
      r_north: String(s.north ?? ""),
      r_south: String(s.south ?? ""),
      r_east: String(s.east ?? ""),
      r_west: String(s.west ?? ""),
    };
  }
  return {
    ...base,
    p_points: JSON.stringify(s.points ?? []),
  };
}

export function ZoneForm({
  mode,
  zone,
}: {
  mode: "create" | "edit";
  zone?: Zone;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFromZone(zone),
  });
  const kind = watch("kind") as ZoneKind;
  const isProhibited = watch("is_prohibited");

  async function onSubmit(values: Values) {
    let shape: unknown;
    try {
      shape = shapeFromValues(values);
    } catch (e) {
      toast.error("Could not parse polygon points: " + (e as Error).message);
      return;
    }
    setSubmitting(true);
    const url =
      mode === "edit" ? `/api/admin/zones/${zone!.id}` : "/api/admin/zones";
    const res = await fetch(url, {
      method: mode === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        description: values.description || (mode === "edit" ? null : undefined),
        kind: values.kind,
        shape,
        is_prohibited: values.is_prohibited,
        alert_on: values.alert_on,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const msg = await res.text();
      toast.error(msg || "Save failed");
      return;
    }
    toast.success(mode === "edit" ? "Zone updated" : "Zone created");
    router.push("/admin/zones");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" {...register("name")} placeholder="Riyadh depot" />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kind">Shape *</Label>
          <Select
            value={kind}
            onValueChange={(v) => v && setValue("kind", v as ZoneKind)}
          >
            <SelectTrigger id="kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="circle">Circle (center + radius)</SelectItem>
              <SelectItem value="rectangle">Rectangle (N/S/E/W bounds)</SelectItem>
              <SelectItem value="polygon">Polygon (JSON coords)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register("description")}
          rows={2}
          placeholder="Main warehouse — vehicles enter at 8am to load"
        />
      </div>

      {kind === "circle" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="c_lat">Center latitude</Label>
            <Input
              id="c_lat"
              type="number"
              step="0.000001"
              {...register("c_lat")}
              placeholder="24.7136"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c_lng">Center longitude</Label>
            <Input
              id="c_lng"
              type="number"
              step="0.000001"
              {...register("c_lng")}
              placeholder="46.6753"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c_radius">Radius (meters)</Label>
            <Input
              id="c_radius"
              type="number"
              step="1"
              {...register("c_radius")}
              placeholder="500"
            />
          </div>
        </div>
      )}

      {kind === "rectangle" && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="r_north">North</Label>
            <Input id="r_north" type="number" step="0.000001" {...register("r_north")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r_south">South</Label>
            <Input id="r_south" type="number" step="0.000001" {...register("r_south")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r_east">East</Label>
            <Input id="r_east" type="number" step="0.000001" {...register("r_east")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r_west">West</Label>
            <Input id="r_west" type="number" step="0.000001" {...register("r_west")} />
          </div>
        </div>
      )}

      {kind === "polygon" && (
        <div className="space-y-1.5">
          <Label htmlFor="p_points">Points (JSON array of [lat, lng])</Label>
          <Textarea
            id="p_points"
            {...register("p_points")}
            rows={5}
            className="font-mono text-xs"
            placeholder='[[24.71, 46.67], [24.72, 46.68], [24.72, 46.69], [24.71, 46.69]]'
          />
          <p className="text-xs text-muted-foreground">
            Minimum 3 points. The polygon closes itself — don&apos;t repeat the
            first point.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="alert_on">Fire alerts on</Label>
          <Select
            value={watch("alert_on")}
            onValueChange={(v) =>
              v && setValue("alert_on", v as "enter" | "exit" | "both")
            }
          >
            <SelectTrigger id="alert_on">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Enter and exit</SelectItem>
              <SelectItem value="enter">Enter only</SelectItem>
              <SelectItem value="exit">Exit only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="is_prohibited">Prohibited zone</Label>
          <div className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2">
            <Switch
              id="is_prohibited"
              checked={isProhibited}
              onCheckedChange={(v) => setValue("is_prohibited", v)}
            />
            <span className="text-sm text-muted-foreground">
              {isProhibited
                ? "Entering raises a destructive alert"
                : "Standard zone — informational alerts"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 size-3.5" />
          )}
          {mode === "edit" ? "Save changes" : "Create zone"}
        </Button>
      </div>
    </form>
  );
}
