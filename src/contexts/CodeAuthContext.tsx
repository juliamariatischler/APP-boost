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

    validateSession()
      .then((validatedSession) => {
        if (cancelled) return;
        const cachedSession = loadSession();
        setSession(
          cachedSession?.session_token === validatedSession?.session_token
            ? validatedSession
            : null,
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const handleSessionCleared = () => setSession(null);
    window.addEventListener(CODE_SESSION_CLEARED_EVENT, handleSessionCleared);

    return () => {
      cancelled = true;
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
