"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  plate: z.string().trim().min(1, "Plate is required").max(40),
  label: z.string().trim().min(1, "Label is required").max(80),
  model: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["active", "idle", "offline", "maintenance"]),
  last_lat: z.string().optional(),
  last_lng: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function AddVehicleDialog({
  triggerLabel = "Add vehicle",
}: {
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { status: "offline" },
  });

  async function onSubmit(values: Values) {
    setSubmitting(true);
    const payload = {
      plate: values.plate,
      label: values.label,
      model: values.model || undefined,
      description: values.description || undefined,
      status: values.status,
      last_lat: values.last_lat ? Number(values.last_lat) : null,
      last_lng: values.last_lng ? Number(values.last_lng) : null,
    };
    const res = await fetch("/api/admin/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const msg = await res.text();
      toast.error(msg || "Failed to add vehicle");
      return;
    }
    const json = (await res.json()) as {
      vehicle: { id: string; plate: string; label: string };
    };
    toast.success(
      `${json.vehicle.label} (${json.vehicle.plate}) added. Opening detail …`,
    );
    setOpen(false);
    reset({ status: "offline" });
    router.push(`/vehicles/${json.vehicle.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            className="bg-gradient-to-r from-sky-500 via-fuchsia-500 to-emerald-500 text-white shadow-md shadow-fuchsia-500/30 hover:opacity-90"
          />
        }
      >
        <Plus className="mr-1 size-4" />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a vehicle</DialogTitle>
          <DialogDescription>
            A fresh ingest token will be generated automatically. Find it on the
            vehicle&apos;s detail page after you save.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plate">Plate *</Label>
              <Input id="plate" {...register("plate")} placeholder="GPC-1006" />
              {errors.plate && (
                <p className="text-xs text-destructive">{errors.plate.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="label">Label *</Label>
              <Input id="label" {...register("label")} placeholder="Truck F" />
              {errors.label && (
                <p className="text-xs text-destructive">{errors.label.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="model">Model</Label>
            <Input id="model" {...register("model")} placeholder="Toyota Hilux" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              value={watch("status")}
              onValueChange={(v) => v && setValue("status", v as Values["status"])}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="idle">Idle</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="last_lat">Initial latitude</Label>
              <Input
                id="last_lat"
                type="number"
                step="0.000001"
                {...register("last_lat")}
                placeholder="24.7136"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_lng">Initial longitude</Label>
              <Input
                id="last_lng"
                type="number"
                step="0.000001"
                {...register("last_lng")}
                placeholder="46.6753"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Distribution route — north city"
              rows={2}
            />
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
                <Plus className="mr-1.5 size-3.5" />
              )}
              Add vehicle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
