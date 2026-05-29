import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, LogOut, Plus, Printer, QrCode, RefreshCcw, RotateCcw, ShieldOff, Users } from "lucide-react";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TeacherBottomNav } from "@/components/TeacherBottomNav";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Capacitor } from "@capacitor/core";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { env } from "@/lib/env";
import { formatDisplayName } from "@/lib/formatName";
import { getCurrentAppRole } from "@/lib/roles";
import { logoutEverywhereOnDevice } from "@/lib/logout";
import {
  addStudent,
  addStudentAuth,
  deactivateStudent,
  deactivateStudentAuth,
  generateActivationCode,
  generateActivationCodeAuth,
  getClassStudents,
  getClassStudentsAuth,
  getTeacherClasses,
  getTeacherClassesAuth,
  resetStudentDevice,
  resetStudentDeviceAuth,
  type ClassStudent,
  type TeacherClass,
} from "@/services/codeAuthService";

type AuthMode = "supabase" | "code";


type ExportTicket = {
  studentId: string;
  studentName: string;
  className: string;
  schoolName: string;
  activationCode: string;
};

const getActivationUrl = (code: string) => {
  return `${env.publicAppUrl}/activate?code=${encodeURIComponent(code)}`;
};

const sanitizeFilenamePart = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "klasse";

const createActivationPdf = async (tickets: ExportTicket[]) => {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();

  for (let index = 0; index < tickets.length; index += 1) {
    const ticket = tickets[index];
    if (index > 0) pdf.addPage();

    const qrDataUrl = await QRCode.toDataURL(getActivationUrl(ticket.activationCode), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 920,
    });

    pdf.setDrawColor(222, 219, 212);
    pdf.setLineWidth(0.7);
    pdf.roundedRect(18, 18, pageWidth - 36, 260, 4, 4);

    pdf.setTextColor(97, 220, 112);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("BOOST SCHULE", pageWidth / 2, 42, { align: "center" });

    pdf.setTextColor(32, 35, 43);
    pdf.setFontSize(22);
    pdf.text("Profil aktivieren", pageWidth / 2, 62, { align: "center" });

    pdf.setFontSize(30);
    const studentName = pdf.splitTextToSize(ticket.studentName, pageWidth - 56);
    pdf.text(studentName, pageWidth / 2, 82, { align: "center" });

    pdf.setTextColor(98, 105, 119);
    pdf.setFontSize(13);
    const classLine = `Klasse ${ticket.className} · ${ticket.schoolName}`;
    pdf.text(pdf.splitTextToSize(classLine, pageWidth - 56), pageWidth / 2, 100, { align: "center" });

    pdf.addImage(qrDataUrl, "PNG", (pageWidth - 92) / 2, 116, 92, 92);

    pdf.setTextColor(98, 105, 119);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(14);
    const helpText = pdf.splitTextToSize(
      "Scanne den QR-Code mit dem Gerät, auf dem BOOST Schule genutzt werden soll. Der QR-Code ist einmalig gültig.",
      pageWidth - 60,
    );
    pdf.text(helpText, pageWidth / 2, 230, { align: "center", lineHeightFactor: 1.35 });
  }

  const firstTicket = tickets[0];
  const filename = `boost-qr-${sanitizeFilenamePart(firstTicket.className)}-${new Date().toISOString().slice(0, 10)}.pdf`;

  const blob = pdf.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });

  if (navigator.canShare?.({ files: [file] })) {
    // iOS + Android 9+: nativer Teilen-Dialog (Dateien sichern, AirDrop, …)
    await navigator.share({ files: [file], title: "BOOST Aktivierungszettel" });
  } else if (Capacitor.isNativePlatform()) {
    // Android-Fallback: PDF als Object-URL im System-Viewer öffnen
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } else {
    // Browser (Desktop): direkter Download
    pdf.save(filename);
  }
};

export default function TeacherManagement() {
  const navigate = useNavigate();
  const { session: codeSession, loading: codeLoading, signOut } = useCodeAuth();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [teacherName, setTeacherName] = useState("Lehrkraft");
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [newStudentName, setNewStudentName] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [activationQrDataUrl, setActivationQrDataUrl] = useState("");
  const [activationStudentName, setActivationStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedExportStudentIds, setSelectedExportStudentIds] = useState<string[]>([]);

  // "Neue Klasse anlegen" state (supabase auth only)
  const [createClassName, setCreateClassName] = useState("");
  const [createClassLoading, setCreateClassLoading] = useState(false);
  const [teacherOwnSchool, setTeacherOwnSchool] = useState<{ id: string; name: string } | null>(null);

  const selectedClass = useMemo(
    () => classes.find((item) => item.class_id === selectedClassId),
    [classes, selectedClassId],
  );

  const exportableStudents = useMemo(
    () =>
      students.filter((student) => {
        const isActivated = Boolean(student.activated_at || student.device_id);
        return student.active !== false && !isActivated;
      }),
    [students],
  );

  const loadClasses = useCallback(async (mode: AuthMode) => {
    setLoading(true);
    try {
      const nextClasses = mode === "code" && codeSession
        ? await getTeacherClasses(codeSession)
        : await getTeacherClassesAuth();
      setClasses(nextClasses);
      setSelectedClassId((current) => current || nextClasses[0]?.class_id || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Klassen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [codeSession]);

  const loadStudents = useCallback(async (mode: AuthMode, classId: string) => {
    if (!classId) {
      setStudents([]);
      return;
    }

    setStudentsLoading(true);
    try {
      const nextStudents = mode === "code" && codeSession
        ? await getClassStudents(codeSession, classId)
        : await getClassStudentsAuth(classId);
      setStudents(nextStudents);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Schüler:innen konnten nicht geladen werden");
    } finally {
      setStudentsLoading(false);
    }
  }, [codeSession]);

  useEffect(() => {
    const resolveTeacher = async () => {
      if (codeLoading) return;

      if (codeSession?.user_type === "teacher") {
        setAuthMode("code");
        setTeacherName(codeSession.display_name || "Lehrkraft");
        await loadClasses("code");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      const role = await getCurrentAppRole();
      if (role !== "teacher") {
        navigate("/dashboard", { replace: true });
        return;
      }

      setAuthMode("supabase");
      setTeacherName(
        String(session.user.user_metadata?.username || session.user.email?.split("@")[0] || "Lehrkraft"),
      );
      await loadClasses("supabase");
    };

    void resolveTeacher();
  }, [codeLoading, codeSession, loadClasses, navigate]);

  useEffect(() => {
    if (!authMode || !selectedClassId) return;
    void loadStudents(authMode, selectedClassId);
  }, [authMode, loadStudents, selectedClassId]);

  // Load teacher's own school for "Neue Klasse anlegen" (supabase auth only)
  useEffect(() => {
    if (authMode !== "supabase") return;
    const load = async () => {
      try {
        const { data } = await (supabase.rpc as any)("get_teacher_own_school_auth");
        const rows = Array.isArray(data) ? data : [];
        if (rows.length > 0) {
          const row = rows[0] as { school_id: string; school_name: string };
          setTeacherOwnSchool({ id: row.school_id, name: row.school_name });
        }
      } catch { /* ignore */ }
    };
    void load();
  }, [authMode]);

  // Fallback: derive own school from already-loaded classes when RPC returned nothing
  useEffect(() => {
    if (authMode !== "supabase") return;
    if (teacherOwnSchool) return;
    const first = classes.find((c) => c.school_id && c.school_name);
    if (first) {
      setTeacherOwnSchool({ id: first.school_id!, name: first.school_name });
    }
  }, [classes, authMode, teacherOwnSchool]);

  const handleCreateNewClass = async () => {
    const name = createClassName.trim();
    if (!name || !teacherOwnSchool) {
      toast.error("Bitte Klassenname eingeben.");
      return;
    }
    setCreateClassLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("create_class_and_assign_auth", {
        p_school_id:  teacherOwnSchool.id,
        p_class_name: name,
      });
      if (error) { toast.error(error.message); return; }
      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) { toast.error("Klasse konnte nicht angelegt werden."); return; }
      toast.success(`Klasse „${name}" angelegt.`);
      setCreateClassName("");
      await loadClasses("supabase");
    } catch (err: any) {
      toast.error(err?.message ?? "Fehler beim Anlegen der Klasse");
    } finally {
      setCreateClassLoading(false);
    }
  };

  const handleLogout = async () => {
    if (authMode === "code") {
      await signOut();
      navigate("/login", { replace: true });
      return;
    }

    await logoutEverywhereOnDevice();
    navigate("/auth", { replace: true });
  };

  const showActivationQr = async (code: string, studentName: string) => {
    const qrDataUrl = await QRCode.toDataURL(getActivationUrl(code), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 720,
    });
    setActivationCode(code);
    setActivationQrDataUrl(qrDataUrl);
    setActivationStudentName(studentName);
  };

  const handleAddStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authMode || !selectedClassId || !newStudentName.trim()) return;

    try {
      const result = authMode === "code" && codeSession
        ? await addStudent(codeSession, selectedClassId, newStudentName)
        : await addStudentAuth(selectedClassId, newStudentName);
      await showActivationQr(result.activation_code, formatDisplayName(newStudentName));
      setNewStudentName("");
      toast.success("Schüler:in angelegt und QR-Code erstellt.");
      await loadClasses(authMode);
      await loadStudents(authMode, selectedClassId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Schüler:in konnte nicht angelegt werden");
    }
  };

  const handleGenerate = async (student: ClassStudent) => {
    if (!authMode) return;

    setBusyStudentId(student.student_id);
    try {
      const result = authMode === "code" && codeSession
        ? await generateActivationCode(codeSession, student.student_id)
        : await generateActivationCodeAuth(student.student_id);
      await showActivationQr(result.activation_code, formatDisplayName(student.display_name));
      toast.success("Neuer QR-Code erstellt.");
      await loadStudents(authMode, selectedClassId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "QR-Code konnte nicht erstellt werden");
    } finally {
      setBusyStudentId(null);
    }
  };

  const handleResetDevice = async (student: ClassStudent) => {
    if (!authMode) return;

    setBusyStudentId(student.student_id);
    try {
      const result = authMode === "code" && codeSession
        ? await resetStudentDevice(codeSession, student.student_id)
        : await resetStudentDeviceAuth(student.student_id);
      if (result.activation_code) {
        await showActivationQr(result.activation_code, formatDisplayName(student.display_name));
        toast.success("Gerät zurückgesetzt und neuer QR-Code erstellt.");
      } else {
        toast.success("Gerät zurückgesetzt.");
      }
      await loadStudents(authMode, selectedClassId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gerät konnte nicht zurückgesetzt werden");
    } finally {
      setBusyStudentId(null);
    }
  };

  const handleDeactivate = async (student: ClassStudent) => {
    if (!authMode) return;

    setBusyStudentId(student.student_id);
    try {
      if (authMode === "code" && codeSession) {
        await deactivateStudent(codeSession, student.student_id);
      } else {
        await deactivateStudentAuth(student.student_id);
      }
      toast.success("Schüler:in deaktiviert.");
      await loadClasses(authMode);
      await loadStudents(authMode, selectedClassId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Schüler:in konnte nicht deaktiviert werden");
    } finally {
      setBusyStudentId(null);
    }
  };

  const openExportDialog = () => {
    if (!selectedClass || !selectedClassId) {
      toast.error("Bitte wähle zuerst eine Klasse aus.");
      return;
    }

    if (exportableStudents.length === 0) {
      toast.info("Für diese Klasse gibt es keine aktiven, offenen Schüler:innen zum Exportieren.");
      return;
    }

    setSelectedExportStudentIds(exportableStudents.map((student) => student.student_id));
    setExportDialogOpen(true);
  };

  const toggleExportStudent = (studentId: string, checked: boolean) => {
    setSelectedExportStudentIds((current) =>
      checked ? Array.from(new Set([...current, studentId])) : current.filter((id) => id !== studentId),
    );
  };

  const setAllExportStudents = (checked: boolean) => {
    setSelectedExportStudentIds(checked ? exportableStudents.map((student) => student.student_id) : []);
  };

  const handleExportClass = async () => {
    if (!selectedClass || !selectedClassId) {
      toast.error("Bitte wähle zuerst eine Klasse aus.");
      return;
    }

    const selectedStudents = exportableStudents.filter((student) =>
      selectedExportStudentIds.includes(student.student_id),
    );

    if (selectedStudents.length === 0) {
      toast.error("Bitte wähle mindestens eine:n Schüler:in aus.");
      return;
    }

    setExporting(true);
    try {
      const results = await Promise.all(
        selectedStudents.map(async (student) => {
          const result = authMode === "code" && codeSession
            ? await generateActivationCode(codeSession, student.student_id)
            : await generateActivationCodeAuth(student.student_id);
          return {
            studentId: student.student_id,
            studentName: formatDisplayName(student.display_name),
            className: selectedClass.class_name,
            schoolName: selectedClass.school_name,
            activationCode: result.activation_code,
          };
        }),
      );

      await createActivationPdf(results);
      toast.success(`${results.length} Aktivierungszettel als PDF erstellt.`);
      setExportDialogOpen(false);
      await loadStudents(authMode, selectedClassId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF konnte nicht erstellt werden");
    } finally {
      setExporting(false);
    }
  };

  const allExportStudentsSelected =
    exportableStudents.length > 0 && selectedExportStudentIds.length === exportableStudents.length;

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <style>{`
        .teacher-print-export {
          display: none;
        }

        @media print {
          @page {
            size: A4;
            margin: 14mm;
          }

          body {
            background: #ffffff !important;
          }

          .teacher-management-screen {
            display: none !important;
          }

          .teacher-print-export {
            display: block !important;
            color: #20232b;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }

          .teacher-print-ticket {
            min-height: 240mm;
            page-break-after: always;
            break-after: page;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .teacher-print-ticket:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .teacher-print-card {
            width: 100%;
            max-width: 155mm;
            border: 2px solid #dedbd4;
            border-radius: 14px;
            padding: 20mm 16mm;
            text-align: center;
          }

          .teacher-print-brand {
            color: #61dc70;
            font-size: 16px;
            font-weight: 900;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }

          .teacher-print-title {
            margin: 8mm 0 4mm;
            font-size: 22px;
            font-weight: 900;
          }

          .teacher-print-name {
            margin: 0;
            font-size: 34px;
            font-weight: 900;
          }

          .teacher-print-class {
            margin: 3mm 0 12mm;
            color: #626977;
            font-size: 15px;
            font-weight: 700;
          }

          .teacher-print-qr {
            width: 82mm;
            height: 82mm;
            margin: 0 auto;
            display: block;
          }

          .teacher-print-help {
            margin: 12mm auto 0;
            max-width: 112mm;
            color: #626977;
            font-size: 16px;
            line-height: 1.45;
          }
        }
      `}</style>

      <div className="teacher-management-screen">
      <header className="border-b border-border bg-background/95 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Verwaltung</p>
            <h1 className="text-2xl font-black leading-tight text-foreground">{teacherName}</h1>
          </div>
          <Button variant="outline" size="icon" onClick={handleLogout} aria-label="Abmelden">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">Klassen</h2>
            {loading && <span className="text-xs text-muted-foreground">Lädt...</span>}
          </div>

          {classes.map((cls) => (
            <button
              key={cls.class_id}
              type="button"
              onClick={() => setSelectedClassId(cls.class_id)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                cls.class_id === selectedClassId
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">Klasse {cls.class_name}</p>
                <p className="truncate text-xs text-muted-foreground">{cls.school_name}</p>
              </div>
              <Badge variant="secondary">{cls.student_count}</Badge>
            </button>
          ))}

          {!loading && classes.length === 0 && (
            <Card className="rounded-lg p-4 text-sm text-muted-foreground">
              Noch keine Klasse verfügbar.
            </Card>
          )}

          {/* Neue Klasse anlegen (supabase auth only) */}
          {authMode === "supabase" && (
            <div className="space-y-2 border-t border-border pt-3">
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                Neue Klasse anlegen
              </h3>
              {teacherOwnSchool ? (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
                  <span className="font-semibold text-foreground truncate">{teacherOwnSchool.name}</span>
                  <span className="ml-2 shrink-0 text-[10px] font-bold text-muted-foreground">fix</span>
                </div>
              ) : (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Kein Schuleintrag gefunden. Bitte übernimm zuerst eine Klasse.
                </p>
              )}
              <Input
                value={createClassName}
                onChange={(e) => setCreateClassName(e.target.value)}
                placeholder="Klassenname, z. B. 4a"
                disabled={createClassLoading || !teacherOwnSchool}
                className="h-9 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreateNewClass(); }}
              />
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={createClassLoading || !createClassName.trim() || !teacherOwnSchool}
                onClick={() => void handleCreateNewClass()}
              >
                {createClassLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Plus className="h-4 w-4" />}
                Klasse anlegen
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{selectedClass?.school_name || "Klasse"}</p>
              <h2 className="text-2xl font-black text-foreground">
                {selectedClass ? `Klasse ${selectedClass.class_name} verwalten` : "Klasse auswählen"}
              </h2>
            </div>
            <Button type="button" variant="outline" onClick={openExportDialog} disabled={exporting || !selectedClassId}>
              <Printer className="h-4 w-4" />
              Exportansicht
            </Button>
          </div>

          <Card className="rounded-lg p-4">
            <form onSubmit={handleAddStudent} className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={newStudentName}
                onChange={(event) => setNewStudentName(event.target.value)}
                placeholder="Vorname Schüler:in"
                disabled={!selectedClassId}
                className="h-11"
              />
              <Button type="submit" disabled={!selectedClassId || !newStudentName.trim()} className="h-11">
                <Plus className="h-4 w-4" />
                Hinzufügen
              </Button>
            </form>
          </Card>

          {activationCode && activationQrDataUrl && (
            <Card className="rounded-lg p-4">
              <div className="grid gap-4 md:grid-cols-[15rem_minmax(0,1fr)]">
                <div className="flex items-center justify-center rounded-lg border border-border bg-white p-3">
                  <img src={activationQrDataUrl} alt="QR-Code zur Schüleraktivierung" className="h-52 w-52" />
                </div>
                <div className="min-w-0 space-y-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Aktivierung</p>
                    <h3 className="text-xl font-black text-foreground">{formatDisplayName(activationStudentName)}</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-muted-foreground">Manueller Code</p>
                    <p className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-lg font-black tracking-[0.12em] text-foreground">
                      {activationCode}
                    </p>
                  </div>
                  <div className="space-y-1 text-sm font-medium text-muted-foreground">
                    <p>Nur der neueste QR-Code ist gültig.</p>
                    <p>Wenn Scannen nicht klappt, Code manuell eingeben.</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">Schüler:innen</h3>
            {studentsLoading && <p className="text-sm text-muted-foreground">Lade Schüler:innen...</p>}
            {!studentsLoading && students.length === 0 && (
              <Card className="rounded-lg p-4 text-sm text-muted-foreground">
                Für diese Klasse sind noch keine Schüler:innen angelegt.
              </Card>
            )}

            {students.map((student) => {
              const isBusy = busyStudentId === student.student_id;
              const isProfileStudent = Boolean(student.is_profile_student);
              const isActivated = Boolean(student.activated_at || student.device_id);
              const codeAvailable = Boolean(student.activation_code_created_at && !student.activation_code_used_at);

              if (isProfileStudent) {
                return (
                  <Card key={student.student_id} className="rounded-lg p-4 border-primary/20 bg-primary/5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-lg font-black text-foreground">{formatDisplayName(student.display_name)}</h4>
                          <Badge variant="default">aktiv</Badge>
                          <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">eigene Anmeldung</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Schüler:in hat sich selbst registriert und nutzt eine eigene App-Anmeldung.
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              }

              return (
                <Card key={student.student_id} className="rounded-lg p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-lg font-black text-foreground">{formatDisplayName(student.display_name)}</h4>
                        <Badge variant={student.active === false ? "destructive" : isActivated ? "default" : "secondary"}>
                          {student.active === false ? "deaktiviert" : isActivated ? "aktiviert" : "offen"}
                        </Badge>
                        {codeAvailable && <Badge variant="outline">QR bereit</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isActivated
                          ? "Ein Gerät ist verbunden."
                          : codeAvailable
                            ? "QR-Code ist vorbereitet."
                            : "Noch kein offener QR-Code."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => handleGenerate(student)} disabled={isBusy}>
                        {codeAvailable ? <RefreshCcw className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
                        {codeAvailable ? "Neu generieren" : "QR generieren"}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleResetDevice(student)} disabled={isBusy}>
                        <RotateCcw className="h-4 w-4" />
                        Gerät resetten
                      </Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => handleDeactivate(student)} disabled={isBusy}>
                        <ShieldOff className="h-4 w-4" />
                        Deaktivieren
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </main>

      <TeacherBottomNav active="verwaltung" />
      </div>

      <Dialog open={exportDialogOpen} onOpenChange={(open) => !exporting && setExportDialogOpen(open)}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>QR-Codes als PDF erstellen</DialogTitle>
            <DialogDescription>
              Wähle aus, für welche Schüler:innen neue QR-Codes erzeugt und als Zettel gedruckt werden sollen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 overflow-hidden">
            <label className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
              <Checkbox
                checked={allExportStudentsSelected}
                onCheckedChange={(checked) => setAllExportStudents(checked === true)}
                disabled={exporting}
              />
              <span className="font-bold text-foreground">Alle auswählbaren Schüler:innen</span>
              <Badge variant="secondary" className="ml-auto">
                {exportableStudents.length}
              </Badge>
            </label>

            <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
              {exportableStudents.map((student) => (
                <label
                  key={student.student_id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-3"
                >
                  <Checkbox
                    checked={selectedExportStudentIds.includes(student.student_id)}
                    onCheckedChange={(checked) => toggleExportStudent(student.student_id, checked === true)}
                    disabled={exporting}
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{formatDisplayName(student.display_name)}</span>
                  <Badge variant="outline">offen</Badge>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setExportDialogOpen(false)} disabled={exporting}>
              Abbrechen
            </Button>
            <Button type="button" onClick={handleExportClass} disabled={exporting || selectedExportStudentIds.length === 0}>
              <Printer className="h-4 w-4" />
              {exporting ? "PDF wird vorbereitet..." : `PDF erstellen (${selectedExportStudentIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
