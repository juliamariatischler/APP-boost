import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, Loader2, X } from "lucide-react";
import { BOOST_POINT_RULES } from "@/lib/gamification";
import tryitFootballNetImg from "@/assets/quest-tryit-football-net.png";

const POINTS_PROBETRAINING = BOOST_POINT_RULES.tryItProbetraining;
const POINTS_KURS = BOOST_POINT_RULES.tryItCompleted;
const TRIAL_STATUS = "Probetraining verfügbar";
const PHONE_REGEX = /^\+?[0-9\s\/\-()]{7,20}$/;

// ─── Types ────────────────────────────────────────────────────────────────────

type Club = {
  id: string;
  name: string;
  sport_type: string;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  logo_url: string | null;
};

type TrialSession = {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string | null;
  location: string;
  address: string | null;
  max_participants: number;
  min_age: number | null;
  max_age: number | null;
  requirements: string | null;
  clubs: Club | null;
};

type Registration = {
  session_id: string;
  status: string;
};

type TryItFilter = "all" | "probetraining" | "highlight";

type StaticProvider = {
  id: string;
  sport: string;
  club: string;
  trialInfo: string;
  ageLabel: string;
  contactPhone?: string;
  contactEmail?: string;
};

// ─── Static providers (Probetraining verfügbar) ───────────────────────────────

const STATIC_PROVIDERS: StaticProvider[] = [
  { id: "aikido-graz", sport: "Aikido", club: "ASKÖ-Aikido-Club Graz", trialInfo: "Probetraining für Kinder und Erwachsene nach Vereinbarung.", ageLabel: "Kinder und Erwachsene", contactPhone: "0664/1012658", contactEmail: "guenther.steger@gmx.at" },
  { id: "football-giants", sport: "American Football", club: "GIANTS Graz", trialInfo: "Probetraining nach Vereinbarung möglich.", ageLabel: "8 bis 15 Jahre", contactPhone: "0660/3217248", contactEmail: "office@grazgiants.at" },
  { id: "badminton-smash", sport: "Badminton", club: "BC Smash Graz", trialInfo: "Probetraining nach Vereinbarung möglich.", ageLabel: "Alle Altersgruppen", contactPhone: "0650/5809058", contactEmail: "ruediger_rudolf@yahoo.de" },
  { id: "badminton-dropin", sport: "Badminton", club: "Drop In Badminton", trialInfo: "Flexibles Probetraining nach Vereinbarung.", ageLabel: "Alle Altersgruppen", contactPhone: "0699/11881222", contactEmail: "schmidt@dropin.at" },
  { id: "baseball-dirtysox", sport: "Baseball", club: "Baseballverein Dirty Sox", trialInfo: "Probetraining November bis März nach Vereinbarung.", ageLabel: "Alle Altersgruppen", contactPhone: "0650/3006954", contactEmail: "baseball@dirtysoxgraz.com" },
  { id: "basketball-dbbc", sport: "Basketball", club: "Damen-Basketballclub Graz (DBBC)", trialInfo: "Probetraining nach Vereinbarung möglich.", ageLabel: "10 bis 13 Jahre", contactPhone: "0664/1870654", contactEmail: "peter.dudau@dbbc.at" },
  { id: "cheerleading-giants", sport: "Cheerleading", club: "GIANTS Graz Cheerleading", trialInfo: "Probetraining nach Vereinbarung möglich.", ageLabel: "Alle Altersgruppen", contactPhone: "0660/3217248", contactEmail: "office@grazgiants.at" },
  { id: "cheerleading-royals", sport: "Cheerleading", club: "Graz Cheerleading Royals", trialInfo: "Probetraining nach Vereinbarung möglich.", ageLabel: "Alle Altersgruppen", contactPhone: "0664/1256882", contactEmail: "office@grazroyals.at" },
  { id: "futsal-panthera", sport: "Futsal", club: "Panthera Graz Futsal Akademie", trialInfo: "Probetraining nach Vereinbarung möglich.", ageLabel: "Alle Altersgruppen", contactPhone: "6607245799", contactEmail: "office@panthera-graz.at" },
  { id: "fuenfkampf-atus", sport: "Moderner Fünfkampf", club: "ATUS Graz – Moderner Fünfkampf", trialInfo: "Probetraining nach Vereinbarung möglich.", ageLabel: "Alle Altersgruppen", contactPhone: "0676/3971712", contactEmail: "familie@kranacher.at" },
  { id: "handball-hcssv", sport: "Handball", club: "HC SSV Graz", trialInfo: "Probetraining nach Vereinbarung möglich.", ageLabel: "Alle Altersgruppen", contactPhone: "0676/6508281", contactEmail: "hsggraz@aon.at" },
  { id: "judo-graz", sport: "Judo", club: "ASKÖ-Judoclub Graz", trialInfo: "Probetraining nach Vereinbarung möglich.", ageLabel: "7 bis 12 Jahre", contactPhone: "0650/4206694", contactEmail: "office@judo-graz.at" },
  { id: "kickboxen-askoe", sport: "Kickboxen", club: "ASKÖ-Kickboxcenter Graz", trialInfo: "Probetraining ab 16 Jahren nach Vereinbarung.", ageLabel: "Ab 16 Jahren", contactPhone: "0664/9660066", contactEmail: "peter.jerovsek@kickboxcenter.at" },
  { id: "selbst-tigerdrache", sport: "Selbstverteidigung", club: "Tiger und Drache", trialInfo: "Probetraining für Kinder und Erwachsene nach Vereinbarung.", ageLabel: "Kinder und Erwachsene", contactPhone: "0650/5678335", contactEmail: "info@tigerdrache.at" },
  { id: "spikeball-roundnet", sport: "Spikeball / Roundnet", club: "Roundnet Club Graz", trialInfo: "Probetraining nach Vereinbarung möglich.", ageLabel: "Alle Altersgruppen", contactEmail: "contact@roundnetclubgraz.at" },
  { id: "trampolin-graz", sport: "Trampolinturnen", club: "Trampolin- und Freestyle-Club Graz", trialInfo: "Probetraining nach Vereinbarung möglich.", ageLabel: "Alle Altersgruppen", contactPhone: "0650/3907017", contactEmail: "hayngu@yahoo.com" },
  { id: "turnen-abenteuer", sport: "Abenteuer- / Zirkusturnen / Parkour", club: "ATUS Graz – Abenteuerturnen", trialInfo: "Probetraining für Kinder nach Vereinbarung.", ageLabel: "Kinder", contactPhone: "0681/81429142", contactEmail: "veronika@sport-abenteuer-kittler.at" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getSessionPoints = (session: TrialSession) => {
  const label = getExperienceLabel(session);
  return label === "Highlight-Erlebnis" ? POINTS_KURS : POINTS_PROBETRAINING;
};

const getExperienceLabel = (session: TrialSession) => {
  return session.end_time && session.end_time > "17:30:00" ? "Highlight-Erlebnis" : "Probetraining";
};

const getSportEmoji = (sportType: string): string => {
  const t = (sportType || '').toLowerCase();
  if (t.includes('fußball') || t.includes('football') || t.includes('soccer') || t.includes('futsal')) return '⚽';
  if (t.includes('american football')) return '🏈';
  if (t.includes('badminton')) return '🏸';
  if (t.includes('baseball')) return '⚾';
  if (t.includes('basketball')) return '🏀';
  if (t.includes('cheerleading')) return '📣';
  if (t.includes('fünfkampf')) return '🏅';
  if (t.includes('handball')) return '🤾';
  if (t.includes('judo') || t.includes('karate') || t.includes('aikido') || t.includes('kickbox') || t.includes('selbstverteidigung')) return '🥋';
  if (t.includes('tanz') || t.includes('dance')) return '🎵';
  if (t.includes('tennis')) return '🎾';
  if (t.includes('schwimm')) return '🏊';
  if (t.includes('trampolin') || t.includes('turnen') || t.includes('gymnas') || t.includes('zirkus') || t.includes('abenteuer') || t.includes('parkour')) return '🤸';
  if (t.includes('laufen') || t.includes('leichtathletik')) return '🏃';
  if (t.includes('volleyball')) return '🏐';
  if (t.includes('spikeball') || t.includes('roundnet')) return '🎾';
  return '⚡';
};

const isFootballSport = (sportType: string) => {
  const t = (sportType || '').toLowerCase();
  return (t.includes('fußball') || t.includes('soccer')) && !t.includes('american') && !t.includes('futsal');
};

const validateGuardianEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const validateGuardianPhone = (phone: string): boolean =>
  PHONE_REGEX.test(phone.trim());

type VerificationStep = "input" | "sending" | "waiting" | "confirmed";
type ProviderSheet = "info" | "form" | "submitting" | "success";

// ─── Component ────────────────────────────────────────────────────────────────

const TrialSessionsList = () => {
  // Dynamic sessions state
  const [sessions, setSessions] = useState<TrialSession[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [attendedIds, setAttendedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isAttending, setIsAttending] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TryItFilter>("all");
  const [selectedSession, setSelectedSession] = useState<TrialSession | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianEmailError, setGuardianEmailError] = useState("");
  const [verificationStep, setVerificationStep] = useState<VerificationStep>("input");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Static provider sheet state
  const [selectedProvider, setSelectedProvider] = useState<StaticProvider | null>(null);
  const [providerSheet, setProviderSheet] = useState<ProviderSheet>("info");
  const [childName, setChildName] = useState("");
  const [childNameError, setChildNameError] = useState("");
  const [childAge, setChildAge] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianPhoneError, setGuardianPhoneError] = useState("");

  useEffect(() => {
    loadData();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  useEffect(() => {
    setGuardianEmail("");
    setGuardianEmailError("");
    setVerificationStep("input");
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, [selectedSession]);

  useEffect(() => {
    if (!selectedProvider) {
      setProviderSheet("info");
      setChildName("");
      setChildNameError("");
      setChildAge("");
      setGuardianPhone("");
      setGuardianPhoneError("");
    }
  }, [selectedProvider]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUserId(session.user.id);
      await loadUserRegistrations(session.user.id);
    }
    await loadSessions();
    setLoading(false);
  };

  const loadSessions = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from("trial_sessions")
      .select(`*, clubs (*)`)
      .gte("date", today)
      .order("date", { ascending: true });

    if (error) {
      console.error("Error loading sessions:", error);
      toast.error("Fehler beim Laden der Schnuppertermine");
      return;
    }

    setSessions(data as TrialSession[] || []);
  };

  const loadUserRegistrations = async (uid: string) => {
    const { data, error } = await supabase
      .from("trial_registrations")
      .select("session_id, status")
      .eq("user_id", uid)
      .in("status", ["registered", "attended"]);
    if (error) { console.error("Error loading registrations:", error); return; }
    setRegistrations((data || []).filter(r => r.status === "registered"));
    setAttendedIds(new Set((data || []).filter(r => r.status === "attended").map(r => r.session_id)));
  };

  const handleSendEmail = async (sessionId: string) => {
    if (!validateGuardianEmail(guardianEmail)) {
      setGuardianEmailError("Bitte gib eine gültige E-Mail-Adresse eines Erziehungsberechtigten ein.");
      return;
    }
    setGuardianEmailError("");
    setVerificationStep("sending");
    try {
      const { data, error } = await supabase.functions.invoke("send-guardian-sms", {
        body: { session_id: sessionId, guardian_email: guardianEmail },
      });
      if (error) {
        let msg = "E-Mail konnte nicht gesendet werden.";
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch {}
        toast.error(msg);
        setVerificationStep("input");
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        setVerificationStep("input");
        return;
      }
      setVerificationStep("waiting");
      startPolling(sessionId);
    } catch (e: any) {
      console.error("Email error:", e);
      toast.error("E-Mail konnte nicht gesendet werden. Bitte versuche es erneut.");
      setVerificationStep("input");
    }
  };

  const startPolling = (sessionId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      const { data } = await (supabase as any)
        .from("guardian_verifications")
        .select("confirmed_at")
        .eq("session_id", sessionId)
        .not("confirmed_at", "is", null)
        .maybeSingle();

      if (data?.confirmed_at) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        setVerificationStep("confirmed");
      }
    }, 3000);
  };

  const handleAttendance = async (sessionId: string) => {
    setIsAttending(true);
    try {
      const { data, error } = await (supabase.rpc as any)("record_trial_attendance", { p_session_id: sessionId });
      if (error) throw error;
      const result = data as { status: string; points_awarded: number };
      if (result.status === "already_attended") {
        toast.info("Du hast bereits teilgenommen.");
      } else {
        if (userId) {
          await supabase
            .from("trial_registrations")
            .update({ guardian_phone: guardianEmail })
            .eq("user_id", userId)
            .eq("session_id", sessionId);
        }
        setAttendedIds(prev => new Set([...prev, sessionId]));
        setSelectedSession(null);
        toast.success(`Super! +${result.points_awarded} Blitze erhalten! ⚡`);
      }
    } catch (e) {
      console.error("Attendance error:", e);
      toast.error("Fehler beim Speichern der Teilnahme.");
    } finally {
      setIsAttending(false);
    }
  };

  const handleProviderInquiry = async (provider: StaticProvider) => {
    let hasError = false;
    if (!childName.trim()) {
      setChildNameError("Bitte gib den Namen des Kindes ein.");
      hasError = true;
    } else {
      setChildNameError("");
    }
    if (!validateGuardianPhone(guardianPhone)) {
      setGuardianPhoneError("Bitte gib eine gültige Telefonnummer eines Erziehungsberechtigten ein.");
      hasError = true;
    } else {
      setGuardianPhoneError("");
    }
    if (hasError) return;

    setProviderSheet("submitting");
    try {
      const { error } = await (supabase as any).from("try_it_trial_requests").insert({
        sport_type: provider.sport,
        provider_name: provider.club,
        child_name: childName.trim(),
        child_age: childAge ? parseInt(childAge, 10) : null,
        guardian_phone: guardianPhone.trim(),
        trial_training_status: TRIAL_STATUS,
        trial_training_info: provider.trialInfo,
        request_status: "requested",
      });

      if (error) {
        console.error("Provider inquiry error:", error);
        toast.error("Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.");
        setProviderSheet("form");
        return;
      }
      setProviderSheet("success");
    } catch (e) {
      console.error("Provider inquiry error:", e);
      toast.error("Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.");
      setProviderSheet("form");
    }
  };

  const isRegistered = (sessionId: string) => registrations.some(r => r.session_id === sessionId);

  const filteredSessions = sessions.filter((session) => {
    if (activeFilter === "all") return true;
    const isHighlight = getExperienceLabel(session) === "Highlight-Erlebnis";
    if (activeFilter === "highlight") return isHighlight;
    return !isHighlight;
  });

  const probetrainingCount = sessions.filter(s => getExperienceLabel(s) !== "Highlight-Erlebnis").length;
  const kursCount = sessions.filter(s => getExperienceLabel(s) === "Highlight-Erlebnis").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const featuredSession = filteredSessions[0] ?? null;
  const remainingSessions = filteredSessions.slice(1);

  const filters: { key: TryItFilter; label: string; count: number }[] = [
    { key: "all", label: "Alle Angebote", count: sessions.length },
    { key: "probetraining", label: "Probetraining", count: probetrainingCount },
    { key: "highlight", label: "Kurse", count: kursCount },
  ];

  return (
    <div className="space-y-5 pt-4">

      {/* Section header */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[1.55rem] font-black leading-tight text-foreground">Sportangebote in Graz</h2>
          <button
            type="button"
            className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary shadow-sm"
          >
            Try It
          </button>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Wähle eine Sportart und tippe auf die Karte, um genaue Termine mit Datum, Uhrzeit, Treffpunkt und Ort zu sehen.
        </p>
      </div>

      {/* Filter pills */}
      <div className="grid grid-cols-[5fr_5fr_3fr] gap-2">
        {filters.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveFilter(key)}
            className={`flex w-full items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-[13px] font-bold transition-all ${
              activeFilter === key
                ? "bg-[linear-gradient(135deg,#16C653_0%,#0D7F38_100%)] text-white shadow-[0_4px_16px_rgba(22,198,83,0.35)]"
                : "border border-black/8 bg-white text-foreground shadow-sm"
            }`}
          >
            <span className="whitespace-nowrap">{label}</span>
            <span className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-xs font-black ${
              activeFilter === key ? "bg-white/25 text-white" : "bg-primary/10 text-primary"
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Featured card */}
      {featuredSession && (() => {
        const club = featuredSession.clubs;
        const clubName = club?.name || "Verein";
        const sportType = club?.sport_type || featuredSession.title;
        const sportEmoji = getSportEmoji(sportType);
        const pointsReward = getSessionPoints(featuredSession);
        const isFootball = isFootballSport(sportType);

        return (
          <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#18C957_0%,#10A048_55%,#0D7F38_100%)] shadow-[0_16px_40px_rgba(14,126,62,0.35)]">
            <div className="pointer-events-none absolute right-[46%] top-4 text-2xl text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">✦</div>
            <div className="pointer-events-none absolute right-[38%] top-16 text-sm text-white/60">✦</div>
            <div className="absolute right-0 top-0 h-full w-[52%]">
              {isFootball ? (
                <img src={tryitFootballNetImg} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center" />
              ) : (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[7rem] leading-none opacity-70">{sportEmoji}</span>
              )}
            </div>
            <div className="relative z-10 max-w-[52%] p-4 pb-3">
              <div className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-white/90">⭐ Empfohlen</div>
              <h3 className="text-[1.7rem] font-black leading-none text-white break-words">{sportType}</h3>
              {featuredSession.description && (
                <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-white/80">{featuredSession.description}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                {club?.logo_url ? (
                  <img src={club.logo_url} alt={clubName} className="h-8 w-8 rounded-full border-2 border-white/30 object-cover" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white/25 bg-white/20 text-xs font-bold text-white">
                    {clubName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{clubName}</p>
                  {featuredSession.location && <p className="truncate text-xs text-white/70">{featuredSession.location}</p>}
                </div>
              </div>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-black/30 px-3.5 py-2 text-sm font-bold text-white">
                  ⚡ +{pointsReward} Blitze
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSession(featuredSession)}
              className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-green-700 shadow-sm"
            >
              Zum Angebot <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        );
      })()}

      {/* Empty state for dynamic sessions */}
      {filteredSessions.length === 0 && (
        <div className="rounded-[24px] bg-white p-8 text-center shadow-sm">
          <p className="text-muted-foreground">Für diesen Filter sind aktuell keine Angebote verfügbar.</p>
        </div>
      )}

      {/* Small dynamic session cards */}
      {remainingSessions.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {remainingSessions.map((session) => {
            const club = session.clubs;
            const clubName = club?.name || "Verein";
            const sportType = club?.sport_type || session.title;
            const sportEmoji = getSportEmoji(sportType);
            const pointsReward = getSessionPoints(session);
            const isHighlight = getExperienceLabel(session) === "Highlight-Erlebnis";
            const isRegisteredSession = isRegistered(session.id);

            return (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSession(session)}
                className="overflow-hidden rounded-[22px] border border-black/5 bg-white text-left shadow-[0_8px_22px_rgba(0,0,0,0.07)]"
              >
                <div className="grid min-h-[130px] grid-cols-[62px_1fr]">
                  <div className={`flex items-center justify-center text-[2.6rem] leading-none ${isHighlight ? "bg-purple-50" : "bg-primary/8"}`}>
                    {sportEmoji}
                  </div>
                  <div className="flex flex-col justify-between p-2">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[13px] font-black leading-tight text-foreground break-words">{sportType}</p>
                      <span className={`w-fit rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                        isHighlight ? "border border-purple-200 bg-purple-50 text-purple-600" : "border border-primary/25 bg-primary/8 text-primary"
                      }`}>
                        {isHighlight ? "Kurs" : "Probetraining"}
                      </span>
                      <p className="text-[11px] font-semibold leading-snug text-foreground/80 break-words">{clubName}</p>
                      {session.location && <p className="text-[10px] leading-snug text-muted-foreground break-words">{session.location}</p>}
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-[10px] font-bold text-primary">⚡ +{pointsReward} Blitze</p>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {isRegisteredSession ? <span className="text-[8px] font-black">✓</span> : <ChevronRight className="h-3 w-3" />}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Static providers section ─────────────────────────────────────────── */}
      <div className="space-y-3 pt-2">
        <div>
          <h3 className="text-[1.15rem] font-black leading-tight text-foreground">Probetraining nach Vereinbarung</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Diese Vereine bieten Probetraining nach Vereinbarung an – einfach anfragen.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {STATIC_PROVIDERS.map((provider) => {
            const emoji = getSportEmoji(provider.sport);
            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => setSelectedProvider(provider)}
                className="overflow-hidden rounded-[22px] border border-black/5 bg-white text-left shadow-[0_8px_22px_rgba(0,0,0,0.07)]"
              >
                <div className="grid min-h-[130px] grid-cols-[62px_1fr]">
                  <div className="flex items-center justify-center text-[2.6rem] leading-none bg-primary/8">
                    {emoji}
                  </div>
                  <div className="flex flex-col justify-between p-2">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[13px] font-black leading-tight text-foreground break-words">{provider.sport}</p>
                      <span className="w-fit rounded-full px-1.5 py-0.5 text-[9px] font-bold border border-emerald-300 bg-emerald-50 text-emerald-700">
                        ✓ {TRIAL_STATUS}
                      </span>
                      <p className="text-[11px] font-semibold leading-snug text-foreground/80 break-words">{provider.club}</p>
                      {provider.contactPhone && (
                        <p className="text-[10px] leading-snug text-muted-foreground">📞 {provider.contactPhone}</p>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-end">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[22px] border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-black text-foreground">Probetrainings</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Wenn auch dein Verein Lust hat mitzumachen, gerne anmelden unter:{" "}
          <a href="mailto:office@boostschule.at" className="font-semibold text-primary">
            office@boostschule.at
          </a>
        </p>
      </div>

      <div className="h-2" />

      {/* ─── Dynamic session detail bottom sheet ──────────────────────────────── */}
      {selectedSession && (() => {
        const s = selectedSession;
        const club = s.clubs;
        const sportType = club?.sport_type || s.title;
        const sportEmoji = getSportEmoji(sportType);
        const isHighlight = getExperienceLabel(s) === "Highlight-Erlebnis";
        const pointsReward = getSessionPoints(s);
        const dateFormatted = new Date(s.date).toLocaleDateString("de-AT", { weekday: "long" }) + "s";
        const timeFormatted = `${s.start_time.slice(0, 5)}${s.end_time ? ` – ${s.end_time.slice(0, 5)}` : ""} Uhr`;

        return (
          <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSelectedSession(null)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
              className="relative w-full max-h-[90vh] overflow-y-auto rounded-t-[32px] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.18)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-black/10" />
              </div>
              <div className="flex items-start justify-between px-5 pb-3 pt-1">
                <div className="flex items-center gap-3">
                  <span className="text-[2.4rem] leading-none">{sportEmoji}</span>
                  <div>
                    <p className="text-[1.3rem] font-black leading-tight text-foreground">{sportType}</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isHighlight ? "bg-purple-50 text-purple-600" : "bg-primary/10 text-primary"
                    }`}>
                      {isHighlight ? "Kurs" : "Probetraining"}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedSession(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/6 text-foreground/60">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 px-5 pb-2">
                <div className="rounded-[16px] bg-gray-50 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <span className="text-base">📅</span>
                    <span className="font-semibold">{dateFormatted}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <span className="text-base">🕐</span>
                    <span className="font-semibold">{timeFormatted}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-base">📍</span>
                    <div>
                      <p className="font-semibold">{s.location}</p>
                      {s.address && <p className="text-xs text-muted-foreground">{s.address}</p>}
                    </div>
                  </div>
                  {club && (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <span className="text-base">🏛</span>
                      <span className="font-semibold">{club.name}</span>
                    </div>
                  )}
                </div>

                {s.description && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.description}</p>
                )}
                {s.requirements && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <span className="font-bold text-foreground/70">Voraussetzungen: </span>{s.requirements}
                  </p>
                )}
              </div>

              {club && (club.contact_email || club.contact_phone || club.website) && (
                <div className="mx-5 mb-3 rounded-[16px] bg-gray-50 p-3.5 space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">Kontakt</p>
                  {club.contact_email && (
                    <a href={`mailto:${club.contact_email}`} className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <span className="text-base">✉️</span>{club.contact_email}
                    </a>
                  )}
                  {club.contact_phone && (
                    <a href={`tel:${club.contact_phone}`} className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span className="text-base">📞</span>{club.contact_phone}
                    </a>
                  )}
                  {club.website && (
                    <a href={club.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <span className="text-base">🌐</span>{club.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </div>
              )}

              <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-1 space-y-3">
                <div className="flex items-center justify-center gap-2 rounded-[16px] bg-primary/8 py-3 text-sm font-bold text-primary">
                  ⚡ +{pointsReward} Blitze nach der Teilnahme
                </div>

                {attendedIds.has(s.id) ? (
                  <div className="flex items-center justify-center gap-2 rounded-[16px] bg-primary/10 py-4 text-sm font-bold text-primary">
                    <CheckCircle2 className="h-5 w-5" />
                    Teilnahme bestätigt
                  </div>
                ) : verificationStep === "input" ? (
                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-bold text-foreground/80">
                      E-Mail Erziehungsberechtigte:r
                    </label>
                    <input
                      type="email"
                      value={guardianEmail}
                      onChange={(e) => { setGuardianEmail(e.target.value); if (guardianEmailError) setGuardianEmailError(""); }}
                      placeholder="z. B. mama@beispiel.at"
                      className={`w-full rounded-[14px] border px-4 py-3 text-sm outline-none transition-colors ${
                        guardianEmailError ? "border-red-400 bg-red-50 focus:border-red-500" : "border-black/10 bg-gray-50 focus:border-primary"
                      }`}
                    />
                    {guardianEmailError && <p className="text-xs font-medium text-red-500">{guardianEmailError}</p>}
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Die E-Mail-Adresse wird verwendet, um die Freigabe durch eine erziehungsberechtigte Person einzuholen.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleSendEmail(s.id)}
                      className="w-full rounded-[16px] bg-primary py-4 text-sm font-black text-white shadow-[0_8px_24px_rgba(22,198,83,0.35)]"
                    >
                      ✉️ Freigabe per E-Mail anfordern
                    </button>
                  </div>
                ) : verificationStep === "sending" ? (
                  <div className="flex items-center justify-center gap-2 rounded-[16px] bg-gray-50 py-4 text-sm font-semibold text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    E-Mail wird gesendet…
                  </div>
                ) : verificationStep === "waiting" ? (
                  <div className="space-y-3">
                    <div className="rounded-[16px] bg-amber-50 border border-amber-200 p-4 space-y-1.5">
                      <p className="text-sm font-black text-amber-800">⏳ Warte auf Bestätigung</p>
                      <p className="text-xs leading-relaxed text-amber-700">
                        Eine E-Mail wurde an <span className="font-bold">{guardianEmail}</span> gesendet. Sobald die erziehungsberechtigte Person den Link bestätigt, geht es automatisch weiter.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVerificationStep("input")}
                      className="w-full rounded-[16px] border border-black/10 bg-white py-3 text-sm font-semibold text-foreground/70"
                    >
                      Andere E-Mail eingeben
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-[16px] bg-primary/10 px-4 py-3 text-sm font-bold text-primary">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Freigabe erteilt!
                    </div>
                    <button
                      type="button"
                      disabled={isAttending}
                      onClick={() => void handleAttendance(s.id)}
                      className="w-full rounded-[16px] bg-primary py-4 text-sm font-black text-white shadow-[0_8px_24px_rgba(22,198,83,0.35)] disabled:opacity-60"
                    >
                      {isAttending ? "Wird gespeichert…" : "✓ Erfolgreich teilgenommen"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Static provider inquiry bottom sheet ─────────────────────────────── */}
      {selectedProvider && (() => {
        const p = selectedProvider;
        const emoji = getSportEmoji(p.sport);
        return (
          <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSelectedProvider(null)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
              className="relative w-full max-h-[90vh] overflow-y-auto rounded-t-[32px] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.18)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-black/10" />
              </div>

              {/* ── Info view ── */}
              {providerSheet === "info" && (
                <>
                  <div className="flex items-start justify-between px-5 pb-3 pt-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[2.4rem] leading-none">{emoji}</span>
                      <div>
                        <p className="text-[1.3rem] font-black leading-tight text-foreground">{p.sport}</p>
                        <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          ✓ {TRIAL_STATUS}
                        </span>
                      </div>
                    </div>
                    <button type="button" onClick={() => setSelectedProvider(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/6 text-foreground/60">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-3 px-5 pb-2">
                    <div className="rounded-[16px] bg-gray-50 p-3.5 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <span className="text-base">🏛</span>
                        <span className="font-semibold">{p.club}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <span className="text-base">👥</span>
                        <span>{p.ageLabel}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-emerald-700">
                        <span className="text-base">✅</span>
                        <span className="font-semibold">{p.trialInfo}</span>
                      </div>
                    </div>

                    {(p.contactPhone || p.contactEmail) && (
                      <div className="rounded-[16px] bg-gray-50 p-3.5 space-y-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">Kontakt</p>
                        {p.contactPhone && (
                          <a href={`tel:${p.contactPhone}`} className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <span className="text-base">📞</span>{p.contactPhone}
                          </a>
                        )}
                        {p.contactEmail && (
                          <a href={`mailto:${p.contactEmail}`} className="flex items-center gap-2 text-sm font-semibold text-primary">
                            <span className="text-base">✉️</span>{p.contactEmail}
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-1">
                    <button
                      type="button"
                      onClick={() => setProviderSheet("form")}
                      className="w-full rounded-[16px] bg-primary py-4 text-sm font-black text-white shadow-[0_8px_24px_rgba(22,198,83,0.35)]"
                    >
                      Anfragen
                    </button>
                  </div>
                </>
              )}

              {/* ── Form view ── */}
              {(providerSheet === "form" || providerSheet === "submitting") && (
                <>
                  <div className="flex items-center justify-between px-5 pt-1 pb-3">
                    <button
                      type="button"
                      onClick={() => setProviderSheet("info")}
                      className="text-sm font-semibold text-muted-foreground"
                    >
                      ← Zurück
                    </button>
                    <button type="button" onClick={() => setSelectedProvider(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/6 text-foreground/60">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] space-y-3">
                    <div>
                      <p className="text-[1.1rem] font-black text-foreground">Probetraining anfragen</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.club} · {p.sport}</p>
                    </div>

                    {/* child_name */}
                    <div className="space-y-1">
                      <label className="block text-[13px] font-bold text-foreground/80">
                        Vorname Kind <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={childName}
                        onChange={(e) => { setChildName(e.target.value); if (childNameError) setChildNameError(""); }}
                        placeholder="z. B. Lena"
                        className={`w-full rounded-[14px] border px-4 py-3 text-sm outline-none transition-colors ${
                          childNameError ? "border-red-400 bg-red-50" : "border-black/10 bg-gray-50 focus:border-primary"
                        }`}
                      />
                      {childNameError && <p className="text-xs font-medium text-red-500">{childNameError}</p>}
                    </div>

                    {/* child_age */}
                    <div className="space-y-1">
                      <label className="block text-[13px] font-bold text-foreground/80">Alter Kind</label>
                      <input
                        type="number"
                        value={childAge}
                        onChange={(e) => setChildAge(e.target.value)}
                        placeholder="z. B. 10"
                        min={3}
                        max={99}
                        className="w-full rounded-[14px] border border-black/10 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-primary"
                      />
                    </div>

                    {/* guardian_phone */}
                    <div className="space-y-1">
                      <label className="block text-[13px] font-bold text-foreground/80">
                        Telefonnummer Erziehungsberechtigte:r <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={guardianPhone}
                        onChange={(e) => { setGuardianPhone(e.target.value); if (guardianPhoneError) setGuardianPhoneError(""); }}
                        placeholder="z. B. +43 660 1234567"
                        className={`w-full rounded-[14px] border px-4 py-3 text-sm outline-none transition-colors ${
                          guardianPhoneError ? "border-red-400 bg-red-50" : "border-black/10 bg-gray-50 focus:border-primary"
                        }`}
                      />
                      {guardianPhoneError && <p className="text-xs font-medium text-red-500">{guardianPhoneError}</p>}
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Die Telefonnummer wird verwendet, um die Freigabe durch eine erziehungsberechtigte Person zu ermöglichen.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={providerSheet === "submitting"}
                      onClick={() => void handleProviderInquiry(p)}
                      className="w-full rounded-[16px] bg-primary py-4 text-sm font-black text-white shadow-[0_8px_24px_rgba(22,198,83,0.35)] disabled:opacity-60"
                    >
                      {providerSheet === "submitting" ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Wird gesendet…
                        </span>
                      ) : "Anfragen absenden"}
                    </button>
                  </div>
                </>
              )}

              {/* ── Success view ── */}
              {providerSheet === "success" && (
                <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-2 space-y-4 text-center">
                  <div className="flex justify-center pt-2">
                    <CheckCircle2 className="h-14 w-14 text-primary" />
                  </div>
                  <div>
                    <p className="text-[1.2rem] font-black text-foreground">Anfrage gesendet!</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Deine Anfrage beim <span className="font-bold text-foreground">{p.club}</span> wurde übermittelt.
                    </p>
                  </div>
                  {(p.contactPhone || p.contactEmail) && (
                    <div className="rounded-[16px] bg-gray-50 p-3.5 text-left space-y-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">Direkt Kontakt aufnehmen</p>
                      {p.contactPhone && (
                        <a href={`tel:${p.contactPhone}`} className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <span>📞</span>{p.contactPhone}
                        </a>
                      )}
                      {p.contactEmail && (
                        <a href={`mailto:${p.contactEmail}`} className="flex items-center gap-2 text-sm font-semibold text-primary">
                          <span>✉️</span>{p.contactEmail}
                        </a>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedProvider(null)}
                    className="w-full rounded-[16px] border border-black/10 bg-white py-3 text-sm font-semibold text-foreground/70"
                  >
                    Schließen
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default TrialSessionsList;
