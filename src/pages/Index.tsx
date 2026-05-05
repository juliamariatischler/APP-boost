import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const resolveEntry = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      navigate(session ? "/dashboard" : "/auth", { replace: true });
    };

    void resolveEntry();
  }, [navigate]);

  return null;
};

export default Index;
