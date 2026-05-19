"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { POI_CATEGORIES } from "@/lib/poi";
import type { Poi, PoiCategory } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).optional(),
  category: z.enum([
    "depot",
    "customer",
    "fuel",
    "service",
    "hospital",
    "police",
    "landmark",
    "other",
  ]),
  icon_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Hex color e.g. #0ea5e9"),
  lat: z.string().refine((v) => {
    const n = Number(v);
    return !isNaN(n) && n >= -90 && n <= 90;
  }, "Latitude between -90 and 90"),
  lng: z.string().refine((v) => {
    const n = Number(v);
    return !isNaN(n) && n >= -180 && n <= 180;
  }, "Longitude between -180 and 180"),
  is_public: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function PoiDialog(
  props:
    | { mode?: "create"; poi?: undefined }
    | { mode: "edit"; poi: Poi },
) {
  const isEdit = props.mode === "edit";
  const p = isEdit ? props.poi : undefined;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const defaultsFor = (poi?: Poi): Partial<Values> => ({
    name: poi?.name ?? "",
    description: poi?.description ?? "",
    category: poi?.category ?? "depot",
    icon_color: poi?.icon_color ?? "#0ea5e9",
    lat: poi?.lat.toString() ?? "24.7136",
    lng: poi?.lng.toString() ?? "46.6753",
    is_public: poi?.is_public ?? true,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(p),
  });

  useEffect(() => {
    if (open && p) reset(defaultsFor(p));
  }, [open, p, reset]);

  async function onSubmit(values: Values) {
    setSubmitting(true);
    const payload = {
      name: values.name,
      description: values.description || (isEdit ? null : undefined),
      category: values.category,
      icon_color: values.icon_color,
      lat: Number(values.lat),
      lng: Number(values.lng),
      is_public: values.is_public,
    };
    const url = isEdit ? `/api/pois/${p!.id}` : "/api/pois";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const msg = await res.text();
      toast.error(msg || "Save failed");
      return;
    }
    toast.success(isEdit ? "POI updated" : "POI created");
    setOpen(false);
    router.refresh();
  }

  const Trigger = isEdit ? (
    <Button variant="outline" size="sm">
      <Pencil className="mr-1 size-3.5" />
      Edit
    </Button>
  ) : (
    <Button
      size="sm"
      className="bg-gradient-to-r from-sky-500 via-fuchsia-500 to-emerald-500 text-white shadow-md shadow-fuchsia-500/30 hover:opacity-90"
    >
      <Plus className="mr-1 size-4" />
      Add POI
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={Trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${p!.name}` : "Add a POI"}</DialogTitle>
          <DialogDescription>
            Mark a location on the map — depot, customer site, fuel station,
            or any other place worth referencing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register("name")} placeholder="Main depot" />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select
                value={watch("category")}
                onValueChange={(v) =>
                  v && setValue("category", v as PoiCategory)
                }
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POI_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.emoji} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="icon_color">Marker color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="icon_color"
                  className="h-9 w-12 cursor-pointer rounded border bg-background"
                  value={watch("icon_color") || "#0ea5e9"}
                  onChange={(e) => setValue("icon_color", e.target.value)}
                />
                <Input
                  className="font-mono text-xs"
                  {...register("icon_color")}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lat">Latitude *</Label>
              <Input
                id="lat"
                type="number"
                step="0.000001"
                {...register("lat")}
              />
              {errors.lat && (
                <p className="text-xs text-destructive">{errors.lat.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lng">Longitude *</Label>
              <Input
                id="lng"
                type="number"
                step="0.000001"
                {...register("lng")}
              />
              {errors.lng && (
                <p className="text-xs text-destructive">{errors.lng.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={2}
              {...register("description")}
              placeholder="Open Sun–Thu 8am–6pm"
            />
          </div>

          <div className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2">
            <Switch
              id="is_public"
              checked={watch("is_public")}
              onCheckedChange={(v) => setValue("is_public", v)}
            />
            <div className="flex-1">
              <Label htmlFor="is_public" className="cursor-pointer">
                Public
              </Label>
              <p className="text-xs text-muted-foreground">
                {watch("is_public")
                  ? "Visible to everyone in your team"
                  : "Only you (and admins) can see this"}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 size-3.5" />
              )}
              {isEdit ? "Save" : "Add POI"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
