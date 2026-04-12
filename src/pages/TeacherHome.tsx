import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { getTeacherClasses, type TeacherClass } from "@/services/codeAuthService";
import { LogOut, Users } from "lucide-react";
import { toast } from "sonner";

export default function TeacherHome() {
  const navigate             = useNavigate();
  const { session, signOut } = useCodeAuth();
  const [classes, setClasses]   = useState<TeacherClass[]>([]);
  const [loading, setLoading]   = useState(true);

  // Redirect if no session
  useEffect(() => {
    if (!session || session.user_type !== "teacher") {
      navigate("/login", { replace: true });
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!session || session.user_type !== "teacher") return;

    getTeacherClasses(session.device_id)
      .then(setClasses)
      .catch(err => toast.error(err instanceof Error ? err.message : "Fehler beim Laden"))
      .finally(() => setLoading(false));
  }, [session]);

  if (!session || session.user_type !== "teacher") return null;

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Lehrkraft</p>
          <h1 className="text-xl font-bold">{session.display_name}</h1>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Abmelden"
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Classes */}
      <main className="flex-1 px-4 py-6 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Meine Klassen
        </h2>

        {loading && (
          <p className="text-sm text-muted-foreground">Lade Klassen…</p>
        )}

        {!loading && classes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Dir sind noch keine Klassen zugewiesen.
          </p>
        )}

        {classes.map(cls => (
          <div
            key={cls.class_id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Klasse {cls.class_name}</p>
              <p className="text-xs text-muted-foreground">{cls.school_name}</p>
            </div>
            <span className="text-sm text-muted-foreground">
              {cls.student_count} {cls.student_count === 1 ? "Schüler" : "Schüler"}
            </span>
          </div>
        ))}
      </main>
    </div>
  );
}
