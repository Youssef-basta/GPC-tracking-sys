"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ContentReport, ReportStatus } from "@/lib/types";

export function ReportActions({ report }: { report: ContentReport }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function set(status: ReportStatus) {
    setPending(true);
    const res = await fetch(`/api/admin/reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Failed to update");
      return;
    }
    toast.success("Updated");
    router.refresh();
  }

  if (report.status !== "open") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => set("dismissed")}>
        Dismiss
      </Button>
      <Button size="sm" disabled={pending} onClick={() => set("resolved")}>
        Resolve
      </Button>
    </div>
  );
}
