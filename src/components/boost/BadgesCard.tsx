import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

interface Props {
  allBadges: Badge[];
  earnedBadgeIds: string[];
}

export const BadgesCard = ({ allBadges, earnedBadgeIds }: Props) => {
  const earned = allBadges.filter((b) => earnedBadgeIds.includes(b.id));
  const locked = allBadges.filter((b) => !earnedBadgeIds.includes(b.id));

  return (
    <Card className="p-4 bg-card shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">Abzeichen</span>
        <span className="text-xs text-muted-foreground font-bold">
          {earned.length}/{allBadges.length}
        </span>
      </div>

      {earned.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {earned.map((badge) => (
            <div
              key={badge.id}
              className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1.5 rounded-full"
              title={badge.description}
            >
              <span className="text-base">{badge.icon}</span>
              <span className="text-xs font-bold text-foreground">{badge.name}</span>
            </div>
          ))}
        </div>
      )}

      {earned.length === 0 && (
        <p className="text-sm text-muted-foreground mb-3">
          Noch keine Abzeichen – schließe Challenges ab! 💪
        </p>
      )}

      {/* Locked badges preview */}
      <div className="flex flex-wrap gap-1.5">
        {locked.slice(0, 6).map((badge) => (
          <div
            key={badge.id}
            className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full opacity-50"
            title={badge.description}
          >
            <Lock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{badge.name}</span>
          </div>
        ))}
        {locked.length > 6 && (
          <span className="text-xs text-muted-foreground self-center">
            +{locked.length - 6} weitere
          </span>
        )}
      </div>
    </Card>
  );
};
