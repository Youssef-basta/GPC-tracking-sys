"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";

export function NotificationsList({
  initial,
  userId,
}: {
  initial: Notification[];
  userId: string;
}) {
  const [items, setItems] = useState<Notification[]>(initial);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`notifications-page:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "INSERT") {
              return [payload.new as Notification, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((n) =>
                n.id === (payload.new as Notification).id
                  ? (payload.new as Notification)
                  : n,
              );
            }
            if (payload.eventType === "DELETE") {
              return prev.filter(
                (n) => n.id !== (payload.old as Notification).id,
              );
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  async function markAllRead() {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
  }

  async function openOne(n: Notification) {
    if (!n.read) {
      const supabase = createClient();
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    }
    if (n.link) router.push(n.link);
  }

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {unreadCount} unread · {items.length} total
        </span>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={markAllRead}>
            <Check className="mr-1.5 size-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Bell className="mx-auto mb-2 size-6 opacity-50" />
          You don&apos;t have any notifications yet.
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => openOne(n)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/40",
                  !n.read && "border-primary/30 bg-primary/5",
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.read ? "bg-muted" : "bg-primary",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-sm", n.read && "text-muted-foreground")}>
                      {n.message}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
