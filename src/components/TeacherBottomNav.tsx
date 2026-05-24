import { useNavigate } from "react-router-dom";
import { BarChart2, ClipboardList, Flame, Trophy, User, Zap } from "lucide-react";

type TeacherNavItem = {
  key: "home" | "uebersicht" | "wertung" | "mitmachen" | "verwaltung" | "profil";
  label: string;
  icon: typeof Zap;
  onClick: () => void;
};

type TeacherBottomNavProps = {
  active: TeacherNavItem["key"];
  onTabChange?: (tab: "home" | "uebersicht" | "wertung" | "mitmachen") => void;
};

export const TeacherBottomNav = ({ active, onTabChange }: TeacherBottomNavProps) => {
  const navigate = useNavigate();

  const goTeacherTab = (tab: "home" | "uebersicht" | "wertung" | "mitmachen") => {
    if (onTabChange) {
      onTabChange(tab);
      return;
    }

    navigate("/teacher-home", tab === "home" ? undefined : { state: { tab } });
  };

  const navItems: TeacherNavItem[] = [
    { key: "home", label: "Home", icon: Zap, onClick: () => goTeacherTab("home") },
    { key: "uebersicht", label: "Übersicht", icon: BarChart2, onClick: () => goTeacherTab("uebersicht") },
    { key: "wertung", label: "Wertung", icon: Trophy, onClick: () => goTeacherTab("wertung") },
    { key: "mitmachen", label: "Aktiv", icon: Flame, onClick: () => goTeacherTab("mitmachen") },
    { key: "verwaltung", label: "Verw.", icon: ClipboardList, onClick: () => navigate("/teacher-management") },
    { key: "profil", label: "Profil", icon: User, onClick: () => navigate("/teacher-profile") },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card shadow-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-6 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={`flex h-full min-w-0 flex-col items-center justify-center gap-1 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isActive ? "border border-black/5 bg-white shadow-[0_8px_18px_rgba(0,0,0,0.12)]" : ""}`}>
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <span className="max-w-full truncate text-[9px] leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
