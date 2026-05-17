"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff, RefreshCw, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function IngestCredentials({
  vehicleId,
  initialToken,
}: {
  vehicleId: string;
  initialToken: string;
}) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken);
  const [visible, setVisible] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed — your browser blocked clipboard access");
    }
  }

  async function rotate() {
    if (!confirm("Rotate the ingest token? The current token will stop working immediately.")) {
      return;
    }
    setRotating(true);
    const res = await fetch(`/api/admin/vehicles/${vehicleId}/rotate-token`, {
      method: "POST",
    });
    setRotating(false);
    if (!res.ok) {
      toast.error("Failed to rotate token");
      return;
    }
    const json = (await res.json()) as { ingest_token: string };
    setToken(json.ingest_token);
    setVisible(true);
    toast.success("Token rotated");
    router.refresh();
  }

  const masked = visible ? token : `${token.slice(0, 8)}…${"•".repeat(20)}`;
  const url = origin ? `${origin}/api/ingest` : "/api/ingest";
  const curlExample = `curl -X POST ${url} \\
  -H "Authorization: Bearer ${visible ? token : "<TOKEN>"}" \\
  -H "Content-Type: application/json" \\
  -d '{"lat": 24.7136, "lng": 46.6753, "speed_kmh": 45, "heading": 90}'`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Terminal className="size-4" />
            GPS ingest credentials
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Point your tracker at this URL with the bearer token. Admin only.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={rotate} disabled={rotating}>
          <RefreshCw className="mr-1.5 size-3.5" />
          Rotate
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
            Endpoint
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border bg-muted/30 px-2 py-1 font-mono text-xs">
              POST {url}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(url, "Endpoint")}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
            Token
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border bg-muted/30 px-2 py-1 font-mono text-xs">
              {masked}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide" : "Show"}
            >
              {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(token, "Token")}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
            Quick test
          </div>
          <pre className="overflow-x-auto rounded-md border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed">
            {curlExample}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
