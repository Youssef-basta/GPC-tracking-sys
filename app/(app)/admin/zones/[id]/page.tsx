import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { PageTitle } from "@/components/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { ZoneForm } from "../zone-form";
import type { Zone } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditZonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("zones")
    .select("*")
    .eq("id", id)
    .single<Zone>();
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/zones"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        All zones
      </Link>
      <PageTitle>Edit zone</PageTitle>
      <Card>
        <CardContent className="pt-6">
          <ZoneForm mode="edit" zone={data} />
        </CardContent>
      </Card>
    </div>
  );
}
