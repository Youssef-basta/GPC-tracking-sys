"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Profile } from "@/lib/types";

export function UsersTable({ users }: { users: Profile[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function toggleDisabled(id: string, disabled: boolean) {
    setPending(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled: !disabled }),
    });
    setPending(null);
    if (!res.ok) {
      toast.error("Failed to update user");
      return;
    }
    toast.success(disabled ? "User reactivated" : "User deactivated");
    router.refresh();
  }

  async function toggleRole(id: string, role: "user" | "admin") {
    setPending(id);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: role === "admin" ? "user" : "admin" }),
    });
    setPending(null);
    if (!res.ok) {
      toast.error("Failed to update role");
      return;
    }
    toast.success("Role updated");
    router.refresh();
  }

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No users match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.full_name || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "admin" ? "default" : "secondary"} className="capitalize">
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {u.disabled ? (
                    <Badge variant="destructive">Disabled</Badge>
                  ) : (
                    <Badge variant="outline">Active</Badge>
                  )}
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending === u.id}
                    onClick={() => toggleRole(u.id, u.role)}
                  >
                    {u.role === "admin" ? "Demote" : "Promote"}
                  </Button>
                  <Button
                    size="sm"
                    variant={u.disabled ? "default" : "outline"}
                    disabled={pending === u.id}
                    onClick={() => toggleDisabled(u.id, u.disabled)}
                  >
                    {u.disabled ? "Reactivate" : "Deactivate"}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
