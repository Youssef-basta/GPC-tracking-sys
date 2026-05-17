"use client";

import { useEffect, useState } from "react";
import { Loader2, Wifi, WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function RealtimeStatus() {
  const [status, setStatus] = useState<
    "connecting" | "connected" | "stale" | "error"
  >("connecting");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("realtime-status")
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("connected");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("error");
        else if (s === "CLOSED") setStatus("stale");
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const label = {
    connecting: "Connecting…",
    connected: "Live",
    stale: "Stale — reconnect",
    error: "Disconnected",
  }[status];

  const icon = {
    connecting: <Loader2 className="size-3 animate-spin" />,
    connected: <Wifi className="size-3" />,
    stale: <WifiOff className="size-3" />,
    error: <WifiOff className="size-3" />,
  }[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
        status === "connected" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        (status === "stale" || status === "error") &&
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        status === "connecting" && "text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </span>
  );
}
