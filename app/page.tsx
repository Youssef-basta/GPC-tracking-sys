import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Activity,
  MapPin,
  Bell,
  Sparkles,
  ArrowRight,
  Radio,
} from "lucide-react";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Background mesh */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.18),transparent_50%),radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.18),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.16),transparent_55%)]"
      />
      {/* Animated blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 size-[480px] rounded-full bg-sky-500/30 blur-[120px] animate-blob"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 right-0 size-[420px] rounded-full bg-fuchsia-500/25 blur-[110px] animate-blob [animation-delay:-4s]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/3 size-[520px] rounded-full bg-emerald-500/20 blur-[140px] animate-blob [animation-delay:-9s]"
      />
      {/* Subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />

      <header className="relative z-10 flex items-center justify-between border-b border-white/5 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="relative grid size-9 place-items-center rounded-lg bg-gradient-to-br from-sky-400 via-fuchsia-400 to-emerald-400 shadow-lg shadow-fuchsia-500/30">
            <Activity className="size-4 text-slate-950" />
          </div>
          <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            GPC Tracking
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:bg-white/5 hover:text-white"
            >
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button
              size="sm"
              className="bg-white text-slate-950 hover:bg-slate-200"
            >
              Get started
              <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <section className="mx-auto max-w-5xl px-6 pb-12 pt-16 text-center sm:pt-24">
          {/* Live pill */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            Live realtime — streamed via Supabase
          </div>

          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            <span className="bg-gradient-to-r from-sky-300 via-white to-fuchsia-300 bg-clip-text text-transparent">
              Real-time fleet visibility,
            </span>
            <br />
            <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-300 bg-clip-text text-transparent">
              with AI on watch.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-slate-300 sm:text-lg">
            GPC Tracking centralizes every vehicle and device, surfaces idle
            time and route deviations, and tells you what to do about it —
            before downtime costs you.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/signup">
              <Button
                size="lg"
                className="group relative overflow-hidden bg-gradient-to-r from-sky-500 via-fuchsia-500 to-emerald-500 px-6 text-white shadow-lg shadow-fuchsia-500/30 transition hover:shadow-fuchsia-500/50"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 -z-10 bg-[linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.4)_50%,transparent_60%)] animate-shimmer"
                />
                Create an account
                <ArrowRight className="ml-1.5 size-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="border-white/15 bg-white/5 text-slate-100 backdrop-blur hover:bg-white/10 hover:text-white"
              >
                Sign in
              </Button>
            </Link>
          </div>

          {/* Quick stats */}
          <div className="mt-14 grid grid-cols-3 gap-4 sm:gap-8">
            <Stat label="Latency" value="<2s" hint="Tile-to-marker render" />
            <Stat label="Anomaly types" value="2+" hint="Idle · route jump" />
            <Stat label="Auth model" value="RLS" hint="Row-level enforced" />
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-5 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={<MapPin className="size-5" />}
            title="Live map"
            tint="from-sky-500/80 to-cyan-500/80"
            ring="ring-sky-400/30"
          >
            See every vehicle move in real time on an interactive map.
          </Feature>
          <Feature
            icon={<Radio className="size-5" />}
            title="Realtime data"
            tint="from-emerald-500/80 to-teal-500/80"
            ring="ring-emerald-400/30"
          >
            Supabase Realtime streams updates the instant a ping arrives.
          </Feature>
          <Feature
            icon={<Bell className="size-5" />}
            title="Notifications"
            tint="from-amber-500/80 to-orange-500/80"
            ring="ring-amber-400/30"
          >
            Anomalies and reports become in-app notifications you can act on.
          </Feature>
          <Feature
            icon={<Sparkles className="size-5" />}
            title="AI summaries"
            tint="from-fuchsia-500/80 to-violet-500/80"
            ring="ring-fuchsia-400/30"
          >
            Ask AI to condense long activity logs into a 3–5 sentence digest.
          </Feature>
        </section>

        {/* Secondary callout */}
        <section className="mx-auto max-w-5xl px-6 pb-24">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-8 backdrop-blur sm:p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-sky-500/20 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-12 size-72 rounded-full bg-emerald-500/20 blur-3xl"
            />
            <div className="relative grid gap-8 sm:grid-cols-2 sm:items-center">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Plug in real GPS devices in minutes.
                </h2>
                <p className="mt-3 text-slate-300">
                  Every vehicle gets a unique bearer token. Point your tracker
                  at our HTTP ingest endpoint and the dashboard lights up.
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/80 p-4 font-mono text-xs text-slate-300 shadow-inner">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse-soft" />
                  <span className="text-slate-400">POST /api/ingest</span>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`curl -X POST $URL/api/ingest \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"lat":24.7136,"lng":46.6753,"speed_kmh":45}'`}
                </pre>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 px-6 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} GPC Tracking sys · Built with Next.js +
        Supabase
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 backdrop-blur">
      <div className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {value}
      </div>
      <div className="mt-0.5 text-xs uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>
    </div>
  );
}

function Feature({
  icon,
  title,
  tint,
  ring,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tint: string;
  ring: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]">
      <div
        className={`mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-lg ${tint} ring-1 ${ring}`}
      >
        {icon}
      </div>
      <div className="font-semibold text-white">{title}</div>
      <p className="mt-1 text-sm text-slate-400">{children}</p>
      <div
        aria-hidden
        className="absolute -bottom-12 -right-12 size-24 rounded-full bg-white/5 opacity-0 blur-2xl transition-opacity group-hover:opacity-100"
      />
    </div>
  );
}
