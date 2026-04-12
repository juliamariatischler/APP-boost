import { supabase } from "@/integrations/supabase/client";

export type UserType = "student" | "teacher";

export interface CodeSession {
  user_type: UserType;
  user_id: string;
  display_name: string;
  session_id: string;
  device_id: string;
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

  const { data, error } = await supabase.rpc("login_with_code", {
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
    device_id,
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

  const { data, error } = await supabase.rpc("validate_session", {
    p_device_id: device_id,
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
    device_id,
    class_id:     result.class_id as string | undefined,
    class_name:   result.class_name as string | undefined,
    school_name:  result.school_name as string | undefined,
  };

  saveSession(session);
  return session;
}

// ── Logout ───────────────────────────────────────────────────
export async function logout(session: CodeSession): Promise<void> {
  // Best-effort deactivate on server (no RPC needed — next login will clear it)
  await supabase
    .from("active_sessions" as never)
    .update({ active: false } as never)
    .eq("id", session.session_id as never);

  clearSession();
}

// ── Teacher helpers ──────────────────────────────────────────
export interface TeacherClass {
  class_id:      string;
  class_name:    string;
  school_name:   string;
  student_count: number;
}

export async function getTeacherClasses(device_id: string): Promise<TeacherClass[]> {
  const { data, error } = await supabase.rpc("get_teacher_classes", {
    p_device_id: device_id,
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
  device_id: string,
  class_id: string
): Promise<ClassStudent[]> {
  const { data, error } = await supabase.rpc("get_class_students", {
    p_device_id: device_id,
    p_class_id:  class_id,
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown>;
  if (result && result.error) throw new Error(result.error as string);

  return (data as ClassStudent[]) ?? [];
}
