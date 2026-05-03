import { ClipboardCheck, Home, Users, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: "Home", path: "/dashboard", matches: ["/dashboard"] },
    { icon: ClipboardCheck, label: "Quests", path: "/quests", matches: ["/quests"] },
    { icon: Users, label: "Klasse", path: "/klasse", matches: ["/klasse"] },
    { icon: User, label: "Profil", path: "/profil", matches: ["/profil", "/settings", "/rewards", "/boost"] },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/95 shadow-lg backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = item.matches.some((path) =>
            path === "/dashboard" ? location.pathname === path : location.pathname.startsWith(path),
          );
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                  isActive
                    ? "border border-black/5 bg-white text-foreground shadow-[0_8px_18px_rgba(0,0,0,0.12),inset_0_-2px_0_rgba(0,0,0,0.06)]"
                    : "bg-transparent"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <span className="text-xs">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
