"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Poi } from "@/lib/types";

export function PoiActions({ poi }: { poi: Poi }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!confirm(`Delete POI "${poi.name}"?`)) return;
    setPending(true);
    const res = await fetch(`/api/pois/${poi.id}`, { method: "DELETE" });
    setPending(false);
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("POI deleted");
    router.refresh();
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={remove}
    >
      <Trash2 className="mr-1 size-3.5" />
      Delete
    </Button>
  );
}
