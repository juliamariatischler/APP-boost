import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentAppRole, routeForRole } from "@/lib/roles";

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

  return null;
};

export default Index;
