import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Circle, Trophy } from "lucide-react";

interface ChallengeCardProps {
  title: string;
  description: string;
  points: number;
  completed: boolean;
  onComplete: () => void;
}

export const ChallengeCard = ({ 
  title, 
  description, 
  points, 
  completed, 
  onComplete 
}: ChallengeCardProps) => {
  return (
    <Card className="p-6 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 bg-gradient-to-br from-card to-secondary/20">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
            {completed ? (
              <CheckCircle className="h-6 w-6 text-success" />
            ) : (
              <Circle className="h-6 w-6 text-muted-foreground" />
            )}
            {title}
          </h3>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary" className="ml-4 flex items-center gap-1 bg-gradient-to-r from-warning to-accent text-white">
          <Trophy className="h-3 w-3" />
          {points} Punkte
        </Badge>
      </div>
      
      {!completed && (
        <Button 
          onClick={onComplete}
          className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-300"
        >
          Challenge abschließen
        </Button>
      )}
      
      {completed && (
        <div className="text-center py-2 text-success font-semibold flex items-center justify-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Abgeschlossen!
        </div>
      )}
    </Card>
  );
};
