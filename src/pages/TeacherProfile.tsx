import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, LogOut, Mail, ShieldCheck, User, Users } from "lucide-react";
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
    <div className="min-h-screen bg-background pb-nav-safe">
      <header className="border-b border-border bg-background px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Lehrer Profil</p>
            <h1 className="text-2xl font-black leading-tight text-foreground">{formatDisplayName(teacherName)}</h1>
          </div>
          <Button variant="outline" size="icon" onClick={handleLogout} disabled={loggingOut} aria-label="Abmelden">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {loading ? (
          <Card className="p-5">
            <p className="text-sm font-semibold text-muted-foreground">Profil wird geladen...</p>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <User className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-black text-foreground">{formatDisplayName(teacherName)}</h2>
                    <Badge variant="outline" className="border-primary/30 text-primary">Lehrer:in</Badge>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span>{authMode === "code" ? "Lehrer-Code Login" : "Lehrer-Account"}</span>
                    </div>
                    {teacherEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-primary" />
                        <span className="truncate">{teacherEmail}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Klassen</p>
                    <p className="mt-1 text-3xl font-black text-foreground">{classes.length}</p>
                  </div>
                  <ClipboardList className="h-8 w-8 text-primary" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Schüler:innen</p>
                    <p className="mt-1 text-3xl font-black text-foreground">{totalStudents}</p>
                  </div>
                  <Users className="h-8 w-8 text-primary" />
                </div>
              </Card>
            </div>

            <Card className="p-5">
              <h2 className="text-base font-black text-foreground">Meine Klassen</h2>
              <div className="mt-3 space-y-2">
                {classes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Noch keine Klasse zugeordnet.</p>
                ) : (
                  classes.map((cls) => (
                    <div key={cls.class_id} className="flex items-center justify-between rounded-2xl bg-muted/50 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{cls.class_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{cls.school_name}</p>
                      </div>
                      <Badge variant="secondary">{cls.student_count} Schüler:innen</Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-5">
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
