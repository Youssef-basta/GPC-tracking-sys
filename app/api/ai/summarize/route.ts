import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { summarizeText } from "@/lib/ai/openrouter";

const schema = z.object({
  content: z.string().min(1).max(50_000),
  systemPrompt: z.string().optional(),
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
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const summary = await summarizeText(parsed.data);
    return NextResponse.json({ summary });
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 500 });
  }
}
