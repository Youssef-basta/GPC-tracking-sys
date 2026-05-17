import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function logAudit(params: {
  actor_id: string | null;
  action: string;
  target_type?: string;
  target_id?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      actor_id: params.actor_id,
      action: params.action,
      target_type: params.target_type ?? null,
      target_id: params.target_id ?? null,
      meta: params.meta ?? {},
    });
  } catch (err) {
    // never throw from audit
    console.error("audit log failed:", err);
  }
}
