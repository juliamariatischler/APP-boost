import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ChallengeDetail from "./pages/ChallengeDetail";
import Admin from "./pages/Admin";
import Rewards from "./pages/Rewards";
import Activity from "./pages/Activity";
import Boost from "./pages/Boost";
import Settings from "./pages/Settings";
import FriendQuest from "./pages/FriendQuest";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
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
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
