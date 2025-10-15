import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BottomNav } from "@/components/BottomNav";
import boostLogo from "@/assets/boost-logo.png";

const Activity = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="bg-card shadow-sm p-4 mb-6">
        <div className="max-w-screen-xl mx-auto flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Button>
          <img src={boostLogo} alt="BOOST Logo" className="h-12 w-auto" />
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-6 text-foreground">Meine Aktivitäten</h1>

        <Card className="p-6 bg-card shadow-card">
          <p className="text-muted-foreground text-center">
            Hier siehst du bald deine Aktivitäten der letzten Wochen und Monate!
          </p>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default Activity;
