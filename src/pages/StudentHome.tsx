import { useNavigate } from "react-router-dom";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { LogOut } from "lucide-react";

export default function StudentHome() {
  const navigate         = useNavigate();
  const { session, signOut } = useCodeAuth();

  // Redirect if no session
  if (!session || session.user_type !== "student") {
    navigate("/login", { replace: true });
    return null;
  }

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {session.school_name} · Klasse {session.class_name}
          </p>
          <h1 className="text-xl font-bold">Hallo, {session.display_name}!</h1>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Abmelden"
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Content placeholder */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 gap-4 text-center">
        <p className="text-4xl">🏃</p>
        <h2 className="text-lg font-semibold">Bereit für deine nächste Challenge?</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Hier erscheinen bald deine täglichen Challenges und dein Fortschritt.
        </p>
      </main>
    </div>
  );
}
