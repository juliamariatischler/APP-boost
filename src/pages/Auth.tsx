import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import boostLogo from "@/assets/boost-logo.png";
import { Loader2 } from "lucide-react";
import { z } from "zod";

// Input validation schemas
const loginSchema = z.object({
  email: z.string().trim().email("Ungültige E-Mail-Adresse").max(255, "E-Mail zu lang"),
  password: z.string().min(1, "Passwort erforderlich")
});

const signupSchema = z.object({
  username: z.string()
    .trim()
    .min(2, "Benutzername muss mindestens 2 Zeichen haben")
    .max(50, "Benutzername zu lang")
    .regex(/^[a-zA-Z0-9äöüÄÖÜß_-]+$/, "Nur Buchstaben, Zahlen, - und _ erlaubt"),
  email: z.string().trim().email("Ungültige E-Mail-Adresse").max(255, "E-Mail zu lang"),
  password: z.string()
    .min(8, "Passwort muss mindestens 8 Zeichen haben")
    .max(100, "Passwort zu lang"),
  school: z.string().trim().min(2, "Schule erforderlich").max(100, "Schulname zu lang"),
  class: z.string().trim().min(1, "Klasse erforderlich").max(20, "Klassenname zu lang")
});

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    username: "",
    email: "",
    password: "",
    school: "",
    class: "",
  });

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validatedData = loginSchema.parse(loginData);

      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) throw error;

      toast.success("Erfolgreich angemeldet!");
      navigate("/dashboard");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error("Eingabefehler: " + error.errors[0].message);
      } else {
        toast.error("Login fehlgeschlagen: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validatedData = signupSchema.parse(signupData);

      const { error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          data: {
            username: validatedData.username,
            school: validatedData.school,
            class: validatedData.class,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;

      toast.success("Erfolgreich registriert! Du wirst weitergeleitet...");
      navigate("/dashboard");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error("Eingabefehler: " + error.errors[0].message);
      } else {
        toast.error("Registrierung fehlgeschlagen: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex justify-center mb-6">
          <img src={boostLogo} alt="BOOST Logo" className="h-16 w-auto" />
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-6 text-foreground">
          BOOST Challenge
        </h1>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login">Anmelden</TabsTrigger>
            <TabsTrigger value="signup">Registrieren</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  placeholder="deine@email.de"
                />
              </div>
              <div>
                <Label htmlFor="login-password">Passwort</Label>
                <Input
                  id="login-password"
                  type="password"
                  required
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Anmelden
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <Label htmlFor="signup-username">Benutzername</Label>
                <Input
                  id="signup-username"
                  type="text"
                  required
                  value={signupData.username}
                  onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                  placeholder="Max123"
                />
              </div>
              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  required
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  placeholder="deine@email.de"
                />
              </div>
              <div>
                <Label htmlFor="signup-password">Passwort</Label>
                <Input
                  id="signup-password"
                  type="password"
                  required
                  minLength={6}
                  value={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <Label htmlFor="signup-school">Schule</Label>
                <Input
                  id="signup-school"
                  type="text"
                  required
                  value={signupData.school}
                  onChange={(e) => setSignupData({ ...signupData, school: e.target.value })}
                  placeholder="Meine Schule"
                />
              </div>
              <div>
                <Label htmlFor="signup-class">Klasse</Label>
                <Input
                  id="signup-class"
                  type="text"
                  required
                  value={signupData.class}
                  onChange={(e) => setSignupData({ ...signupData, class: e.target.value })}
                  placeholder="5a"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrieren
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;
