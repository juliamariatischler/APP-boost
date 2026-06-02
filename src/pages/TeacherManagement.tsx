import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MoreHorizontal, Plus, Printer, QrCode, RefreshCcw, RotateCcw, ShieldOff, Users } from "lucide-react";
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
  const { session: codeSession, loading: codeLoading } = useCodeAuth();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [teacherName, setTeacherName] = useState("Lehrkraft");
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [newStudentName, setNewStudentName] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [activationQrDataUrl, setActivationQrDataUrl] = useState("");
  const [activationStudentName, setActivationStudentName] = useState("");
  const activationCardRef = useRef<HTMLDivElement | null>(null);
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



  const showActivationQr = async (code: string, studentName: string) => {
    const qrDataUrl = await QRCode.toDataURL(getActivationUrl(code), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 720,
    });
    setActivationCode(code);
    setActivationQrDataUrl(qrDataUrl);
    setActivationStudentName(studentName);
    // Nach kurzer Verzögerung zum neuen QR-Code scrollen
    setTimeout(() => {
      activationCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
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
      // Alten angezeigten QR-Code entfernen – er wurde durch den Export ungültig
      setActivationCode("");
      setActivationQrDataUrl("");
      setActivationStudentName("");
      await loadStudents(authMode, selectedClassId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF konnte nicht erstellt werden");
    } finally {
      setExporting(false);
    }
  };

  const allExportStudentsSelected =
    exportableStudents.length > 0 && selectedExportStudentIds.length === exportableStudents.length;

  const [studentActionsStudent, setStudentActionsStudent] = useState<ClassStudent | null>(null);

  return (
    <div className="min-h-screen bg-[#f8fbf8] pb-nav-safe">
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
      <header className="border-b border-border/40 bg-white px-4 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Verwaltung</p>
            <h1 className="text-2xl font-black leading-tight text-foreground">{teacherName}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
        {/* ── Klassen-Sidebar ─────────────────────────────────── */}
        <section className="space-y-2">
          <h2 className="px-1 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            {loading ? "Lädt…" : "Klassen"}
          </h2>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-[60px] animate-pulse rounded-[20px] bg-muted" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {classes.map((cls) => (
                <button
                  key={cls.class_id}
                  type="button"
                  onClick={() => setSelectedClassId(cls.class_id)}
                  className={`flex w-full items-center gap-3 rounded-[20px] px-4 py-3.5 text-left transition-all ${
                    cls.class_id === selectedClassId
                      ? "bg-primary/10"
                      : "border border-black/5 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:bg-primary/5"
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    cls.class_id === selectedClassId ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
                  }`}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-foreground">Klasse {cls.class_name}</p>
                    <p className="truncate text-xs font-medium text-muted-foreground">{cls.school_name}</p>
                  </div>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-black text-muted-foreground">
                    {cls.student_count}
                  </div>
                </button>
              ))}

              {classes.length === 0 && (
                <p className="px-2 text-sm text-muted-foreground">Noch keine Klasse verfügbar.</p>
              )}
            </div>
          )}

          {authMode === "supabase" && (
            <>
              <div className="my-1 border-t border-black/5" />
              <button
                type="button"
                onClick={() => navigate("/teacher-home", { state: { openCreateClass: true } })}
                className="flex w-full items-center gap-2 rounded-2xl px-2 py-2.5 text-left text-sm text-muted-foreground transition hover:text-foreground"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-white">
                  <Plus className="h-3 w-3 text-primary" />
                </div>
                <span>
                  Neue Klasse auf{" "}
                  <span className="font-black text-primary">Home</span>{" "}
                  anlegen
                </span>
              </button>
            </>
          )}
        </section>

        {/* ── Hauptbereich ────────────────────────────────────── */}
        <section className="space-y-5">

          {/* Klassen-Heading + Exportansicht */}
          <div className="flex items-end justify-between gap-3">
            <div>
              {selectedClass && (
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-black text-primary">
                    {selectedClass.class_name.toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{selectedClass.school_name}</span>
                </div>
              )}
              <h2 className="text-2xl font-black text-foreground">
                {selectedClass ? `Klasse ${selectedClass.class_name} verwalten` : "Klasse auswählen"}
              </h2>
            </div>
            {selectedClassId && (
              <Button
                type="button"
                variant="outline"
                className="shrink-0 rounded-full border-primary/30 text-primary hover:bg-primary/5"
                onClick={openExportDialog}
                disabled={exporting}
              >
                <Printer className="h-4 w-4" />
                Exportansicht
              </Button>
            )}
          </div>

          {/* Schüler:in hinzufügen */}
          <div className="space-y-2">
            <h3 className="text-sm font-black text-foreground">Schüler:in hinzufügen</h3>
            <form onSubmit={handleAddStudent} className="space-y-2">
              <Input
                value={newStudentName}
                onChange={(event) => setNewStudentName(event.target.value)}
                placeholder="Vorname Schüler:in"
                disabled={!selectedClassId}
                className="h-12 rounded-2xl border-black/8 bg-white text-base shadow-[0_2px_6px_rgba(0,0,0,0.04)]"
              />
              <Button
                type="submit"
                disabled={!selectedClassId || !newStudentName.trim()}
                className="h-12 w-full rounded-2xl text-base"
              >
                <Plus className="h-4 w-4" />
                Hinzufügen
              </Button>
            </form>
          </div>

          {/* QR-Code nach Hinzufügen / Neugenerierung */}
          {activationCode && activationQrDataUrl && (
            <Card ref={activationCardRef} className="overflow-hidden rounded-[20px] border-primary/15 bg-white p-5 shadow-[0_12px_28px_rgba(34,197,94,0.10)]">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/12">
                  <QrCode className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Aktivierung</p>
                <span className="ml-1 text-sm font-black text-foreground">— {formatDisplayName(activationStudentName)}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-[15rem_minmax(0,1fr)]">
                <div className="flex items-center justify-center rounded-[18px] border border-black/5 bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
                  <img src={activationQrDataUrl} alt="QR-Code zur Schüleraktivierung" className="h-52 w-52" />
                </div>
                <div className="min-w-0 space-y-3">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-muted-foreground">Manueller Code</p>
                    <p className="break-all rounded-2xl bg-muted px-4 py-3 font-mono text-lg font-black tracking-[0.12em] text-foreground">
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

          {/* Schüler:innen-Liste */}
          <div className="space-y-2">
            <h3 className="text-sm font-black text-foreground">Schüler:innen</h3>

            {studentsLoading ? (
              <div className="space-y-px overflow-hidden rounded-[20px] border border-black/5 bg-white">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-[58px] animate-pulse border-b border-black/5 bg-muted/30 last:border-0" />
                ))}
              </div>
            ) : students.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Für diese Klasse sind noch keine Schüler:innen angelegt.
              </p>
            ) : (
              <div className="overflow-hidden rounded-[20px] border border-black/5 bg-white shadow-[0_8px_18px_rgba(0,0,0,0.04)]">
                {students.map((student, index) => {
                  const isBusy = busyStudentId === student.student_id;
                  const isActivated = Boolean(student.activated_at || student.device_id);
                  const isDeactivated = student.active === false;

                  const nameParts = formatDisplayName(student.display_name).split(" ");
                  const initials = nameParts.length >= 2
                    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
                    : formatDisplayName(student.display_name).substring(0, 2).toUpperCase();

                  return (
                    <div
                      key={student.student_id}
                      className={`flex items-center gap-3 px-4 py-3.5 ${
                        index < students.length - 1 ? "border-b border-black/5" : ""
                      } ${isDeactivated ? "opacity-50" : ""}`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-black ${
                        isDeactivated
                          ? "bg-red-100 text-red-500"
                          : isActivated
                            ? "bg-primary/15 text-primary"
                            : "bg-primary/10 text-primary"
                      }`}>
                        {initials}
                      </div>
                      <span className="min-w-0 flex-1 truncate font-bold text-foreground">
                        {formatDisplayName(student.display_name)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setStudentActionsStudent(student)}
                        disabled={isBusy}
                        aria-label="Aktionen"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/60 disabled:opacity-50"
                      >
                        {isBusy
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <MoreHorizontal className="h-4 w-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      <TeacherBottomNav active="verwaltung" />
      </div>

      {/* ── Schüler:in Aktionen Dialog ──────────────────────── */}
      <Dialog
        open={!!studentActionsStudent}
        onOpenChange={(open) => { if (!open && !busyStudentId) setStudentActionsStudent(null); }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-[24px]">
          {studentActionsStudent && (() => {
            const student = studentActionsStudent;
            const isProfileStudent = Boolean(student.is_profile_student);
            const isActivated = Boolean(student.activated_at || student.device_id);
            const codeAvailable = Boolean(student.activation_code_created_at && !student.activation_code_used_at);
            const isBusy = busyStudentId === student.student_id;

            const nameParts = formatDisplayName(student.display_name).split(" ");
            const initials = nameParts.length >= 2
              ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
              : formatDisplayName(student.display_name).substring(0, 2).toUpperCase();

            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-black text-primary">
                      {initials}
                    </div>
                    <div>
                      <DialogTitle className="text-left">{formatDisplayName(student.display_name)}</DialogTitle>
                      <DialogDescription className="text-left">
                        {isProfileStudent
                          ? "Eigene App-Anmeldung"
                          : isActivated
                            ? "Gerät verbunden"
                            : codeAvailable
                              ? "QR-Code bereit"
                              : "Noch kein QR-Code"}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                {isProfileStudent ? (
                  <div className="rounded-2xl bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                    Schüler:in hat sich selbst registriert und nutzt eine eigene App-Anmeldung.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      className="flex w-full items-center gap-3 rounded-2xl bg-muted/40 px-4 py-3.5 text-left text-sm font-bold text-foreground transition hover:bg-muted/60 disabled:opacity-50"
                      onClick={async () => {
                        await handleGenerate(student);
                        setStudentActionsStudent(null);
                      }}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                        {codeAvailable ? <RefreshCcw className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
                      </div>
                      {codeAvailable ? "QR-Code neu generieren" : "QR-Code generieren"}
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      className="flex w-full items-center gap-3 rounded-2xl bg-muted/40 px-4 py-3.5 text-left text-sm font-bold text-foreground transition hover:bg-muted/60 disabled:opacity-50"
                      onClick={async () => {
                        await handleResetDevice(student);
                        setStudentActionsStudent(null);
                      }}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/60">
                        <RotateCcw className="h-4 w-4" />
                      </div>
                      Gerät zurücksetzen
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      className="flex w-full items-center gap-3 rounded-2xl bg-red-50 px-4 py-3.5 text-left text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      onClick={async () => {
                        await handleDeactivate(student);
                        setStudentActionsStudent(null);
                      }}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500">
                        <ShieldOff className="h-4 w-4" />
                      </div>
                      Deaktivieren
                    </button>

                    {isBusy && (
                      <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Wird verarbeitet…
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={(open) => !exporting && setExportDialogOpen(open)}>
        <DialogContent className="max-h-[85vh] overflow-hidden rounded-[24px] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>QR-Codes als PDF erstellen</DialogTitle>
            <DialogDescription>
              Wähle aus, für welche Schüler:innen neue QR-Codes erzeugt und als Zettel gedruckt werden sollen.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-bold">Hinweis:</span> Für jede ausgewählte Person wird ein <span className="font-bold">neuer QR-Code</span> erzeugt. Bereits gezeigte oder ausgedruckte Codes werden damit ungültig.
          </div>

          <div className="space-y-3 overflow-hidden">
            <label className="flex items-center gap-3 rounded-[18px] border border-black/5 bg-primary/5 px-4 py-3 shadow-sm">
              <Checkbox
                checked={allExportStudentsSelected}
                onCheckedChange={(checked) => setAllExportStudents(checked === true)}
                disabled={exporting}
              />
              <span className="font-black text-foreground">Alle auswählbaren Schüler:innen</span>
              <Badge variant="secondary" className="ml-auto rounded-full">
                {exportableStudents.length}
              </Badge>
            </label>

            <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
              {exportableStudents.map((student) => (
                <label
                  key={student.student_id}
                  className="flex items-center gap-3 rounded-[18px] border border-black/5 bg-white px-4 py-3 shadow-[0_2px_6px_rgba(0,0,0,0.04)]"
                >
                  <Checkbox
                    checked={selectedExportStudentIds.includes(student.student_id)}
                    onCheckedChange={(checked) => toggleExportStudent(student.student_id, checked === true)}
                    disabled={exporting}
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{formatDisplayName(student.display_name)}</span>
                  <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-600">offen</Badge>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setExportDialogOpen(false)} disabled={exporting}>
              Abbrechen
            </Button>
            <Button type="button" className="rounded-2xl" onClick={handleExportClass} disabled={exporting || selectedExportStudentIds.length === 0}>
              <Printer className="h-4 w-4" />
              {exporting ? "PDF wird vorbereitet..." : `PDF erstellen (${selectedExportStudentIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
