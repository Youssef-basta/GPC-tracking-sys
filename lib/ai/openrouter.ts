import "server-only";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export interface SummarizeOptions {
  content: string;
  systemPrompt?: string;
  model?: string;
}

export async function summarizeText({
  content,
  systemPrompt,
  model,
}: SummarizeOptions): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "X-Title": "GPC Tracking sys",
    },
    body: JSON.stringify({
      model: model || process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-4-5",
      messages: [
        {
          role: "system",
          content:
            systemPrompt ||
            "You are a concise summarizer for fleet operations. Summarize the provided activity log in 3 to 5 short, factual sentences. Highlight any anomalies, idle time, or unusual route deviations.",
        },
        { role: "user", content },
      ],
      max_tokens: 400,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const out = data.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("Empty response from model");
  return out;
}
