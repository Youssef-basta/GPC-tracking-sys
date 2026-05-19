"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Units, UserSettings } from "@/lib/types";

export function SettingsForm({ initial }: { initial: UserSettings }) {
  const router = useRouter();
  const [units, setUnits] = useState<Units>(initial.units);
  const [language, setLanguage] = useState(initial.language);
  const [defaultZoom, setDefaultZoom] = useState(initial.default_zoom);
  const [showTrails, setShowTrails] = useState(initial.show_trails);
  const [trailPoints, setTrailPoints] = useState(initial.trail_points);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    const res = await fetch("/api/user-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        units,
        language,
        default_zoom: defaultZoom,
        show_trails: showTrails,
        trail_points: trailPoints,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error("Failed to save");
      return;
    }
    toast.success("Settings saved");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="units">Distance units</Label>
          <Select value={units} onValueChange={(v) => v && setUnits(v as Units)}>
            <SelectTrigger id="units">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="metric">Metric (km, m)</SelectItem>
              <SelectItem value="imperial">Imperial (mi, ft)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="language">Language</Label>
          <Select
            value={language}
            onValueChange={(v) => v && setLanguage(v)}
          >
            <SelectTrigger id="language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ar">العربية (Arabic) — coming soon</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Arabic translation pending — UI is English-only for now.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="default_zoom">Default map zoom (1–20)</Label>
        <Input
          id="default_zoom"
          type="number"
          min={1}
          max={20}
          value={defaultZoom}
          onChange={(e) => setDefaultZoom(Number(e.target.value))}
        />
        <p className="text-xs text-muted-foreground">
          11 ≈ city level. 14 ≈ neighbourhood. 17 ≈ street level.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-3">
        <Switch
          id="show_trails"
          checked={showTrails}
          onCheckedChange={setShowTrails}
        />
        <div className="flex-1">
          <Label htmlFor="show_trails" className="cursor-pointer">
            Show vehicle trails by default
          </Label>
          <p className="text-xs text-muted-foreground">
            Recent positions drawn as a polyline behind each vehicle.
          </p>
        </div>
      </div>

      {showTrails && (
        <div className="space-y-1.5">
          <Label htmlFor="trail_points">Trail length (positions)</Label>
          <Input
            id="trail_points"
            type="number"
            min={5}
            max={200}
            value={trailPoints}
            onChange={(e) => setTrailPoints(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            How many recent location pings to draw per vehicle (5–200).
          </p>
        </div>
      )}

      <div className="flex justify-end border-t pt-4">
        <Button onClick={save} disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 size-3.5" />
          )}
          Save preferences
        </Button>
      </div>
    </div>
  );
}
