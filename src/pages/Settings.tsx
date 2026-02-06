import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { TopHeader } from "@/components/TopHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Erfolgreich abgemeldet");
      navigate("/auth");
    } catch (error: any) {
      toast.error("Fehler beim Abmelden: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <TopHeader />

      <div className="max-w-screen-xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-6 text-foreground">Einstellungen</h1>

        <Card className="p-6 bg-card shadow-card">
          <Button
            onClick={handleLogout}
            variant="destructive"
            className="w-full"
          >
            Abmelden
          </Button>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default Settings;
