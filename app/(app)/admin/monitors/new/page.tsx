import { requireAdmin } from "@/lib/auth";
import { PageTitle } from "@/components/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { MonitorForm } from "../monitor-form";
import type { Vehicle, Zone } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewMonitorPage() {
  const { supabase } = await requireAdmin();
  const [{ data: vehicles }, { data: zones }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, plate, label")
      .is("deleted_at", null)
      .order("label"),
    supabase
      .from("zones")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle>New monitor</PageTitle>
      <Card>
        <CardContent className="pt-6">
          <MonitorForm
            mode="create"
            vehicles={(vehicles ?? []) as Pick<Vehicle, "id" | "plate" | "label">[]}
            zones={(zones ?? []) as Pick<Zone, "id" | "name">[]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
