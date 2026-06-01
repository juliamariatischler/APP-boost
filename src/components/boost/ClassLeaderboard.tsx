import { useEffect, useState } from "react";
import { Trophy, Zap, ArrowUp, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { formatDisplayName } from "@/lib/formatName";

interface ClassRanking {
  className: string;
  school: string;
  totalFlashes: number;
  studentCount?: number;
}

interface StudentRanking {
  id: string;
  username: string;
  points: number;
}

interface Props {
  userClass: string;
  userSchool: string;
}

const CLASS_MILESTONE_PER_STUDENT = 300;
const PUBLIC_STUDENT_LIMIT = 10;
const PRESENTATION_RANKINGS_UNAVAILABLE_KEY = "boost:presentation_class_rankings_unavailable";
const PRESENTATION_CLASS_RANKINGS: ClassRanking[] = [
  { className: "3b", school: "NMS Klusemann", totalFlashes: 2840, studentCount: 30 },
  { className: "4a", school: "NMS Straden", totalFlashes: 2635, studentCount: 30 },
  { className: "3c", school: "NMS Graz St. Peter", totalFlashes: 2195, studentCount: 30 },
  { className: "2a", school: "MS Graz Smart City", totalFlashes: 1980, studentCount: 30 },
];

export const ClassLeaderboard = ({ userClass, userSchool }: Props) => {
  const [rankings, setRankings] = useState<ClassRanking[]>([]);
  const [studentRankings, setStudentRankings] = useState<StudentRanking[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [isTeacherView, setIsTeacherView] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRankings();
  }, [userClass, userSchool]);

  const loadRankings = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id || null;
      setMyUserId(currentUserId);
      let teacherAssignedIds: string[] = [];
      let isTeacher = false;

      if (currentUserId) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", currentUserId)
          .eq("role", "admin")
          .maybeSingle();
        isTeacher = !!roleData;
        setIsTeacherView(isTeacher);

        if (isTeacher) {
          const { data: assignmentRows, error: assignmentError } = await (supabase as any)
            .from("teacher_student_assignments")
            .select("student_id")
            .eq("teacher_id", currentUserId);

          if (!assignmentError && assignmentRows) {
            teacherAssignedIds = assignmentRows.map((row: { student_id: string }) => row.student_id);
          } else if (assignmentError) {
            const code = assignmentError.code || "";
            const message = String(assignmentError.message || "").toLowerCase();
            const isMissingInfra =
              code === "PGRST205" ||
              code === "PGRST202" ||
              code === "42P01" ||
              message.includes("could not find the table") ||
              message.includes("schema cache");

            if (!isMissingInfra) {
              console.error("Error loading teacher assignments:", assignmentError);
            }
          }
        }
      }

      // Aggregate points by class+school from profiles
      let presentationData: Array<{ school: string; class: string; total_flashes: number; student_count: number }> | null = null;
      let presentationError: any = null;

      if (sessionStorage.getItem(PRESENTATION_RANKINGS_UNAVAILABLE_KEY) !== "1") {
        const response = await (supabase.rpc as any)("get_class_rankings_with_quest_bonus");

        presentationData = response.data;
        presentationError = response.error;
      }

      const presentationErrorText =
        `${presentationError?.message ?? ""} ${presentationError?.details ?? ""} ${presentationError?.hint ?? ""}`.toLowerCase();
      const missingPresentationInfra =
        presentationError?.code === "PGRST202" ||
        presentationError?.code === "PGRST205" ||
        presentationError?.code === "42P01" ||
        presentationErrorText.includes("schema cache") ||
        presentationErrorText.includes("could not find the table");

      if (presentationError && !missingPresentationInfra) {
        console.error("Error loading presentation class rankings:", presentationError);
      } else if (missingPresentationInfra) {
        sessionStorage.setItem(PRESENTATION_RANKINGS_UNAVAILABLE_KEY, "1");
      }

      if (presentationData && presentationData.length > 0) {
        setRankings(
          presentationData.map((entry: { school: string; class: string; total_flashes: number; student_count: number }) => ({
            className: entry.class,
            school: entry.school,
            totalFlashes: Number(entry.total_flashes || 0),
            studentCount: Number(entry.student_count || 30),
          }))
        );
      } else {
        setRankings(PRESENTATION_CLASS_RANKINGS);
      }

      if (userClass && userSchool) {
        if (isTeacher && teacherAssignedIds.length === 0) {
          setStudentRankings([]);
          return;
        }

        let studentsQuery = supabase
          .from("profiles")
          .select("id, username, points")
          .eq("class", userClass)
          .eq("school", userSchool);

        if (isTeacher) {
          studentsQuery = studentsQuery.in("id", teacherAssignedIds);
        }

        const { data: students } = await studentsQuery
          .order("points", { ascending: false })
          .order("username", { ascending: true });

        if (students) {
          setStudentRankings(students);
        }
      }
    } catch (err) {
      console.error("Error loading rankings:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  const top5 = rankings.slice(0, 5);
  const myClassIndex = rankings.findIndex(
    (r) => r.className === userClass && r.school === userSchool
  );
  const myClass = myClassIndex >= 0 ? rankings[myClassIndex] : null;
  const myRank = myClassIndex >= 0 ? myClassIndex + 1 : null;
  const isInTop5 = myRank !== null && myRank <= 5;
  const classFlashesFromAssigned = studentRankings.reduce((sum, student) => sum + Number(student.points || 0), 0);
  const classFlashes = isTeacherView ? classFlashesFromAssigned : myClass?.totalFlashes || 0;
  const classStudentCount = myClass?.studentCount || studentRankings.length;
  const classMilestone = classStudentCount * CLASS_MILESTONE_PER_STUDENT;
  const classProgress = classMilestone > 0 ? Math.min((classFlashes / classMilestone) * 100, 100) : 0;

  const flashesToNextRank =
    myRank && myRank > 1
      ? rankings[myClassIndex - 1].totalFlashes - classFlashes + 1
      : 0;

  const publicStudentRankings = isTeacherView
    ? studentRankings
    : studentRankings.slice(0, PUBLIC_STUDENT_LIMIT);
  const myStudentIndex = studentRankings.findIndex((student) => student.id === myUserId);
  const myStudentRank = myStudentIndex >= 0 ? myStudentIndex + 1 : null;
  const isOutsidePublicTop = !isTeacherView && myStudentRank !== null && myStudentRank > PUBLIC_STUDENT_LIMIT;
  const myStudent = myStudentRank ? studentRankings[myStudentRank - 1] : null;

  return (
    <>
      {/* Class summary */}
      <Card className="p-4 bg-card shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Unsere Klasse diese Woche</span>
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary/10 px-3 py-1 rounded-full">
            <span className="font-bold text-primary">{userClass}</span>
          </div>
          <span className="text-xs text-muted-foreground">{userSchool}</span>
          {myRank && (
            <span className="text-xs font-bold text-primary ml-auto">Platz {myRank}</span>
          )}
        </div>
        <div className="flex items-end gap-2 mb-3">
          <span className="text-3xl font-black text-foreground">{classFlashes}</span>
          <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500 mb-0.5" />
          <span className="text-sm text-muted-foreground mb-0.5">gesamt</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Klassenziel</span>
            <span className="font-bold">{classMilestone} ⚡</span>
          </div>
          <Progress value={classProgress} className="h-2" />
          {classFlashes < classMilestone && (
            <p className="text-xs text-center text-muted-foreground">
              Noch <span className="font-bold text-primary">{classMilestone - classFlashes} ⚡</span> bis zum nächsten gemeinsamen Klassenziel
            </p>
          )}
          {classStudentCount > 0 ? (
            <>
              <p className="text-[11px] text-muted-foreground text-center">
                Das Klassenziel wird pro Schüler berechnet und macht den Teamfortschritt sichtbar.
              </p>
              <p className="text-[11px] text-muted-foreground text-center">
                • {CLASS_MILESTONE_PER_STUDENT} ⚡ pro Schüler ({classStudentCount} Schüler = {classMilestone} ⚡ Klassenziel)
              </p>
              {isTeacherView && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Bei Lehrkräften zählen nur zugeteilte Schüler.
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground text-center">
              Noch keine Schüler zugeteilt.
            </p>
          )}
        </div>
      </Card>

      {/* Leaderboard */}
      <Card className="p-4 bg-card shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">Top 5 Klassen diese Woche</span>
          <Trophy className="h-5 w-5 text-yellow-500" />
        </div>

        <div className="space-y-1.5">
          {top5.map((entry, i) => {
            const rank = i + 1;
            const isMe = entry.className === userClass && entry.school === userSchool;
            return (
              <div
                key={`${entry.className}-${entry.school}`}
                className={`flex items-center justify-between p-2.5 rounded-lg ${
                  isMe ? "bg-primary/10 border border-primary" : "bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      rank === 1 ? "bg-yellow-500 text-white" :
                      rank === 2 ? "bg-gray-400 text-white" :
                      rank === 3 ? "bg-amber-600 text-white" :
                      "bg-muted text-muted-foreground"
                    }`}
                  >
                    {rank}
                  </div>
                  <div>
                    <span className={`font-bold text-sm ${isMe ? "text-primary" : "text-foreground"}`}>
                      {entry.className}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1.5">{entry.school}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-sm">{entry.totalFlashes}</span>
                  <Zap className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                </div>
              </div>
            );
          })}

          {/* Own class if not in top 5 */}
          {!isInTop5 && myClass && myRank && (
            <>
              <div className="text-center text-muted-foreground text-xs py-0.5">···</div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs bg-primary/20 text-primary">
                    {myRank}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-primary">{userClass}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">{userSchool}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-sm">{classFlashes}</span>
                  <Zap className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                </div>
              </div>
            </>
          )}
        </div>

        {flashesToNextRank > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-center gap-1.5 text-xs">
            <ArrowUp className="h-3.5 w-3.5 text-primary" />
            <span>
              Noch <span className="font-bold text-primary">{flashesToNextRank} ⚡</span> bis Platz {myRank! - 1}
            </span>
          </div>
        )}
      </Card>

      <Card className="p-4 bg-card shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">Klassen-Leaderboard</span>
          <Trophy className="h-5 w-5 text-yellow-500" />
        </div>

        <div className="space-y-1.5">
          {publicStudentRankings.map((student, i) => {
            const rank = i + 1;
            const isMe = student.id === myUserId;
            return (
              <div
                key={student.id}
                className={`flex items-center justify-between p-2.5 rounded-lg ${
                  isMe ? "bg-primary/10 border border-primary" : "bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      rank === 1 ? "bg-yellow-500 text-white" :
                      rank === 2 ? "bg-gray-400 text-white" :
                      rank === 3 ? "bg-amber-600 text-white" :
                      "bg-muted text-muted-foreground"
                    }`}
                  >
                    {rank}
                  </div>
                  <span className={`font-bold text-sm ${isMe ? "text-primary" : "text-foreground"}`}>
                    {formatDisplayName(student.username)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-sm">{student.points}</span>
                  <Zap className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                </div>
              </div>
            );
          })}

          {isOutsidePublicTop && myStudent && (
            <>
              <div className="text-center text-muted-foreground text-xs py-0.5">···</div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs bg-primary/20 text-primary">
                    {myStudentRank}
                  </div>
                  <span className="font-bold text-sm text-primary">{formatDisplayName(myStudent.username)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-sm">{myStudent.points}</span>
                  <Zap className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                </div>
              </div>
            </>
          )}
        </div>

        {!isTeacherView && studentRankings.length > PUBLIC_STUDENT_LIMIT && (
          <p className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground text-center">
            Öffentlich sichtbar sind nur die Top {PUBLIC_STUDENT_LIMIT}. Plätze darunter sehen nur Lehrkräfte.
          </p>
        )}
      </Card>
    </>
  );
};
