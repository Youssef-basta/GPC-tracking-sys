import { requireProfile } from "@/lib/auth";
import { PageTitle } from "@/components/page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "./settings-form";
import type { UserSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS: Omit<UserSettings, "user_id" | "updated_at"> = {
  units: "metric",
  language: "en",
  default_zoom: 11,
  show_trails: false,
  trail_points: 30,
};

export default async function SettingsPage() {
  const { profile, supabase } = await requireProfile();

  const { data } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  const settings = (data as UserSettings | null) ?? {
    user_id: profile.id,
    ...DEFAULT_SETTINGS,
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Settings</PageTitle>
        <p className="text-sm text-muted-foreground">
          Personalize units, language, and map defaults for your account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm initial={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Email:</span>{" "}
            <span className="font-mono">{profile.email}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Name:</span>{" "}
            {profile.full_name || "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Role:</span>{" "}
            <span className="capitalize">{profile.role}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
