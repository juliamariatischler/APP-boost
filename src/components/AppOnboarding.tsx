import { useEffect, useMemo, useState } from "react";
import { Home, Sparkles, Trophy, User, Users, X, Zap } from "lucide-react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import {
  ONBOARDING_OPEN_EVENT,
  type OnboardingRole,
  hasSeenOnboarding,
  markOnboardingSeen,
} from "@/lib/onboarding";

type Slide = {
  title: string;
  text: string;
  icon: typeof Sparkles;
  accentClass: string;
  panelClass: string;
  points: string[];
};

const STUDENT_SLIDES: Slide[] = [
  {
    title: "Willkommen bei BOOST",
    text: "Bewege dich, sammle Blitze und hab Spaß mit deiner Klasse.",
    icon: Sparkles,
    accentClass: "bg-amber-300 text-amber-950",
    panelClass: "from-[#fff8cf] via-[#fff3d4] to-[#eefad0]",
    points: ["Kurze Aufgaben", "Viel Bewegung", "Coole Belohnungen"],
  },
  {
    title: "Dein Home",
    text: "Hier siehst du jeden Tag, was du schon geschafft hast.",
    icon: Home,
    accentClass: "bg-emerald-300 text-emerald-950",
    panelClass: "from-[#eefce9] via-[#f7fff5] to-[#dff7f0]",
    points: ["Balken füllen", "Tagesziele schaffen", "Blitze sammeln"],
  },
  {
    title: "Quests und Klasse",
    text: "Hol dir Missionen und schau, wie deine Klasse gemeinsam vorankommt.",
    icon: Users,
    accentClass: "bg-sky-300 text-sky-950",
    panelClass: "from-[#ebf7ff] via-[#f7fbff] to-[#e4f0ff]",
    points: ["Wochenmission starten", "Mit der Klasse sammeln", "Zusammen motiviert bleiben"],
  },
  {
    title: "Profil und Rewards",
    text: "Im Profil findest du deinen Avatar, deine Punkte und Extras.",
    icon: Zap,
    accentClass: "bg-fuchsia-300 text-fuchsia-950",
    panelClass: "from-[#fff0fb] via-[#fff8fe] to-[#f6ebff]",
    points: ["Avatar ansehen", "Blitze checken", "Belohnungen entdecken"],
  },
];

const TEACHER_SLIDES: Slide[] = [
  {
    title: "Willkommen bei BOOST",
    text: "BOOST macht Bewegung im Schulalltag sichtbar und einfach.",
    icon: Sparkles,
    accentClass: "bg-amber-300 text-amber-950",
    panelClass: "from-[#fff7d1] via-[#fff2d8] to-[#edf9d8]",
    points: ["Schneller Start", "Klare Übersicht", "Motivierendes System"],
  },
  {
    title: "Home und Aktivität",
    text: "Auf Home sehen Sie direkt, was heute passiert und wie aktiv die Woche läuft.",
    icon: Home,
    accentClass: "bg-emerald-300 text-emerald-950",
    panelClass: "from-[#edfce7] via-[#f8fff5] to-[#def6f2]",
    points: ["Tagesfortschritt", "Wochenblick", "Schneller Einstieg"],
  },
  {
    title: "Quests und Klasse",
    text: "Starten Sie Missionen und behalten Sie die Klasse im Blick.",
    icon: Trophy,
    accentClass: "bg-sky-300 text-sky-950",
    panelClass: "from-[#ebf6ff] via-[#f7fbff] to-[#e4f1ff]",
    points: ["Wochenmissionen", "Klassenansicht", "Mehr Motivation"],
  },
  {
    title: "Profil und Einstellungen",
    text: "Hier finden Sie Punkte, Rewards und später auch diese Einführung wieder.",
    icon: User,
    accentClass: "bg-fuchsia-300 text-fuchsia-950",
    panelClass: "from-[#fff0fb] via-[#fff8fe] to-[#f5edff]",
    points: ["Profil ansehen", "Belohnungen öffnen", "Onboarding erneut starten"],
  },
];

const HIDDEN_PATHS = ["/", "/auth", "/login", "/reset-password"];

const AppOnboarding = () => {
  const location = useLocation();
  const { session: codeSession, loading: codeLoading } = useCodeAuth();
  const [supabaseRole, setSupabaseRole] = useState<OnboardingRole | null>(null);
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);

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
    setManualOpen(false);
    setOpen(true);
  }, [authReady, role, location.pathname]);

  useEffect(() => {
    const handleOpen = () => {
      if (!role) return;
      setCurrentIndex(0);
      setManualOpen(true);
      setOpen(true);
    };

    window.addEventListener(ONBOARDING_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(ONBOARDING_OPEN_EVENT, handleOpen);
  }, [role]);

  if (!open || !role || HIDDEN_PATHS.includes(location.pathname)) return null;

  const slide = slides[currentIndex];
  const Icon = slide.icon;
  const isLast = currentIndex === slides.length - 1;

  const closeOnboarding = () => {
    markOnboardingSeen(role);
    setOpen(false);
    setManualOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-[#f6f2e9]/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-screen max-w-screen-sm items-center px-4 py-6">
        <div className={`relative w-full overflow-hidden rounded-[36px] bg-gradient-to-br ${slide.panelClass} p-5 shadow-[0_24px_60px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.85)]`}>
          <button
            type="button"
            onClick={closeOnboarding}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-foreground shadow-[0_10px_20px_rgba(0,0,0,0.08)]"
            aria-label="Onboarding schließen"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="pt-2">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-foreground/75">
                {manualOpen ? "App-Erklärung" : "Neu in BOOST"}
              </div>
              <div className="text-sm font-black text-foreground/70">
                {currentIndex + 1}/{slides.length}
              </div>
            </div>

            <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] ${slide.accentClass} shadow-[0_18px_30px_rgba(0,0,0,0.12)]`}>
              <Icon className="h-11 w-11" />
            </div>

            <div className="mt-6 text-center">
              <h2 className="text-[2rem] font-black leading-[1.05] text-foreground">{slide.title}</h2>
              <p className="mx-auto mt-3 max-w-xs text-base font-medium leading-relaxed text-foreground/72">
                {slide.text}
              </p>
            </div>

            <div className="mt-6 space-y-3">
              {slide.points.map((point) => (
                <div
                  key={point}
                  className="flex items-center gap-3 rounded-[22px] bg-white/78 px-4 py-3 text-left shadow-[0_12px_24px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Zap className="h-4 w-4 fill-current" />
                  </div>
                  <span className="text-sm font-bold text-foreground">{point}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-center gap-2">
              {slides.map((_, index) => (
                <span
                  key={index}
                  className={`h-2.5 rounded-full transition-all ${
                    index === currentIndex ? "w-8 bg-primary" : "w-2.5 bg-foreground/18"
                  }`}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={closeOnboarding}
                className="flex-1 rounded-[20px] bg-white/85 px-4 py-3 text-sm font-black text-foreground shadow-[0_12px_22px_rgba(0,0,0,0.06)]"
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
                className="flex-[1.2] rounded-[20px] bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-[0_16px_28px_rgba(31,224,102,0.28)]"
              >
                {isLast ? "Los geht's" : "Weiter"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppOnboarding;
