import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import boostLogo from "@/assets/boost-logo.png";
import { ArrowLeft, Loader2, UserPlus, UserMinus, RefreshCw } from "lucide-react";

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
  profiles: Profile | null;
};

const Admin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allStudents, setAllStudents] = useState<Profile[]>([]);
  const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>([]);
  const [results, setResults] = useState<DailyResult[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [assigningStudentId, setAssigningStudentId] = useState<string | null>(null);
  const [bulkAssigning, setBulkAssigning] = useState(false);

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
      .maybeSingle();

    if (!roleData) {
      toast.error("Kein Zugriff - nur für Lehrer");
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    setAdminUserId(session.user.id);

    const { data: ownProfile } = await supabase
      .from("profiles")
      .select("school, class")
      .eq("id", session.user.id)
      .maybeSingle();

    if (ownProfile) {
      setSelectedSchool(ownProfile.school);
      setSelectedClass(ownProfile.class);
    }

    await loadData(session.user.id);
  };

  const loadData = async (teacherId = adminUserId) => {
    if (!teacherId) return;
    setLoading(true);

    // Load all profiles and admin ids to separate students from teachers
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("username");

    if (profilesError) {
      toast.error("Fehler beim Laden der Profile");
      console.error(profilesError);
    }

    const { data: adminRoleRows, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError) {
      toast.error("Fehler beim Laden der Rollen");
      console.error(rolesError);
      setLoading(false);
      return;
    }

    const adminIds = new Set((adminRoleRows || []).map((row) => row.user_id));
    const studentProfiles = (profilesData || []).filter((profile) => !adminIds.has(profile.id));
    setAllStudents(studentProfiles);

    const { data: assignmentRows, error: assignmentError } = await (supabase as any)
      .from("teacher_student_assignments")
      .select("student_id")
      .eq("teacher_id", teacherId);

    if (assignmentError) {
      toast.error("Fehler beim Laden der Schüler-Zuteilungen");
      console.error(assignmentError);
      setLoading(false);
      return;
    }

    const assignedIds = (assignmentRows || []).map((row: { student_id: string }) => row.student_id);
    const assignedSet = new Set(assignedIds);

    setAssignedStudentIds(assignedIds);
    setProfiles(studentProfiles.filter((profile) => assignedSet.has(profile.id)));

    if (selectedSchool && !studentProfiles.some((s) => s.school === selectedSchool)) {
      setSelectedSchool("");
      setSelectedClass("");
    }

    // Load results only for assigned students
    if (assignedIds.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

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
      .in("user_id", assignedIds)
      .order("date", { ascending: false });

    if (resultsError) {
      toast.error("Fehler beim Laden der Ergebnisse");
      console.error(resultsError);
    } else {
      setResults(resultsData as unknown as DailyResult[] || []);
    }

    setLoading(false);
  };

  const assignStudent = async (studentId: string) => {
    if (!adminUserId) return;
    setAssigningStudentId(studentId);

    const { error } = await (supabase as any)
      .from("teacher_student_assignments")
      .upsert(
        {
          teacher_id: adminUserId,
          student_id: studentId,
          created_by: adminUserId,
        },
        { onConflict: "teacher_id,student_id" }
      );

    if (error) {
      toast.error("Schüler konnte nicht zugeteilt werden");
      console.error(error);
    } else {
      toast.success("Schüler zugeteilt");
      await loadData(adminUserId);
    }

    setAssigningStudentId(null);
  };

  const unassignStudent = async (studentId: string) => {
    if (!adminUserId) return;
    setAssigningStudentId(studentId);

    const { error } = await (supabase as any)
      .from("teacher_student_assignments")
      .delete()
      .eq("teacher_id", adminUserId)
      .eq("student_id", studentId);

    if (error) {
      toast.error("Zuteilung konnte nicht entfernt werden");
      console.error(error);
    } else {
      toast.success("Zuteilung entfernt");
      await loadData(adminUserId);
    }

    setAssigningStudentId(null);
  };

  const autoAssignByClass = async () => {
    if (!adminUserId || !selectedSchool || !selectedClass) {
      toast.error("Bitte Schule und Klasse auswählen");
      return;
    }

    setBulkAssigning(true);

    const { data, error } = await (supabase.rpc as any)("assign_students_to_teacher_by_class", {
      p_teacher_id: adminUserId,
      p_school: selectedSchool,
      p_class: selectedClass,
    });

    if (error) {
      toast.error("Automatische Zuteilung fehlgeschlagen");
      console.error(error);
    } else {
      toast.success(`${Number(data) || 0} Schüler automatisch zugeteilt`);
      await loadData(adminUserId);
    }

    setBulkAssigning(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const availableSchools = [...new Set(allStudents.map((student) => student.school))].sort((a, b) =>
    a.localeCompare(b, "de")
  );
  const availableClasses = [
    ...new Set(
      allStudents
        .filter((student) => !selectedSchool || student.school === selectedSchool)
        .map((student) => student.class)
    ),
  ].sort((a, b) => a.localeCompare(b, "de"));

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
        {/* Assignment Management */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Lehrer-Admin: Schüler zuteilen</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Du siehst im Dashboard nur dir zugeteilte Schüler. Hier kannst du manuell zuweisen oder eine ganze Klasse automatisch übernehmen.
          </p>

          <div className="grid gap-3 md:grid-cols-4 mb-4">
            <Select
              value={selectedSchool}
              onValueChange={(value) => {
                setSelectedSchool(value);
                setSelectedClass("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Schule wählen" />
              </SelectTrigger>
              <SelectContent>
                {availableSchools.map((school) => (
                  <SelectItem key={school} value={school}>
                    {school}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Klasse wählen" />
              </SelectTrigger>
              <SelectContent>
                {availableClasses.map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    {cls}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={autoAssignByClass}
              disabled={!selectedSchool || !selectedClass || bulkAssigning}
              className="gap-2"
            >
              {bulkAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Klasse automatisch zuweisen
            </Button>

            <Button variant="outline" onClick={() => loadData(adminUserId)} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Aktualisieren
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Benutzername</TableHead>
                  <TableHead>Schule</TableHead>
                  <TableHead>Klasse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allStudents.map((student) => {
                  const isAssigned = assignedStudentIds.includes(student.id);
                  const isBusy = assigningStudentId === student.id;
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.username}</TableCell>
                      <TableCell>{student.school}</TableCell>
                      <TableCell>{student.class}</TableCell>
                      <TableCell>
                        <span className={isAssigned ? "text-green-600 font-medium" : "text-muted-foreground"}>
                          {isAssigned ? "Zugewiesen" : "Nicht zugewiesen"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {isAssigned ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={isBusy}
                            onClick={() => unassignStudent(student.id)}
                          >
                            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                            Entfernen
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="gap-2"
                            disabled={isBusy}
                            onClick={() => assignStudent(student.id)}
                          >
                            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                            Zuteilen
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Students Overview */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Meine zugeteilten Schüler ({profiles.length})</h2>
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
                      <TableCell className="font-medium">{result.profiles?.username || "Unbekannt"}</TableCell>
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
