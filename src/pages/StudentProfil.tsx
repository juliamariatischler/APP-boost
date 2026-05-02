import { useNavigate } from "react-router-dom";
import { Zap, LogOut, Shield, ChevronRight, School } from "lucide-react";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { StudentNav } from "@/components/student/StudentNav";

export default function StudentProfil() {
  const navigate = useNavigate();
  const { session, signOut } = useCodeAuth();

  if (!session || session.user_type !== "student") {
    navigate("/login", { replace: true });
    return null;
  }

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const initials = session.display_name.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-4 border-b border-gray-100">
        <h1 className="text-3xl font-black text-gray-900">Profil</h1>
      </div>

      <div className="px-4 pt-6 space-y-4">

        {/* Avatar card */}
        <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-sm">
          <div className="h-20 w-20 rounded-full bg-green-500 flex items-center justify-center text-white text-2xl font-black shadow-md">
            {initials}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-gray-900">{session.display_name}</h2>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <School className="h-3.5 w-3.5 text-gray-400" />
              <p className="text-sm text-gray-400">
                {session.school_name} · Klasse {session.class_name}
              </p>
            </div>
          </div>

          {/* Weekly points badge */}
          <div className="flex items-center gap-1.5 bg-green-50 px-4 py-2 rounded-full mt-1">
            <Zap className="h-4 w-4 fill-green-500 text-green-500" />
            <span className="text-sm font-bold text-green-700">0 Blitze diese Woche</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Streak",    value: "0",  unit: "Tage" },
            { label: "Gesamt",    value: "0",  unit: "Blitze" },
            { label: "Rank",      value: "–",  unit: "Klasse" },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl p-3 text-center shadow-sm">
              <p className="text-xl font-black text-gray-900">{stat.value}</p>
              <p className="text-[11px] text-gray-400 font-medium">{stat.unit}</p>
              <p className="text-[10px] text-gray-300 font-semibold uppercase tracking-wide mt-0.5">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Menu items */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
          <button
            onClick={() => window.open("/datenschutz.html", "_blank", "noopener,noreferrer")}
            className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-gray-50"
          >
            <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>
            <span className="flex-1 text-sm font-semibold text-gray-800">
              Datenschutzerklärung
            </span>
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full bg-white rounded-2xl px-4 py-4 flex items-center gap-3 shadow-sm active:bg-red-50"
        >
          <div className="h-9 w-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <LogOut className="h-5 w-5 text-red-500" />
          </div>
          <span className="flex-1 text-sm font-semibold text-red-500 text-left">Abmelden</span>
        </button>

      </div>

      <StudentNav />
    </div>
  );
}
