import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CodeAuthProvider } from "@/contexts/CodeAuthContext";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import AppOnboarding from "@/components/AppOnboarding";
import { FeedbackPromptModal } from "@/components/FeedbackPromptModal";
import { RewardsHintModal } from "@/components/RewardsHintModal";
import { AnnouncementModal } from "@/components/AnnouncementModal";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const CodeLogin = lazy(() => import("./pages/CodeLogin"));
const Activate = lazy(() => import("./pages/Activate"));
const StudentHome = lazy(() => import("./pages/StudentHome"));
const TeacherHome = lazy(() => import("./pages/TeacherHome"));
const TeacherManagement = lazy(() => import("./pages/TeacherManagement"));
const TeacherProfile = lazy(() => import("./pages/TeacherProfile"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Quests = lazy(() => import("./pages/Quests"));
const ClassQuest = lazy(() => import("./pages/ClassQuest"));
const Klasse = lazy(() => import("./pages/Klasse"));
const Profil = lazy(() => import("./pages/Profil"));
const ChallengeDetail = lazy(() => import("./pages/ChallengeDetail"));
const Admin = lazy(() => import("./pages/Admin"));
const Rewards = lazy(() => import("./pages/Rewards"));
const Activity = lazy(() => import("./pages/Activity"));
const Boost = lazy(() => import("./pages/Boost"));
const Legal = lazy(() => import("./pages/Legal"));
const Settings = lazy(() => import("./pages/Settings"));
const FriendQuest = lazy(() => import("./pages/FriendQuest"));
const WeeklyAthleteChallenge = lazy(() => import("./pages/WeeklyAthleteChallenge"));
const NfcRouteChallenge = lazy(() => import("./pages/NfcRouteChallenge"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyGuardian = lazy(() => import("./pages/VerifyGuardian"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <p className="text-sm text-muted-foreground">Lade Seite...</p>
  </div>
);

const NativeChrome = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const configureStatusBar = async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setStyle({ style: Style.Dark });
      } catch (error) {
        console.warn("StatusBar configuration skipped:", error);
      }
    };

    void configureStatusBar();
  }, []);

  return null;
};

// Global listener to catch PASSWORD_RECOVERY and redirect
const RecoveryRedirect = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check URL hash for recovery type on any page
    const hash = window.location.hash;
    if (hash.includes("type=recovery") && location.pathname !== "/reset-password") {
      navigate("/reset-password" + window.location.hash, { replace: true });
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && location.pathname !== "/reset-password") {
        navigate("/reset-password", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CodeAuthProvider>
          <RecoveryRedirect>
            <NativeChrome />
            <AppOnboarding />
            {/* 14-Tage-Feedback-Pop-up: erscheint einmalig nach 14 Tagen Nutzung */}
            <FeedbackPromptModal />
            {/* Belohnungs-Hinweis: erscheint ab 09.06.2026 einmalig für jedes Kind */}
            <RewardsHintModal />
            {/* Datenbankgesteuerte Scheduled Pop-ups: Inhalt komplett via Supabase steuerbar */}
            <AnnouncementModal />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Code-based login routes */}
                <Route path="/login" element={<CodeLogin />} />
                <Route path="/activate" element={<Activate />} />
                <Route path="/student-home" element={<StudentHome />} />
                <Route path="/teacher-home" element={<TeacherHome />} />
                <Route path="/teacher-management" element={<TeacherManagement />} />
                <Route path="/teacher-profile" element={<TeacherProfile />} />
                {/* Legacy email/password routes */}
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/quests" element={<Quests />} />
                <Route path="/class-quest" element={<ClassQuest />} />
                <Route path="/klasse" element={<Klasse />} />
                <Route path="/profil" element={<Profil />} />
                <Route path="/challenge/:id" element={<ChallengeDetail />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/rewards" element={<Rewards />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/boost" element={<Boost />} />
                <Route path="/legal" element={<Legal />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/challenge/friend" element={<FriendQuest />} />
                <Route path="/challenge/weekly/athlete" element={<WeeklyAthleteChallenge />} />
                <Route path="/nfc-route" element={<NfcRouteChallenge />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-guardian" element={<VerifyGuardian />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </RecoveryRedirect>
        </CodeAuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
