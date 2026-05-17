import { requireAdmin } from "@/lib/auth";
import { UsersTable } from "./users-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { q, role } = await searchParams;

  let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (q) {
    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  }
  if (role && role !== "all") {
    query = query.eq("role", role);
  }
  const { data } = await query;
  const users = (data ?? []) as Profile[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          {users.length} account{users.length === 1 ? "" : "s"}
        </p>
      </div>

      <form className="flex flex-wrap gap-2">
        <Input
          name="q"
          defaultValue={q || ""}
          placeholder="Search by name or email"
          className="max-w-sm"
        />
        <Select name="role" defaultValue={role || "all"}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          Apply
        </Button>
        <div className="ml-auto">
          <a
            href={`/api/export/users${q || role ? "?" : ""}${
              new URLSearchParams({
                ...(q ? { q } : {}),
                ...(role && role !== "all" ? { role } : {}),
              }).toString()
            }`}
          >
            <Button variant="outline">Export CSV</Button>
          </a>
        </div>
      </form>

      <UsersTable users={users} />
    </div>
  );
}
