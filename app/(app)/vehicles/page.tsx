import { requireProfile } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/page-title";
import { AddVehicleDialog } from "@/components/vehicle-dialog";
import { VehiclesTable } from "./vehicles-table";
import type { Vehicle } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { profile, supabase } = await requireProfile();
  const { q } = await searchParams;

  let query = supabase
    .from("vehicles")
    .select("*")
    .is("deleted_at", null)
    .order("label");
  if (q) {
    query = query.or(
      `plate.ilike.%${q}%,label.ilike.%${q}%,model.ilike.%${q}%,driver_name.ilike.%${q}%`,
    );
  }
  const { data } = await query;
  const vehicles = (data ?? []) as Vehicle[];
  const isAdmin = profile.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageTitle>Vehicles</PageTitle>
          <p className="text-sm text-muted-foreground">
            {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
            {isAdmin && " · select rows for bulk actions"}
          </p>
        </div>
        {isAdmin && <AddVehicleDialog />}
      </div>

      <form className="flex gap-2">
        <Input
          name="q"
          defaultValue={q || ""}
          placeholder="Search by plate, label, model, or driver"
          className="max-w-sm"
        />
      </form>

      <VehiclesTable vehicles={vehicles} canBulkEdit={isAdmin} />
    </div>
  );
}
