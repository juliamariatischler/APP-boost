import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  type CodeSession,
  loginWithCode,
  validateSession,
  logout,
} from "@/services/codeAuthService";

const INACTIVITY_MS = 15 * 60 * 1000; // 15 minutes

interface CodeAuthContextValue {
  session: CodeSession | null;
  loading: boolean;
  login: (code: string) => Promise<CodeSession>;
  signOut: () => Promise<void>;
}

const CodeAuthContext = createContext<CodeAuthContextValue | null>(null);

export function CodeAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CodeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
  };

  const scheduleAutoLogout = useCallback((currentSession: CodeSession | null) => {
    clearTimer();
    if (!currentSession) return;
    inactivityTimer.current = setTimeout(async () => {
      await logout(currentSession);
      setSession(null);
    }, INACTIVITY_MS);
  }, []);

  const resetTimer = useCallback(() => {
    setSession(prev => {
      scheduleAutoLogout(prev);
      return prev;
    });
  }, [scheduleAutoLogout]);

  // Restore session on mount
  useEffect(() => {
    validateSession()
      .then(s => {
        setSession(s);
        scheduleAutoLogout(s);
      })
      .finally(() => setLoading(false));

    return clearTimer;
  }, [scheduleAutoLogout]);

  // Listen for user activity to reset inactivity timer
  useEffect(() => {
    if (!session) return;
    const events: (keyof DocumentEventMap)[] = ["touchstart", "mousedown", "keydown", "scroll"];
    events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));
    return () => events.forEach(e => document.removeEventListener(e, resetTimer));
  }, [session, resetTimer]);

  const login = useCallback(async (code: string): Promise<CodeSession> => {
    const s = await loginWithCode(code);
    setSession(s);
    scheduleAutoLogout(s);
    return s;
  }, [scheduleAutoLogout]);

  const signOut = useCallback(async () => {
    clearTimer();
    if (session) await logout(session);
    setSession(null);
  }, [session]);

  return (
    <CodeAuthContext.Provider value={{ session, loading, login, signOut }}>
      {children}
    </CodeAuthContext.Provider>
  );
}

export function useCodeAuth(): CodeAuthContextValue {
  const ctx = useContext(CodeAuthContext);
  if (!ctx) throw new Error("useCodeAuth must be used inside CodeAuthProvider");
  return ctx;
}
