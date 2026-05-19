import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  shape: z.record(z.string(), z.unknown()).optional(),
  is_prohibited: z.boolean().optional(),
  alert_on: z.enum(["enter", "exit", "both"]).optional(),
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
    .from("zones")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return new NextResponse(error.message, { status: 500 });

  await logAudit({
    actor_id: user.id,
    action: "zone.update",
    target_type: "zone",
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
    .from("zones")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return new NextResponse(error.message, { status: 500 });

  await logAudit({
    actor_id: user.id,
    action: "zone.delete",
    target_type: "zone",
    target_id: id,
  });

  return NextResponse.json({ ok: true });
}
