import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

const circleSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  radius_m: z.number().gt(0).lte(1_000_000),
});

const rectangleSchema = z.object({
  north: z.number().gte(-90).lte(90),
  south: z.number().gte(-90).lte(90),
  east: z.number().gte(-180).lte(180),
  west: z.number().gte(-180).lte(180),
});

const polygonSchema = z.object({
  points: z
    .array(z.tuple([z.number().gte(-90).lte(90), z.number().gte(-180).lte(180)]))
    .min(3)
    .max(500),
});

const schema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional().or(z.literal("")),
    kind: z.enum(["circle", "rectangle", "polygon"]),
    shape: z.unknown(),
    is_prohibited: z.boolean().default(false),
    alert_on: z.enum(["enter", "exit", "both"]).default("both"),
  })
  .superRefine((val, ctx) => {
    const parser =
      val.kind === "circle"
        ? circleSchema
        : val.kind === "rectangle"
          ? rectangleSchema
          : polygonSchema;
    const r = parser.safeParse(val.shape);
    if (!r.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid shape for ${val.kind}: ${r.error.message}`,
        path: ["shape"],
      });
    }
    if (val.kind === "rectangle") {
      const s = val.shape as Record<string, number>;
      if (s.north <= s.south)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "north must be > south",
          path: ["shape", "north"],
        });
      if (s.east <= s.west)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "east must be > west",
          path: ["shape", "east"],
        });
    }
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

export async function POST(request: NextRequest) {
  const user = await requireAdminUser();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("zones")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      kind: parsed.data.kind,
      shape: parsed.data.shape as Record<string, unknown>,
      is_prohibited: parsed.data.is_prohibited,
      alert_on: parsed.data.alert_on,
      created_by: user.id,
    })
    .select("id, name")
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });

  await logAudit({
    actor_id: user.id,
    action: "zone.create",
    target_type: "zone",
    target_id: data.id,
    meta: { name: data.name, kind: parsed.data.kind },
  });

  return NextResponse.json({ ok: true, zone: data });
}
