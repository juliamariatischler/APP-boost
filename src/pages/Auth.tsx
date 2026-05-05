import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import ForgotPassword from "@/components/ForgotPassword";
import { DEMO_MIN_POINTS } from "@/lib/demo";

const REGISTERED_SCHOOLS_RPC_UNAVAILABLE_KEY = "boost:get_registered_schools_unavailable";

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
  const [loading, setLoading] = useState(false);
  const [demoStudentLoading, setDemoStudentLoading] = useState(false);
  const [demoTeacherLoading, setDemoTeacherLoading] = useState(false);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [registeredSchools, setRegisteredSchools] = useState<string[]>([]);
  const [showSchoolRequest, setShowSchoolRequest] = useState(false);
  const [schoolRequestLoading, setSchoolRequestLoading] = useState(false);
  const [requestedSchool, setRequestedSchool] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loginType, setLoginType] = useState<"student" | "teacher">("student");
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

  const DEMO_SCHOOL = "DemoSchule";
  const DEMO_CLASS = "4a";
  const DEMO_STUDENT = {
    email: "demo@boost-challenge.de",
    password: "demo123456",
    username: "Demo",
  };
  const DEMO_TEACHER = {
    email: "demo-lehrkraft@boost-challenge.de",
    password: "demo123456",
    username: "DemoLehrkraft",
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
  }) => {
    const basePayload = {
      username: params.username,
      school: DEMO_SCHOOL,
      class: DEMO_CLASS,
      points: params.points,
    };

    if (!params.includeAge) {
      return basePayload;
    }

    return {
      ...basePayload,
      age: params.accountType === "student" ? 10 : null,
    };
  };

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard", { replace: true });
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const demo = params.get("demo");
    const name = params.get("name")?.trim();
    if (demo !== "student") return;

    handleNamedDemoStudentLogin(name || "Demo");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

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
        toast.success("Erfolgreich angemeldet!");
        navigate("/dashboard", { replace: true });
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
        toast.success("Erfolgreich registriert! Du wirst weitergeleitet...");
        navigate("/dashboard", { replace: true });
      } else if (data.user) {
        // User created but needs email confirmation
        toast.success("Registrierung erfolgreich! Bitte überprüfe dein E-Mail-Postfach.");
        // Auto-confirm is enabled, so this shouldn't happen, but handle it gracefully
        setTimeout(() => navigate("/dashboard", { replace: true }), 2000);
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
            })
          )
          .eq("id", signInResult.data.user.id);

        profileUpdateError = retry.error;
      }

      if (profileUpdateError) {
        throw profileUpdateError;
      }

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

      toast.success(result.created ? "Demo-Schülerkonto erstellt!" : "Demo-Login erfolgreich!");
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

      toast.success(result.created ? "Demo-Schülerkonto erstellt!" : "Demo-Login erfolgreich!");
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

      // Fallback: ensure explicit demo student -> demo teacher mapping when table exists.
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

      if (!assignmentSucceeded) {
        toast.success("Demo-Lehrkraft-Login erfolgreich! Zuordnung aktuell nicht möglich (DB-Migration fehlt).");
      } else {
        toast.success("Demo-Lehrkraft-Login erfolgreich! Demoschüler ist der Demo-Lehrkraft zugeordnet.");
      }
      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      if (isAssignmentInfraMissing(error)) {
        toast.success("Demo-Lehrkraft-Login erfolgreich! Zuordnung wird ohne Assignment-Tabelle übersprungen.");
        navigate("/dashboard", { replace: true });
        return;
      }
      toast.error("Demo-Lehrkraft-Login fehlgeschlagen: " + (error?.message ?? "Unbekannter Fehler"));
    } finally {
      setDemoTeacherLoading(false);
    }
  };

  const handleSchoolRequest = async () => {
    const schoolName = requestedSchool.trim();
    if (schoolName.length < 2) {
      toast.error("Bitte gib einen gültigen Schulnamen ein.");
      return;
    }

    setSchoolRequestLoading(true);

    const { error } = await (supabase.rpc as any)("submit_school_registration_request", {
      p_requested_school: schoolName,
      p_requester_email: signupData.email?.trim() || null,
      p_requester_name: signupData.username?.trim() || null,
      p_request_note: `Anfrage aus Registrierung (${signupData.accountType})`,
    });

    setSchoolRequestLoading(false);

    if (!registeredSchools.includes(schoolName)) {
      setRegisteredSchools((prev) => [...prev, schoolName].sort((a, b) => a.localeCompare(b)));
    }
    setSignupData((prev) => ({ ...prev, school: schoolName }));
    setRequestedSchool("");
    setShowSchoolRequest(false);

    if (error) {
      console.error("School request failed:", error);
      toast.success("Schule übernommen. Die Anfrage an die Datenbank konnte gerade nicht gespeichert werden.");
      return;
    }

    toast.success("Schule hinzugefügt und ausgewählt.");
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
            {showForgotPassword ? (
              <ForgotPassword onBack={() => setShowForgotPassword(false)} />
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-account-type">Login als</Label>
                  <select
                    id="login-account-type"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={loginType}
                    onChange={(e) => setLoginType(e.target.value as "student" | "teacher")}
                  >
                    <option value="student">Schüler:in</option>
                    <option value="teacher">Lehrkraft</option>
                  </select>
                </div>
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
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={loading || demoStudentLoading || demoTeacherLoading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Anmelden
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={loginType === "teacher" ? handleDemoTeacherLogin : handleDemoStudentLogin}
                    disabled={loading || demoStudentLoading || demoTeacherLoading}
                  >
                    {(demoStudentLoading || demoTeacherLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {loginType === "teacher" ? "Demo Lehrkraft" : "Demo Schüler:in"}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-sm"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Passwort vergessen?
                </Button>
              </form>
            )}
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <Label htmlFor="signup-account-type">Konto-Typ</Label>
                <select
                  id="signup-account-type"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={signupData.accountType}
                  onChange={(e) =>
                    setSignupData({
                      ...signupData,
                      accountType: e.target.value as "student" | "teacher",
                    })
                  }
                >
                  <option value="student">Schüler:in</option>
                  <option value="teacher">Lehrkraft</option>
                </select>
              </div>
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
                <div className="space-y-2">
                  <select
                    id="signup-school"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                    value={signupData.school}
                    onChange={(e) => setSignupData({ ...signupData, school: e.target.value })}
                    disabled={schoolsLoading}
                  >
                    <option value="">
                      {schoolsLoading
                        ? "Schulen werden geladen..."
                        : registeredSchools.length > 0
                        ? "Schule auswählen"
                        : "Noch keine Schule registriert"}
                    </option>
                    {registeredSchools.map((school) => (
                      <option key={school} value={school}>
                        {school}
                      </option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-sm"
                    onClick={() => setShowSchoolRequest((prev) => !prev)}
                  >
                    Schule nicht dabei? Neu hinzufügen
                  </Button>

                  {showSchoolRequest && (
                    <div className="space-y-2 rounded-md border border-border p-3">
                      <Input
                        value={requestedSchool}
                        onChange={(e) => setRequestedSchool(e.target.value)}
                        placeholder="Name deiner Schule"
                      />
                      <Button
                        type="button"
                        onClick={handleSchoolRequest}
                        disabled={schoolRequestLoading}
                        className="w-full"
                      >
                        {schoolRequestLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Schule hinzufügen
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="signup-class">
                  {signupData.accountType === "teacher" ? "Klasse/Fach" : "Klasse"}
                </Label>
                <Input
                  id="signup-class"
                  type="text"
                  required
                  value={signupData.class}
                  onChange={(e) => setSignupData({ ...signupData, class: e.target.value })}
                  placeholder={signupData.accountType === "teacher" ? "z. B. Sport" : "5a"}
                />
              </div>
              {signupData.accountType === "student" && (
                <div>
                  <Label htmlFor="signup-age">Alter</Label>
                  <Input
                    id="signup-age"
                    type="number"
                    min={6}
                    max={19}
                    required
                    value={signupData.age}
                    onChange={(e) => setSignupData({ ...signupData, age: e.target.value })}
                    placeholder="z. B. 10"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Das Alter hilft uns, Tageschallenges und Trainingshinweise altersgerechter einzuordnen.
                  </p>
                </div>
              )}
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
