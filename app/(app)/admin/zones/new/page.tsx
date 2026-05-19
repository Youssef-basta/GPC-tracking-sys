import { requireAdmin } from "@/lib/auth";
import { PageTitle } from "@/components/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { ZoneForm } from "../zone-form";

export const dynamic = "force-dynamic";

export default async function NewZonePage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <PageTitle>New zone</PageTitle>
      <Card>
        <CardContent className="pt-6">
          <ZoneForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
