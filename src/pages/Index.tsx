import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import boostLogo from "@/assets/boost-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const { session: codeSession } = useCodeAuth();

  useEffect(() => {
    // If already logged in via code, go to the right home
    if (codeSession) {
      navigate(
        codeSession.user_type === "student" ? "/student-home" : "/teacher-home",
        { replace: true }
      );
      return;
    }

    // If already logged in via legacy email/password, go to dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard", { replace: true });
    });
  }, [codeSession, navigate]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          "radial-gradient(circle at top left, #ecfdf5 0%, #f8fafc 50%, #ecfdf5 100%)",
      }}
    >
      {/* Top nav */}
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <img src={boostLogo} alt="BOOST" className="h-10 w-auto" />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            Schüler-Login
          </button>
          <button
            onClick={() => navigate("/auth")}
            className="rounded-full bg-green-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-600 active:scale-95 transition-all"
          >
            Schule anmelden
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6 pb-24">
        <span className="rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-green-700">
          Fitness-Programm für Schulen
        </span>

        <h1 className="text-4xl font-black leading-tight text-gray-900 md:text-6xl">
          Mehr Bewegung.
          <br />
          <span className="text-green-500">Mehr Fokus.</span>
          <br />
          Mehr Leistung.
        </h1>

        <p className="max-w-md text-base text-gray-500 leading-relaxed">
          BOOST bringt tägliche Bewegungsaufgaben an deine Schule – für
          zuhause, unterwegs oder in der Pause. Kein Equipment, kein Aufwand,
          maximale Wirkung.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => navigate("/login")}
            className="w-full rounded-2xl bg-green-500 py-4 text-base font-bold text-white shadow-md hover:bg-green-600 active:scale-95 transition-all"
          >
            Jetzt kostenlos starten
          </button>
          <button
            onClick={() => navigate("/auth")}
            className="w-full rounded-2xl border border-gray-200 bg-white py-4 text-base font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            Mehr erfahren
          </button>
        </div>

        <p className="text-sm text-gray-400">
          ✓ Bereits an Schulen im Einsatz
        </p>
      </main>
    </div>
  );
};

export default Index;
