import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import boostLogo from "@/assets/boost-logo.png";
import { ArrowLeft, Loader2, UserPlus, UserMinus, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

type Profile = {
  id: string;
  username: string;
  school: string;
  class: string;
  points?: number;
};

type DailyResult = {
  id: string;
  user_id: string;
  date: string;
  push_ups: number | null;
  squats: number | null;
  planks: number | null;
  sit_ups: number | null;
  jumping_jacks: number | null;
  steps: number | null;
  profiles: Profile | null;
};

type SchoolRegistrationRequest = {
  id: string;
  requested_school: string;
  requester_email: string | null;
  requester_name: string | null;
  request_note: string | null;
  status: string;
  created_at: string;
};

type RewardRedemptionRequest = {
  id: string;
  user_id: string;
  reward_id: string;
  status: string;
  requested_at: string;
  profiles: Profile | null;
  reward_items: {
    id: string;
    title: string;
    threshold: number;
  } | null;
};

type RewardItemAdmin = {
  id: string;
  title: string;
  partner: string | null;
  threshold: number;
  category: string;
  icon: string | null;
  is_active: boolean;
};

type MilestoneAdmin = {
  id: string;
  threshold: number;
  title: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

const EXERCISE_GOALS = {
  push_ups: 20,
  squats: 30,
  planks: 60,
  sit_ups: 25,
  jumping_jacks: 40,
} as const;

const getCompletedGoalsCount = (result?: DailyResult | null) => {
  if (!result) return 0;
  let done = 0;
  if ((result.push_ups || 0) >= EXERCISE_GOALS.push_ups) done++;
  if ((result.squats || 0) >= EXERCISE_GOALS.squats) done++;
  if ((result.planks || 0) >= EXERCISE_GOALS.planks) done++;
  if ((result.sit_ups || 0) >= EXERCISE_GOALS.sit_ups) done++;
  if ((result.jumping_jacks || 0) >= EXERCISE_GOALS.jumping_jacks) done++;
  return done;
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
  const [schoolRequests, setSchoolRequests] = useState<SchoolRegistrationRequest[]>([]);
  const [handlingRequestId, setHandlingRequestId] = useState<string | null>(null);
  const [rewardRequests, setRewardRequests] = useState<RewardRedemptionRequest[]>([]);
  const [handlingRewardRequestId, setHandlingRewardRequestId] = useState<string | null>(null);
  const [rewardItems, setRewardItems] = useState<RewardItemAdmin[]>([]);
  const [milestones, setMilestones] = useState<MilestoneAdmin[]>([]);
  const [savingReward, setSavingReward] = useState(false);
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [newReward, setNewReward] = useState({
    title: "",
    partner: "",
    threshold: 50,
    category: "gutscheine",
    icon: "🎁",
  });
  const [newMilestone, setNewMilestone] = useState({
    threshold: 2500,
    title: "",
    description: "",
    icon: "🏆",
    sort_order: 1,
  });

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

    await Promise.all([
      loadSchoolRequests(),
      loadRewardRequests(assignedIds),
      loadRewardsAdminData(),
    ]);

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

  const loadSchoolRequests = async () => {
    const { data, error } = await (supabase as any)
      .from("school_registration_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      toast.error("Schulanfragen konnten nicht geladen werden");
      return;
    }

    setSchoolRequests((data || []) as SchoolRegistrationRequest[]);
  };

  const loadRewardRequests = async (assignedIds: string[]) => {
    if (assignedIds.length === 0) {
      setRewardRequests([]);
      return;
    }

    const { data, error } = await (supabase as any)
      .from("reward_redemptions")
      .select(`
        id,
        user_id,
        reward_id,
        status,
        requested_at,
        profiles:user_id (
          id,
          username,
          school,
          class
        ),
        reward_items:reward_id (
          id,
          title,
          threshold
        )
      `)
      .eq("status", "requested")
      .in("user_id", assignedIds)
      .order("requested_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Belohnungsanfragen konnten nicht geladen werden");
      return;
    }

    setRewardRequests((data || []) as RewardRedemptionRequest[]);
  };

  const loadRewardsAdminData = async () => {
    const [{ data: rewardsData, error: rewardsError }, { data: milestoneData, error: milestoneError }] = await Promise.all([
      (supabase as any)
        .from("reward_items")
        .select("id, title, partner, threshold, category, icon, is_active")
        .order("threshold", { ascending: true }),
      (supabase as any)
        .from("class_milestones")
        .select("id, threshold, title, description, icon, sort_order, is_active")
        .order("sort_order", { ascending: true })
        .order("threshold", { ascending: true }),
    ]);

    if (rewardsError) {
      console.error(rewardsError);
      toast.error("Belohnungen konnten nicht geladen werden");
    } else {
      setRewardItems((rewardsData || []) as RewardItemAdmin[]);
    }

    if (milestoneError) {
      console.error(milestoneError);
      toast.error("Meilensteine konnten nicht geladen werden");
    } else {
      setMilestones((milestoneData || []) as MilestoneAdmin[]);
    }
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

  const handleSchoolRequestDecision = async (requestId: string, status: "approved" | "rejected") => {
    if (!adminUserId) return;

    setHandlingRequestId(requestId);

    const { error } = await (supabase as any)
      .from("school_registration_requests")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId,
      })
      .eq("id", requestId);

    setHandlingRequestId(null);

    if (error) {
      console.error(error);
      toast.error("Anfrage konnte nicht aktualisiert werden");
      return;
    }

    toast.success(status === "approved" ? "Schule freigegeben" : "Anfrage abgelehnt");
    await loadSchoolRequests();
  };

  const handleRewardRequestDecision = async (requestId: string, status: "approved" | "rejected") => {
    if (!adminUserId) return;

    setHandlingRewardRequestId(requestId);

    const { error } = await (supabase as any)
      .from("reward_redemptions")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId,
      })
      .eq("id", requestId);

    setHandlingRewardRequestId(null);

    if (error) {
      console.error(error);
      toast.error("Belohnungsanfrage konnte nicht aktualisiert werden");
      return;
    }

    toast.success(status === "approved" ? "Belohnung freigegeben" : "Belohnung abgelehnt");
    await loadData(adminUserId);
  };

  const handleCreateReward = async () => {
    if (!newReward.title.trim() || Number(newReward.threshold) <= 0) {
      toast.error("Bitte Titel und gültige Schwelle angeben");
      return;
    }

    setSavingReward(true);
    const { error } = await (supabase as any).from("reward_items").insert({
      title: newReward.title.trim(),
      partner: newReward.partner.trim() || null,
      threshold: Number(newReward.threshold),
      category: newReward.category.trim() || "allgemein",
      icon: newReward.icon.trim() || null,
      is_active: true,
    });
    setSavingReward(false);

    if (error) {
      console.error(error);
      toast.error("Belohnung konnte nicht erstellt werden");
      return;
    }

    toast.success("Belohnung erstellt");
    setNewReward({ title: "", partner: "", threshold: 50, category: "gutscheine", icon: "🎁" });
    await loadRewardsAdminData();
  };

  const handleToggleRewardActive = async (rewardId: string, active: boolean) => {
    const { error } = await (supabase as any).from("reward_items").update({ is_active: !active }).eq("id", rewardId);
    if (error) {
      console.error(error);
      toast.error("Status konnte nicht geändert werden");
      return;
    }
    toast.success(!active ? "Belohnung aktiviert" : "Belohnung deaktiviert");
    await loadRewardsAdminData();
  };

  const handleCreateMilestone = async () => {
    if (!newMilestone.title.trim() || Number(newMilestone.threshold) <= 0) {
      toast.error("Bitte Titel und gültige Schwelle angeben");
      return;
    }

    setSavingMilestone(true);
    const { error } = await (supabase as any).from("class_milestones").insert({
      threshold: Number(newMilestone.threshold),
      title: newMilestone.title.trim(),
      description: newMilestone.description.trim() || null,
      icon: newMilestone.icon.trim() || null,
      sort_order: Number(newMilestone.sort_order) || 1,
      is_active: true,
    });
    setSavingMilestone(false);

    if (error) {
      console.error(error);
      toast.error("Meilenstein konnte nicht erstellt werden");
      return;
    }

    toast.success("Meilenstein erstellt");
    setNewMilestone({ threshold: 2500, title: "", description: "", icon: "🏆", sort_order: 1 });
    await loadRewardsAdminData();
  };

  const handleToggleMilestoneActive = async (milestoneId: string, active: boolean) => {
    const { error } = await (supabase as any).from("class_milestones").update({ is_active: !active }).eq("id", milestoneId);
    if (error) {
      console.error(error);
      toast.error("Status konnte nicht geändert werden");
      return;
    }
    toast.success(!active ? "Meilenstein aktiviert" : "Meilenstein deaktiviert");
    await loadRewardsAdminData();
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

  const todayStr = new Date().toISOString().split("T")[0];
  const latestResultByStudent = new Map<string, DailyResult>();
  const todayResultByStudent = new Map<string, DailyResult>();

  for (const result of results) {
    if (!latestResultByStudent.has(result.user_id)) {
      latestResultByStudent.set(result.user_id, result);
    }
    if (result.date === todayStr && !todayResultByStudent.has(result.user_id)) {
      todayResultByStudent.set(result.user_id, result);
    }
  }

  const rankedAssignedProfiles = [...profiles].sort((a, b) => {
    const pointsDiff = Number(b.points || 0) - Number(a.points || 0);
    if (pointsDiff !== 0) return pointsDiff;
    return a.username.localeCompare(b.username, "de");
  });

  const classScopedAssignedProfiles = selectedSchool && selectedClass
    ? rankedAssignedProfiles.filter((p) => p.school === selectedSchool && p.class === selectedClass)
    : rankedAssignedProfiles;

  const openClassCandidates = selectedSchool && selectedClass
    ? allStudents.filter(
        (student) =>
          student.school === selectedSchool &&
          student.class === selectedClass &&
          !assignedStudentIds.includes(student.id)
      )
    : [];

  const studentsForManagement = allStudents.filter(
    (student) =>
      (!selectedSchool || student.school === selectedSchool) &&
      (!selectedClass || student.class === selectedClass)
  );

  const pointsByStudentId = new Map(profiles.map((p) => [p.id, Number(p.points || 0)]));

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
        {/* Rewards Admin */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Rewards verwalten</h2>

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-bold text-lg">Neue Belohnung</h3>
              <div className="grid gap-3">
                <div>
                  <Label>Titel</Label>
                  <Input value={newReward.title} onChange={(e) => setNewReward((p) => ({ ...p, title: e.target.value }))} />
                </div>
                <div>
                  <Label>Partner</Label>
                  <Input value={newReward.partner} onChange={(e) => setNewReward((p) => ({ ...p, partner: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Schwelle</Label>
                    <Input type="number" min={1} value={newReward.threshold} onChange={(e) => setNewReward((p) => ({ ...p, threshold: Number(e.target.value) || 1 }))} />
                  </div>
                  <div>
                    <Label>Kategorie</Label>
                    <Input value={newReward.category} onChange={(e) => setNewReward((p) => ({ ...p, category: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Icon</Label>
                    <Input value={newReward.icon} onChange={(e) => setNewReward((p) => ({ ...p, icon: e.target.value }))} />
                  </div>
                </div>
                <Button onClick={handleCreateReward} disabled={savingReward}>
                  {savingReward ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Belohnung anlegen
                </Button>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titel</TableHead>
                      <TableHead className="text-right">Schwelle</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rewardItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.icon || "🎁"} {item.title}</TableCell>
                        <TableCell className="text-right">{item.threshold} ⚡</TableCell>
                        <TableCell>{item.is_active ? "Aktiv" : "Inaktiv"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleToggleRewardActive(item.id, item.is_active)}>
                            {item.is_active ? "Deaktivieren" : "Aktivieren"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-lg">Neue Meilensteine</h3>
              <div className="grid gap-3">
                <div>
                  <Label>Titel</Label>
                  <Input value={newMilestone.title} onChange={(e) => setNewMilestone((p) => ({ ...p, title: e.target.value }))} />
                </div>
                <div>
                  <Label>Beschreibung</Label>
                  <Input value={newMilestone.description} onChange={(e) => setNewMilestone((p) => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Schwelle</Label>
                    <Input type="number" min={1} value={newMilestone.threshold} onChange={(e) => setNewMilestone((p) => ({ ...p, threshold: Number(e.target.value) || 1 }))} />
                  </div>
                  <div>
                    <Label>Reihenfolge</Label>
                    <Input type="number" min={1} value={newMilestone.sort_order} onChange={(e) => setNewMilestone((p) => ({ ...p, sort_order: Number(e.target.value) || 1 }))} />
                  </div>
                  <div>
                    <Label>Icon</Label>
                    <Input value={newMilestone.icon} onChange={(e) => setNewMilestone((p) => ({ ...p, icon: e.target.value }))} />
                  </div>
                </div>
                <Button onClick={handleCreateMilestone} disabled={savingMilestone}>
                  {savingMilestone ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Meilenstein anlegen
                </Button>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titel</TableHead>
                      <TableHead className="text-right">Schwelle</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {milestones.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.icon || "🏆"} {item.title}</TableCell>
                        <TableCell className="text-right">{item.threshold} ⚡</TableCell>
                        <TableCell>{item.is_active ? "Aktiv" : "Inaktiv"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleToggleMilestoneActive(item.id, item.is_active)}>
                            {item.is_active ? "Deaktivieren" : "Aktivieren"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </Card>

        {/* Assignment Management */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Lehrkraft: Schüler verwalten</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Du siehst im Dashboard nur dir zugeteilte Schüler. Hier kannst du Schüler annehmen, hinzufügen, entfernen oder eine ganze Klasse übernehmen.
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
                {studentsForManagement.map((student) => {
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
                            Hinzufügen
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {studentsForManagement.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Keine Schüler für die aktuelle Schul-/Klassenfilterung gefunden.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Schüler annehmen ({openClassCandidates.length})</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Offene Schüler aus der aktuell ausgewählten Schule/Klasse ({selectedSchool || "-"} / {selectedClass || "-"}).
          </p>
          {!selectedSchool || !selectedClass ? (
            <p className="text-muted-foreground">Bitte oben zuerst Schule und Klasse auswählen.</p>
          ) : openClassCandidates.length === 0 ? (
            <p className="text-muted-foreground">Keine offenen Schüler mehr in dieser Klasse.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Benutzername</TableHead>
                    <TableHead>Schule</TableHead>
                    <TableHead>Klasse</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openClassCandidates.map((student) => {
                    const isBusy = assigningStudentId === student.id;
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.username}</TableCell>
                        <TableCell>{student.school}</TableCell>
                        <TableCell>{student.class}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" className="gap-2" disabled={isBusy} onClick={() => assignStudent(student.id)}>
                            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Annehmen
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* School Requests */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Schulanfragen ({schoolRequests.length})</h2>
          {schoolRequests.length === 0 ? (
            <p className="text-muted-foreground">Keine offenen Schulanfragen.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Schule</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Notiz</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schoolRequests.map((request) => {
                    const isBusy = handlingRequestId === request.id;
                    return (
                      <TableRow key={request.id}>
                        <TableCell>{new Date(request.created_at).toLocaleDateString("de-DE")}</TableCell>
                        <TableCell className="font-medium">{request.requested_school}</TableCell>
                        <TableCell>{request.requester_name || "-"}</TableCell>
                        <TableCell>{request.requester_email || "-"}</TableCell>
                        <TableCell>{request.request_note || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={isBusy}
                              onClick={() => handleSchoolRequestDecision(request.id, "approved")}
                              className="gap-2"
                            >
                              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              Freigeben
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => handleSchoolRequestDecision(request.id, "rejected")}
                              className="gap-2"
                            >
                              <XCircle className="h-4 w-4" />
                              Ablehnen
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Reward Redemption Requests */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Belohnungsanfragen ({rewardRequests.length})</h2>
          {rewardRequests.length === 0 ? (
            <p className="text-muted-foreground">Keine offenen Belohnungsanfragen.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Schüler</TableHead>
                    <TableHead>Schule/Klasse</TableHead>
                    <TableHead>Belohnung</TableHead>
                    <TableHead className="text-right">Schwelle</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewardRequests.map((request) => {
                    const isBusy = handlingRewardRequestId === request.id;
                    return (
                      <TableRow key={request.id}>
                        <TableCell>{new Date(request.requested_at).toLocaleDateString("de-DE")}</TableCell>
                        <TableCell className="font-medium">{request.profiles?.username || "Unbekannt"}</TableCell>
                        <TableCell>{request.profiles ? `${request.profiles.school} / ${request.profiles.class}` : "-"}</TableCell>
                        <TableCell>{request.reward_items?.title || "Belohnung"}</TableCell>
                        <TableCell className="text-right">{request.reward_items?.threshold || 0} ⚡</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={isBusy}
                              onClick={() => handleRewardRequestDecision(request.id, "approved")}
                              className="gap-2"
                            >
                              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              Freigeben
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => handleRewardRequestDecision(request.id, "rejected")}
                              className="gap-2"
                            >
                              <XCircle className="h-4 w-4" />
                              Ablehnen
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Students Overview */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-foreground">
            Ranking & Status meiner Schüler ({classScopedAssignedProfiles.length})
          </h2>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rang</TableHead>
                    <TableHead>Benutzername</TableHead>
                    <TableHead>Schule</TableHead>
                    <TableHead>Klasse</TableHead>
                    <TableHead className="text-right">Blitze</TableHead>
                    <TableHead className="text-right">Aufgaben heute</TableHead>
                    <TableHead>Letzte Aktivität</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classScopedAssignedProfiles.map((profile, idx) => {
                    const todayResult = todayResultByStudent.get(profile.id);
                    const latestResult = latestResultByStudent.get(profile.id);
                    const todayCompleted = getCompletedGoalsCount(todayResult);
                    const isBusy = assigningStudentId === profile.id;

                    return (
                      <TableRow key={profile.id}>
                        <TableCell className="font-semibold">#{idx + 1}</TableCell>
                        <TableCell className="font-medium">{profile.username}</TableCell>
                        <TableCell>{profile.school}</TableCell>
                        <TableCell>{profile.class}</TableCell>
                        <TableCell className="text-right font-semibold">{Number(profile.points || 0)} ⚡</TableCell>
                        <TableCell className="text-right">
                          <span className={todayCompleted >= 5 ? "text-green-600 font-semibold" : "text-muted-foreground"}>
                            {todayCompleted}/5
                          </span>
                        </TableCell>
                        <TableCell>
                          {latestResult ? new Date(latestResult.date).toLocaleDateString("de-DE") : "Noch keine"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={isBusy}
                            onClick={() => unassignStudent(profile.id)}
                          >
                            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                            Entfernen
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {classScopedAssignedProfiles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Keine zugeteilten Schüler in der aktuellen Auswahl.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Results Overview */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Tägliche Ergebnisse & Aufgabenfortschritt</h2>
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
                    <TableHead className="text-right">Blitze</TableHead>
                    <TableHead className="text-right">Erreicht</TableHead>
                    <TableHead className="text-right">Push-ups</TableHead>
                    <TableHead className="text-right">Squats</TableHead>
                    <TableHead className="text-right">Planks (s)</TableHead>
                    <TableHead className="text-right">Sit-ups</TableHead>
                    <TableHead className="text-right">Jumping Jacks</TableHead>
                    <TableHead className="text-right">Schritte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => {
                    const doneGoals = getCompletedGoalsCount(result);
                    const flashes = pointsByStudentId.get(result.user_id) ?? 0;
                    return (
                      <TableRow key={result.id}>
                        <TableCell>{new Date(result.date).toLocaleDateString("de-DE")}</TableCell>
                        <TableCell className="font-medium">{result.profiles?.username || "Unbekannt"}</TableCell>
                        <TableCell className="text-right">{flashes} ⚡</TableCell>
                        <TableCell className="text-right">{doneGoals}/5</TableCell>
                        <TableCell className="text-right">{result.push_ups || 0}</TableCell>
                        <TableCell className="text-right">{result.squats || 0}</TableCell>
                        <TableCell className="text-right">{result.planks || 0}</TableCell>
                        <TableCell className="text-right">{result.sit_ups || 0}</TableCell>
                        <TableCell className="text-right">{result.jumping_jacks || 0}</TableCell>
                        <TableCell className="text-right">{result.steps || 0}</TableCell>
                      </TableRow>
                    );
                  })}
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
