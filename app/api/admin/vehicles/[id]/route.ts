import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

const patchSchema = z.object({
  plate: z.string().trim().min(1).max(40).optional(),
  label: z.string().trim().min(1).max(80).optional(),
  model: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(["active", "idle", "offline", "maintenance"]).optional(),
  last_lat: z.number().gte(-90).lte(90).nullable().optional(),
  last_lng: z.number().gte(-180).lte(180).nullable().optional(),
});

async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (actor?.role !== "admin") return null;
  return user;
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireAdminUser();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("vehicles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return new NextResponse(error.message, { status: 500 });

  await logAudit({
    actor_id: user.id,
    action: "vehicle.soft_delete",
    target_type: "vehicle",
    target_id: id,
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireAdminUser();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vehicles")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, plate, label")
    .single();

  if (error) {
    if (error.code === "23505") {
      return new NextResponse(
        `A vehicle with plate "${parsed.data.plate}" already exists.`,
        { status: 409 },
      );
    }
    return new NextResponse(error.message, { status: 500 });
  }

  await logAudit({
    actor_id: user.id,
    action: "vehicle.update",
    target_type: "vehicle",
    target_id: id,
    meta: parsed.data,
  });

  return NextResponse.json({ ok: true, vehicle: data });
}
