"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Zone } from "@/lib/types";

export function ZoneActions({ zone }: { zone: Zone }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!confirm(`Delete zone "${zone.name}"?`)) return;
    setPending(true);
    const res = await fetch(`/api/admin/zones/${zone.id}`, { method: "DELETE" });
    setPending(false);
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Zone deleted");
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-2">
      <Link href={`/admin/zones/${zone.id}`}>
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
        <Trash2 className="mr-1 size-3.5" />
        Delete
      </Button>
    </div>
  );
}
