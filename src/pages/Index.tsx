import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentAppRole, routeForRole } from "@/lib/roles";
import boostLogo from "@/assets/boost-logo.png";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const resolveEntry = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      const role = await getCurrentAppRole();
      navigate(routeForRole(role), { replace: true });
    };

    void resolveEntry();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f5f0] px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <img src={boostLogo} alt="BOOST" className="h-20 w-20 rounded-3xl shadow-sm" />
        <p className="text-sm font-semibold text-muted-foreground">BOOST wird geladen...</p>
      </div>
    </div>
  );
};

export default Index;
