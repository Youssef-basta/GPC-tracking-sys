import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

const conditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("speed_above"), kmh: z.number().gte(0).lte(500) }),
  z.object({ type: z.literal("speed_below"), kmh: z.number().gte(0).lte(500) }),
  z.object({
    type: z.literal("idle_above"),
    seconds: z.number().int().gte(0).lte(86400),
  }),
  z.object({
    type: z.literal("in_zone"),
    zone_ids: z.array(z.string().uuid()).min(1).max(50),
  }),
  z.object({
    type: z.literal("out_of_zone"),
    zone_ids: z.array(z.string().uuid()).min(1).max(50),
  }),
  z.object({
    type: z.literal("fuel_below"),
    percent: z.number().gte(0).lte(100),
  }),
  z.object({
    type: z.literal("temp_above"),
    celsius: z.number().gte(-50).lte(200),
  }),
  z.object({
    type: z.literal("voltage_below"),
    volts: z.number().gte(0).lte(50),
  }),
]);

const actionSchema = z.object({ type: z.literal("notify_admins") });

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
  valid_from: z.string().datetime().nullable().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  vehicle_ids: z.array(z.string().uuid()).nullable().optional(),
  conditions: z.array(conditionSchema).min(1).max(10).optional(),
  actions: z.array(actionSchema).min(1).max(5).optional(),
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
  const { error } = await admin
    .from("monitors")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return new NextResponse(error.message, { status: 500 });

  await logAudit({
    actor_id: user.id,
    action: "monitor.update",
    target_type: "monitor",
    target_id: id,
    meta: parsed.data,
  });

  return NextResponse.json({ ok: true });
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
    .from("monitors")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return new NextResponse(error.message, { status: 500 });

  await logAudit({
    actor_id: user.id,
    action: "monitor.delete",
    target_type: "monitor",
    target_id: id,
  });

  return NextResponse.json({ ok: true });
}
