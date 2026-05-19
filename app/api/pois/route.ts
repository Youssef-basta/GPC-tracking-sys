import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  category: z.enum([
    "depot",
    "customer",
    "fuel",
    "service",
    "hospital",
    "police",
    "landmark",
    "other",
  ]),
  icon_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Hex color like #0ea5e9")
    .default("#0ea5e9"),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  is_public: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
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

  const { data, error } = await supabase
    .from("pois")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category,
      icon_color: parsed.data.icon_color,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      is_public: parsed.data.is_public,
      created_by: user.id,
    })
    .select("id, name")
    .single();
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ ok: true, poi: data });
}
