import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  action: z.enum(["update", "delete"]),
  payload: z
    .object({
      status: z
        .enum(["active", "idle", "offline", "maintenance"])
        .optional(),
      driver_name: z.string().trim().max(80).nullable().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (actor?.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();

  if (parsed.data.action === "delete") {
    const { error } = await admin
      .from("vehicles")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", parsed.data.ids);
    if (error) return new NextResponse(error.message, { status: 500 });
    await logAudit({
      actor_id: user.id,
      action: "vehicle.bulk_soft_delete",
      target_type: "vehicle",
      meta: { count: parsed.data.ids.length, ids: parsed.data.ids },
    });
    return NextResponse.json({ ok: true, affected: parsed.data.ids.length });
  }

  // update
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.payload?.status !== undefined)
    updates.status = parsed.data.payload.status;
  if (parsed.data.payload?.driver_name !== undefined)
    updates.driver_name = parsed.data.payload.driver_name;

  if (Object.keys(updates).length === 1) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("vehicles")
    .update(updates)
    .in("id", parsed.data.ids);
  if (error) return new NextResponse(error.message, { status: 500 });

  await logAudit({
    actor_id: user.id,
    action: "vehicle.bulk_update",
    target_type: "vehicle",
    meta: {
      count: parsed.data.ids.length,
      ids: parsed.data.ids,
      payload: parsed.data.payload,
    },
  });
  return NextResponse.json({ ok: true, affected: parsed.data.ids.length });
}
