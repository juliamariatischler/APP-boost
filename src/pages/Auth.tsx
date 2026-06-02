import { useState, useEffect, useRef, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import boostLogo from "@/assets/boost-logo.png";
import { Loader2, QrCode, ChevronRight, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import ForgotPassword from "@/components/ForgotPassword";
import { DEMO_MIN_POINTS } from "@/lib/demo";
import { getCurrentAppRole, routeForRole } from "@/lib/roles";
import { activateQrAsSupabaseUser, getQrActivationErrorMessage } from "@/services/codeAuthService";
import jsQR from "jsqr";

const REGISTERED_SCHOOLS_RPC_UNAVAILABLE_KEY = "boost:get_registered_schools_unavailable";
const ACTIVATION_CODE_PATTERN = /^[A-Z0-9]{20}$/;
const LOGIN_SUCCESS_TOAST_OPTIONS = { duration: 1000 };

// Input validation schemas
const loginSchema = z.object({
  email: z.string().trim().email("Ungültige E-Mail-Adresse").max(255, "E-Mail zu lang"),
  password: z.string().min(1, "Passwort erforderlich")
});

const signupSchema = z.object({
  username: z.string()
    .trim()
    .min(1, "Benutzername erforderlich")
    .max(50, "Benutzername zu lang"),
  email: z.string().trim().email("Ungültige E-Mail-Adresse").max(255, "E-Mail zu lang"),
  password: z.string()
    .min(1, "Passwort erforderlich"),
  school: z.string().trim().min(1, "Schule erforderlich").max(100, "Schulname zu lang"),
  class: z.string().trim().min(1, "Klasse erforderlich").max(20, "Klassenname zu lang"),
  age: z.string().trim().optional(),
  accountType: z.enum(["student", "teacher"]),
}).superRefine((data, ctx) => {
  if (data.accountType !== "student") {
    return;
  }

  if (!data.age || data.age.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["age"],
      message: "Alter erforderlich",
    });
    return;
  }

  const parsedAge = Number(data.age);
  if (!Number.isInteger(parsedAge) || parsedAge < 6 || parsedAge > 19) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["age"],
      message: "Bitte ein Alter zwischen 6 und 19 angeben",
    });
  }
});

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activatingRef = useRef(false);
  const schoolRequestInFlightRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [qrScannerError, setQrScannerError] = useState("");
  const [manualQrCode, setManualQrCode] = useState("");
  const [demoStudentLoading, setDemoStudentLoading] = useState(false);
  const [demoTeacherLoading, setDemoTeacherLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [registeredSchools, setRegisteredSchools] = useState<string[]>([]);
  const [schoolsWithIds, setSchoolsWithIds] = useState<{ id: string; name: string }[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [classesForSchool, setClassesForSchool] = useState<{ id: string; name: string }[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [showNewClassInput, setShowNewClassInput] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassLoading, setNewClassLoading] = useState(false);
  const [showSchoolRequest, setShowSchoolRequest] = useState(false);
  const [schoolRequestLoading, setSchoolRequestLoading] = useState(false);
  const [requestedSchool, setRequestedSchool] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loginType, setLoginType] = useState<"student" | "teacher">("student");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    username: "",
    email: "",
    password: "",
    school: "",
    class: "",
    age: "",
    accountType: "student" as "student" | "teacher",
  });

  const DEMO_SCHOOL = "BoostSchule";
  const DEMO_CLASS = "4a";
  const DEMO_STUDENT = {
    email: "demo@boost-challenge.de",
    password: "demo123456",
    username: "Demo",
  };
  const DEMO_TEACHER = {
    email: "demo-lehrkraft@boost-challenge.de",
    password: "demo123456",
    username: "Coach",
  };

  const normalizeActivationCode = (value: string) => value.replace(/\s+/g, "").trim().toUpperCase();

  const extractActivationCode = (value: string) => {
    const trimmed = value.trim();
    try {
      const parsed = new URL(trimmed);
      const code = normalizeActivationCode(parsed.searchParams.get("code") || "");
      return ACTIVATION_CODE_PATTERN.test(code) ? code : "";
    } catch {
      const directCode = normalizeActivationCode(trimmed);
      if (ACTIVATION_CODE_PATTERN.test(directCode)) return directCode;
      const embeddedCode = directCode.match(/[A-Z0-9]{20}/)?.[0] || "";
      return ACTIVATION_CODE_PATTERN.test(embeddedCode) ? embeddedCode : "";
    }
  };

  const getActivationErrorMessage = getQrActivationErrorMessage;

  const activateScannedCode = async (rawValue: string): Promise<boolean> => {
    const code = extractActivationCode(rawValue);
    if (!code) {
      toast.error("Dieser QR-Code ist nicht gültig.");
      return false;
    }

    activatingRef.current = true;
    setQrLoading(true);
    try {
      await activateQrAsSupabaseUser(code);
      toast.success("Profil erfolgreich aktiviert.");
      setQrScannerOpen(false);
      navigate("/dashboard", { replace: true });
      return true;
    } catch (error) {
      toast.error(getActivationErrorMessage(error));
      return false;
    } finally {
      activatingRef.current = false;
      setQrLoading(false);
    }
  };

  const handleManualQrSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void activateScannedCode(manualQrCode);
  };

  const isMissingInfraError = (error: any) => {
    const code = error?.code ?? "";
    const text = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();
    return (
      code === "PGRST202" ||
      code === "PGRST204" ||
      code === "PGRST205" ||
      code === "42P01" ||
      text.includes("schema cache") ||
      text.includes("could not find the function") ||
      text.includes("could not find the table") ||
      text.includes("could not find the 'age' column")
    );
  };

  const getProfilePayload = (params: {
    username: string;
    accountType: "student" | "teacher";
    points: number;
    includeAge?: boolean;
    includeRole?: boolean;
  }) => {
    const basePayload = {
      username: params.username,
      school: DEMO_SCHOOL,
      class: DEMO_CLASS,
      points: params.points,
    };

    const withRole = params.includeRole
      ? {
          ...basePayload,
          role: params.accountType,
        }
      : basePayload;

    if (!params.includeAge) {
      return withRole;
    }

    return {
      ...withRole,
      age: params.accountType === "student" ? 10 : null,
    };
  };

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        getCurrentAppRole().then((role) => {
          navigate(routeForRole(role), { replace: true });
        });
      }
    });
  }, [location.search, navigate]);

  useEffect(() => {
    const loadRegisteredSchools = async () => {
      setSchoolsLoading(true);
      const rpcUnavailable = sessionStorage.getItem(REGISTERED_SCHOOLS_RPC_UNAVAILABLE_KEY) === "1";
      const { data, error } = rpcUnavailable
        ? { data: null, error: { code: "PGRST205", message: "cached unavailable rpc" } }
        : await (supabase.rpc as any)("get_registered_schools");

      if (error) {
        if (isMissingInfraError(error)) {
          sessionStorage.setItem(REGISTERED_SCHOOLS_RPC_UNAVAILABLE_KEY, "1");
          const { data: fallbackSchools } = await supabase
            .from("profiles")
            .select("school")
            .not("school", "is", null);

          const schools = Array.isArray(fallbackSchools)
            ? fallbackSchools
                .map((row: { school?: string | null }) => row.school?.trim() || "")
                .filter((school: string) => school.length > 0)
            : [];

          setRegisteredSchools([...new Set(schools)]);
        } else {
          console.error("Error loading registered schools:", error);
          setRegisteredSchools([]);
        }
      } else {
        const schools = Array.isArray(data)
          ? data
              .map((row: { school?: string }) => row.school?.trim() || "")
              .filter((school: string) => school.length > 0)
          : [];
        setRegisteredSchools([...new Set(schools)]);
      }

      setSchoolsLoading(false);
    };

    loadRegisteredSchools();
  }, []);

  // Load schools with IDs for the ID-based dropdown
  useEffect(() => {
    const loadSchoolsWithIds = async () => {
      try {
        const { data, error } = await (supabase.rpc as any)("get_schools_list");
        if (!error && Array.isArray(data)) {
          setSchoolsWithIds(data as { id: string; name: string }[]);
        }
      } catch {
        // silently fall back — schoolsWithIds stays empty, class dropdown unused
      }
    };
    loadSchoolsWithIds();
  }, []);

  // Load classes when a school is selected
  useEffect(() => {
    if (!selectedSchoolId) {
      setClassesForSchool([]);
      setSelectedClassId("");
      setShowNewClassInput(false);
      return;
    }
    setClassesLoading(true);
    setClassesForSchool([]);
    setSelectedClassId("");
    setShowNewClassInput(false);
    const loadClasses = async () => {
      try {
        const { data, error } = await (supabase.rpc as any)("get_classes_for_school", {
          p_school_id: selectedSchoolId,
        });
        if (!error && Array.isArray(data)) {
          setClassesForSchool(data as { id: string; name: string }[]);
        }
      } catch {
        // ignore
      } finally {
        setClassesLoading(false);
      }
    };
    loadClasses();
  }, [selectedSchoolId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const demo = params.get("demo");
    const name = params.get("name")?.trim();
    if (demo !== "student") return;

    handleNamedDemoStudentLogin(name || "Demo");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    if (!qrScannerOpen) return;

    let cancelled = false;
    let animationFrame = 0;
    let stream: MediaStream | null = null;

    const stopStream = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const startScanner = async () => {
      setQrScannerError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        setQrScannerError("Diese Kamera-Funktion wird auf diesem Gerät nicht unterstützt. Bitte nutze ein Gerät mit Kamera oder gib den Code manuell ein.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          stopStream();
          return;
        }

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const BarcodeDetectorCtor = (window as any).BarcodeDetector;
        const detector = BarcodeDetectorCtor ? new BarcodeDetectorCtor({ formats: ["qr_code"] }) : null;

        const scan = async () => {
          if (cancelled || activatingRef.current) return;

          try {
            let rawValue = "";
            if (detector) {
              const results = await detector.detect(video);
              rawValue = String(results?.[0]?.rawValue || "");
            }

            if (!rawValue) {
              const canvas = scannerCanvasRef.current;
              const context = canvas?.getContext("2d", { willReadFrequently: true });
              const width = video.videoWidth;
              const height = video.videoHeight;

              if (canvas && context && width > 0 && height > 0) {
                canvas.width = width;
                canvas.height = height;
                context.drawImage(video, 0, 0, width, height);
                const imageData = context.getImageData(0, 0, width, height);
                rawValue = jsQR(imageData.data, width, height)?.data || "";
              }
            }

            if (rawValue) {
              const success = await activateScannedCode(rawValue);
              if (success) {
                cancelled = true;
                stopStream();
                return;
              }
              // Activation failed — wait 3s before scanning again to prevent repeat errors
              await new Promise<void>((resolve) => setTimeout(resolve, 3000));
            }
          } catch {
            setQrScannerError("Der QR-Code konnte nicht gelesen werden. Richte die Kamera direkt auf den Code oder gib den Code manuell ein.");
          }

          if (!cancelled) {
            animationFrame = window.requestAnimationFrame(scan);
          }
        };

        animationFrame = window.requestAnimationFrame(scan);
      } catch {
        setQrScannerError("Bitte erlaube den Kamerazugriff, damit du deinen BOOST QR-Code scannen kannst.");
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopStream();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrScannerOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validatedData = loginSchema.parse(loginData);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) {
        // Handle specific auth errors
        if (error.message.includes("Invalid login credentials")) {
          toast.error("E-Mail oder Passwort falsch");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Bitte bestätige deine E-Mail-Adresse");
        } else {
          toast.error("Login fehlgeschlagen: " + error.message);
        }
        return;
      }

      if (data.session) {
        toast.success("Erfolgreich angemeldet!", LOGIN_SUCCESS_TOAST_OPTIONS);
        const role = await getCurrentAppRole();
        navigate(routeForRole(role), { replace: true });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error("Eingabefehler: " + error.errors[0].message);
      } else if (error.name === "TypeError" && error.message.includes("Failed to fetch")) {
        toast.error("Netzwerkfehler. Bitte überprüfe deine Internetverbindung und versuche es erneut.");
      } else {
        toast.error("Ein Fehler ist aufgetreten. Bitte versuche es später erneut.");
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

      // Students must have a class when a school with ID was selected
      if (validatedData.accountType === "student" && selectedSchoolId && !selectedClassId) {
        toast.error("Bitte wähle eine Klasse aus oder füge deine Klasse hinzu.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          data: {
            username: validatedData.username,
            school: validatedData.school,
            class: validatedData.class,
            age: validatedData.accountType === "student" ? Number(validatedData.age) : null,
            account_type: validatedData.accountType,
            ...(selectedSchoolId ? { school_id: selectedSchoolId } : {}),
            ...(selectedClassId  ? { class_id:  selectedClassId  } : {}),
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        // Handle specific auth errors
        if (error.message.includes("User already registered")) {
          toast.error("Ein Konto mit dieser E-Mail existiert bereits. Bitte melde dich an.");
        } else if (error.message.includes("Database error saving new user")) {
          toast.error("Registrierung fehlgeschlagen: Benutzername oder Profildaten sind ungültig.", {
            description: "Bitte versuche einen anderen Benutzernamen (z. B. mit Zahl)."
          });
        } else if (error.message.includes("Password should be at least")) {
          toast.error("Das Passwort muss mindestens 6 Zeichen haben");
        } else {
          toast.error("Registrierung fehlgeschlagen: " + error.message);
        }
        return;
      }

      if (data.session) {
        toast.success("Erfolgreich registriert! Du wirst weitergeleitet...", LOGIN_SUCCESS_TOAST_OPTIONS);
        // Brief pause so the DB trigger that creates the profile row can complete
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const role = await getCurrentAppRole();
        navigate(routeForRole(role), { replace: true });
      } else if (data.user) {
        // User created but needs email confirmation
        toast.success("Registrierung erfolgreich! Bitte überprüfe dein E-Mail-Postfach.");
        // Auto-confirm is enabled, so this shouldn't happen, but handle it gracefully
        setTimeout(() => navigate(routeForRole(validatedData.accountType), { replace: true }), 2000);
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error("Eingabefehler: " + error.errors[0].message);
      } else if (error.name === "TypeError" && error.message.includes("Failed to fetch")) {
        toast.error("Netzwerkfehler. Bitte überprüfe deine Internetverbindung und versuche es erneut.");
      } else {
        toast.error("Ein Fehler ist aufgetreten. Bitte versuche es später erneut.");
      }
    } finally {
      setLoading(false);
    }
  };

  const ensureDemoAccount = async (params: {
    email: string;
    password: string;
    username: string;
    accountType: "student" | "teacher";
  }) => {
    const signInResult = await supabase.auth.signInWithPassword({
      email: params.email,
      password: params.password,
    });

    if (!signInResult.error && signInResult.data.user) {
      const { data: existingProfile } = await (supabase as any)
        .from("profiles")
        .select("points")
        .eq("id", signInResult.data.user.id)
        .maybeSingle();

      let { error: profileUpdateError } = await (supabase as any)
        .from("profiles")
        .update(
          getProfilePayload({
            username: params.username,
            accountType: params.accountType,
            points: Math.max(Number(existingProfile?.points || 0), DEMO_MIN_POINTS),
            includeAge: true,
            includeRole: true,
          })
        )
        .eq("id", signInResult.data.user.id);

      if (profileUpdateError && isMissingInfraError(profileUpdateError)) {
        const retry = await (supabase as any)
          .from("profiles")
          .update(
            getProfilePayload({
              username: params.username,
              accountType: params.accountType,
              points: Math.max(Number(existingProfile?.points || 0), DEMO_MIN_POINTS),
              includeAge: false,
              includeRole: false,
            })
          )
          .eq("id", signInResult.data.user.id);

        profileUpdateError = retry.error;
      }

      if (profileUpdateError) {
        throw profileUpdateError;
      }

      await supabase.auth.updateUser({ data: { username: params.username } });

      return { user: signInResult.data.user, created: false };
    }

    const signUpResult = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          username: params.username,
          school: DEMO_SCHOOL,
          class: DEMO_CLASS,
          age: params.accountType === "student" ? 10 : null,
          account_type: params.accountType,
        },
      },
    });

    if (signUpResult.error) {
      throw signUpResult.error;
    }

    if (!signUpResult.data.user) {
      throw new Error("Demo-Konto konnte nicht erstellt werden.");
    }

    if (!signUpResult.data.session) {
      const postSignupSignIn = await supabase.auth.signInWithPassword({
        email: params.email,
        password: params.password,
      });

      if (postSignupSignIn.error || !postSignupSignIn.data.user) {
        throw postSignupSignIn.error ?? new Error("Demo-Konto konnte nicht angemeldet werden.");
      }
    }

    let { error: profileUpdateError } = await (supabase as any)
      .from("profiles")
      .update(
        getProfilePayload({
          username: params.username,
          accountType: params.accountType,
          points: DEMO_MIN_POINTS,
          includeAge: true,
          includeRole: true,
        })
      )
      .eq("id", signUpResult.data.user.id);

    if (profileUpdateError && isMissingInfraError(profileUpdateError)) {
      const retry = await (supabase as any)
        .from("profiles")
        .update(
          getProfilePayload({
            username: params.username,
            accountType: params.accountType,
            points: DEMO_MIN_POINTS,
            includeAge: false,
            includeRole: false,
          })
        )
        .eq("id", signUpResult.data.user.id);

      profileUpdateError = retry.error;
    }

    if (profileUpdateError) {
      throw profileUpdateError;
    }

    return { user: signUpResult.data.user, created: true };
  };

  const handleDemoStudentLogin = async () => {
    setDemoStudentLoading(true);
    try {
      const result = await ensureDemoAccount({
        ...DEMO_STUDENT,
        accountType: "student",
      });

      toast.success(result.created ? "Demo-Schülerkonto erstellt!" : "Demo-Login erfolgreich!", LOGIN_SUCCESS_TOAST_OPTIONS);
      navigate("/dashboard");
    } catch (error: any) {
      toast.error("Demo-Login fehlgeschlagen: " + (error?.message ?? "Unbekannter Fehler"));
    } finally {
      setDemoStudentLoading(false);
    }
  };

  const handleNamedDemoStudentLogin = async (username: string) => {
    setDemoStudentLoading(true);
    try {
      const result = await ensureDemoAccount({
        ...DEMO_STUDENT,
        username,
        accountType: "student",
      });

      toast.success(result.created ? "Demo-Schülerkonto erstellt!" : "Demo-Login erfolgreich!", LOGIN_SUCCESS_TOAST_OPTIONS);
      navigate("/dashboard");
    } catch (error: any) {
      toast.error("Demo-Login fehlgeschlagen: " + (error?.message ?? "Unbekannter Fehler"));
    } finally {
      setDemoStudentLoading(false);
    }
  };

  const isAssignmentInfraMissing = (error: any) => {
    const code = error?.code ?? "";
    const message = String(error?.message ?? "").toLowerCase();
    const details = String(error?.details ?? "").toLowerCase();
    const hint = String(error?.hint ?? "").toLowerCase();
    const payload = JSON.stringify(error ?? {}).toLowerCase();
    const text = `${message} ${details} ${hint} ${payload}`;
    return (
      code === "PGRST202" ||
      code === "PGRST205" ||
      code === "42P01" ||
      text.includes("schema cache") ||
      text.includes("could not find the table") ||
      text.includes("could not find the function") ||
      (text.includes("relation") && text.includes("does not exist")) ||
      text.includes("is_demo_user") ||
      text.includes("is_demo_profile") ||
      text.includes("teacher_student_assignments")
    );
  };

  const handleDemoTeacherLogin = async () => {
    setDemoTeacherLoading(true);
    try {
      const studentResult = await ensureDemoAccount({
        ...DEMO_STUDENT,
        accountType: "student",
      });

      await supabase.auth.signOut();

      const teacherResult = await ensureDemoAccount({
        ...DEMO_TEACHER,
        accountType: "teacher",
      });

      const teacherId = teacherResult.user.id;
      const studentId = studentResult.user.id;
      let assignError: any = null;
      let assignmentSucceeded = false;
      try {
        const rpcResult = await (supabase.rpc as any)("assign_students_to_teacher_by_class", {
          p_teacher_id: teacherId,
          p_school: DEMO_SCHOOL,
          p_class: DEMO_CLASS,
        });
        assignError = rpcResult?.error ?? null;
        if (!assignError) {
          assignmentSucceeded = true;
        }
      } catch (rpcThrownError: any) {
        assignError = rpcThrownError;
      }

      if (assignError && !isAssignmentInfraMissing(assignError)) {
        throw assignError;
      }

      // Fallback: explicit student→teacher mapping — only needed if class-assignment didn't work.
      if (!assignmentSucceeded) {
        try {
          const { error: directAssignError } = await (supabase.rpc as any)("admin_assign_student", {
            p_student_id: studentId,
          });

          if (!directAssignError) {
            assignmentSucceeded = true;
          } else if (!isAssignmentInfraMissing(directAssignError)) {
            throw directAssignError;
          }
        } catch (directAssignThrown: any) {
          if (!isAssignmentInfraMissing(directAssignThrown)) {
            throw directAssignThrown;
          }
        }
      }

      if (!assignmentSucceeded) {
        toast.success("Demo-Lehrkraft-Login erfolgreich! Zuordnung aktuell nicht möglich (DB-Migration fehlt).", LOGIN_SUCCESS_TOAST_OPTIONS);
      } else {
        toast.success("Demo-Lehrkraft-Login erfolgreich! Demoschüler ist der Demo-Lehrkraft zugeordnet.", LOGIN_SUCCESS_TOAST_OPTIONS);
      }
      navigate("/teacher-home", { replace: true });
    } catch (error: any) {
      if (isAssignmentInfraMissing(error)) {
        toast.success("Demo-Lehrkraft-Login erfolgreich! Zuordnung wird ohne Assignment-Tabelle übersprungen.", LOGIN_SUCCESS_TOAST_OPTIONS);
        navigate("/teacher-home", { replace: true });
        return;
      }
      toast.error("Demo-Lehrkraft-Login fehlgeschlagen: " + (error?.message ?? "Unbekannter Fehler"));
    } finally {
      setDemoTeacherLoading(false);
    }
  };

  const handleSchoolRequest = async () => {
    // Guard: prevent multiple simultaneous submissions (e.g. rapid double-tap on Android)
    if (schoolRequestInFlightRef.current) return;

    const schoolName = requestedSchool.trim();
    if (schoolName.length < 2) {
      toast.error("Bitte gib einen gültigen Schulnamen ein.");
      return;
    }

    schoolRequestInFlightRef.current = true;
    setSchoolRequestLoading(true);

    try {
      const { error } = await (supabase.rpc as any)("submit_school_registration_request", {
        p_requested_school: schoolName,
        p_requester_email: signupData.email?.trim() || null,
        p_requester_name: signupData.username?.trim() || null,
        p_request_note: `Anfrage aus Registrierung (${signupData.accountType})`,
      });

      if (error && !isMissingInfraError(error)) {
        // Real API error — show it and do not update local state
        toast.error(`Schule konnte nicht gespeichert werden: ${error.message}`);
        return;
      }

      // Update state only after the API call has resolved (or gracefully failed due to missing infra)
      setRegisteredSchools((prev) =>
        prev.includes(schoolName)
          ? prev
          : [...prev, schoolName].sort((a, b) => a.localeCompare(b))
      );
      setSignupData((prev) => ({ ...prev, school: schoolName }));
      setRequestedSchool("");
      setShowSchoolRequest(false);

      toast.success(
        error
          ? "Schule übernommen. Die Anfrage wird manuell geprüft."
          : "Schule hinzugefügt und ausgewählt."
      );
    } catch (err: any) {
      toast.error(`Fehler beim Hinzufügen der Schule: ${err?.message ?? "Unbekannter Fehler"}`);
    } finally {
      // Always release the lock and clear loading, even on network errors
      schoolRequestInFlightRef.current = false;
      setSchoolRequestLoading(false);
    }
  };

  const handleAddClass = async () => {
    const name = newClassName.trim().replace(/\s+/g, "").toUpperCase();
    if (!name) return;
    setNewClassLoading(true);
    try {
      if (selectedSchoolId) {
        // ID-based mode: persist to DB
        const { data, error } = await (supabase.rpc as any)("add_class_to_school", {
          p_school_id: selectedSchoolId,
          p_class_name: name,
        });
        if (error) {
          toast.error("Klasse konnte nicht angelegt werden: " + error.message);
          return;
        }
        const rows = Array.isArray(data) ? data : [];
        if (rows.length > 0) {
          const added = rows[0] as { id: string; name: string };
          setClassesForSchool((prev) => {
            const exists = prev.some((c) => c.id === added.id);
            return exists ? prev : [...prev, added].sort((a, b) => a.name.localeCompare(b.name));
          });
          setSelectedClassId(added.id);
          setSignupData((prev) => ({ ...prev, class: added.name }));
        }
      } else {
        // Fallback mode: set class name as free text
        setSignupData((prev) => ({ ...prev, class: name }));
      }
      setNewClassName("");
      setShowNewClassInput(false);
      toast.success(`Klasse „${name}" ausgewählt.`);
    } catch (err: any) {
      toast.error("Fehler: " + (err?.message ?? "Unbekannt"));
    } finally {
      setNewClassLoading(false);
    }
  };

  return (
    <div className="relative h-screen overflow-hidden flex flex-col" style={{ background: "linear-gradient(180deg, #cce8f8 0%, #ddf0fa 40%, #eef8f0 75%, #d4f0dc 100%)" }}>

      {/* Clouds */}
      <div className="absolute top-4 right-6 flex flex-col gap-1 select-none pointer-events-none">
        <div className="w-20 h-7 rounded-full bg-white opacity-90" style={{ filter: "blur(2px)" }} />
        <div className="w-12 h-5 rounded-full bg-white opacity-80 ml-3" style={{ filter: "blur(2px)" }} />
      </div>
      <div className="absolute top-10 left-1 flex flex-col gap-1 select-none pointer-events-none">
        <div className="w-14 h-6 rounded-full bg-white opacity-70" style={{ filter: "blur(2px)" }} />
        <div className="w-8 h-4 rounded-full bg-white opacity-60 ml-2" style={{ filter: "blur(2px)" }} />
      </div>

      {/* Stars */}
      <div className="absolute top-5 right-14 text-yellow-400 text-2xl select-none pointer-events-none drop-shadow">⭐</div>
      <div className="absolute top-16 left-10 text-yellow-300 text-base select-none pointer-events-none">✦</div>
      <div className="absolute top-8 left-28 text-yellow-400 text-sm select-none pointer-events-none">✦</div>

      {/* Hero area */}
      <div className="relative flex items-center gap-4 px-5 pt-7 pb-4 flex-shrink-0">
        <img
          src={boostLogo}
          alt="BOOST Maskottchen"
          className="w-28 h-28 object-contain flex-shrink-0 drop-shadow-lg"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black leading-tight text-gray-800">
            Hi! Schön, dass<br />
            <span style={{ color: "#22c55e" }}>du da bist!</span>
          </h1>
          <p className="mt-1 text-sm text-gray-600 leading-snug">
            Scanne deinen QR-Code und starte dein Abenteuer mit{" "}
            <span className="font-bold" style={{ color: "#16a34a" }}>BOOST</span>.
          </p>
        </div>
      </div>

      {/* White card */}
      {activeTab === "login" ? (
        /* ── LOGIN VIEW ── */
        <div className="bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-6 flex-1 flex flex-col overflow-y-auto overflow-x-hidden gap-5">

          {/* TOP: QR + Rollen-Karten */}
          <div>
            <button
              type="button"
              disabled={qrLoading}
              onClick={() => { setQrScannerError(""); setManualQrCode(""); setQrScannerOpen(true); }}
              className="w-full flex items-center gap-3 rounded-2xl text-white mb-4 transition active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", padding: "13px 18px" }}
            >
              <div className="rounded-xl p-2.5 flex-shrink-0" style={{ background: "rgba(0,0,0,0.15)" }}>
                {qrLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <QrCode className="w-6 h-6" />}
              </div>
              <div className="flex-1 text-left">
                <div className="font-black text-xl leading-tight">QR-Code scannen</div>
                <div className="text-sm opacity-80">Los geht's!</div>
              </div>
              <div className="rounded-full bg-white flex items-center justify-center w-9 h-9 flex-shrink-0" style={{ color: "#16a34a" }}>
                <ChevronRight className="w-5 h-5" />
              </div>
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-bold tracking-widest text-gray-400 whitespace-nowrap">⭐ SO GEHT'S WEITER ⭐</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                type="button"
                className="rounded-2xl px-3 py-3 text-left transition active:scale-[0.97] flex items-center gap-2"
                style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0" }}
                onClick={() => { setSignupData({ ...signupData, accountType: "student" }); setActiveTab("signup"); }}
              >
                <span className="text-2xl flex-shrink-0">🎒</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">Ich bin</div>
                  <div className="font-black text-sm whitespace-nowrap" style={{ color: "#16a34a" }}>Schüler:in</div>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#22c55e" }} />
              </button>
              <button
                type="button"
                className="rounded-2xl px-3 py-3 text-left transition active:scale-[0.97] flex items-center gap-2"
                style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe" }}
                onClick={() => { setSignupData({ ...signupData, accountType: "teacher" }); setActiveTab("signup"); }}
              >
                <span className="text-2xl flex-shrink-0">📚</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">Ich bin</div>
                  <div className="font-black text-sm whitespace-nowrap" style={{ color: "#2563eb" }}>Lehrer:in</div>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#3b82f6" }} />
              </button>
            </div>

            <button
              type="button"
              className="w-full text-center text-sm font-bold py-1"
              style={{ color: "#16a34a" }}
              onClick={() => setActiveTab("signup")}
            >
              Neu hier? Jetzt registrieren →
            </button>
          </div>

          {/* MITTE: Login-Formular */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-bold tracking-widest text-gray-400 whitespace-nowrap">🔒 ANMELDEN</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {showForgotPassword ? (
              <ForgotPassword onBack={() => setShowForgotPassword(false)} />
            ) : (
              <form onSubmit={handleLogin} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input type="email" required value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    placeholder="Deine E-Mail-Adresse"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-12 pr-4 py-3.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-inset focus:ring-green-100"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input type={showPassword ? "text" : "password"} required value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    placeholder="Dein Passwort"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-12 pr-12 py-3.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-inset focus:ring-green-100"
                  />
                  <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="flex items-center justify-between px-1">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded accent-green-500" />
                    Angemeldet bleiben
                  </label>
                  <button type="button" className="text-sm font-semibold" style={{ color: "#16a34a" }} onClick={() => setShowForgotPassword(true)}>
                    Passwort vergessen?
                  </button>
                </div>
                <button type="submit" disabled={loading || demoStudentLoading || demoTeacherLoading}
                  className="w-full flex items-center gap-3 rounded-2xl text-white transition active:scale-[0.98] disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", padding: "13px 18px" }}
                >
                  <div className="rounded-xl p-2 flex-shrink-0 text-xl leading-none" style={{ background: "rgba(0,0,0,0.15)" }}>
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>🚀</span>}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-black text-xl leading-tight">Einloggen</div>
                    <div className="text-sm opacity-80">Weiter geht's!</div>
                  </div>
                  <div className="rounded-full bg-white flex items-center justify-center w-9 h-9 flex-shrink-0" style={{ color: "#16a34a" }}>
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </button>
              </form>
            )}
          </div>

          {/* UNTEN: Demo + Footer */}
          <div className="space-y-3 pb-2">
            <button
              type="button"
              onClick={handleDemoStudentLogin}
              disabled={demoStudentLoading || demoTeacherLoading}
              className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 transition active:scale-[0.98] disabled:opacity-60"
            >
              <span className="text-2xl flex-shrink-0">🎮</span>
              <div className="flex-1 text-left">
                <div className="text-sm font-black text-gray-700">Demo ausprobieren</div>
                <div className="text-xs text-gray-400">Ohne Registrierung testen</div>
              </div>
              {demoStudentLoading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>
            <p className="text-center text-xs text-gray-400">Sammle Punkte, meistere Challenges und bewege dich mit deiner Klasse! 🏆</p>
          </div>

        </div>
      ) : (
        /* ── SIGNUP VIEW: scrollbar ── */
        <div className="bg-white rounded-t-3xl shadow-2xl flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-5 pt-5 pb-8">

            {/* Zurück-Button */}
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 mb-4"
              onClick={() => setActiveTab("login")}
            >
              <ChevronRight className="w-4 h-4 rotate-180" /> Zurück zum Login
            </button>

            {signupData.accountType === "teacher" && (
              <button
                type="button"
                onClick={handleDemoTeacherLogin}
                disabled={demoStudentLoading || demoTeacherLoading}
                className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-blue-200 bg-blue-50 px-4 py-3 mb-4 transition active:scale-[0.98] disabled:opacity-60"
              >
                <span className="text-2xl flex-shrink-0">📚</span>
                <div className="flex-1 text-left">
                  <div className="text-sm font-black text-blue-700">Demo Lehrkraft ausprobieren</div>
                  <div className="text-xs text-blue-400">Ohne Registrierung testen</div>
                </div>
                {demoTeacherLoading ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <ChevronRight className="w-4 h-4 text-blue-400" />}
              </button>
            )}

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-bold tracking-widest text-gray-400 whitespace-nowrap">🎉 REGISTRIEREN</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <form onSubmit={handleSignup} className="space-y-3">
              <div className="flex gap-2">
                <button type="button" className="flex-1 rounded-xl py-2.5 text-sm font-bold border-2 transition"
                  style={signupData.accountType === "student" ? { background: "#dcfce7", borderColor: "#22c55e", color: "#15803d" } : { background: "#f9fafb", borderColor: "#e5e7eb", color: "#6b7280" }}
                  onClick={() => { setSignupData({ ...signupData, accountType: "student", class: "" }); setSelectedClassId(""); }}>
                  🎒 Schüler:in
                </button>
                <button type="button" className="flex-1 rounded-xl py-2.5 text-sm font-bold border-2 transition"
                  style={signupData.accountType === "teacher" ? { background: "#dbeafe", borderColor: "#3b82f6", color: "#1d4ed8" } : { background: "#f9fafb", borderColor: "#e5e7eb", color: "#6b7280" }}
                  onClick={() => { setSignupData({ ...signupData, accountType: "teacher", class: "" }); setSelectedClassId(""); }}>
                  📚 Lehrkraft
                </button>
              </div>

              <input type="text" required value={signupData.username}
                onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                placeholder="Benutzername (z.B. Max123)"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-inset focus:ring-green-100"
              />
              <input type="email" required value={signupData.email}
                onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                placeholder="E-Mail-Adresse"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-inset focus:ring-green-100"
              />
              <div className="relative">
                <input type={showPassword ? "text" : "password"} required minLength={6} value={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  placeholder="Passwort (min. 6 Zeichen)"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 pr-12 py-3.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-inset focus:ring-green-100"
                />
                <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {signupData.password.length > 0 && (
                <p className={`text-xs px-1 ${signupData.password.length < 6 ? "text-red-500" : signupData.password.length >= 10 ? "text-green-600" : "text-amber-600"}`}>
                  {signupData.password.length < 6 ? `Noch ${6 - signupData.password.length} Zeichen` : signupData.password.length >= 10 ? "Starkes Passwort ✓" : "Passwort ausreichend ✓"}
                </p>
              )}

              {/* School dropdown — ID-based when schools table is populated, fallback otherwise */}
              {schoolsWithIds.length > 0 ? (
                <select
                  required
                  value={selectedSchoolId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const found = schoolsWithIds.find((s) => s.id === id);
                    setSelectedSchoolId(id);
                    setSignupData((prev) => ({ ...prev, school: found?.name ?? "" }));
                  }}
                  disabled={schoolsLoading}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none focus:border-green-400"
                >
                  <option value="">{schoolsLoading ? "Schulen werden geladen…" : "Schule auswählen"}</option>
                  {schoolsWithIds.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <select
                  required
                  value={signupData.school}
                  onChange={(e) => setSignupData({ ...signupData, school: e.target.value })}
                  disabled={schoolsLoading}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none focus:border-green-400"
                >
                  <option value="">{schoolsLoading ? "Schulen werden geladen…" : registeredSchools.length > 0 ? "Schule auswählen" : "Noch keine Schule registriert"}</option>
                  {registeredSchools.map((school) => <option key={school} value={school}>{school}</option>)}
                </select>
              )}
              <button type="button" className="text-sm font-semibold px-1" style={{ color: "#16a34a" }} onClick={() => setShowSchoolRequest((prev) => !prev)}>
                Schule nicht dabei? Neu hinzufügen
              </button>
              {showSchoolRequest && (
                <div className="space-y-2 rounded-2xl border border-gray-200 p-3 bg-gray-50">
                  <Input value={requestedSchool} onChange={(e) => setRequestedSchool(e.target.value)} placeholder="Name deiner Schule" className="rounded-xl" />
                  <Button type="button" onClick={handleSchoolRequest} disabled={schoolRequestLoading} className="w-full rounded-xl">
                    {schoolRequestLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Schule hinzufügen
                  </Button>
                </div>
              )}

              {/* Class field */}
              {signupData.accountType === "student" ? (
                <div className="space-y-2">
                  {/* Dropdown: shown when school has a DB-ID, disabled until school is selected */}
                  {schoolsWithIds.length > 0 ? (
                    <select
                      required={!showNewClassInput}
                      value={selectedClassId}
                      onChange={(e) => {
                        const id = e.target.value;
                        const found = classesForSchool.find((c) => c.id === id);
                        setSelectedClassId(id);
                        setSignupData((prev) => ({ ...prev, class: found?.name ?? "" }));
                        setShowNewClassInput(false);
                      }}
                      disabled={!selectedSchoolId || classesLoading}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none focus:border-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {classesLoading
                          ? "Klassen werden geladen…"
                          : !selectedSchoolId
                            ? "Bitte zuerst Schule auswählen"
                            : classesForSchool.length > 0
                              ? "Klasse auswählen"
                              : "Noch keine Klasse vorhanden"}
                      </option>
                      {classesForSchool.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    /* Fallback: free-text class input (no school IDs available yet) */
                    <input
                      type="text"
                      required={!showNewClassInput}
                      value={signupData.class}
                      onChange={(e) => setSignupData({ ...signupData, class: e.target.value.replace(/\s+/g, "").toUpperCase() })}
                      placeholder="Klasse (z.B. 5a)"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-inset focus:ring-green-100"
                    />
                  )}

                  {/* "Klasse nicht dabei?" — same pattern as the school field, always visible */}
                  <button
                    type="button"
                    className="text-sm font-semibold px-1"
                    style={{ color: "#16a34a" }}
                    onClick={() => setShowNewClassInput((prev) => !prev)}
                  >
                    Klasse nicht dabei? Neu hinzufügen
                  </button>
                  {showNewClassInput && (
                    <div className="space-y-2 rounded-2xl border border-gray-200 p-3 bg-gray-50">
                      <Input
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value.replace(/\s+/g, "").toUpperCase())}
                        placeholder="Klassenname (z.B. 4a)"
                        className="rounded-xl"
                      />
                      <Button
                        type="button"
                        onClick={handleAddClass}
                        disabled={newClassLoading || !newClassName.trim()}
                        className="w-full rounded-xl"
                      >
                        {newClassLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Klasse hinzufügen
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                /* Teacher: plain text input */
                <input
                  type="text"
                  required
                  value={signupData.class}
                  onChange={(e) => setSignupData({ ...signupData, class: e.target.value.replace(/\s+/g, "").toUpperCase() })}
                  placeholder="Klasse"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-inset focus:ring-green-100"
                />
              )}
              {signupData.accountType === "student" && (
                <input type="number" min={6} max={19} required value={signupData.age}
                  onChange={(e) => setSignupData({ ...signupData, age: e.target.value })}
                  placeholder="Alter (z.B. 10)"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-inset focus:ring-green-100"
                />
              )}

              <button type="submit" disabled={loading || schoolRequestLoading}
                className="w-full flex items-center gap-3 rounded-2xl text-white transition active:scale-[0.98] disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", padding: "13px 18px" }}
              >
                <div className="rounded-xl p-2 flex-shrink-0 text-xl leading-none" style={{ background: "rgba(0,0,0,0.15)" }}>
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>🎉</span>}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-black text-xl leading-tight">Registrieren</div>
                  <div className="text-sm opacity-80">Los geht's!</div>
                </div>
                <div className="rounded-full bg-white flex items-center justify-center w-9 h-9 flex-shrink-0" style={{ color: "#16a34a" }}>
                  <ChevronRight className="w-5 h-5" />
                </div>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* QR Scanner Dialog */}
      <Dialog open={qrScannerOpen} onOpenChange={(open) => !qrLoading && setQrScannerOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR-Code scannen</DialogTitle>
            <DialogDescription>
              Scanne den QR-Code deiner Lehrkraft. Danach öffnet sich automatisch deine BOOST App.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-black">
              <video
                ref={videoRef}
                className="aspect-square w-full object-cover"
                muted
                playsInline
                aria-label="QR-Code Kamera"
              />
              <canvas ref={scannerCanvasRef} className="hidden" aria-hidden="true" />
            </div>

            {qrScannerError && (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{qrScannerError}</p>
            )}

            <p className="text-center text-sm font-medium text-muted-foreground">
              Halte den QR-Code vollständig in den Rahmen. Die Aktivierung startet automatisch.
            </p>

            <form className="space-y-3" onSubmit={handleManualQrSubmit}>
              <div className="space-y-2">
                <Label htmlFor="manual-qr-code">Code manuell eingeben</Label>
                <Input
                  id="manual-qr-code"
                  value={manualQrCode}
                  onChange={(event) => setManualQrCode(event.target.value)}
                  placeholder="20-stelliger Aktivierungscode"
                  autoCapitalize="characters"
                  autoComplete="off"
                  disabled={qrLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={qrLoading || !manualQrCode.trim()}>
                {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Code aktivieren
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
