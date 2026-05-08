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
  validateSession,
  logout,
} from "@/services/codeAuthService";

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
    validateSession()
      .then(setSession)
      .finally(() => setLoading(false));
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
    if (session) await logout(session);
    setSession(null);
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
