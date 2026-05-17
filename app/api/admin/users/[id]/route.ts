import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  disabled: z.boolean().optional(),
  role: z.enum(["user", "admin"]).optional(),
});

export async function PATCH(
  request: NextRequest,
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

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (id === user.id && parsed.data.role === "user") {
    return new NextResponse("You cannot demote yourself.", { status: 400 });
  }
  if (id === user.id && parsed.data.disabled === true) {
    return new NextResponse("You cannot disable your own account.", { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      ...(parsed.data.disabled !== undefined ? { disabled: parsed.data.disabled } : {}),
      ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return new NextResponse(error.message, { status: 500 });

  await logAudit({
    actor_id: user.id,
    action: "user.update",
    target_type: "profile",
    target_id: id,
    meta: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
