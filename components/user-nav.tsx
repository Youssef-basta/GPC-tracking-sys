"use client";

import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@/lib/types";

export function UserNav({ profile }: { profile: Profile }) {
  const initials = (profile.full_name || profile.email)
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function signOut() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // ignore — we still navigate even if the request fails
    }
    // Hard navigation: avoids the RSC refresh race with the
    // already-removed session cookie on routes with realtime subscriptions.
    window.location.href = "/login";
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            className="relative size-9 rounded-full p-0"
          />
        }
      >
        <Avatar className="size-9">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        <div className="space-y-0.5 px-2 py-1.5">
          <div className="truncate text-sm font-medium">
            {profile.full_name || profile.email}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {profile.email}
          </div>
          {profile.role === "admin" && (
            <Badge variant="secondary" className="mt-1">
              Admin
            </Badge>
          )}
        </div>
        <div className="my-1 border-t" />
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </PopoverContent>
    </Popover>
  );
}
