import { supabase } from "@/integrations/supabase/client";
import { clearSession as clearCodeSession } from "@/services/codeAuthService";

export const CODE_SESSION_CLEARED_EVENT = "boost:code-session-cleared";

const clearSupabaseAuthStorage = () => {
  if (typeof window === "undefined") return;

  for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith("sb-") && key.endsWith("-auth-token")) {
      window.localStorage.removeItem(key);
    }
  }
};

export const logoutEverywhereOnDevice = async () => {
  clearCodeSession();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CODE_SESSION_CLEARED_EVENT));
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
  } finally {
    clearSupabaseAuthStorage();
  }
};
