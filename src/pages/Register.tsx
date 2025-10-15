import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import boostLogo from "@/assets/boost-logo.png";
import { toast } from "sonner";

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    school: "",
    class: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.school || !formData.class) {
      toast.error("Bitte fülle alle Felder aus");
      return;
    }

    // Save user data to localStorage
    localStorage.setItem("boostUser", JSON.stringify(formData));
    toast.success("Willkommen bei BOOST!");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-card shadow-card">
        <div className="flex justify-center mb-8">
          <img src={boostLogo} alt="BOOST Logo" className="h-20 w-auto" />
        </div>

        <h1 className="text-3xl font-bold text-center mb-2 text-foreground">
          Willkommen bei BOOST
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          Freude an Bewegung für alle Schüler:innen
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Dein Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="school">Schule</Label>
            <Input
              id="school"
              type="text"
              placeholder="Deine Schule"
              value={formData.school}
              onChange={(e) => setFormData({ ...formData, school: e.target.value })}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="class">Klasse</Label>
            <Input
              id="class"
              type="text"
              placeholder="Deine Klasse"
              value={formData.class}
              onChange={(e) => setFormData({ ...formData, class: e.target.value })}
              className="mt-2"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all"
            size="lg"
          >
            Los geht's!
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Register;
