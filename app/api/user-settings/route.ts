import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  units: z.enum(["metric", "imperial"]).optional(),
  language: z.string().trim().min(2).max(8).optional(),
  default_zoom: z.number().int().gte(1).lte(20).optional(),
  show_trails: z.boolean().optional(),
  trail_points: z.number().int().gte(5).lte(200).optional(),
});

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      ...parsed.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ ok: true });
}
