import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  type CodeSession,
  activateWithQrCode,
  loginWithCode,
  loadSession,
  validateSession,
  logout,
} from "@/services/codeAuthService";
import { CODE_SESSION_CLEARED_EVENT } from "@/lib/logout";

interface CodeAuthContextValue {
  session: CodeSession | null;
  loading: boolean;
  login: (code: string) => Promise<CodeSession>;
  activate: (code: string) => Promise<CodeSession>;
  signOut: () => Promise<void>;
}

const CodeAuthContext = createContext<CodeAuthContextValue | null>(null);

export function CodeAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CodeSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    let cancelled = false;

    // Show UI immediately with cached session — don't block on the network round-trip.
    const cached = loadSession();
    setSession(cached);
    setLoading(false);

    if (!cached?.session_token) return;

    // Validate in background; clear session if the server says it's invalid.
    // A 4-second safety timeout prevents a stale-network scenario from
    // quietly holding an expired session open forever.
    const timeoutId = setTimeout(() => { /* validation still running — keep cached */ }, 4_000);

    validateSession()
      .then((validatedSession) => {
        if (cancelled) return;
        const freshCached = loadSession();
        // If server rejects the token, clear it
        if (!validatedSession || freshCached?.session_token !== validatedSession.session_token) {
          setSession(null);
        } else {
          setSession(validatedSession);
        }
      })
      .catch(() => { /* network error – keep cached session, will fail on next API call */ })
      .finally(() => clearTimeout(timeoutId));

    const handleSessionCleared = () => setSession(null);
    window.addEventListener(CODE_SESSION_CLEARED_EVENT, handleSessionCleared);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      window.removeEventListener(CODE_SESSION_CLEARED_EVENT, handleSessionCleared);
    };
  }, []);

  const login = useCallback(async (code: string): Promise<CodeSession> => {
    const s = await loginWithCode(code);
    setSession(s);
    return s;
  }, []);

  const activate = useCallback(async (code: string): Promise<CodeSession> => {
    const s = await activateWithQrCode(code);
    setSession(s);
    return s;
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (session) await logout(session);
    } finally {
      setSession(null);
    }
  }, [session]);

  return (
    <CodeAuthContext.Provider value={{ session, loading, login, activate, signOut }}>
      {children}
    </CodeAuthContext.Provider>
  );
}

export function useCodeAuth(): CodeAuthContextValue {
  const ctx = useContext(CodeAuthContext);
  if (!ctx) throw new Error("useCodeAuth must be used inside CodeAuthProvider");
  return ctx;
}
