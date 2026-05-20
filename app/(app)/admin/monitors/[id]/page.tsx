import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { PageTitle } from "@/components/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { MonitorForm } from "../monitor-form";
import type { Monitor, Vehicle, Zone } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditMonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data: monitor }, { data: vehicles }, { data: zones }] =
    await Promise.all([
      supabase.from("monitors").select("*").eq("id", id).single(),
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
  if (!monitor) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/monitors"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        All monitors
      </Link>
      <PageTitle>Edit monitor</PageTitle>
      <Card>
        <CardContent className="pt-6">
          <MonitorForm
            mode="edit"
            monitor={monitor as Monitor}
            vehicles={(vehicles ?? []) as Pick<Vehicle, "id" | "plate" | "label">[]}
            zones={(zones ?? []) as Pick<Zone, "id" | "name">[]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
