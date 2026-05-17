"use client";

import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SimulateButton() {
  const [running, setRunning] = useState(false);

  async function tick() {
    setRunning(true);
    try {
      const res = await fetch("/api/simulate?manual=1", { method: "POST" });
      if (!res.ok) throw new Error("Simulation failed");
      const json = await res.json();
      toast.success(`Simulated ${json.pings} ping(s).`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={tick} disabled={running}>
      {running ? (
        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
      ) : (
        <Zap className="mr-1.5 size-3.5" />
      )}
      Simulate ping
    </Button>
  );
}
