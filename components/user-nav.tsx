"use client";

import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
      // ignore — we still want to navigate even if the request fails
    }
    // Hard navigation: clears all client-side state (React tree, supabase
    // realtime channels, in-flight RSC fetches) so we don't race the
    // session removal against any background subscriptions.
    window.location.href = "/login";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-1">
          <div className="truncate text-sm">
            {profile.full_name || profile.email}
          </div>
          <div className="truncate text-xs font-normal text-muted-foreground">
            {profile.email}
          </div>
          {profile.role === "admin" && (
            <Badge variant="secondary" className="mt-1">
              Admin
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
