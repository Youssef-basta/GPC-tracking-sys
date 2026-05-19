import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  plate: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(80),
  model: z.string().trim().max(80).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  driver_name: z.string().trim().max(80).optional().or(z.literal("")),
  status: z.enum(["active", "idle", "offline", "maintenance"]).default("offline"),
  last_lat: z.number().gte(-90).lte(90).optional().nullable(),
  last_lng: z.number().gte(-180).lte(180).optional().nullable(),
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vehicles")
    .insert({
      plate: parsed.data.plate,
      label: parsed.data.label,
      model: parsed.data.model || null,
      description: parsed.data.description || null,
      driver_name: parsed.data.driver_name || null,
      status: parsed.data.status,
      last_lat: parsed.data.last_lat ?? null,
      last_lng: parsed.data.last_lng ?? null,
    })
    .select("id, plate, label, ingest_token")
    .single();

  if (error) {
    if (error.code === "23505") {
      return new NextResponse(`A vehicle with plate "${parsed.data.plate}" already exists.`, { status: 409 });
    }
    return new NextResponse(error.message, { status: 500 });
  }

  await logAudit({
    actor_id: user.id,
    action: "vehicle.create",
    target_type: "vehicle",
    target_id: data.id,
    meta: { plate: data.plate, label: data.label },
  });

  return NextResponse.json({ ok: true, vehicle: data });
}
