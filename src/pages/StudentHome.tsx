import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCodeAuth } from "@/contexts/CodeAuthContext";

export default function StudentHome() {
  const navigate = useNavigate();
  const { session } = useCodeAuth();

  useEffect(() => {
    if (session?.user_type === "student") {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [session, navigate]);

  return null;
}
