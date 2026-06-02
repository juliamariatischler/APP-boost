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
  points?: number;
  // student-only
  class_id?: string;
  class_name?: string;
  school_name?: string;
}

export interface QrRegistrationContext {
  student_id: string;
  display_name: string;
  first_name: string;
  class_id: string;
  class_name: string;
  school_name: string;
  email: string;
}

export interface QrRegistrationResult {
  user_type: "student";
  user_id: string;
  student_id: string;
  display_name: string;
  class_id: string;
  class_name: string;
  school_name: string;
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
    points:       Number(result.points || 0),
    class_id:     result.class_id as string | undefined,
    class_name:   result.class_name as string | undefined,
    school_name:  result.school_name as string | undefined,
  };

  saveSession(session);
  return session;
}

export async function activateWithQrCode(code: string): Promise<CodeSession> {
  const device_id = getOrCreateDeviceId();

  const { data, error } = await (supabase.rpc as any)("activate_student_qr", {
    p_code: code.trim().toUpperCase(),
    p_device_id: device_id,
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown>;
  if (!result) throw new Error('Keine Antwort vom Server');
  if (result.error) throw new Error(result.error as string);

  const session: CodeSession = {
    user_type: result.user_type as UserType,
    user_id: result.user_id as string,
    display_name: result.display_name as string,
    session_id: result.session_id as string,
    session_token: result.session_token as string,
    device_id,
    expires_at: result.expires_at as string | undefined,
    points: Number(result.points || 0),
    class_id: result.class_id as string | undefined,
    class_name: result.class_name as string | undefined,
    school_name: result.school_name as string | undefined,
  };

  saveSession(session);
  return session;
}

const normalizeQrCode = (code: string) => code.trim().toUpperCase();

/** Wandelt einen rohen QR-Fehler in eine schülerfreundliche Meldung um. */
export function getQrActivationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();

  if (lower.includes("bereits verwendet") || lower.includes("already used")) {
    return "Dieser QR-Code wurde bereits aktiviert. Bitte bitte deine Lehrkraft, einen neuen QR-Code zu generieren.";
  }
  if (lower.includes("abgelaufen") || lower.includes("expired")) {
    return "Dieser QR-Code ist abgelaufen. Bitte bitte deine Lehrkraft um einen neuen Code.";
  }
  if (lower.includes("deaktiviert") || lower.includes("deactivated")) {
    return "Dieses Profil ist deaktiviert. Bitte wende dich an deine Lehrkraft.";
  }
  if (lower.includes("gerät") || lower.includes("geraet") || lower.includes("device") || lower.includes("verbunden")) {
    return "Dieses Profil ist bereits mit einem Gerät verbunden. Bitte bitte deine Lehrkraft, das Gerät zurückzusetzen.";
  }
  if (lower.includes("kein zugriff") || lower.includes("zugriff")) {
    return "Zugriff verweigert. Bitte wende dich an deine Lehrkraft.";
  }
  if (lower.includes("nicht angemeldet") || lower.includes("keine antwort") || lower.includes("server")) {
    return "Verbindungsfehler. Bitte versuche es erneut.";
  }

  return "Dieser QR-Code ist nicht gültig. Prüfe, ob du den neuesten Code scannst.";
}

const getQrAccountPassword = (code: string, studentId: string) =>
  `Boost-${normalizeQrCode(code)}-${studentId.slice(0, 8)}!`;

export async function activateQrAsSupabaseUser(code: string): Promise<QrRegistrationResult> {
  const normalizedCode = normalizeQrCode(code);
  const device_id = getOrCreateDeviceId();

  console.log('[BOOST QR] Schritt 1 – Aktivierung gestartet');
  console.log('[BOOST QR] Code (Anfang):', normalizedCode.slice(0, 4) + '****' + normalizedCode.slice(-4));
  console.log('[BOOST QR] Device-ID (Präfix):', device_id.slice(0, 8));

  const { data: contextData, error: contextError } = await (supabase.rpc as any)(
    "prepare_student_qr_registration",
    { p_code: normalizedCode }
  );

  console.log('[BOOST QR] Schritt 2 – prepare_student_qr_registration:', {
    hasData: !!contextData,
    rpcError: contextError?.message ?? null,
    appError: (contextData as any)?.error ?? null,
  });

  if (contextError) throw new Error(contextError.message);

  const context = contextData as QrRegistrationContext & { error?: string };
  if (!context) throw new Error("Keine Antwort vom Server");
  if (context.error) {
    console.log('[BOOST QR] prepare_student_qr_registration Fehler:', context.error);
    throw new Error(context.error);
  }

  console.log('[BOOST QR] Schritt 3 – Schülerprofil gefunden:', {
    student_id: context.student_id?.slice(0, 8),
    class_name: context.class_name,
    school_name: context.school_name,
  });

  const password = getQrAccountPassword(normalizedCode, context.student_id);

  clearSession();
  await supabase.auth.signOut();

  console.log('[BOOST QR] Schritt 4 – Alte Session gelöscht');

  const signUpResult = await supabase.auth.signUp({
    email: context.email,
    password,
    options: {
      data: {
        username: context.display_name,
        school: context.school_name,
        class: context.class_name,
        age: 10,
        account_type: "student",
      },
    },
  });

  console.log('[BOOST QR] Schritt 5 – signUp:', {
    error: signUpResult.error?.message ?? null,
    hasUser: !!signUpResult.data.user,
    hasSession: !!signUpResult.data.session,
  });

  if (signUpResult.error) {
    const message = signUpResult.error.message.toLowerCase();
    if (!message.includes("already") && !message.includes("registered")) {
      console.log('[BOOST QR] signUp Fehler (schwerwiegend):', signUpResult.error.message);
      throw signUpResult.error;
    }
    console.log('[BOOST QR] Konto bereits vorhanden – versuche Anmeldung');
  }

  const currentSession = (await supabase.auth.getSession()).data.session;
  if (!currentSession) {
    console.log('[BOOST QR] Schritt 6 – Kein Session vorhanden, melde an...');
    const signInResult = await supabase.auth.signInWithPassword({
      email: context.email,
      password,
    });

    console.log('[BOOST QR] signIn:', {
      error: signInResult.error?.message ?? null,
      hasSession: !!signInResult.data.session,
    });

    if (signInResult.error || !signInResult.data.session) {
      throw signInResult.error ?? new Error("QR-Konto konnte nicht angemeldet werden.");
    }
  } else {
    console.log('[BOOST QR] Schritt 6 – Session bereits vorhanden, weiter');
  }

  console.log('[BOOST QR] Schritt 7 – complete_student_qr_registration...');

  const { data: completionData, error: completionError } = await (supabase.rpc as any)(
    "complete_student_qr_registration",
    {
      p_code: normalizedCode,
      p_device_id: device_id,
    }
  );

  console.log('[BOOST QR] Schritt 8 – complete_student_qr_registration:', {
    hasData: !!completionData,
    rpcError: completionError?.message ?? null,
    appError: (completionData as any)?.error ?? null,
  });

  if (completionError) throw new Error(completionError.message);

  const result = completionData as QrRegistrationResult & { error?: string };
  if (!result) throw new Error("Keine Antwort vom Server");
  if (result.error) {
    console.log('[BOOST QR] complete_student_qr_registration Fehler:', result.error);
    throw new Error(result.error);
  }

  console.log('[BOOST QR] Schritt 9 – Aktivierung erfolgreich!', {
    user_id: result.user_id?.slice(0, 8),
    student_id: result.student_id?.slice(0, 8),
    class_name: result.class_name,
  });

  clearSession();
  return result;
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
    points:       Number(result.points || 0),
    class_id:     result.class_id as string | undefined,
    class_name:   result.class_name as string | undefined,
    school_name:  result.school_name as string | undefined,
  };

  saveSession(session);
  return session;
}

// ── Logout ───────────────────────────────────────────────────
export async function logout(session: CodeSession): Promise<void> {
  try {
    await (supabase.rpc as any)("logout_code_session", {
      p_device_id: session.device_id,
      p_session_token: session.session_token,
    });
  } finally {
    clearSession();
  }
}

export interface CodeDailyResult {
  date: string;
  jumping_jacks: number | null;
  push_ups: number | null;
  squats: number | null;
  planks: number | null;
  sit_ups: number | null;
  steps: number | null;
  steps_tracking_active?: boolean | null;
  updated_at?: string | null;
}

export async function getCodeStudentDashboard(
  session: Pick<CodeSession, "device_id" | "session_token">,
  weekStart: string,
  weekEnd: string
): Promise<{ points: number; daily_results: CodeDailyResult[] }> {
  const { data, error } = await (supabase.rpc as any)("get_code_student_dashboard", {
    p_device_id: session.device_id,
    p_session_token: session.session_token,
    p_week_start: weekStart,
    p_week_end: weekEnd,
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown>;
  if (result?.error) throw new Error(result.error as string);

  return {
    points: Number(result.points || 0),
    daily_results: (result.daily_results as CodeDailyResult[]) ?? [],
  };
}

export async function saveCodeStudentCounterResults(
  session: Pick<CodeSession, "device_id" | "session_token">,
  date: string,
  deltas: {
    jumping_jacks?: number;
    push_ups?: number;
    squats?: number;
    planks?: number;
    sit_ups?: number;
  }
): Promise<{ points_awarded: number; total_points: number }> {
  const { data, error } = await (supabase.rpc as any)("save_code_student_counter_results", {
    p_device_id: session.device_id,
    p_session_token: session.session_token,
    p_date: date,
    p_jumping_jacks_delta: deltas.jumping_jacks || 0,
    p_push_ups_delta: deltas.push_ups || 0,
    p_squats_delta: deltas.squats || 0,
    p_planks_delta: deltas.planks || 0,
    p_sit_ups_delta: deltas.sit_ups || 0,
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown>;
  if (result?.error) throw new Error(result.error as string);

  return {
    points_awarded: Number(result.points_awarded || 0),
    total_points: Number(result.total_points || 0),
  };
}

// ── Teacher helpers ──────────────────────────────────────────
export interface TeacherClass {
  class_id:      string;
  class_name:    string;
  school_id?:    string;
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
  student_id: string;
  auth_user_id?: string | null;
  progress_user_id?: string | null;
  display_name: string;
  first_name: string;
  points?: number;
  active?: boolean;
  activated_at?: string | null;
  device_id?: string | null;
  activation_code_created_at?: string | null;
  activation_code_used_at?: string | null;
  is_profile_student?: boolean;
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

export interface ActivationResult {
  student_id: string;
  activation_code: string;
}

export async function getTeacherClassesAuth(): Promise<TeacherClass[]> {
  const { data, error } = await (supabase.rpc as any)("teacher_get_classes_auth");

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown>;
  if (result && result.error) throw new Error(result.error as string);

  return (data as TeacherClass[]) ?? [];
}

export async function getClassStudentsAuth(class_id: string): Promise<ClassStudent[]> {
  const { data, error } = await (supabase.rpc as any)("teacher_get_students_auth", {
    p_class_id: class_id,
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown>;
  if (result && result.error) throw new Error(result.error as string);

  return (data as ClassStudent[]) ?? [];
}

export async function addStudentAuth(class_id: string, first_name: string): Promise<ActivationResult> {
  const { data, error } = await (supabase.rpc as any)("teacher_add_student_auth", {
    p_class_id: class_id,
    p_first_name: first_name.trim(),
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown>;
  if (result.error) throw new Error(result.error as string);

  return {
    student_id: result.student_id as string,
    activation_code: result.activation_code as string,
  };
}

export async function generateActivationCodeAuth(student_id: string): Promise<ActivationResult> {
  const { data, error } = await (supabase.rpc as any)("teacher_generate_student_activation_auth", {
    p_student_id: student_id,
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown>;
  if (result.error) throw new Error(result.error as string);

  return {
    student_id: result.student_id as string,
    activation_code: result.activation_code as string,
  };
}

export async function resetStudentDeviceAuth(student_id: string): Promise<{ activation_code?: string }> {
  const { data, error } = await (supabase.rpc as any)("teacher_reset_student_device_auth", {
    p_student_id: student_id,
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown> | null;
  if (result?.error) throw new Error(result.error as string);
  return { activation_code: result?.activation_code as string | undefined };
}

export async function deactivateStudentAuth(student_id: string): Promise<void> {
  const { data, error } = await (supabase.rpc as any)("teacher_deactivate_student_auth", {
    p_student_id: student_id,
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown> | null;
  if (result?.error) throw new Error(result.error as string);
}

// ── Code-auth write operations ────────────────────────────────────────────────

type SessionParams = Pick<CodeSession, "device_id" | "session_token">;

export async function addStudent(
  session: SessionParams,
  class_id: string,
  first_name: string,
): Promise<ActivationResult> {
  const { data, error } = await (supabase.rpc as any)("teacher_add_student", {
    p_device_id: session.device_id,
    p_session_token: session.session_token,
    p_class_id: class_id,
    p_first_name: first_name.trim(),
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown>;
  if (result.error) throw new Error(result.error as string);

  return {
    student_id: result.student_id as string,
    activation_code: result.activation_code as string,
  };
}

export async function generateActivationCode(
  session: SessionParams,
  student_id: string,
): Promise<ActivationResult> {
  const { data, error } = await (supabase.rpc as any)("teacher_generate_student_activation", {
    p_device_id: session.device_id,
    p_session_token: session.session_token,
    p_student_id: student_id,
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown>;
  if (result.error) throw new Error(result.error as string);

  return {
    student_id: result.student_id as string,
    activation_code: result.activation_code as string,
  };
}

export async function resetStudentDevice(
  session: SessionParams,
  student_id: string,
): Promise<{ activation_code?: string }> {
  const { data, error } = await (supabase.rpc as any)("teacher_reset_student_device", {
    p_device_id: session.device_id,
    p_session_token: session.session_token,
    p_student_id: student_id,
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown> | null;
  if (result?.error) throw new Error(result.error as string);

  return { activation_code: result?.activation_code as string | undefined };
}

export async function deactivateStudent(
  session: SessionParams,
  student_id: string,
): Promise<void> {
  const { data, error } = await (supabase.rpc as any)("teacher_deactivate_student", {
    p_device_id: session.device_id,
    p_session_token: session.session_token,
    p_student_id: student_id,
  });

  if (error) throw new Error(error.message);

  const result = data as Record<string, unknown> | null;
  if (result?.error) throw new Error(result.error as string);
}
