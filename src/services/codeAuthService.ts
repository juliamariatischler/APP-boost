import { supabase } from "@/integrations/supabase/client";

export type UserType = "student" | "teacher";

export interface CodeSession {
  user_type: UserType;
  user_id: string;
  display_name: string;
  session_id: string;
  session_token: string;
  device_id: string;
  expires_at?: string;
  // student-only
  class_id?: string;
  class_name?: string;
  school_name?: string;
}

const SESSION_KEY = "boost:code_session";
const DEVICE_KEY  = "boost:device_id";

// ── Device ID ────────────────────────────────────────────────
export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// ── Persist / clear session ───────────────────────────────────
export function saveSession(session: CodeSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): CodeSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as CodeSession) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ── Login with code ──────────────────────────────────────────
export async function loginWithCode(code: string): Promise<CodeSession> {
  const device_id = getOrCreateDeviceId();

  const { data, error } = await (supabase.rpc as any)("login_with_code", {
    p_code: code.trim().toUpperCase(),
    p_device_id: device_id,
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown>;
  if (result.error) throw new Error(result.error as string);

  const session: CodeSession = {
    user_type:    result.user_type as UserType,
    user_id:      result.user_id as string,
    display_name: result.display_name as string,
    session_id:   result.session_id as string,
    session_token: result.session_token as string,
    device_id,
    expires_at:   result.expires_at as string | undefined,
    class_id:     result.class_id as string | undefined,
    class_name:   result.class_name as string | undefined,
    school_name:  result.school_name as string | undefined,
  };

  saveSession(session);
  return session;
}

// ── Validate existing session ────────────────────────────────
export async function validateSession(): Promise<CodeSession | null> {
  const device_id = getOrCreateDeviceId();
  const cached = loadSession();

  if (!cached?.session_token) {
    clearSession();
    return null;
  }

  const { data, error } = await (supabase.rpc as any)("validate_session", {
    p_device_id: device_id,
    p_session_token: cached.session_token,
  });

  if (error || !data) {
    clearSession();
    return null;
  }

  const result = data as Record<string, unknown>;
  if (result.error) {
    clearSession();
    return null;
  }

  const session: CodeSession = {
    user_type:    result.user_type as UserType,
    user_id:      result.user_id as string,
    display_name: result.display_name as string,
    session_id:   result.session_id as string,
    session_token: result.session_token as string,
    device_id,
    expires_at:   result.expires_at as string | undefined,
    class_id:     result.class_id as string | undefined,
    class_name:   result.class_name as string | undefined,
    school_name:  result.school_name as string | undefined,
  };

  saveSession(session);
  return session;
}

// ── Logout ───────────────────────────────────────────────────
export async function logout(session: CodeSession): Promise<void> {
  await (supabase.rpc as any)("logout_code_session", {
    p_device_id: session.device_id,
    p_session_token: session.session_token,
  });

  clearSession();
}

// ── Teacher helpers ──────────────────────────────────────────
export interface TeacherClass {
  class_id:      string;
  class_name:    string;
  school_name:   string;
  student_count: number;
}

export async function getTeacherClasses(session: Pick<CodeSession, "device_id" | "session_token">): Promise<TeacherClass[]> {
  const { data, error } = await (supabase.rpc as any)("get_teacher_classes", {
    p_device_id: session.device_id,
    p_session_token: session.session_token,
  });

  if (error) throw new Error(error.message);
  return (data as TeacherClass[]) ?? [];
}

export interface ClassStudent {
  student_id:   string;
  display_name: string;
  first_name:   string;
}

export async function getClassStudents(
  session: Pick<CodeSession, "device_id" | "session_token">,
  class_id: string
): Promise<ClassStudent[]> {
  const { data, error } = await (supabase.rpc as any)("get_class_students", {
    p_device_id: session.device_id,
    p_session_token: session.session_token,
    p_class_id:  class_id,
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown>;
  if (result && result.error) throw new Error(result.error as string);

  return (data as ClassStudent[]) ?? [];
}
