import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import boostLogo from "@/assets/boost-logo.png";
import { ChallengeScroll } from "@/components/ChallengeScroll";
import { BottomNav } from "@/components/BottomNav";

interface UserData {
  name: string;
  school: string;
  class: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("boostUser");
    if (!storedUser) {
      navigate("/register");
      return;
    }
    setUserData(JSON.parse(storedUser));
  }, [navigate]);

  if (!userData) return null;

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="bg-card shadow-sm p-4 mb-6">
        <div className="max-w-screen-xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{userData.school}</p>
              <p className="font-bold text-foreground text-lg">{userData.name}</p>
            </div>
            <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg">
              <Zap className="h-5 w-5 text-primary fill-primary" />
              <span className="font-bold text-primary">125</span>
            </div>
          </div>
          <img src={boostLogo} alt="BOOST Logo" className="h-12 w-auto" />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-screen-xl mx-auto px-4">
        <h2 className="text-2xl font-bold mb-4 text-foreground">
          Deine Challenges
        </h2>
        
        <ChallengeScroll />
      </div>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
