import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Footprints, Dumbbell, Flame, ChevronRight } from "lucide-react";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { StudentNav } from "@/components/student/StudentNav";
import boostLogo from "@/assets/boost-logo.png";

const FILTER_TABS = [
  { id: "quest",   label: "Wochen-Quest" },
  { id: "klasse",  label: "Klasse"       },
  { id: "tryit",   label: "Try It"       },
];

const WEEKLY_TASKS = [
  {
    id: "steps",
    Icon: Footprints,
    bg: "bg-green-500",
    title: "Tagesziel Schritte",
    subtitle: "7.500 Schritte",
    points: 10,
    done: false,
  },
  {
    id: "exercise",
    Icon: Dumbbell,
    bg: "bg-orange-500",
    title: "Eine Übung machen",
    subtitle: "Egal welche, ab 15 min",
    points: 10,
    done: false,
  },
  {
    id: "streak",
    Icon: Flame,
    bg: "bg-sky-500",
    title: "Streak halten",
    subtitle: "Heute eingeloggt ✓",
    points: 5,
    done: true,
  },
];

export default function StudentHome() {
  const navigate = useNavigate();
  const { session } = useCodeAuth();
  const [activeFilter, setActiveFilter] = useState("quest");

  if (!session || session.user_type !== "student") {
    navigate("/login", { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Logo header */}
      <div className="bg-white px-4 pt-6 pb-3 flex flex-col items-center gap-0.5">
        <img src={boostLogo} alt="Boost" className="h-9 w-auto" />
        <p className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase">
          Together we move.
        </p>
      </div>

      {/* Filter pills */}
      <div className="bg-white px-4 py-2 flex gap-2 border-b border-gray-100">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              activeFilter === tab.id
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Featured quest card */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {/* Hatched green header */}
          <div
            className="px-4 py-3 flex items-center"
            style={{
              background:
                "repeating-linear-gradient(-45deg,#bbf7d0,#bbf7d0 8px,#dcfce7 8px,#dcfce7 16px)",
            }}
          >
            <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              Wochen-Quest
            </span>
            <span className="ml-auto flex items-center gap-1 bg-black/10 text-green-900 text-xs font-bold px-2 py-0.5 rounded-full">
              <Zap className="h-3 w-3" /> EPIC
            </span>
          </div>

          {/* Quest body */}
          <div className="p-4">
            <p className="text-[11px] text-gray-400 font-semibold mb-1 uppercase tracking-wide">
              {session.school_name} · Klasse {session.class_name} · Klassenaufgabe
            </p>
            <p className="font-bold text-gray-900 text-base mb-2 leading-snug">
              10.000 Liegestütze gemeinsam schaffen
            </p>
            <ul className="text-sm text-gray-500 space-y-1 mb-3">
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 text-green-500">•</span>
                Mach so viele Liegestütze wie du kannst
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 text-green-500">•</span>
                Jede Wiederholung zählt für die Klasse
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 text-green-500">•</span>
                Gemeinsam schafft ihr das Ziel!
              </li>
            </ul>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Endet So 23:58</p>
              <button
                onClick={() => navigate("/student-quests")}
                className="flex items-center gap-0.5 text-xs font-semibold text-green-600"
              >
                Details <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Diese Woche */}
        <div>
          <h2 className="text-lg font-black text-gray-900 mb-3">Diese Woche</h2>
          <div className="space-y-2">
            {WEEKLY_TASKS.map(({ id, Icon, bg, title, subtitle, points, done }) => (
              <div
                key={id}
                className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm"
              >
                <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
                  <p className="text-xs text-gray-400">{subtitle}</p>
                </div>
                <div className={`flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                  done
                    ? "bg-gray-100 text-gray-400"
                    : "bg-green-50 text-green-700"
                }`}>
                  +{points}
                  <Zap className={`h-3 w-3 ml-0.5 ${done ? "text-gray-400" : "fill-green-500 text-green-500"}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <StudentNav />
    </div>
  );
}
