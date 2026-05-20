"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

const userNav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/pois", label: "Places" },
  { href: "/notifications", label: "Notifications" },
  { href: "/settings", label: "Settings" },
];
const adminNav = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/zones", label: "Zones" },
  { href: "/admin/monitors", label: "Monitors" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/reports", label: "Reports" },
];

export function MobileNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" />
        }
      >
        <Menu className="size-5" />
        <span className="sr-only">Open menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Activity className="size-5 text-primary" />
            GPC Tracking
          </SheetTitle>
        </SheetHeader>
        <nav className="space-y-4 px-3 py-4 text-sm">
          <Group
            label="Workspace"
            items={userNav}
            pathname={pathname}
            onSelect={() => setOpen(false)}
          />
          {role === "admin" && (
            <Group
              label="Admin"
              items={adminNav}
              pathname={pathname}
              onSelect={() => setOpen(false)}
            />
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function Group({
  label,
  items,
  pathname,
  onSelect,
}: {
  label: string;
  items: { href: string; label: string }[];
  pathname: string;
  onSelect: () => void;
}) {
  return (
    <div>
      <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onSelect}
                className={cn(
                  "block rounded-md px-2 py-1.5",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/60",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
