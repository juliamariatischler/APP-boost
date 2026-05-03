const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROLE = {
  STUDENT: "STUDENT",
  TEACHER: "TEACHER",
  SCHOOL_ADMIN: "SCHOOL_ADMIN",
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
};

const SCOPES = {
  PERSONAL: "PERSONAL",
  CLASS: "CLASS",
  SCHOOL: "SCHOOL",
};

const CHALLENGE_STATUS = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
};

const SOURCE = {
  WORKOUT: "WORKOUT",
  BONUS: "BONUS",
  PENALTY: "PENALTY",
};

const SESSION_STATUS = {
  STARTED: "STARTED",
  SUBMITTED: "SUBMITTED",
  CANCELLED: "CANCELLED",
};

const SESSION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 Stunden

const MAX_POINTS_PER_DAY = 300;
const MAX_SCORING_WORKOUTS_PER_DAY = 2;
const STREAK_BONUS = 20;
const DAILY_GOAL_BONUS = 15;
const WEEKLY_GOAL_BONUS = 40;
const CLASS_PARTICIPATION_BONUS = 10;
const CLASS_PARTICIPATION_THRESHOLD = 0.6;
const MVP_AVATARS = ["tiger", "rocket", "falcon", "panther", "comet", "wave"];

const EXERCISE_POINTS = {
  ex_jj: 2,
  ex_squat: 3,
  ex_plank: 1,
};

const EXERCISE_LIMITS = {
  ex_jj: 400,
  ex_squat: 300,
  ex_plank: 600,
};

const LEVELS = [
  { key: "AKTIV", min_points: 0 },
  { key: "POWER", min_points: 300 },
  { key: "ELITE", min_points: 1000 },
];

// In-memory rate limiter: max 10 login attempts per IP per 15 minutes
const loginAttempts = new Map(); // ip -> { count, resetAt }
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 10;

function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }
  entry.count += 1;
  if (entry.count > RATE_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader("Retry-After", retryAfter);
    return res.status(429).json({ error: "Zu viele Anmeldeversuche. Bitte warte kurz." });
  }
  next();
}

// Periodically purge expired entries to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}, RATE_WINDOW_MS);

function buildMvpApi() {
  const router = require("express").Router();
  const dataFile = path.join(__dirname, "data", "mvp-db.json");

  ensureSeedData();

  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "boost-mvp-api", module: "fitness_m1", privacy_mode: "strict" });
  });

  router.get("/privacy/rules", (_req, res) => {
    res.json({
      no_real_name_required: true,
      video_storage: "disabled",
      motion_data_storage: "temporary_and_aggregated",
      cross_school_personal_leaderboard: false,
      school_vs_school_is_aggregated_only: true,
      gdpr_delete_supported: true,
      parental_consent_mvp: "optional",
      audit_source_of_truth: "points_ledger",
      roles: Object.values(ROLE),
    });
  });

  router.get("/avatars", (_req, res) => {
    res.json({
      available_icons: MVP_AVATARS,
      recommended_colors: ["#10b981", "#2563eb", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9"],
    });
  });

  router.post("/auth/student/login", loginRateLimiter, (req, res) => {
    const joinCodeRaw = String(req.body?.join_code || "").trim();
    const nicknameRaw = String(req.body?.nickname || "").trim();
    const avatarIcon = String(req.body?.avatar_icon || "tiger").trim().toLowerCase();
    const avatarColor = String(req.body?.avatar_color || "#10b981").trim();

    if (!joinCodeRaw || !nicknameRaw) {
      return res.status(400).json({ error: "join_code und nickname sind erforderlich." });
    }

    const joinCode = joinCodeRaw.toUpperCase();
    const nickname = nicknameRaw.slice(0, 24);
    const db = readDb();
    const cls = db.classes.find((c) => String(c.join_code || "").toUpperCase() === joinCode);
    if (!cls) return res.status(404).json({ error: "Join-Code ungueltig." });

    const school = db.schools.find((s) => s.id === cls.school_id) || null;
    let student = db.students.find(
      (s) => s.class_id === cls.id && s.display_name.toLowerCase() === nickname.toLowerCase()
    );

    if (!student) {
      const studentId = makeId("student");
      student = {
        id: studentId,
        class_id: cls.id,
        school_id: cls.school_id,
        display_name: nickname,
        avatar_config: {
          icon: MVP_AVATARS.includes(avatarIcon) ? avatarIcon : "tiger",
          color: avatarColor,
        },
        consent_status: "OPTIONAL_PENDING",
        created_at: new Date().toISOString(),
      };
      db.students.push(student);
      db.users.push({
        id: studentId,
        role: ROLE.STUDENT,
        display_name: nickname,
        school_id: cls.school_id,
        class_id: cls.id,
      });
      trackEvent(db, {
        type: "student_registered",
        actor_id: studentId,
        role: ROLE.STUDENT,
        school_id: cls.school_id,
        class_id: cls.id,
        meta: { via: "join_code" },
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    db.session_tokens = (db.session_tokens || []).filter(
      (t) => t.user_id !== student.id && new Date(t.expires_at) > new Date()
    );
    db.session_tokens.push({
      token,
      user_id: student.id,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + SESSION_TOKEN_EXPIRY_MS).toISOString(),
    });
    writeDb(db);

    res.json({
      auth: {
        user_id: student.id,
        session_token: token,
        role: ROLE.STUDENT,
        auth_header_hint: "x-user-id + x-session-token",
      },
      student: pick(student, ["id", "display_name", "avatar_config", "class_id", "school_id"]),
      class: cls,
      school,
    });
  });

  router.post("/auth/teacher/login", loginRateLimiter, (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const schoolId = String(req.body?.school_id || "school_1").trim();
    const password = String(req.body?.password || "");
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Gueltige E-Mail ist erforderlich." });
    }
    if (!password) {
      return res.status(400).json({ error: "Passwort ist erforderlich." });
    }

    const db = readDb();
    const school = db.schools.find((s) => s.id === schoolId);
    if (!school) return res.status(404).json({ error: "Schule nicht gefunden." });

    let teacher = db.users.find((u) => u.role === ROLE.TEACHER && String(u.email || "").toLowerCase() === email);
    const creds = db.teacher_credentials || [];

    if (!teacher) {
      // Neues Lehrerkonto: Passwort-Hash speichern
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.scryptSync(password, salt, 32).toString("hex");
      teacher = {
        id: makeId("teacher"),
        role: ROLE.TEACHER,
        display_name: req.body?.display_name || email.split("@")[0],
        email,
        school_id: schoolId,
        class_id: null,
      };
      db.users.push(teacher);
      db.teacher_credentials = creds;
      db.teacher_credentials.push({ user_id: teacher.id, hash: `${salt}:${hash}` });
      trackEvent(db, {
        type: "teacher_registered",
        actor_id: teacher.id,
        role: ROLE.TEACHER,
        school_id: schoolId,
        class_id: null,
        meta: { email },
      });
    } else {
      // Bestehendes Konto: Passwort verifizieren
      const existingCred = creds.find((c) => c.user_id === teacher.id);
      if (!existingCred) {
        return res.status(401).json({ error: "Konto nicht eingerichtet. Bitte Administrator kontaktieren." });
      }
      const [salt, storedHash] = existingCred.hash.split(":");
      const derived = crypto.scryptSync(password, salt, 32);
      const expected = Buffer.from(storedHash, "hex");
      if (derived.length !== expected.length || !crypto.timingSafeEqual(derived, expected)) {
        return res.status(401).json({ error: "Falsches Passwort." });
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    db.session_tokens = (db.session_tokens || []).filter(
      (t) => t.user_id !== teacher.id && new Date(t.expires_at) > new Date()
    );
    db.session_tokens.push({
      token,
      user_id: teacher.id,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + SESSION_TOKEN_EXPIRY_MS).toISOString(),
    });
    writeDb(db);

    const classes = db.classes.filter((c) => canManageClass(teacher, c));
    res.json({
      auth: {
        user_id: teacher.id,
        session_token: token,
        role: teacher.role,
        auth_header_hint: "x-user-id + x-session-token",
      },
      teacher: pick(teacher, ["id", "display_name", "email", "school_id"]),
      classes,
    });
  });

  router.use(requireAuth);

  router.get("/me", (req, res) => {
    res.json(req.user);
  });

  router.post("/auth/logout", (req, res) => {
    const db = readDb();
    const sessionToken = req.header("x-session-token");
    db.session_tokens = (db.session_tokens || []).filter(
      (t) => !(t.user_id === req.user.id && t.token === sessionToken)
    );
    writeDb(db);
    res.json({ ok: true });
  });

  router.get("/auth/demo-users", allow(ROLE.SYSTEM_ADMIN), (_req, res) => {
    const db = readDb();
    res.json(
      db.users.map((u) => ({
        id: u.id,
        role: u.role,
        display_name: u.display_name,
        email: u.email || null,
        school_id: u.school_id || null,
        class_id: u.class_id || null,
      }))
    );
  });

  router.delete("/me", (req, res) => {
    const db = readDb();
    const user = db.users.find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: "User nicht gefunden." });

    if (req.user.role === ROLE.STUDENT) {
      db.students = db.students.filter((s) => s.id !== req.user.id);
      db.workout_sessions = db.workout_sessions.filter((s) => s.student_id !== req.user.id);
      db.workout_results = db.workout_results.filter((r) => r.student_id !== req.user.id);
      db.points_ledger = db.points_ledger.filter((p) => p.student_id !== req.user.id);
    }
    db.users = db.users.filter((u) => u.id !== req.user.id);
    trackEvent(db, {
      type: "gdpr_delete",
      actor_id: req.user.id,
      role: req.user.role,
      school_id: req.user.school_id || null,
      class_id: req.user.class_id || null,
      meta: { requested_by: "self" },
    });
    writeDb(db);
    res.json({ ok: true, deleted_user_id: req.user.id });
  });

  router.get("/student/exercises", allow(ROLE.STUDENT), (_req, res) => {
    const db = readDb();
    const allowed = new Set(Object.keys(EXERCISE_POINTS));
    res.json(db.exercise_catalog.filter((e) => allowed.has(e.id)));
  });

  router.get("/student/dashboard", allow(ROLE.STUDENT), (req, res) => {
    const db = readDb();
    const student = mustStudent(db, req.user.id);
    const today = dateKey(new Date().toISOString());
    const streak = computeCurrentStreak(db, student.id);
    const pointsToday = getStudentPointsForDate(db, student.id, today);
    const totalPoints = sum(db.points_ledger.filter((x) => x.student_id === student.id).map((x) => x.points_delta));
    const workoutsToday = getScoringWorkoutsForDate(db, student.id, today);

    const classStudents = db.students.filter((s) => s.class_id === student.class_id);
    const activeToday = classStudents.filter((s) => getStudentPointsForDate(db, s.id, today) > 0).length;

    const personalGoals = getPersonalGoals(db, student.id, today);
    const badges = computeBadges(db, student.id);
    const level = computeLevel(totalPoints);

    res.json({
      student: pick(student, ["id", "display_name", "avatar_config", "school_id", "class_id"]),
      today: {
        date: today,
        points: pointsToday,
        scored_workouts: workoutsToday,
        scored_workouts_limit: MAX_SCORING_WORKOUTS_PER_DAY,
      },
      streak_days: streak,
      blitze_total: totalPoints,
      class_participation_today: classStudents.length ? round2(activeToday / classStudents.length) : 0,
      goals: personalGoals,
      level,
      badges,
    });
  });

  router.get("/student/goals", allow(ROLE.STUDENT), (req, res) => {
    const db = readDb();
    const today = dateKey(new Date().toISOString());
    res.json(getPersonalGoals(db, req.user.id, today));
  });

  router.post("/student/goals/claim", allow(ROLE.STUDENT), (req, res) => {
    const goalKey = String(req.body?.goal_key || "").toLowerCase();
    if (!["daily", "weekly"].includes(goalKey)) {
      return res.status(400).json({ error: "goal_key muss daily oder weekly sein." });
    }

    const db = readDb();
    const student = mustStudent(db, req.user.id);
    const today = dateKey(new Date().toISOString());
    const goals = getPersonalGoals(db, student.id, today);
    const goal = goals[goalKey];
    if (!goal) return res.status(400).json({ error: "Unbekanntes Ziel." });
    if (!goal.completed) return res.status(400).json({ error: "Ziel noch nicht erreicht." });
    if (goal.claimed) {
      return res.json({
        awarded: false,
        reason: "already_claimed",
        goal_key: goalKey,
        points_awarded: 0,
        blitze_total: sum(db.points_ledger.filter((p) => p.student_id === student.id).map((p) => p.points_delta)),
        blitze_today: getStudentPointsForDate(db, student.id, today),
      });
    }

    const bonus = goalKey === "daily" ? DAILY_GOAL_BONUS : WEEKLY_GOAL_BONUS;
    const remainingToday = Math.max(0, MAX_POINTS_PER_DAY - getStudentPointsForDate(db, student.id, today));
    const awarded = Math.min(bonus, remainingToday);
    if (awarded <= 0) {
      return res.json({
        awarded: false,
        reason: "daily_hardcap_reached",
        goal_key: goalKey,
        points_awarded: 0,
        blitze_total: sum(db.points_ledger.filter((p) => p.student_id === student.id).map((p) => p.points_delta)),
        blitze_today: getStudentPointsForDate(db, student.id, today),
      });
    }

    bookPoints(db, {
      student_id: student.id,
      class_id: student.class_id,
      school_id: student.school_id,
      source_type: SOURCE.BONUS,
      source_id: goal.claim_source_id,
      points_delta: awarded,
    });

    trackEvent(db, {
      type: "goal_claimed",
      actor_id: student.id,
      role: ROLE.STUDENT,
      school_id: student.school_id,
      class_id: student.class_id,
      meta: { goal_key: goalKey, points_awarded: awarded },
    });

    writeDb(db);
    res.json({
      awarded: true,
      goal_key: goalKey,
      points_awarded: awarded,
      blitze_total: sum(db.points_ledger.filter((p) => p.student_id === student.id).map((p) => p.points_delta)),
      blitze_today: getStudentPointsForDate(db, student.id, today),
    });
  });

  router.get("/student/missions/today", allow(ROLE.STUDENT), (req, res) => {
    const db = readDb();
    const student = mustStudent(db, req.user.id);
    const now = new Date().toISOString();
    const missions = db.class_missions
      .filter((m) => m.class_id === student.class_id && m.start_at <= now && m.end_at >= now)
      .map((m) => ({
        ...m,
        template: db.workout_templates.find((t) => t.id === m.template_id) || null,
      }));
    res.json(missions);
  });

  router.post("/student/workout-sessions/start", allow(ROLE.STUDENT), (req, res) => {
    const db = readDb();
    const student = mustStudent(db, req.user.id);
    const templateId = req.body?.template_id || "tpl_fitness_m1";
    const template = db.workout_templates.find((t) => t.id === templateId);

    const session = {
      id: makeId("sess"),
      student_id: student.id,
      class_id: student.class_id,
      school_id: student.school_id,
      template_id: template ? template.id : templateId,
      started_at: new Date().toISOString(),
      submitted_at: null,
      status: SESSION_STATUS.STARTED,
      evidence_type: "CAMERA_ON_DEVICE",
      // Privacy: no raw video or image bytes stored in backend.
      client_hash: sha256(`${student.id}:${Date.now()}:${Math.random()}`),
    };

    db.workout_sessions.push(session);
    trackEvent(db, {
      type: "workout_started",
      actor_id: student.id,
      role: ROLE.STUDENT,
      school_id: student.school_id,
      class_id: student.class_id,
      meta: { session_id: session.id, template_id: session.template_id },
    });
    writeDb(db);
    res.status(201).json(session);
  });

  router.post("/student/workout-sessions/:id/submit", allow(ROLE.STUDENT), (req, res) => {
    const db = readDb();
    const student = mustStudent(db, req.user.id);
    const session = db.workout_sessions.find((s) => s.id === req.params.id && s.student_id === student.id);

    if (!session) return res.status(404).json({ error: "Session nicht gefunden." });
    if (session.status !== SESSION_STATUS.STARTED) {
      return res.status(400).json({ error: "Session ist nicht im Status STARTED." });
    }

    const submittedAt = new Date().toISOString();
    const submittedDay = dateKey(submittedAt);
    const rawResults = Array.isArray(req.body?.results) ? req.body.results : [];
    const normalized = normalizeWorkoutResults(rawResults);
    if (normalized.length === 0) {
      return res.status(400).json({ error: "Mindestens ein Ergebnis (results[]) ist erforderlich." });
    }

    const flags = [];
    let points = 0;
    for (const row of normalized) {
      const limit = EXERCISE_LIMITS[row.exercise_id] || 9999;
      if (row.achieved_value > limit) flags.push(`outlier:${row.exercise_id}`);
      if (row.motion_score !== null && row.motion_score < 0.3) flags.push(`low_movement:${row.exercise_id}`);
      if (row.detection_confidence !== null && row.detection_confidence < 0.5) {
        flags.push(`poor_detection:${row.exercise_id}`);
      }
      points += row.achieved_value * (EXERCISE_POINTS[row.exercise_id] || 0);
    }

    const scoredToday = getScoringWorkoutsForDate(db, student.id, submittedDay);
    if (scoredToday >= MAX_SCORING_WORKOUTS_PER_DAY) {
      points = 0;
      flags.push("daily_scoring_limit_reached");
    }

    const pointsToday = getStudentPointsForDate(db, student.id, submittedDay);
    if (pointsToday >= MAX_POINTS_PER_DAY) {
      points = 0;
      flags.push("daily_hardcap_reached");
    } else if (pointsToday + points > MAX_POINTS_PER_DAY) {
      points = Math.max(0, MAX_POINTS_PER_DAY - pointsToday);
      flags.push("daily_hardcap_truncated");
    }

    const workoutResult = {
      id: makeId("wres"),
      session_id: session.id,
      student_id: student.id,
      class_id: student.class_id,
      school_id: student.school_id,
      calculated_points: points,
      flags: dedupe(flags),
      teacher_approved: false,
      submitted_at: submittedAt,
      // Stored output stays aggregated, no frame/video payload.
      results: normalized.map((row) => ({
        exercise_id: row.exercise_id,
        achieved_value: row.achieved_value,
        detection_confidence: row.detection_confidence,
        motion_score: row.motion_score,
      })),
    };

    session.status = SESSION_STATUS.SUBMITTED;
    session.submitted_at = submittedAt;
    db.workout_results.push(workoutResult);

    if (points > 0) {
      bookPoints(db, {
        student_id: student.id,
        class_id: student.class_id,
        school_id: student.school_id,
        source_type: SOURCE.WORKOUT,
        source_id: workoutResult.id,
        points_delta: points,
      });
    }

    const streakAfterSubmit = computeCurrentStreakAfterSubmit(db, student.id, submittedDay);
    if (streakAfterSubmit >= 3 && !hasStreakBonusToday(db, student.id, submittedDay)) {
      const remaining = Math.max(0, MAX_POINTS_PER_DAY - getStudentPointsForDate(db, student.id, submittedDay));
      if (remaining > 0) {
        bookPoints(db, {
          student_id: student.id,
          class_id: student.class_id,
          school_id: student.school_id,
          source_type: SOURCE.BONUS,
          source_id: `streak:${submittedDay}`,
          points_delta: Math.min(STREAK_BONUS, remaining),
        });
      }
    }

    const classBonus = maybeApplyClassParticipationBonus(db, student.class_id, submittedDay);

    trackEvent(db, {
      type: "workout_submitted",
      actor_id: student.id,
      role: ROLE.STUDENT,
      school_id: student.school_id,
      class_id: student.class_id,
      meta: {
        session_id: session.id,
        result_id: workoutResult.id,
        scored_points: workoutResult.calculated_points,
        flags_count: workoutResult.flags.length,
      },
    });

    writeDb(db);
    res.json({
      session_id: session.id,
      calculated_points: workoutResult.calculated_points,
      flags: workoutResult.flags,
      streak_days: computeCurrentStreak(db, student.id),
      blitze_today: getStudentPointsForDate(db, student.id, submittedDay),
      blitze_total: sum(db.points_ledger.filter((p) => p.student_id === student.id).map((p) => p.points_delta)),
      class_participation_bonus: classBonus,
    });
  });

  router.get(
    "/leaderboards/class",
    allow(ROLE.STUDENT, ROLE.TEACHER, ROLE.SCHOOL_ADMIN, ROLE.SYSTEM_ADMIN),
    (req, res) => {
      const db = readDb();
      const classId = resolveClassScope(req, db, req.query.class_id);
      if (!classId) return res.status(403).json({ error: "Kein Zugriff auf diese Klasse." });
      const top = Math.max(0, Number.parseInt(req.query.top || "0", 10) || 0);
      const includeMe = parseBool(req.query.include_me);

      const students = db.students.filter((s) => s.class_id === classId);
      const ranked = students
        .map((s) => ({
          student_id: s.id,
          display_name: s.display_name,
          avatar_config: s.avatar_config,
          points: sum(db.points_ledger.filter((x) => x.student_id === s.id).map((x) => x.points_delta)),
        }))
        .sort((a, b) => b.points - a.points)
        .map((row, idx) => ({ ...row, rank: idx + 1 }));

      let entries = top > 0 ? ranked.slice(0, top) : ranked;
      let me = null;
      if (includeMe && req.user.role === ROLE.STUDENT) {
        me = ranked.find((r) => r.student_id === req.user.id) || null;
        if (me && !entries.some((x) => x.student_id === me.student_id)) {
          entries = [...entries, me];
        }
      }

      res.json({
        class_id: classId,
        entries,
        top_limit: top || null,
        me,
        privacy: "nickname_and_avatar_only",
      });
    }
  );

  router.get("/leaderboards/student/private", allow(ROLE.STUDENT), (req, res) => {
    const db = readDb();
    const student = mustStudent(db, req.user.id);
    const today = new Date();
    const thisWeekFrom = dateKey(new Date(today.getTime() - 6 * 86400000).toISOString());
    const thisWeekTo = dateKey(today.toISOString());
    const lastWeekFrom = dateKey(new Date(today.getTime() - 13 * 86400000).toISOString());
    const lastWeekTo = dateKey(new Date(today.getTime() - 7 * 86400000).toISOString());
    const recentDays = lastNDays(14).map((day) => ({
      date: day,
      points: getStudentPointsForDate(db, student.id, day),
      workouts: getScoringWorkoutsForDate(db, student.id, day),
    }));

    const thisWeekPoints = sumPointsRange(db, student.id, thisWeekFrom, thisWeekTo);
    const lastWeekPoints = sumPointsRange(db, student.id, lastWeekFrom, lastWeekTo);

    res.json({
      student_id: student.id,
      display_name: student.display_name,
      streak_days: computeCurrentStreak(db, student.id),
      this_week: {
        from: thisWeekFrom,
        to: thisWeekTo,
        points: thisWeekPoints,
      },
      last_week: {
        from: lastWeekFrom,
        to: lastWeekTo,
        points: lastWeekPoints,
      },
      delta_points: thisWeekPoints - lastWeekPoints,
      recent_days: recentDays,
      blitze_total: sum(db.points_ledger.filter((p) => p.student_id === student.id).map((p) => p.points_delta)),
    });
  });

  router.get(
    "/leaderboards/school/classes",
    allow(ROLE.STUDENT, ROLE.TEACHER, ROLE.SCHOOL_ADMIN, ROLE.SYSTEM_ADMIN),
    (req, res) => {
      const db = readDb();
      const schoolId = resolveSchoolScope(req, req.query.school_id);
      if (!schoolId) return res.status(403).json({ error: "Kein Zugriff auf diese Schule." });

      const schoolClasses = db.classes.filter((c) => c.school_id === schoolId);
      const rows = schoolClasses
        .map((c) => {
          const classStudents = db.students.filter((s) => s.class_id === c.id);
          const points = sum(db.points_ledger.filter((x) => x.class_id === c.id).map((x) => x.points_delta));
          const active = classStudents.filter((s) => hasAnyPoints(db, s.id)).length;
          return {
            class_id: c.id,
            class_name: c.name,
            year_grade: c.year_grade,
            total_points: points,
            participation_rate: classStudents.length ? round2(active / classStudents.length) : 0,
          };
        })
        .sort((a, b) => {
          if (b.participation_rate !== a.participation_rate) return b.participation_rate - a.participation_rate;
          return b.total_points - a.total_points;
        });

      res.json({
        school_id: schoolId,
        scoring_hint: "fairness_first_participation_rate_then_points",
        entries: rows,
      });
    }
  );

  router.get("/leaderboards/schools", allow(ROLE.STUDENT, ROLE.TEACHER, ROLE.SCHOOL_ADMIN, ROLE.SYSTEM_ADMIN), (_req, res) => {
    const db = readDb();
    const rows = db.schools
      .map((s) => {
        const schoolStudents = db.students.filter((st) => st.school_id === s.id);
        const totalPoints = sum(db.points_ledger.filter((x) => x.school_id === s.id).map((x) => x.points_delta));
        const activeStudents = schoolStudents.filter((st) => hasAnyPoints(db, st.id)).length;
        const avgPointsPerActiveStudent = activeStudents ? round2(totalPoints / activeStudents) : 0;
        return {
          school_id: s.id,
          school_name: s.name,
          total_points: totalPoints,
          participation_rate: schoolStudents.length ? round2(activeStudents / schoolStudents.length) : 0,
          avg_points_per_active_student: avgPointsPerActiveStudent,
        };
      })
      .sort((a, b) => {
        if (b.participation_rate !== a.participation_rate) return b.participation_rate - a.participation_rate;
        return b.avg_points_per_active_student - a.avg_points_per_active_student;
      });
    res.json({
      scope: "school_vs_school_aggregated",
      contains_personal_data: false,
      entries: rows,
    });
  });

  router.post("/teacher/classes", allow(ROLE.TEACHER, ROLE.SCHOOL_ADMIN, ROLE.SYSTEM_ADMIN), (req, res) => {
    const { name, year_grade, teacher_id, school_id } = req.body || {};
    if (!name || !year_grade) return res.status(400).json({ error: "name und year_grade sind erforderlich." });

    const db = readDb();
    const finalSchoolId = resolveSchoolScope(req, school_id);
    if (!finalSchoolId) return res.status(403).json({ error: "Kein Zugriff auf diese Schule." });

    const cls = {
      id: makeId("class"),
      school_id: finalSchoolId,
      name,
      year_grade: Number(year_grade),
      join_code: randomCode(),
      teacher_id: teacher_id || req.user.id,
    };
    db.classes.push(cls);

    trackEvent(db, {
      type: "class_created",
      actor_id: req.user.id,
      role: req.user.role,
      school_id: finalSchoolId,
      class_id: cls.id,
      meta: { class_name: cls.name },
    });

    writeDb(db);
    res.status(201).json(cls);
  });

  router.get("/teacher/classes", allow(ROLE.TEACHER, ROLE.SCHOOL_ADMIN, ROLE.SYSTEM_ADMIN), (req, res) => {
    const db = readDb();
    const rows = db.classes.filter((cls) => canManageClass(req.user, cls));
    res.json(rows);
  });

  router.post("/teacher/classes/:id/join-code/refresh", allow(ROLE.TEACHER, ROLE.SCHOOL_ADMIN, ROLE.SYSTEM_ADMIN), (req, res) => {
    const db = readDb();
    const cls = db.classes.find((c) => c.id === req.params.id);
    if (!cls) return res.status(404).json({ error: "Klasse nicht gefunden." });
    if (!canManageClass(req.user, cls)) return res.status(403).json({ error: "Kein Zugriff auf diese Klasse." });

    cls.join_code = randomCode();
    trackEvent(db, {
      type: "join_code_refreshed",
      actor_id: req.user.id,
      role: req.user.role,
      school_id: cls.school_id,
      class_id: cls.id,
      meta: { new_join_code: cls.join_code },
    });
    writeDb(db);
    res.json({ class_id: cls.id, join_code: cls.join_code });
  });

  router.get("/teacher/templates", allow(ROLE.TEACHER, ROLE.SCHOOL_ADMIN, ROLE.SYSTEM_ADMIN), (req, res) => {
    const db = readDb();
    res.json(db.workout_templates);
  });

  router.post("/teacher/missions/activate", allow(ROLE.TEACHER, ROLE.SCHOOL_ADMIN, ROLE.SYSTEM_ADMIN), (req, res) => {
    const { class_id, template_id, start_at, end_at } = req.body || {};
    if (!class_id || !template_id || !start_at || !end_at) {
      return res.status(400).json({ error: "class_id, template_id, start_at, end_at sind erforderlich." });
    }
    const db = readDb();
    const cls = db.classes.find((c) => c.id === class_id);
    const template = db.workout_templates.find((t) => t.id === template_id);
    if (!cls || !template) return res.status(404).json({ error: "Klasse oder Template nicht gefunden." });
    if (!canManageClass(req.user, cls)) return res.status(403).json({ error: "Kein Zugriff auf diese Klasse." });

    const mission = {
      id: makeId("mission"),
      class_id,
      template_id,
      start_at,
      end_at,
      activated_by: req.user.id,
    };
    db.class_missions.push(mission);

    trackEvent(db, {
      type: "mission_activated",
      actor_id: req.user.id,
      role: req.user.role,
      school_id: cls.school_id,
      class_id: cls.id,
      meta: { mission_id: mission.id, template_id },
    });

    writeDb(db);
    res.status(201).json(mission);
  });

  router.post("/teacher/challenges", allow(ROLE.TEACHER, ROLE.SCHOOL_ADMIN, ROLE.SYSTEM_ADMIN), (req, res) => {
    const payload = req.body || {};
    const challenge = {
      id: makeId("chal"),
      scope: payload.scope || SCOPES.CLASS,
      challenger_type: payload.challenger_type || "CLASS",
      challenger_ids: payload.challenger_ids || [],
      opponent_type: payload.opponent_type || "CLASS",
      opponent_ids: payload.opponent_ids || [],
      start_at: payload.start_at,
      end_at: payload.end_at,
      scoring_mode: payload.scoring_mode || "avg_points_per_active_student",
      status: payload.status || CHALLENGE_STATUS.DRAFT,
      rewards: payload.rewards || null,
      created_by: req.user.id,
      created_at: new Date().toISOString(),
    };
    if (!challenge.start_at || !challenge.end_at) {
      return res.status(400).json({ error: "start_at und end_at sind erforderlich." });
    }

    if (challenge.scope === SCOPES.SCHOOL && req.user.role === ROLE.TEACHER) {
      return res.status(403).json({ error: "Nur SchoolAdmin/SystemAdmin darf SCHOOL-Challenges erstellen." });
    }

    const db = readDb();
    db.challenges.push(challenge);
    trackEvent(db, {
      type: "challenge_created",
      actor_id: req.user.id,
      role: req.user.role,
      school_id: req.user.school_id || null,
      class_id: req.user.class_id || null,
      meta: { challenge_id: challenge.id, scope: challenge.scope },
    });
    writeDb(db);
    res.status(201).json(challenge);
  });

  router.get("/teacher/classes/:id/overview", allow(ROLE.TEACHER, ROLE.SCHOOL_ADMIN, ROLE.SYSTEM_ADMIN), (req, res) => {
    const db = readDb();
    const cls = db.classes.find((c) => c.id === req.params.id);
    if (!cls) return res.status(404).json({ error: "Klasse nicht gefunden." });
    if (!canManageClass(req.user, cls)) return res.status(403).json({ error: "Kein Zugriff auf diese Klasse." });

    const students = db.students.filter((s) => s.class_id === cls.id);
    const daily = lastNDays(14).map((d) => {
      const points = sum(db.points_ledger.filter((x) => x.class_id === cls.id && dateKey(x.created_at) === d).map((x) => x.points_delta));
      const participants = students.filter((s) => getStudentPointsForDate(db, s.id, d) > 0).length;
      return {
        date: d,
        points,
        participants,
        participation_rate: students.length ? round2(participants / students.length) : 0,
      };
    });

    res.json({
      class: cls,
      students_total: students.length,
      participants_total: students.filter((s) => hasAnyPoints(db, s.id)).length,
      total_points: sum(db.points_ledger.filter((x) => x.class_id === cls.id).map((x) => x.points_delta)),
      daily_trend: daily,
    });
  });

  router.get("/teacher/classes/:id/dashboard", allow(ROLE.TEACHER, ROLE.SCHOOL_ADMIN, ROLE.SYSTEM_ADMIN), (req, res) => {
    const db = readDb();
    const cls = db.classes.find((c) => c.id === req.params.id);
    if (!cls) return res.status(404).json({ error: "Klasse nicht gefunden." });
    if (!canManageClass(req.user, cls)) return res.status(403).json({ error: "Kein Zugriff auf diese Klasse." });

    const students = db.students.filter((s) => s.class_id === cls.id);
    const today = dateKey(new Date().toISOString());
    const weekDays = lastNDays(7);
    const todayActive = students.filter((s) => getStudentPointsForDate(db, s.id, today) > 0);

    const activeStudents = students.filter((s) => hasAnyPoints(db, s.id));
    const inactiveStudents = students.filter((s) => !hasAnyPoints(db, s.id));

    const weeklyPoints = weekDays.map((day) => ({
      date: day,
      points: sum(db.points_ledger.filter((p) => p.class_id === cls.id && dateKey(p.created_at) === day).map((p) => p.points_delta)),
    }));

    const schoolRanking = buildSchoolClassRanking(db, cls.school_id);
    const myRanking = schoolRanking.find((r) => r.class_id === cls.id) || null;

    const suspiciousSubmits = db.workout_results
      .filter((r) => r.class_id === cls.id && Array.isArray(r.flags) && r.flags.length > 0)
      .map((r) => ({
        id: r.id,
        student_id: r.student_id,
        flags: r.flags,
        submitted_at: r.submitted_at,
      }));

    res.json({
      class: cls,
      participation_rate_today: students.length ? round2(todayActive.length / students.length) : 0,
      points_per_week: weeklyPoints,
      active_students: activeStudents.map((s) => pick(s, ["id", "display_name", "avatar_config"])),
      inactive_students: inactiveStudents.map((s) => pick(s, ["id", "display_name", "avatar_config"])),
      class_ranking_in_school: {
        current: myRanking,
        leaderboard: schoolRanking,
      },
      suspicious_submits: suspiciousSubmits,
    });
  });

  router.get("/teacher/flags", allow(ROLE.TEACHER, ROLE.SCHOOL_ADMIN, ROLE.SYSTEM_ADMIN), (req, res) => {
    const db = readDb();
    const allowedClassIds =
      req.user.role === ROLE.SYSTEM_ADMIN
        ? new Set(db.classes.map((c) => c.id))
        : req.user.role === ROLE.SCHOOL_ADMIN
          ? new Set(db.classes.filter((c) => c.school_id === req.user.school_id).map((c) => c.id))
          : new Set(db.classes.filter((c) => c.teacher_id === req.user.id).map((c) => c.id));

    const rows = db.workout_results
      .filter((r) => r.flags && r.flags.length > 0 && allowedClassIds.has(r.class_id))
      .map((r) => ({
        id: r.id,
        class_id: r.class_id,
        school_id: r.school_id,
        student_id: r.student_id,
        flags: r.flags,
        submitted_at: r.submitted_at,
      }));

    res.json(rows);
  });

  router.get("/kpi/mvp-summary", allow(ROLE.TEACHER, ROLE.SCHOOL_ADMIN, ROLE.SYSTEM_ADMIN, ROLE.SYSTEM_ADMIN), (req, res) => {
    const db = readDb();
    const date = req.query.date ? String(req.query.date) : dateKey(new Date().toISOString());
    const scopeSchoolId = req.user.role === ROLE.SYSTEM_ADMIN ? req.query.school_id || null : req.user.school_id || null;

    const scopedStudents = scopeSchoolId
      ? db.students.filter((s) => s.school_id === scopeSchoolId)
      : db.students.slice();
    const scopedStudentIds = new Set(scopedStudents.map((s) => s.id));

    const sessions = db.workout_sessions.filter((s) => scopedStudentIds.has(s.student_id));
    const startsToday = sessions.filter((s) => dateKey(s.started_at) === date).length;
    const submitsToday = sessions.filter((s) => s.status === SESSION_STATUS.SUBMITTED && dateKey(s.submitted_at) === date).length;

    const dau = new Set(
      sessions
        .filter((s) => s.status === SESSION_STATUS.SUBMITTED && dateKey(s.submitted_at) === date)
        .map((s) => s.student_id)
    ).size;

    const resultsToday = db.workout_results.filter((r) => scopedStudentIds.has(r.student_id) && dateKey(r.submitted_at) === date);
    const avgRepsPerSession = resultsToday.length
      ? round2(
          sum(
            resultsToday.map((r) => sum((r.results || []).filter((x) => x.exercise_id !== "ex_plank").map((x) => x.achieved_value)))
          ) / resultsToday.length
        )
      : 0;

    const dayMinus7 = dateKey(new Date(new Date(`${date}T00:00:00.000Z`).getTime() - 7 * 86400000).toISOString());
    const activeToday = new Set(
      sessions
        .filter((s) => s.status === SESSION_STATUS.SUBMITTED && dateKey(s.submitted_at) === date)
        .map((s) => s.student_id)
    );
    const activeDayMinus7 = new Set(
      sessions
        .filter((s) => s.status === SESSION_STATUS.SUBMITTED && dateKey(s.submitted_at) === dayMinus7)
        .map((s) => s.student_id)
    );
    const retained = [...activeDayMinus7].filter((id) => activeToday.has(id)).length;
    const retention7 = activeDayMinus7.size ? round2(retained / activeDayMinus7.size) : 0;

    const classParticipation = buildClassParticipationRate(db, date, scopedStudents);

    res.json({
      date,
      scope_school_id: scopeSchoolId,
      dau,
      workout_completion_rate: startsToday ? round2(submitsToday / startsToday) : 0,
      average_reps_per_session: avgRepsPerSession,
      retention_7d: retention7,
      class_participation_rate: classParticipation,
    });
  });

  return router;

  function requireAuth(req, res, next) {
    const userId = req.header("x-user-id");
    const sessionToken = req.header("x-session-token");
    if (!userId || !sessionToken) {
      return res.status(401).json({ error: "x-user-id und x-session-token Header erforderlich." });
    }
    const db = readDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return res.status(401).json({ error: "Unbekannter Benutzer." });
    const now = new Date();
    const tokenEntry = (db.session_tokens || []).find(
      (t) => t.token === sessionToken && t.user_id === userId && new Date(t.expires_at) > now
    );
    if (!tokenEntry) {
      return res.status(401).json({ error: "Ungültige oder abgelaufene Session. Bitte neu anmelden." });
    }
    req.user = user;
    next();
  }

  function allow(...roles) {
    return (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: "Keine Berechtigung." });
      }
      next();
    };
  }

  function canManageClass(user, cls) {
    if (user.role === ROLE.SYSTEM_ADMIN) return true;
    if (user.role === ROLE.SCHOOL_ADMIN) return cls.school_id === user.school_id;
    if (user.role === ROLE.TEACHER) return cls.teacher_id === user.id;
    return false;
  }

  function resolveClassScope(req, db, requestedClassId) {
    if (req.user.role === ROLE.SYSTEM_ADMIN) return requestedClassId || req.user.class_id || null;
    if (req.user.role === ROLE.SCHOOL_ADMIN) {
      if (!requestedClassId) return null;
      const cls = db.classes.find((c) => c.id === requestedClassId && c.school_id === req.user.school_id);
      return cls ? cls.id : null;
    }
    if (req.user.role === ROLE.TEACHER) {
      if (!requestedClassId) return null;
      const cls = db.classes.find((c) => c.id === requestedClassId && c.teacher_id === req.user.id);
      return cls ? cls.id : null;
    }
    return req.user.class_id || null;
  }

  function resolveSchoolScope(req, requestedSchoolId) {
    if (req.user.role === ROLE.SYSTEM_ADMIN) return requestedSchoolId || null;
    if (req.user.role === ROLE.SCHOOL_ADMIN) return req.user.school_id;
    if (req.user.role === ROLE.TEACHER) return req.user.school_id;
    if (req.user.role === ROLE.STUDENT) return req.user.school_id;
    return null;
  }

  function mustStudent(db, userId) {
    const student = db.students.find((s) => s.id === userId);
    if (!student) {
      throw new Error("Studentdatensatz nicht gefunden.");
    }
    return student;
  }

  function hasAnyPoints(db, studentId) {
    return db.points_ledger.some((x) => x.student_id === studentId && x.points_delta > 0);
  }

  function getScoringWorkoutsForDate(db, studentId, day) {
    return db.workout_results.filter((r) => r.student_id === studentId && dateKey(r.submitted_at) === day && r.calculated_points > 0).length;
  }

  function bookPoints(db, { student_id, class_id, school_id, source_type, source_id, points_delta }) {
    db.points_ledger.push({
      id: makeId("pl"),
      student_id,
      class_id,
      school_id,
      source_type,
      source_id,
      points_delta: Number(points_delta),
      created_at: new Date().toISOString(),
    });
  }

  function hasStreakBonusToday(db, studentId, day) {
    return db.points_ledger.some(
      (x) => x.student_id === studentId && x.source_type === SOURCE.BONUS && x.source_id === `streak:${day}`
    );
  }

  function hasClassParticipationBonusForDay(db, classId, day) {
    const sourceId = `class_participation:${classId}:${day}`;
    return db.points_ledger.some((x) => x.class_id === classId && x.source_type === SOURCE.BONUS && x.source_id === sourceId);
  }

  function maybeApplyClassParticipationBonus(db, classId, day) {
    if (!classId) return { awarded: false, reason: "missing_class" };
    if (hasClassParticipationBonusForDay(db, classId, day)) {
      return { awarded: false, reason: "already_awarded_today" };
    }

    const classStudents = db.students.filter((s) => s.class_id === classId);
    if (classStudents.length === 0) return { awarded: false, reason: "no_students" };

    const submittedIds = new Set(
      db.workout_sessions
        .filter((s) => s.class_id === classId && s.status === SESSION_STATUS.SUBMITTED && dateKey(s.submitted_at) === day)
        .map((s) => s.student_id)
    );

    const participationRate = submittedIds.size / classStudents.length;
    if (participationRate < CLASS_PARTICIPATION_THRESHOLD) {
      return { awarded: false, reason: "participation_below_threshold", participation_rate: round2(participationRate) };
    }

    let recipients = 0;
    const sourceId = `class_participation:${classId}:${day}`;
    for (const st of classStudents) {
      const remaining = Math.max(0, MAX_POINTS_PER_DAY - getStudentPointsForDate(db, st.id, day));
      if (remaining <= 0) continue;
      bookPoints(db, {
        student_id: st.id,
        class_id: st.class_id,
        school_id: st.school_id,
        source_type: SOURCE.BONUS,
        source_id: sourceId,
        points_delta: Math.min(CLASS_PARTICIPATION_BONUS, remaining),
      });
      recipients += 1;
    }

    return {
      awarded: recipients > 0,
      reason: recipients > 0 ? "threshold_reached" : "all_at_hardcap",
      recipients,
      participation_rate: round2(participationRate),
      threshold: CLASS_PARTICIPATION_THRESHOLD,
      bonus_points: CLASS_PARTICIPATION_BONUS,
    };
  }

  function getStudentPointsForDate(db, studentId, day) {
    return sum(
      db.points_ledger.filter((x) => x.student_id === studentId && dateKey(x.created_at) === day).map((x) => x.points_delta)
    );
  }

  function sumPointsRange(db, studentId, fromDay, toDay) {
    return sum(
      db.points_ledger
        .filter((x) => x.student_id === studentId)
        .filter((x) => {
          const d = dateKey(x.created_at);
          return d >= fromDay && d <= toDay;
        })
        .map((x) => x.points_delta)
    );
  }

  function computeCurrentStreakAfterSubmit(db, studentId, day) {
    const sessionDays = new Set(
      db.workout_sessions
        .filter((s) => s.student_id === studentId && s.status === SESSION_STATUS.SUBMITTED && s.submitted_at)
        .map((s) => dateKey(s.submitted_at))
    );
    sessionDays.add(day);
    return computeStreakFromDays(sessionDays, day);
  }

  function computeCurrentStreak(db, studentId) {
    const sessionDays = new Set(
      db.workout_sessions
        .filter((s) => s.student_id === studentId && s.status === SESSION_STATUS.SUBMITTED && s.submitted_at)
        .map((s) => dateKey(s.submitted_at))
    );
    return computeStreakFromDays(sessionDays, dateKey(new Date().toISOString()));
  }

  function computeStreakFromDays(daySet, startDay) {
    let streak = 0;
    let cursor = new Date(`${startDay}T00:00:00.000Z`);
    while (daySet.has(dateKey(cursor.toISOString()))) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 86400000);
    }
    return streak;
  }

  function getPersonalGoals(db, studentId, today) {
    const pointsToday = getStudentPointsForDate(db, studentId, today);
    const weekFrom = dateKey(new Date(new Date(`${today}T00:00:00.000Z`).getTime() - 6 * 86400000).toISOString());
    const weekPoints = sumPointsRange(db, studentId, weekFrom, today);
    const streak = computeCurrentStreak(db, studentId);

    const dailyTarget = 120;
    const weeklyTarget = 600;

    const dailySourceId = `goal:daily:${today}`;
    const weeklySourceId = `goal:weekly:${weekFrom}:${today}`;

    return {
      daily: {
        target_points: dailyTarget,
        current_points: pointsToday,
        completed: pointsToday >= dailyTarget,
        reward_points: DAILY_GOAL_BONUS,
        claimed: hasGoalClaimed(db, studentId, dailySourceId),
        claim_source_id: dailySourceId,
      },
      weekly: {
        target_points: weeklyTarget,
        current_points: weekPoints,
        completed: weekPoints >= weeklyTarget,
        reward_points: WEEKLY_GOAL_BONUS,
        claimed: hasGoalClaimed(db, studentId, weeklySourceId),
        claim_source_id: weeklySourceId,
      },
      streak: {
        current_days: streak,
        bonus_on_day: 3,
        bonus_points: STREAK_BONUS,
      },
    };
  }

  function computeBadges(db, studentId) {
    const allResults = db.workout_results.filter((r) => r.student_id === studentId);
    const totalReps = sum(
      allResults.map((r) => sum((r.results || []).filter((x) => x.exercise_id !== "ex_plank").map((x) => x.achieved_value)))
    );
    const totalPoints = sum(db.points_ledger.filter((p) => p.student_id === studentId).map((p) => p.points_delta));
    const streak = computeCurrentStreak(db, studentId);

    return {
      reps_100: totalReps >= 100,
      streak_5_days: streak >= 5,
      blitze_1000: totalPoints >= 1000,
    };
  }

  function computeLevel(totalPoints) {
    let current = LEVELS[0];
    for (const level of LEVELS) {
      if (totalPoints >= level.min_points) current = level;
    }
    const next = LEVELS.find((lvl) => lvl.min_points > current.min_points) || null;
    return {
      current_level: current.key,
      points_total: totalPoints,
      next_level: next ? next.key : null,
      points_to_next_level: next ? Math.max(0, next.min_points - totalPoints) : 0,
    };
  }

  function normalizeWorkoutResults(rawResults) {
    const byExercise = new Map();

    for (const item of rawResults) {
      const exerciseId = String(item.exercise_id || "").trim();
      if (!EXERCISE_POINTS[exerciseId]) continue;

      const current = byExercise.get(exerciseId) || {
        exercise_id: exerciseId,
        achieved_value: 0,
        detection_confidence: null,
        motion_score: null,
      };

      const amount = Math.max(0, Math.floor(Number(item.achieved_value || 0)));
      current.achieved_value += amount;

      if (item.detection_confidence !== undefined && item.detection_confidence !== null) {
        const conf = Number(item.detection_confidence);
        if (Number.isFinite(conf)) {
          current.detection_confidence = current.detection_confidence === null ? conf : Math.min(current.detection_confidence, conf);
        }
      }

      if (item.motion_score !== undefined && item.motion_score !== null) {
        const motion = Number(item.motion_score);
        if (Number.isFinite(motion)) {
          current.motion_score = current.motion_score === null ? motion : Math.min(current.motion_score, motion);
        }
      }

      byExercise.set(exerciseId, current);
    }

    return [...byExercise.values()];
  }

  function hasGoalClaimed(db, studentId, sourceId) {
    return db.points_ledger.some(
      (x) => x.student_id === studentId && x.source_type === SOURCE.BONUS && x.source_id === sourceId
    );
  }

  function buildSchoolClassRanking(db, schoolId) {
    return db.classes
      .filter((c) => c.school_id === schoolId)
      .map((c) => {
        const classStudents = db.students.filter((s) => s.class_id === c.id);
        const totalPoints = sum(db.points_ledger.filter((p) => p.class_id === c.id).map((p) => p.points_delta));
        const activeStudents = classStudents.filter((s) => hasAnyPoints(db, s.id)).length;
        const participationRate = classStudents.length ? round2(activeStudents / classStudents.length) : 0;
        return {
          class_id: c.id,
          class_name: c.name,
          total_points: totalPoints,
          participation_rate: participationRate,
        };
      })
      .sort((a, b) => {
        if (b.participation_rate !== a.participation_rate) return b.participation_rate - a.participation_rate;
        return b.total_points - a.total_points;
      })
      .map((row, idx) => ({ ...row, rank: idx + 1 }));
  }

  function buildClassParticipationRate(db, day, scopedStudents) {
    const studentsByClass = new Map();
    for (const student of scopedStudents) {
      const arr = studentsByClass.get(student.class_id) || [];
      arr.push(student);
      studentsByClass.set(student.class_id, arr);
    }

    const rows = [];
    for (const [classId, students] of studentsByClass.entries()) {
      const active = students.filter((s) =>
        db.workout_sessions.some(
          (w) => w.student_id === s.id && w.status === SESSION_STATUS.SUBMITTED && dateKey(w.submitted_at) === day
        )
      ).length;

      rows.push({
        class_id: classId,
        active_students: active,
        total_students: students.length,
        participation_rate: students.length ? round2(active / students.length) : 0,
      });
    }
    return rows;
  }

  function trackEvent(db, event) {
    db.kpi_events.push({
      id: makeId("evt"),
      created_at: new Date().toISOString(),
      ...event,
    });
  }

  function ensureSeedData() {
    if (!fs.existsSync(path.dirname(dataFile))) {
      fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    }
    if (fs.existsSync(dataFile)) return;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    const seed = {
      users: [
        {
          id: "student_anna",
          role: ROLE.STUDENT,
          display_name: "Anna",
          school_id: "school_1",
          class_id: "class_1",
        },
        { id: "student_ben", role: ROLE.STUDENT, display_name: "Ben", school_id: "school_1", class_id: "class_1" },
        {
          id: "teacher_mia",
          role: ROLE.TEACHER,
          display_name: "Frau Mia",
          email: "mia@schule.de",
          school_id: "school_1",
          class_id: null,
        },
        {
          id: "schooladmin_luca",
          role: ROLE.SCHOOL_ADMIN,
          display_name: "Admin Luca",
          school_id: "school_1",
          class_id: null,
        },
        {
          id: "sysadmin_root",
          role: ROLE.SYSTEM_ADMIN,
          display_name: "System Root",
          school_id: null,
          class_id: null,
        },
      ],
      schools: [
        {
          id: "school_1",
          name: "Grundschule Nord",
          region: "DE-BY",
          code: "GSN",
          settings: { leaderboard_visibility: "school_internal" },
        },
        {
          id: "school_2",
          name: "Grundschule Sued",
          region: "DE-BY",
          code: "GSS",
          settings: { leaderboard_visibility: "school_internal" },
        },
      ],
      classes: [
        { id: "class_1", school_id: "school_1", name: "2A", year_grade: 5, join_code: "JOIN2A", teacher_id: "teacher_mia" },
        { id: "class_2", school_id: "school_1", name: "2B", year_grade: 5, join_code: "JOIN2B", teacher_id: "teacher_mia" },
      ],
      students: [
        {
          id: "student_anna",
          class_id: "class_1",
          school_id: "school_1",
          display_name: "BlitzTiger",
          avatar_config: { color: "#10b981", icon: "tiger" },
          consent_status: "GRANTED",
          created_at: now.toISOString(),
        },
        {
          id: "student_ben",
          class_id: "class_1",
          school_id: "school_1",
          display_name: "MoveRocket",
          avatar_config: { color: "#2563eb", icon: "rocket" },
          consent_status: "GRANTED",
          created_at: now.toISOString(),
        },
      ],
      exercise_catalog: [
        { id: "ex_jj", name: "Hampelmann", type: "reps", unit_label: "Reps", safety_note: "Rutschfeste Schuhe." },
        { id: "ex_squat", name: "Kniebeuge", type: "reps", unit_label: "Reps", safety_note: "Ruecken neutral halten." },
        { id: "ex_plank", name: "Plank", type: "time", unit_label: "Sekunden", safety_note: "Nicht ins Hohlkreuz." },
      ],
      workout_templates: [
        {
          id: "tpl_fitness_m1",
          title: "Modul 1 Fitness",
          description: "Hampelmann, Kniebeuge und Plank",
          difficulty: 2,
          exercises: [
            { exercise_id: "ex_jj", target_value: 20, order: 1 },
            { exercise_id: "ex_squat", target_value: 15, order: 2 },
            { exercise_id: "ex_plank", target_value: 30, order: 3 },
          ],
          duration_estimate: 8,
          created_by: "system",
        },
      ],
      class_missions: [
        {
          id: "mission_seed_1",
          class_id: "class_1",
          template_id: "tpl_fitness_m1",
          start_at: now.toISOString(),
          end_at: tomorrow.toISOString(),
          activated_by: "teacher_mia",
        },
      ],
      challenges: [],
      workout_sessions: [],
      workout_results: [],
      points_ledger: [],
      kpi_events: [],
    };
    fs.writeFileSync(dataFile, JSON.stringify(seed, null, 2), "utf8");
  }

  function readDb() {
    const raw = fs.readFileSync(dataFile, "utf8");
    const db = JSON.parse(raw);
    const changed = normalizeDb(db);
    if (changed) writeDb(db);
    return db;
  }

  function writeDb(db) {
    fs.writeFileSync(dataFile, JSON.stringify(db, null, 2), "utf8");
  }
}

function normalizeDb(db) {
  let changed = false;

  const arrayKeys = [
    "users",
    "schools",
    "classes",
    "students",
    "exercise_catalog",
    "workout_templates",
    "class_missions",
    "challenges",
    "workout_sessions",
    "workout_results",
    "points_ledger",
    "kpi_events",
    "goal_rewards",
    "session_tokens",
    "teacher_credentials",
  ];

  for (const key of arrayKeys) {
    if (!Array.isArray(db[key])) {
      db[key] = [];
      changed = true;
    }
  }

  for (const teacher of db.users.filter((u) => u.role === ROLE.TEACHER)) {
    if (!teacher.email) {
      teacher.email = `${teacher.id}@schule.local`;
      changed = true;
    }
  }

  const mappedExercises = db.exercise_catalog.map((exercise) => {
    if (exercise.id === "ex_push") {
      changed = true;
      return {
        ...exercise,
        id: "ex_squat",
        name: "Kniebeuge",
        safety_note: "Ruecken neutral halten.",
      };
    }
    return exercise;
  });

  const ensureExercise = (exerciseId, payload) => {
    if (!mappedExercises.some((e) => e.id === exerciseId)) {
      mappedExercises.push(payload);
      changed = true;
    }
  };

  ensureExercise("ex_jj", { id: "ex_jj", name: "Hampelmann", type: "reps", unit_label: "Reps", safety_note: "Rutschfeste Schuhe." });
  ensureExercise("ex_squat", { id: "ex_squat", name: "Kniebeuge", type: "reps", unit_label: "Reps", safety_note: "Ruecken neutral halten." });
  ensureExercise("ex_plank", { id: "ex_plank", name: "Plank", type: "time", unit_label: "Sekunden", safety_note: "Nicht ins Hohlkreuz." });

  db.exercise_catalog = dedupeById(mappedExercises);

  for (const tpl of db.workout_templates) {
    if (!Array.isArray(tpl.exercises)) continue;
    for (const exercise of tpl.exercises) {
      if (exercise.exercise_id === "ex_push") {
        exercise.exercise_id = "ex_squat";
        changed = true;
      }
    }
  }

  if (!db.workout_templates.some((tpl) => tpl.id === "tpl_fitness_m1")) {
    db.workout_templates.push({
      id: "tpl_fitness_m1",
      title: "Modul 1 Fitness",
      description: "Hampelmann, Kniebeuge und Plank",
      difficulty: 2,
      exercises: [
        { exercise_id: "ex_jj", target_value: 20, order: 1 },
        { exercise_id: "ex_squat", target_value: 15, order: 2 },
        { exercise_id: "ex_plank", target_value: 30, order: 3 },
      ],
      duration_estimate: 8,
      created_by: "system",
    });
    changed = true;
  }

  return changed;
}

function dateKey(iso) {
  return String(iso).slice(0, 10);
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function randomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function sum(values) {
  return values.reduce((a, b) => a + Number(b || 0), 0);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function parseBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return false;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function pick(obj, keys) {
  return keys.reduce((acc, key) => {
    acc[key] = obj[key];
    return acc;
  }, {});
}

function lastNDays(n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * 86400000);
    out.push(dateKey(d.toISOString()));
  }
  return out;
}

function dedupeById(rows) {
  const map = new Map();
  for (const row of rows) map.set(row.id, row);
  return [...map.values()];
}

function dedupe(rows) {
  return [...new Set(rows)];
}

module.exports = { buildMvpApi };
