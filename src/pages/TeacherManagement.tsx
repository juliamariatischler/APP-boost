import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Home, LogOut, Plus, Printer, QrCode, RefreshCcw, RotateCcw, ShieldOff, Users } from "lucide-react";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { env } from "@/lib/env";
import { getCurrentAppRole } from "@/lib/roles";
import {
  addStudentAuth,
  deactivateStudentAuth,
  generateActivationCodeAuth,
  getClassStudents,
  getClassStudentsAuth,
  getTeacherClasses,
  getTeacherClassesAuth,
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

const getQrImageUrl = (code: string, size = 220) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(getActivationUrl(code))}`;

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
  pdf.save(filename);
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
  const [activationStudentName, setActivationStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedExportStudentIds, setSelectedExportStudentIds] = useState<string[]>([]);

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

  const handleLogout = async () => {
    if (authMode === "code") {
      await signOut();
      navigate("/login", { replace: true });
      return;
    }

    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const handleAddStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authMode !== "supabase") {
      toast.error("Schülerverwaltung ist für diesen Testzugang nur mit Lehrer-Account verfügbar.");
      return;
    }
    if (!selectedClassId || !newStudentName.trim()) return;

    try {
      const result = await addStudentAuth(selectedClassId, newStudentName);
      setActivationCode(result.activation_code);
      setActivationStudentName(newStudentName.trim());
      setNewStudentName("");
      toast.success("Schüler:in angelegt und QR-Code erstellt.");
      await loadClasses(authMode);
      await loadStudents(authMode, selectedClassId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Schüler:in konnte nicht angelegt werden");
    }
  };

  const handleGenerate = async (student: ClassStudent) => {
    if (authMode !== "supabase") {
      toast.error("QR-Codes können nur mit einem Lehrer-Account erzeugt werden.");
      return;
    }

    setBusyStudentId(student.student_id);
    try {
      const result = await generateActivationCodeAuth(student.student_id);
      setActivationCode(result.activation_code);
      setActivationStudentName(student.display_name);
      toast.success("Neuer QR-Code erstellt.");
      await loadStudents(authMode, selectedClassId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "QR-Code konnte nicht erstellt werden");
    } finally {
      setBusyStudentId(null);
    }
  };

  const handleResetDevice = async (student: ClassStudent) => {
    if (authMode !== "supabase") return;

    setBusyStudentId(student.student_id);
    try {
      await resetStudentDeviceAuth(student.student_id);
      toast.success("Gerät zurückgesetzt.");
      await loadStudents(authMode, selectedClassId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gerät konnte nicht zurückgesetzt werden");
    } finally {
      setBusyStudentId(null);
    }
  };

  const handleDeactivate = async (student: ClassStudent) => {
    if (authMode !== "supabase") return;

    setBusyStudentId(student.student_id);
    try {
      await deactivateStudentAuth(student.student_id);
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
    if (authMode !== "supabase") {
      toast.error("Die Exportansicht ist nur mit einem Lehrer-Account verfügbar.");
      return;
    }
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
    if (authMode !== "supabase") {
      toast.error("Die Exportansicht ist nur mit einem Lehrer-Account verfügbar.");
      return;
    }
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
          const result = await generateActivationCodeAuth(student.student_id);
          return {
            studentId: student.student_id,
            studentName: student.display_name,
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
    <div className="min-h-screen bg-background pb-24">
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
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
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
        </section>

        <section className="space-y-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{selectedClass?.school_name || "Klasse"}</p>
              <h2 className="text-2xl font-black text-foreground">
                {selectedClass ? `Klasse ${selectedClass.class_name} verwalten` : "Klasse auswählen"}
              </h2>
            </div>
            <Button type="button" variant="outline" onClick={openExportDialog} disabled={exporting || !selectedClassId || authMode !== "supabase"}>
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
                disabled={!selectedClassId || authMode !== "supabase"}
                className="h-11"
              />
              <Button type="submit" disabled={!selectedClassId || authMode !== "supabase" || !newStudentName.trim()} className="h-11">
                <Plus className="h-4 w-4" />
                Hinzufügen
              </Button>
            </form>
            {authMode === "code" && (
              <p className="mt-3 text-sm text-muted-foreground">
                Dieser Lehrer-Code zeigt die Klasse an. Änderungen sind im registrierten Lehrer-Account verfügbar.
              </p>
            )}
          </Card>

          {activationCode && (
            <Card className="rounded-lg p-4">
              <div className="grid gap-4 md:grid-cols-[15rem_minmax(0,1fr)]">
                <div className="flex items-center justify-center rounded-lg border border-border bg-white p-3">
                  <img src={getQrImageUrl(activationCode)} alt="QR-Code zur Schüleraktivierung" className="h-52 w-52" />
                </div>
                <div className="min-w-0 space-y-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Aktivierung</p>
                    <h3 className="text-xl font-black text-foreground">{activationStudentName}</h3>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Code</p>
                    <p className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-lg font-bold tracking-[0.12em]">
                      {activationCode}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">QR-Link</p>
                    <p className="break-all rounded-lg bg-muted px-3 py-2 text-sm">{getActivationUrl(activationCode)}</p>
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
              const isActivated = Boolean(student.activated_at || student.device_id);
              const codeAvailable = Boolean(student.activation_code_created_at && !student.activation_code_used_at);

              return (
                <Card key={student.student_id} className="rounded-lg p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-lg font-black text-foreground">{student.display_name}</h4>
                        <Badge variant={student.active === false ? "destructive" : isActivated ? "default" : "secondary"}>
                          {student.active === false ? "deaktiviert" : isActivated ? "aktiviert" : "offen"}
                        </Badge>
                        {codeAvailable && <Badge variant="outline">QR bereit</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isActivated
                          ? "Ein Gerät ist verbunden."
                          : codeAvailable
                            ? "Aktivierungscode ist vorbereitet."
                            : "Noch kein offener Aktivierungscode."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => handleGenerate(student)} disabled={isBusy || authMode !== "supabase"}>
                        {codeAvailable ? <RefreshCcw className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
                        {codeAvailable ? "Neu generieren" : "QR generieren"}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleResetDevice(student)} disabled={isBusy || authMode !== "supabase"}>
                        <RotateCcw className="h-4 w-4" />
                        Gerät resetten
                      </Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => handleDeactivate(student)} disabled={isBusy || authMode !== "supabase"}>
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

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/95 shadow-lg backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-around px-2">
          <button
            onClick={() => navigate("/teacher-home")}
            className="flex h-full flex-1 flex-col items-center justify-center gap-1 text-muted-foreground"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full">
              <Home className="h-[18px] w-[18px]" />
            </div>
            <span className="text-xs">Home</span>
          </button>
          <button className="flex h-full flex-1 flex-col items-center justify-center gap-1 text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/5 bg-white shadow-[0_8px_18px_rgba(0,0,0,0.12)]">
              <ClipboardList className="h-[18px] w-[18px]" />
            </div>
            <span className="text-xs">Verwaltung</span>
          </button>
        </div>
      </nav>
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
                  <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{student.display_name}</span>
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
