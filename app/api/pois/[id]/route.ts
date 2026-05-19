import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  category: z
    .enum([
      "depot",
      "customer",
      "fuel",
      "service",
      "hospital",
      "police",
      "landmark",
      "other",
    ])
    .optional(),
  icon_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  lat: z.number().gte(-90).lte(90).optional(),
  lng: z.number().gte(-180).lte(180).optional(),
  is_public: z.boolean().optional(),
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

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // RLS already enforces "own or admin" — just attempt the update
  const { error } = await supabase
    .from("pois")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { error } = await supabase
    .from("pois")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ ok: true });
}
