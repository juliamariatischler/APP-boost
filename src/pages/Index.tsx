import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem("boostUser");
    if (storedUser) {
      navigate("/dashboard");
    } else {
      navigate("/register");
    }
  }, [navigate]);

  return null;
};

export default Index;
