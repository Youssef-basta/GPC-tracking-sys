import { requireProfile } from "@/lib/auth";
import { NotificationsList } from "./notifications-list";
import type { Notification } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { profile, supabase } = await requireProfile();

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const items = (data ?? []) as Notification[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Live alerts for anomalies, reports, and admin actions affecting you.
        </p>
      </div>
      <NotificationsList initial={items} userId={profile.id} />
    </div>
  );
}
