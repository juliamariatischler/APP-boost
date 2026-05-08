import { supabase } from "@/integrations/supabase/client";

export type AppRole = "student" | "teacher";

const isMissingRoleColumn = (error: any) => {
  const text = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();
  return error?.code === "PGRST204" || text.includes("could not find the 'role' column");
};

export const getCurrentAppRole = async (): Promise<AppRole> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return "student";

  const metadataRole = String(session.user.user_metadata?.account_type || "").toLowerCase();
  if (metadataRole === "teacher") return "teacher";

  const { data: profile, error: profileError } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!profileError && profile?.role === "teacher") return "teacher";
  if (profileError && !isMissingRoleColumn(profileError)) {
    console.error("Role profile lookup failed:", profileError);
  }

  const { data: adminRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .eq("role", "admin")
    .maybeSingle();

  return adminRole ? "teacher" : "student";
};

export const routeForRole = (role: AppRole) => (role === "teacher" ? "/teacher-home" : "/dashboard");
