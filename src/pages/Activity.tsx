import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TopHeader } from "@/components/TopHeader";
import { WeekOverview } from "@/components/WeekOverview";
import { supabase } from "@/integrations/supabase/client";

const Activity = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUserId(session.user.id);
  };

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <TopHeader />

      <div className="max-w-screen-xl mx-auto px-4 space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Meine Aktivitäten</h1>

        {userId && <WeekOverview userId={userId} />}
      </div>

      <BottomNav />
    </div>
  );
};

export default Activity;
