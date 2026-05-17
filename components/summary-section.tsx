"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SummarySection({
  content,
  title = "AI summary",
  description,
}: {
  content: string;
  title?: string;
  description?: string;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Request failed (${res.status})`);
      }
      const json = (await res.json()) as { summary: string };
      setSummary(json.summary);
      setOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary" />
            {title}
          </CardTitle>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Collapse" : "Expand"}
            >
              {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          )}
          <Button size="sm" onClick={run} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 size-3.5" />
            )}
            {summary ? "Regenerate" : "Summarize"}
          </Button>
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          "text-sm text-muted-foreground",
          summary && open ? "block" : "hidden",
        )}
      >
        {summary && (
          <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-foreground">
            {summary}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
