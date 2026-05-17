import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Activity, MapPin, Bell, Sparkles } from "lucide-react";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2 font-semibold">
          <Activity className="size-5 text-primary" />
          GPC Tracking
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 py-20 text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Real-time fleet visibility, with AI on watch.
          </h1>
          <p className="mt-6 text-balance text-lg text-muted-foreground">
            GPC Tracking centralizes every vehicle and device, surfaces idle
            time and route deviations, and tells you what to do about it.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/signup">
              <Button size="lg">Create an account</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Sign in
              </Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={<MapPin className="size-5" />} title="Live map">
            See every vehicle move in real time on an interactive map.
          </Feature>
          <Feature icon={<Activity className="size-5" />} title="Realtime data">
            Supabase Realtime streams updates the instant a ping arrives.
          </Feature>
          <Feature icon={<Bell className="size-5" />} title="Notifications">
            Anomalies and reports become in-app notifications you can act on.
          </Feature>
          <Feature icon={<Sparkles className="size-5" />} title="AI summaries">
            Ask AI to condense long activity logs into a 3–5 sentence digest.
          </Feature>
        </section>
      </main>

      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} GPC Tracking sys
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-2 flex items-center gap-2 text-primary">{icon}</div>
      <div className="font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
