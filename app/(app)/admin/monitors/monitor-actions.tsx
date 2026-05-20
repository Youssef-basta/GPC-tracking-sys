"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Monitor } from "@/lib/types";

export function MonitorActions({ monitor }: { monitor: Monitor }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const res = await fetch(`/api/admin/monitors/${monitor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !monitor.is_active }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Failed to toggle");
      return;
    }
    toast.success(monitor.is_active ? "Monitor paused" : "Monitor activated");
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete monitor "${monitor.name}"?`)) return;
    setPending(true);
    const res = await fetch(`/api/admin/monitors/${monitor.id}`, {
      method: "DELETE",
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Monitor deleted");
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={toggle}
        disabled={pending}
        title={monitor.is_active ? "Pause" : "Activate"}
      >
        {monitor.is_active ? (
          <Pause className="size-3.5" />
        ) : (
          <Play className="size-3.5" />
        )}
      </Button>
      <Link href={`/admin/monitors/${monitor.id}`}>
        <Button variant="outline" size="sm">
          <Pencil className="mr-1 size-3.5" />
          Edit
        </Button>
      </Link>
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={remove}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
