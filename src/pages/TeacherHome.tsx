import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardList, LogOut, QrCode, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentAppRole } from "@/lib/roles";
import {
  getTeacherClasses,
  getTeacherClassesAuth,
  type TeacherClass,
} from "@/services/codeAuthService";

type AuthMode = "supabase" | "code";

export default function TeacherHome() {
  const navigate = useNavigate();
  const { session: codeSession, loading: codeLoading, signOut } = useCodeAuth();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [teacherName, setTeacherName] = useState("Lehrkraft");
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);

  const totalStudents = useMemo(
    () => classes.reduce((sum, cls) => sum + Number(cls.student_count || 0), 0),
    [classes],
  );

  const loadClasses = useCallback(async (mode: AuthMode) => {
    setLoading(true);
    try {
      const nextClasses = mode === "code" && codeSession
        ? await getTeacherClasses(codeSession)
        : await getTeacherClassesAuth();
      setClasses(nextClasses);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Klassen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [codeSession]);

  useEffect(() => {
    const resolveTeacher = async () => {
      if (codeLoading) return;

      if (codeSession?.user_type === "teacher") {
        setAuthMode("code");
        setTeacherName(codeSession.display_name || "Lehrkraft");
        await loadClasses("code");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      const role = await getCurrentAppRole();
      if (role !== "teacher") {
        navigate("/dashboard", { replace: true });
        return;
      }

      setAuthMode("supabase");
      setTeacherName(
        String(session.user.user_metadata?.username || session.user.email?.split("@")[0] || "Lehrkraft"),
      );
      await loadClasses("supabase");
    };

    void resolveTeacher();
  }, [codeLoading, codeSession, loadClasses, navigate]);

  const handleLogout = async () => {
    if (authMode === "code") {
      await signOut();
      navigate("/login", { replace: true });
      return;
    }

    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Lehrer Home</p>
            <h1 className="text-2xl font-black leading-tight text-foreground">{teacherName}</h1>
          </div>
          <Button variant="outline" size="icon" onClick={handleLogout} aria-label="Abmelden">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 pb-24">
        <Card className="overflow-hidden rounded-[28px] border-0 bg-[linear-gradient(135deg,#22c55e_0%,#14b8a6_54%,#38bdf8_100%)] p-5 text-white shadow-[0_20px_44px_rgba(34,197,94,0.22)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge className="border-0 bg-white/18 text-white hover:bg-white/18">
                BOOST Verwaltung
              </Badge>
              <h2 className="mt-5 text-4xl font-black leading-[0.95] tracking-tight">
                Willkommen
                <br />
                im Lehrerbereich
              </h2>
              <p className="mt-3 max-w-md text-sm font-semibold leading-relaxed text-white/82">
                Behalte deine Klassen im Blick und öffne die Verwaltung, wenn du Schüler:innen, QR-Codes oder Geräte bearbeiten möchtest.
              </p>
            </div>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] bg-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              <Users className="h-8 w-8" />
            </div>
          </div>
        </Card>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Card className="rounded-[20px] border-black/5 bg-white p-3 text-center shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
            <Users className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-xl font-black">{loading ? "..." : classes.length}</p>
            <p className="text-[11px] font-bold text-muted-foreground">Klassen</p>
          </Card>
          <Card className="rounded-[20px] border-black/5 bg-white p-3 text-center shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
            <ClipboardList className="mx-auto h-5 w-5 text-sky-500" />
            <p className="mt-1 text-xl font-black">{loading ? "..." : totalStudents}</p>
            <p className="text-[11px] font-bold text-muted-foreground">Schüler:innen</p>
          </Card>
          <Card className="rounded-[20px] border-black/5 bg-white p-3 text-center shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
            <QrCode className="mx-auto h-5 w-5 text-amber-500" />
            <p className="mt-1 text-xl font-black">QR</p>
            <p className="text-[11px] font-bold text-muted-foreground">Aktivierung</p>
          </Card>
        </div>

        <section className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-foreground">Schnellzugriff</h2>
          </div>

          <button
            type="button"
            onClick={() => navigate("/teacher-management")}
            className="flex w-full items-center gap-4 rounded-[24px] border border-primary/15 bg-white p-4 text-left shadow-[0_14px_32px_rgba(0,0,0,0.07)] transition hover:border-primary/40"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-primary/12 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-foreground">Verwaltung öffnen</h3>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                Schüler:innen hinzufügen, QR-Codes anzeigen, Geräte zurücksetzen.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {classes.map((cls) => (
            <button
              key={cls.class_id}
              type="button"
              onClick={() => navigate("/teacher-management")}
              className="flex w-full items-center gap-3 rounded-[20px] border border-black/5 bg-white px-4 py-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.05)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-foreground">Klasse {cls.class_name}</p>
                <p className="truncate text-xs font-semibold text-muted-foreground">{cls.school_name}</p>
              </div>
              <Badge variant="secondary">{cls.student_count}</Badge>
            </button>
          ))}

          {!loading && classes.length === 0 && (
            <Card className="rounded-[20px] border-black/5 bg-white p-4 text-sm text-muted-foreground">
              Noch keine Klasse verfügbar. Öffne die Verwaltung, um deine erste Klasse vorzubereiten.
            </Card>
          )}
        </section>
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/95 shadow-lg backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-around px-2">
          <button className="flex h-full flex-1 flex-col items-center justify-center gap-1 text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/5 bg-white shadow-[0_8px_18px_rgba(0,0,0,0.12)]">
              <Zap className="h-[18px] w-[18px]" />
            </div>
            <span className="text-xs">Home</span>
          </button>
          <button
            onClick={() => navigate("/teacher-management")}
            className="flex h-full flex-1 flex-col items-center justify-center gap-1 text-muted-foreground"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full">
              <ClipboardList className="h-[18px] w-[18px]" />
            </div>
            <span className="text-xs">Verwaltung</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
