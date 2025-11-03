import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import boostLogo from "@/assets/boost-logo.png";
import { ArrowLeft, Loader2 } from "lucide-react";

type Profile = {
  id: string;
  username: string;
  school: string;
  class: string;
};

type DailyResult = {
  id: string;
  user_id: string;
  date: string;
  push_ups: number;
  squats: number;
  planks: number;
  sit_ups: number;
  jumping_jacks: number;
  profiles: Profile;
};

const Admin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [results, setResults] = useState<DailyResult[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      toast.error("Kein Zugriff - nur für Lehrer");
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    await loadData();
  };

  const loadData = async () => {
    setLoading(true);

    // Load all profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("username");

    if (profilesError) {
      toast.error("Fehler beim Laden der Profile");
      console.error(profilesError);
    } else {
      setProfiles(profilesData || []);
    }

    // Load all results with profiles
    const { data: resultsData, error: resultsError } = await supabase
      .from("daily_results")
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          school,
          class
        )
      `)
      .order("date", { ascending: false });

    if (resultsError) {
      toast.error("Fehler beim Laden der Ergebnisse");
      console.error(resultsError);
    } else {
      setResults(resultsData as unknown as DailyResult[] || []);
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-card shadow-sm p-4 mb-6">
        <div className="max-w-screen-xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
            <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <img src={boostLogo} alt="BOOST Logo" className="h-12 w-auto" />
            <Button variant="outline" onClick={handleLogout}>
              Abmelden
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 space-y-8">
        {/* Students Overview */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Registrierte Schüler ({profiles.length})</h2>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Benutzername</TableHead>
                    <TableHead>Schule</TableHead>
                    <TableHead>Klasse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.username}</TableCell>
                      <TableCell>{profile.school}</TableCell>
                      <TableCell>{profile.class}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Results Overview */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Tägliche Ergebnisse</h2>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-muted-foreground text-center p-8">Noch keine Ergebnisse vorhanden</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Schüler</TableHead>
                    <TableHead className="text-right">Push-ups</TableHead>
                    <TableHead className="text-right">Squats</TableHead>
                    <TableHead className="text-right">Planks (s)</TableHead>
                    <TableHead className="text-right">Sit-ups</TableHead>
                    <TableHead className="text-right">Jumping Jacks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell>{new Date(result.date).toLocaleDateString('de-DE')}</TableCell>
                      <TableCell className="font-medium">{result.profiles.username}</TableCell>
                      <TableCell className="text-right">{result.push_ups}</TableCell>
                      <TableCell className="text-right">{result.squats}</TableCell>
                      <TableCell className="text-right">{result.planks}</TableCell>
                      <TableCell className="text-right">{result.sit_ups}</TableCell>
                      <TableCell className="text-right">{result.jumping_jacks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Admin;
