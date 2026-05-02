import { Home, BookOpen, Users, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const ITEMS = [
  { Icon: Home,     label: "Home",   path: "/student-home"   },
  { Icon: BookOpen, label: "Quests", path: "/student-quests" },
  { Icon: Users,    label: "Klasse", path: "/student-klasse" },
  { Icon: User,     label: "Profil", path: "/student-profil" },
];

export function StudentNav() {
  const navigate      = useNavigate();
  const { pathname }  = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
      <div className="flex h-16 max-w-xl mx-auto">
        {ITEMS.map(({ Icon, label, path }) => {
          const active = pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors ${
                active ? "text-green-600" : "text-gray-400"
              }`}
            >
              <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 1.75} />
              <span className={`text-[11px] font-semibold ${active ? "text-green-600" : "text-gray-400"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
