"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  LayoutDashboard,
  Truck,
  Bell,
  Users,
  ShieldAlert,
  BarChart3,
  FileBarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

const userNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vehicles", label: "Vehicles", icon: Truck },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

const adminNav = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/content", label: "Content", icon: ShieldAlert },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart },
];

export function AppSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
        <Activity className="size-5 text-primary" />
        GPC Tracking
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4 text-sm">
        <NavGroup label="Workspace" items={userNav} pathname={pathname} />
        {role === "admin" && (
          <NavGroup label="Admin" items={adminNav} pathname={pathname} />
        )}
      </nav>
    </aside>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  pathname: string;
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
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 rounded-md px-2 py-1.5 transition-all",
                  active
                    ? "bg-gradient-to-r from-sky-500/15 via-fuchsia-500/10 to-emerald-500/15 text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_rgba(99,102,241,0.15)]"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-gradient-to-b from-sky-500 via-fuchsia-500 to-emerald-500"
                  />
                )}
                <Icon className={cn("size-4", active && "text-sky-600 dark:text-sky-400")} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
