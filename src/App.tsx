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

if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: false });
  StatusBar.setStyle({ style: Style.Light });
}

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const CodeLogin = lazy(() => import("./pages/CodeLogin"));
const StudentHome = lazy(() => import("./pages/StudentHome"));
const StudentKlasse = lazy(() => import("./pages/StudentKlasse"));
const StudentQuests = lazy(() => import("./pages/StudentQuests"));
const StudentProfil = lazy(() => import("./pages/StudentProfil"));
const TeacherHome = lazy(() => import("./pages/TeacherHome"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ChallengeDetail = lazy(() => import("./pages/ChallengeDetail"));
const Admin = lazy(() => import("./pages/Admin"));
const Rewards = lazy(() => import("./pages/Rewards"));
const Activity = lazy(() => import("./pages/Activity"));
const Boost = lazy(() => import("./pages/Boost"));
const Settings = lazy(() => import("./pages/Settings"));
const FriendQuest = lazy(() => import("./pages/FriendQuest"));
const WeeklyAthleteChallenge = lazy(() => import("./pages/WeeklyAthleteChallenge"));
const WeeklyGeoTracking = lazy(() => import("./pages/WeeklyGeoTracking"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <p className="text-sm text-muted-foreground">Lade Seite...</p>
  </div>
);

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
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Code-based login routes */}
                <Route path="/login" element={<CodeLogin />} />
                <Route path="/student-home"   element={<StudentHome />} />
                <Route path="/student-klasse" element={<StudentKlasse />} />
                <Route path="/student-quests" element={<StudentQuests />} />
                <Route path="/student-profil" element={<StudentProfil />} />
                <Route path="/teacher-home" element={<TeacherHome />} />
                {/* Legacy email/password routes */}
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/challenge/:id" element={<ChallengeDetail />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/rewards" element={<Rewards />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/boost" element={<Boost />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/challenge/friend" element={<FriendQuest />} />
                <Route path="/challenge/weekly/athlete" element={<WeeklyAthleteChallenge />} />
                <Route path="/challenge/weekly/geotracking" element={<WeeklyGeoTracking />} />
                <Route path="/reset-password" element={<ResetPassword />} />
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
