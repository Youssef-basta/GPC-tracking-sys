import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  const newToken = randomUUID();
  const admin = createAdminClient();
  const { error } = await admin
    .from("vehicles")
    .update({ ingest_token: newToken, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return new NextResponse(error.message, { status: 500 });

  await logAudit({
    actor_id: user.id,
    action: "vehicle.rotate_token",
    target_type: "vehicle",
    target_id: id,
  });

  return NextResponse.json({ ok: true, ingest_token: newToken });
}
