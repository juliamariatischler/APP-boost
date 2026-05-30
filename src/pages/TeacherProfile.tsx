import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, LogOut, Mail, User, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeacherBottomNav } from "@/components/TeacherBottomNav";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentAppRole } from "@/lib/roles";
import { logoutEverywhereOnDevice } from "@/lib/logout";
import { formatDisplayName } from "@/lib/formatName";
import { getTeacherClasses, getTeacherClassesAuth, type TeacherClass } from "@/services/codeAuthService";

type AuthMode = "supabase" | "code";

export default function TeacherProfile() {
  const navigate = useNavigate();
  const { session: codeSession, loading: codeLoading, signOut } = useCodeAuth();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [teacherName, setTeacherName] = useState("Lehrkraft");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const totalStudents = useMemo(
    () => classes.reduce((sum, cls) => sum + Number(cls.student_count || 0), 0),
    [classes],
  );

  const loadTeacherProfile = useCallback(async () => {
    if (codeLoading) return;

    setLoading(true);
    try {
      if (codeSession?.user_type === "teacher") {
        setAuthMode("code");
        setTeacherName(codeSession.display_name || "Lehrkraft");
        setTeacherEmail("");
        setClasses(await getTeacherClasses(codeSession));
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
      setTeacherEmail(session.user.email || "");
      setTeacherName(
        String(session.user.user_metadata?.username || session.user.email?.split("@")[0] || "Lehrkraft"),
      );
      setClasses(await getTeacherClassesAuth());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profil konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [codeLoading, codeSession, navigate]);

  useEffect(() => {
    void loadTeacherProfile();
  }, [loadTeacherProfile]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      if (authMode === "code") {
        await signOut();
        navigate("/login", { replace: true });
        return;
      }

      await logoutEverywhereOnDevice();
      navigate("/auth", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Abmelden fehlgeschlagen");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fbf8] pb-nav-safe">
      <header className="border-b border-border/40 bg-white px-4 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Lehrer Profil</p>
            <h1 className="text-2xl font-black leading-tight text-foreground">{formatDisplayName(teacherName)}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-[24px] bg-muted" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Profile info card */}
            <Card className="overflow-hidden rounded-[24px] border-black/5 bg-white p-5 shadow-[0_12px_28px_rgba(0,0,0,0.07)]">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-primary/12 text-primary shadow-[0_8px_16px_rgba(34,197,94,0.15)]">
                  <User className="h-8 w-8" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-black text-foreground">{formatDisplayName(teacherName)}</h2>
                    <Badge className="border-0 bg-primary/12 text-primary hover:bg-primary/12">Lehrer:in</Badge>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {teacherEmail && (
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                          <Mail className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="truncate font-medium">{teacherEmail}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Stats grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="rounded-[20px] border-black/5 bg-white p-4 shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">Klassen</p>
                    <p className="mt-1 text-3xl font-black text-foreground">{classes.length}</p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">Klassen verwaltet</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-primary/12 text-primary shadow-[0_4px_10px_rgba(34,197,94,0.15)]">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                </div>
              </Card>
              <Card className="rounded-[20px] border-black/5 bg-white p-4 shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">Schüler:innen</p>
                    <p className="mt-1 text-3xl font-black text-foreground">{totalStudents}</p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">Schüler:innen insgesamt</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-sky-500/12 text-sky-600 shadow-[0_4px_10px_rgba(14,165,233,0.15)]">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Meine Klassen */}
            <Card className="rounded-[24px] border-black/5 bg-white p-5 shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
              <h2 className="mb-3 text-base font-black text-foreground">Meine Klassen</h2>
              <div className="space-y-2">
                {classes.length === 0 ? (
                  <p className="py-2 text-center text-sm text-muted-foreground">Noch keine Klasse zugeordnet.</p>
                ) : (
                  classes.map((cls) => (
                    <div key={cls.class_id} className="flex items-center gap-3 rounded-[18px] border border-black/5 bg-white px-4 py-3 shadow-[0_4px_10px_rgba(0,0,0,0.04)]">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-black text-primary">
                        {cls.class_name.length > 2 ? cls.class_name.substring(0, 2).toUpperCase() : cls.class_name.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-foreground">{cls.school_name}</p>
                        <p className="truncate text-xs font-semibold text-muted-foreground">Klasse {cls.class_name}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 rounded-full">{cls.student_count} Schüler:innen</Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Logout */}
            <Card className="rounded-[24px] border-red-100 bg-red-50/60 p-4 shadow-[0_8px_18px_rgba(239,68,68,0.06)]">
              <Button onClick={handleLogout} disabled={loggingOut} variant="destructive" className="w-full rounded-2xl">
                <LogOut className="mr-2 h-4 w-4" />
                {loggingOut ? "Melde ab..." : "Abmelden"}
              </Button>
            </Card>
          </div>
        )}
      </main>

      <TeacherBottomNav active="profil" />
    </div>
  );
}
