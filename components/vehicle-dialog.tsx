"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Loader2 } from "lucide-react";
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
import type { Vehicle } from "@/lib/types";

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

type Props =
  | { mode?: "create"; vehicle?: undefined; redirectAfter?: boolean; triggerLabel?: string }
  | { mode: "edit"; vehicle: Vehicle; redirectAfter?: boolean; triggerLabel?: string };

export function VehicleDialog(props: Props) {
  const isEdit = props.mode === "edit";
  const v = isEdit ? props.vehicle : undefined;
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
    defaultValues: {
      plate: v?.plate ?? "",
      label: v?.label ?? "",
      model: v?.model ?? "",
      description: v?.description ?? "",
      status: v?.status ?? "offline",
      last_lat: v?.last_lat?.toString() ?? "",
      last_lng: v?.last_lng?.toString() ?? "",
    },
  });

  // When the dialog opens for edit, re-sync from the latest props
  useEffect(() => {
    if (open && v) {
      reset({
        plate: v.plate,
        label: v.label,
        model: v.model ?? "",
        description: v.description ?? "",
        status: v.status,
        last_lat: v.last_lat?.toString() ?? "",
        last_lng: v.last_lng?.toString() ?? "",
      });
    }
  }, [open, v, reset]);

  async function onSubmit(values: Values) {
    setSubmitting(true);
    const payload = {
      plate: values.plate,
      label: values.label,
      model: values.model || (isEdit ? null : undefined),
      description: values.description || (isEdit ? null : undefined),
      status: values.status,
      last_lat: values.last_lat ? Number(values.last_lat) : null,
      last_lng: values.last_lng ? Number(values.last_lng) : null,
    };
    const url = isEdit ? `/api/admin/vehicles/${v!.id}` : "/api/admin/vehicles";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const msg = await res.text();
      toast.error(msg || "Failed to save vehicle");
      return;
    }
    const json = (await res.json()) as {
      vehicle: { id: string; plate: string; label: string };
    };
    if (isEdit) {
      toast.success(`Updated ${json.vehicle.label}`);
    } else {
      toast.success(`${json.vehicle.label} (${json.vehicle.plate}) added`);
    }
    setOpen(false);
    if (!isEdit && props.redirectAfter !== false) {
      router.push(`/vehicles/${json.vehicle.id}`);
    }
    router.refresh();
  }

  const Trigger = isEdit ? (
    <Button variant="outline" size="sm">
      <Pencil className="mr-1 size-3.5" />
      {props.triggerLabel ?? "Edit"}
    </Button>
  ) : (
    <Button
      size="sm"
      className="bg-gradient-to-r from-sky-500 via-fuchsia-500 to-emerald-500 text-white shadow-md shadow-fuchsia-500/30 hover:opacity-90"
    >
      <Plus className="mr-1 size-4" />
      {props.triggerLabel ?? "Add vehicle"}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={Trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${v!.label}` : "Add a vehicle"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details below. The ingest token stays the same — rotate it separately on the detail page."
              : "A fresh ingest token will be generated automatically. Find it on the vehicle’s detail page after you save."}
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
              onValueChange={(val) =>
                val && setValue("status", val as Values["status"])
              }
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
              <Label htmlFor="last_lat">
                {isEdit ? "Latitude" : "Initial latitude"}
              </Label>
              <Input
                id="last_lat"
                type="number"
                step="0.000001"
                {...register("last_lat")}
                placeholder="24.7136"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_lng">
                {isEdit ? "Longitude" : "Initial longitude"}
              </Label>
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
              ) : isEdit ? (
                <Pencil className="mr-1.5 size-3.5" />
              ) : (
                <Plus className="mr-1.5 size-3.5" />
              )}
              {isEdit ? "Save changes" : "Add vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Back-compat thin wrappers so existing imports keep working
export function AddVehicleDialog(props: { triggerLabel?: string } = {}) {
  return <VehicleDialog mode="create" triggerLabel={props.triggerLabel} />;
}

export function EditVehicleDialog({
  vehicle,
  triggerLabel,
}: {
  vehicle: Vehicle;
  triggerLabel?: string;
}) {
  return (
    <VehicleDialog mode="edit" vehicle={vehicle} triggerLabel={triggerLabel} />
  );
}
