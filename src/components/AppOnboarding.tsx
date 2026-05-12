import { useMemo, useState, useEffect } from "react";
import { Shield, Trophy, Users, X, Zap } from "lucide-react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import {
  ONBOARDING_OPEN_EVENT,
  type OnboardingRole,
  hasSeenOnboarding,
  markOnboardingSeen,
} from "@/lib/onboarding";

type PointType = "zap" | "trophy" | "shield";

type Slide = {
  titleBefore: string;
  titleGreen: string;
  titleAfter: string;
  text: string;
  HeroComponent: React.FC;
  points: Array<{ type: PointType; text: string }>;
};

const HIDDEN_PATHS = ["/", "/auth", "/login", "/reset-password"];

// ── Hero illustrations ──────────────────────────────────────────────────────

const Hero1: React.FC = () => (
  <div className="relative flex h-full items-center justify-center">
    <div className="relative z-10 flex h-28 w-28 items-center justify-center rounded-[32px] bg-primary/15 shadow-[0_20px_40px_rgba(34,197,94,0.22)]">
      <Zap className="h-16 w-16 fill-primary text-primary" />
    </div>
    <span className="absolute left-6 top-1/2 -translate-y-3 select-none text-6xl drop-shadow-lg">⚽</span>
    <span className="absolute right-6 top-1/2 translate-y-2 select-none text-5xl drop-shadow-lg">🥤</span>
    <span className="absolute right-14 top-3 select-none text-base text-primary opacity-60">✦</span>
    <span className="absolute left-14 bottom-3 select-none text-xs text-primary opacity-40">✦</span>
    <span className="absolute top-4 left-1/2 -translate-x-6 select-none text-xs text-primary opacity-30">✦</span>
  </div>
);

const Hero2: React.FC = () => (
  <div className="relative flex h-full items-center justify-center">
    <div className="relative z-10 flex h-28 w-24 flex-col items-center justify-center gap-1 rounded-[28px] bg-emerald-100 shadow-[0_16px_32px_rgba(0,0,0,0.10)]">
      <span className="select-none text-5xl">🗓️</span>
      <div className="flex items-center gap-0.5">
        <Zap className="h-3 w-3 fill-primary text-primary" />
        <span className="text-[11px] font-black text-primary">✓ ✓ ✓</span>
      </div>
    </div>
    <span className="absolute left-5 top-[30%] select-none text-5xl drop-shadow-lg">🏀</span>
    <span className="absolute right-6 bottom-4 select-none text-5xl drop-shadow-lg">👟</span>
    <span className="absolute right-8 top-3 select-none text-4xl drop-shadow-lg">🏆</span>
    <div className="absolute bottom-3 left-4 rounded-full bg-purple-100 p-2">
      <Users className="h-5 w-5 text-purple-500" />
    </div>
  </div>
);

const Hero3: React.FC = () => (
  <div className="relative flex h-full items-center justify-center">
    {/* Leaderboard card */}
    <div className="absolute left-2 top-1/2 w-24 -translate-y-1/2 rounded-2xl bg-white p-2 shadow-md">
      <p className="mb-1 text-[8px] font-black uppercase tracking-wide text-foreground/50">
        Klassen-Rangliste
      </p>
      {(["1", "2", "3"] as const).map((rank, i) => (
        <div key={rank} className="mb-0.5 flex items-center justify-between">
          <div
            className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black ${
              i === 0 ? "bg-primary text-white" : "bg-foreground/10 text-foreground/50"
            }`}
          >
            {rank}
          </div>
          <div className="flex items-center gap-0.5 text-[9px] font-bold">
            <Zap className="h-2.5 w-2.5 fill-primary text-primary" />
            {["1.250", "980", "730"][i]}
          </div>
        </div>
      ))}
    </div>
    {/* Central trophy */}
    <div className="relative z-10 flex h-28 w-28 items-center justify-center rounded-full bg-primary/15 shadow-[0_20px_40px_rgba(34,197,94,0.22)]">
      <Trophy className="h-16 w-16 fill-primary/70 text-primary" />
    </div>
    {/* +150 badge */}
    <div className="absolute right-2 top-1/2 -translate-y-6 rounded-xl bg-white px-2.5 py-1.5 shadow-md">
      <div className="flex items-center gap-0.5 text-sm font-black text-foreground">
        +150 <Zap className="h-3 w-3 fill-primary text-primary" />
      </div>
    </div>
    <span className="absolute top-2 left-1/2 select-none text-sm text-primary opacity-40">⚡</span>
    <span className="absolute bottom-2 right-1/3 select-none text-xs text-primary opacity-30">⚡</span>
  </div>
);

const Hero4: React.FC = () => (
  <div className="relative flex h-full items-center justify-center">
    <span className="absolute left-6 top-4 select-none text-5xl drop-shadow-lg">🚩</span>
    <div className="relative z-10 flex h-28 w-28 items-center justify-center rounded-[32px] bg-primary/15 shadow-[0_20px_40px_rgba(34,197,94,0.22)]">
      <Zap className="h-16 w-16 fill-primary text-primary" />
    </div>
    <span className="absolute right-8 top-4 select-none text-5xl drop-shadow-lg">🏆</span>
    <span className="absolute right-6 bottom-8 select-none text-4xl drop-shadow-lg">👟</span>
    <div className="absolute left-4 bottom-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 shadow-sm">
      <Users className="h-6 w-6 text-emerald-600" />
    </div>
    <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-2.5 py-1 shadow-sm">
      <Shield className="h-3 w-3 text-foreground/60" />
      <span className="whitespace-nowrap text-[9px] font-bold text-foreground/60">
        Sicher &amp; geschützt
      </span>
    </div>
  </div>
);

// ── Slide data ───────────────────────────────────────────────────────────────

const STUDENT_SLIDES: Slide[] = [
  {
    titleBefore: "Willkommen bei ",
    titleGreen: "BOOST",
    titleAfter: "",
    text: "Jeden Tag bewegst du dich mit kurzen Sport-Hausübungen und lustigen Challenges.",
    HeroComponent: Hero1,
    points: [
      { type: "zap", text: "Tägliche Hausübung" },
      { type: "zap", text: "Lustige Challenges" },
      { type: "zap", text: "Mit deiner Klasse" },
    ],
  },
  {
    titleBefore: "So läuft ",
    titleGreen: "BOOST",
    titleAfter: "",
    text: "Mach deine tägliche Hausübung und entdecke Friendquests, Klassenziele und Try-it-Challenges.",
    HeroComponent: Hero2,
    points: [
      { type: "zap", text: "Tägliche Hausübung" },
      { type: "zap", text: "Friendquests & Klasse" },
      { type: "zap", text: "Try-it-Challenges" },
    ],
  },
  {
    titleBefore: "Dein ",
    titleGreen: "Blitz",
    titleAfter: " zählt",
    text: "Jeder Blitz hilft deiner Klasse. Gemeinsam sammelt ihr Punkte, Rewards und echte Erfolgserlebnisse.",
    HeroComponent: Hero3,
    points: [
      { type: "zap", text: "Jeder Beitrag hilft" },
      { type: "zap", text: "Punkte & Rewards" },
      { type: "zap", text: "Gemeinsam gewinnen" },
    ],
  },
  {
    titleBefore: "Bereit für deinen ",
    titleGreen: "ersten Blitz",
    titleAfter: "?",
    text: "Starte jetzt deine erste Challenge, sammle Punkte und hilf deiner Klasse.",
    HeroComponent: Hero4,
    points: [
      { type: "zap", text: "Erste Challenge starten" },
      { type: "trophy", text: "Punkte für deine Klasse" },
      { type: "shield", text: "Keine Fotos & Videos" },
    ],
  },
];

const TEACHER_SLIDES: Slide[] = [
  {
    titleBefore: "Willkommen bei ",
    titleGreen: "BOOST",
    titleAfter: "",
    text: "BOOST macht Bewegung im Schulalltag sichtbar und einfach.",
    HeroComponent: Hero1,
    points: [
      { type: "zap", text: "Schneller Start" },
      { type: "zap", text: "Klare Übersicht" },
      { type: "zap", text: "Motivierendes System" },
    ],
  },
  {
    titleBefore: "Home und ",
    titleGreen: "Aktivität",
    titleAfter: "",
    text: "Ein Streak-Tag zählt ab 80 % Tagesfortschritt, also ab 5 von 6 Aufgaben.",
    HeroComponent: Hero2,
    points: [
      { type: "zap", text: "80%-Streak verstehen" },
      { type: "zap", text: "Tagesfortschritt prüfen" },
      { type: "zap", text: "Wochenblick einordnen" },
    ],
  },
  {
    titleBefore: "Quests und ",
    titleGreen: "Klasse",
    titleAfter: "",
    text: "Starten Sie Missionen und behalten Sie die Klasse im Blick.",
    HeroComponent: Hero3,
    points: [
      { type: "zap", text: "Wochenmissionen" },
      { type: "zap", text: "Klassenansicht" },
      { type: "trophy", text: "Mehr Motivation" },
    ],
  },
  {
    titleBefore: "Profil und ",
    titleGreen: "Einstellungen",
    titleAfter: "",
    text: "Hier finden Sie Punkte, Rewards und später auch diese Einführung wieder.",
    HeroComponent: Hero4,
    points: [
      { type: "zap", text: "Profil ansehen" },
      { type: "zap", text: "Belohnungen öffnen" },
      { type: "shield", text: "Onboarding erneut starten" },
    ],
  },
];

// ── Point icon helper ────────────────────────────────────────────────────────

const PointIcon = ({ type }: { type: PointType }) => {
  if (type === "trophy") return <Trophy className="h-4 w-4" />;
  if (type === "shield") return <Shield className="h-4 w-4" />;
  return <Zap className="h-4 w-4 fill-current" />;
};

// ── Main component ───────────────────────────────────────────────────────────

const AppOnboarding = () => {
  const location = useLocation();
  const { session: codeSession, loading: codeLoading } = useCodeAuth();
  const [supabaseRole, setSupabaseRole] = useState<OnboardingRole | null>(null);
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const resolveSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const accountType = String(session.user.user_metadata?.account_type || "").toLowerCase();
        setSupabaseRole(accountType === "teacher" ? "teacher" : "student");
      } else {
        setSupabaseRole(null);
      }
      setSupabaseReady(true);
    };

    void resolveSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const accountType = String(session.user.user_metadata?.account_type || "").toLowerCase();
        setSupabaseRole(accountType === "teacher" ? "teacher" : "student");
      } else {
        setSupabaseRole(null);
      }
      setSupabaseReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const role: OnboardingRole | null = codeSession?.user_type ?? supabaseRole;
  const authReady = !codeLoading && supabaseReady;
  const slides = useMemo(() => (role === "teacher" ? TEACHER_SLIDES : STUDENT_SLIDES), [role]);

  useEffect(() => {
    if (!authReady || !role) return;
    if (HIDDEN_PATHS.includes(location.pathname)) return;
    if (hasSeenOnboarding(role)) return;
    setCurrentIndex(0);
    setOpen(true);
  }, [authReady, role, location.pathname]);

  useEffect(() => {
    const handleOpen = () => {
      if (!role) return;
      setCurrentIndex(0);
      setOpen(true);
    };
    window.addEventListener(ONBOARDING_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(ONBOARDING_OPEN_EVENT, handleOpen);
  }, [role]);

  if (!open || !role || HIDDEN_PATHS.includes(location.pathname)) return null;

  const slide = slides[currentIndex];
  const { HeroComponent } = slide;
  const isLast = currentIndex === slides.length - 1;

  const closeOnboarding = () => {
    markOnboardingSeen(role);
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-[#f0ece4]">
      <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col px-5 pb-8 pt-16">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="rounded-full bg-foreground/85 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white">
            App-Erklärung
          </div>
          <button
            type="button"
            onClick={closeOnboarding}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md"
            aria-label="Onboarding schließen"
          >
            <X className="h-4 w-4 text-foreground" />
          </button>
        </div>

        {/* Hero area with counter badge */}
        <div className="relative mt-5 h-52 w-full">
          <HeroComponent />
          <div className="absolute right-0 top-0 rounded-xl bg-primary/12 px-2.5 py-1">
            <span className="text-sm font-black text-primary">
              {currentIndex + 1}/{slides.length}
            </span>
          </div>
        </div>

        {/* Title */}
        <h2 className="mt-5 text-center text-[2rem] font-black leading-[1.1] text-foreground">
          {slide.titleBefore}
          <span className="text-primary">{slide.titleGreen}</span>
          {slide.titleAfter}
        </h2>

        {/* Subtitle */}
        <p className="mx-auto mt-3 max-w-xs text-center text-[15px] font-medium leading-relaxed text-foreground/60">
          {slide.text}
        </p>

        {/* Feature cards */}
        <div className="mt-5 space-y-3">
          {slide.points.map((point) => (
            <div
              key={point.text}
              className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                <PointIcon type={point.type} />
              </div>
              <span className="text-sm font-bold text-foreground">{point.text}</span>
            </div>
          ))}
        </div>

        {/* Progress dots */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full transition-all ${
                i === currentIndex ? "bg-primary" : "bg-foreground/20"
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={closeOnboarding}
            className="flex-1 py-3.5 text-sm font-black text-foreground/60"
          >
            Überspringen
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLast) {
                closeOnboarding();
                return;
              }
              setCurrentIndex((prev) => prev + 1);
            }}
            className="flex-[1.5] rounded-full bg-primary py-3.5 text-sm font-black text-white shadow-[0_8px_20px_rgba(34,197,94,0.35)]"
          >
            {isLast ? "Los geht's" : "Weiter"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default AppOnboarding;
