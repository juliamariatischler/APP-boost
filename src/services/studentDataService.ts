import { supabase } from "@/integrations/supabase/client";

// ── Types ─────────────────────────────────────────────────────

export interface StudentStats {
  weekly_points:       number;
  total_points:        number;
  active_days_week:    number;
  class_rank:          number;
  today_push_ups:      number;
  today_squats:        number;
  today_situps:        number;
  today_planks_sec:    number;
  today_jumping_jacks: number;
  today_points:        number;
}

export interface LeaderboardEntry {
  student_id:    string;
  display_name:  string;
  weekly_points: number;
  is_me:         boolean;
  rank:          number;
}

export interface SchoolRankEntry {
  class_id:      string;
  class_name:    string;
  weekly_points: number;
  is_my_class:   boolean;
  rank:          number;
}

export interface ClassQuest {
  id:            string;
  title:         string;
  exercise_type: string;
  target_reps:   number;
  current_reps:  number;
  my_reps:       number;
  percent:       number;
  ends_at:       string;
  days_left:     number;
  reward_points: number;
}

// ── localStorage keys written by exercise HTML pages ─────────
const EXERCISE_KEYS: Record<string, keyof Pick<LogExerciseArgs, "p_pushups"|"p_squats"|"p_situps"|"p_planks_seconds"|"p_jumping_jacks">> = {
  pushups_result:       "p_pushups",
  squats_result:        "p_squats",
  situps_result:        "p_situps",
  planks_result:        "p_planks_seconds",
  jumpingjacks_result:  "p_jumping_jacks",
};

const MAX_VALUES: Record<string, number> = {
  pushups_result:      200,
  squats_result:       300,
  situps_result:       300,
  planks_result:       600,  // seconds
  jumpingjacks_result: 500,
};

interface LogExerciseArgs {
  p_pushups:        number;
  p_squats:         number;
  p_situps:         number;
  p_planks_seconds: number;
  p_jumping_jacks:  number;
}

// ── Helpers ───────────────────────────────────────────────────

function rpcErr(data: unknown): string | null {
  if (data && typeof data === "object" && "error" in data) {
    return String((data as Record<string, unknown>).error);
  }
  return null;
}

// ── APIs ──────────────────────────────────────────────────────

/** Read exercise results from localStorage (written by exercise HTML pages),
 *  call log_exercise RPC, then clear the keys. Returns points awarded. */
export async function flushLocalExerciseResults(deviceId: string): Promise<number> {
  const args: LogExerciseArgs = {
    p_pushups: 0, p_squats: 0, p_situps: 0,
    p_planks_seconds: 0, p_jumping_jacks: 0,
  };
  let hasAny = false;

  for (const [lsKey, argKey] of Object.entries(EXERCISE_KEYS)) {
    const raw = localStorage.getItem(lsKey);
    if (!raw) continue;
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val > 0 && val <= (MAX_VALUES[lsKey] ?? 9999)) {
      args[argKey] = val;
      hasAny = true;
    }
    localStorage.removeItem(lsKey);
  }

  if (!hasAny) return 0;

  const { data, error } = await supabase.rpc("log_exercise", {
    p_device_id: deviceId,
    ...args,
  });
  if (error) throw new Error(error.message);
  const err = rpcErr(data);
  if (err) throw new Error(err);
  return (data as Record<string, unknown>).points_awarded as number ?? 0;
}

export async function getStudentStats(deviceId: string): Promise<StudentStats> {
  const { data, error } = await supabase.rpc("get_student_stats", { p_device_id: deviceId });
  if (error) throw new Error(error.message);
  const err = rpcErr(data);
  if (err) throw new Error(err);
  return data as StudentStats;
}

export async function getClassLeaderboard(deviceId: string): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc("get_class_leaderboard", { p_device_id: deviceId });
  if (error) throw new Error(error.message);
  if (Array.isArray(data)) return data as LeaderboardEntry[];
  const err = rpcErr(data);
  if (err) throw new Error(err);
  return [];
}

export async function getSchoolRanking(deviceId: string): Promise<SchoolRankEntry[]> {
  const { data, error } = await supabase.rpc("get_school_ranking", { p_device_id: deviceId });
  if (error) throw new Error(error.message);
  if (Array.isArray(data)) return data as SchoolRankEntry[];
  const err = rpcErr(data);
  if (err) throw new Error(err);
  return [];
}

export async function getClassQuest(deviceId: string): Promise<ClassQuest | null> {
  const { data, error } = await supabase.rpc("get_class_quest", { p_device_id: deviceId });
  if (error) throw new Error(error.message);
  const result = data as Record<string, unknown>;
  const err = rpcErr(result);
  if (err) throw new Error(err);
  return (result.quest as ClassQuest | null) ?? null;
}

// ── Exercise type labels ─────────────────────────────────────

export const EXERCISE_LABELS: Record<string, string> = {
  pushup:       "Liegestütze",
  squat:        "Kniebeugen",
  situp:        "Sit-ups",
  plank:        "Plank (Sek.)",
  jumping_jack: "Hampelmänner",
};
