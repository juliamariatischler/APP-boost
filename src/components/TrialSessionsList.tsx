import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import GrazSportsGallery from "@/components/GrazSportsGallery";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Phone, 
  Mail, 
  Globe,
  CheckCircle,
  Loader2,
  Zap
} from "lucide-react";
import { format } from "date-fns";
import { isValid, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { BOOST_POINT_RULES } from "@/lib/gamification";

const POINTS_PROBETRAINING = BOOST_POINT_RULES.tryItProbetraining;
const POINTS_KURS = BOOST_POINT_RULES.tryItCompleted;

type Club = {
  id: string;
  name: string;
  sport_type: string;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  logo_url: string | null;
};

type TrialSession = {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string | null;
  location: string;
  address: string | null;
  max_participants: number;
  min_age: number | null;
  max_age: number | null;
  requirements: string | null;
  clubs: Club | null;
};

type Registration = {
  session_id: string;
  status: string;
};

type TryItFilter = "all" | "probetraining" | "highlight";

const getAssociationInfo = (clubName: string) => {
  const normalized = clubName.toLowerCase();

  if (normalized.includes("asvö") || normalized.includes("asvoe")) {
    return { label: "ASVÖ", className: "bg-red-600 text-white" };
  }

  if (normalized.includes("askö") || normalized.includes("askoe")) {
    return { label: "ASKÖ", className: "bg-rose-700 text-white" };
  }

  if (normalized.includes("sportunion")) {
    return { label: "Sportunion", className: "bg-blue-700 text-white" };
  }

  return { label: "Partnerverein", className: "bg-slate-800 text-white" };
};

const getSessionPoints = (session: TrialSession) => {
  const label = getExperienceLabel(session);
  return label === "Highlight-Erlebnis" ? POINTS_KURS : POINTS_PROBETRAINING;
};

const getExperienceLabel = (session: TrialSession) => {
  return session.end_time && session.end_time > "17:30:00" ? "Highlight-Erlebnis" : "Probetraining";
};

const TrialSessionsList = () => {
  const [sessions, setSessions] = useState<TrialSession[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationCounts, setRegistrationCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<TryItFilter>("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUserId(session.user.id);
      await loadUserRegistrations(session.user.id);
    }
    await loadSessions();
    setLoading(false);
  };

  const loadSessions = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from("trial_sessions")
      .select(`
        *,
        clubs (*)
      `)
      .gte("date", today)
      .order("date", { ascending: true });

    if (error) {
      console.error("Error loading sessions:", error);
      toast.error("Fehler beim Laden der Schnuppertermine");
      return;
    }

    setSessions(data as TrialSession[] || []);
    
    // Load registration counts for each session
    if (data && data.length > 0) {
      const counts: Record<string, number> = {};
      for (const session of data) {
        const { count } = await supabase
          .from("trial_registrations")
          .select("*", { count: "exact", head: true })
          .eq("session_id", session.id)
          .eq("status", "registered");
        
        counts[session.id] = count || 0;
      }
      setRegistrationCounts(counts);
    }
  };

  const loadUserRegistrations = async (uid: string) => {
    const { data, error } = await supabase
      .from("trial_registrations")
      .select("session_id, status")
      .eq("user_id", uid)
      .eq("status", "registered");

    if (error) {
      console.error("Error loading registrations:", error);
      return;
    }

    setRegistrations(data || []);
  };

  const handleRegister = async (sessionId: string) => {
    if (!userId) {
      toast.error("Bitte melde dich zuerst an");
      return;
    }

    const session = sessions.find((entry) => entry.id === sessionId);
    const pointsReward = session ? getSessionPoints(session) : POINTS_PER_VISIT;

    setRegistering(sessionId);

    const { error } = await supabase
      .from("trial_registrations")
      .insert({
        session_id: sessionId,
        user_id: userId,
        status: "registered"
      });

    if (error) {
      if (error.code === "23505") {
        toast.error("Du bist bereits für diesen Termin angemeldet");
      } else {
        console.error("Error registering:", error);
        toast.error("Fehler bei der Anmeldung");
      }
    } else {
      // Award points for registration
      try {
        await (supabase.rpc as any)('increment_points', { 
          points_to_add: pointsReward
        });
        window.dispatchEvent(new CustomEvent("points-updated", { detail: { delta: pointsReward } }));
        toast.success(`Erfolgreich angemeldet! +${pointsReward} ⚡ Blitze`);
      } catch (e) {
        toast.success("Erfolgreich angemeldet!");
      }
      setRegistrations(prev => [...prev, { session_id: sessionId, status: "registered" }]);
      setRegistrationCounts(prev => ({
        ...prev,
        [sessionId]: (prev[sessionId] || 0) + 1
      }));
    }

    setRegistering(null);
  };

  const handleCancelRegistration = async (sessionId: string) => {
    if (!userId) return;

    setRegistering(sessionId);

    const { error } = await supabase
      .from("trial_registrations")
      .update({ status: "cancelled" })
      .eq("session_id", sessionId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error cancelling:", error);
      toast.error("Fehler beim Stornieren");
    } else {
      toast.success("Anmeldung storniert");
      setRegistrations(prev => prev.filter(r => r.session_id !== sessionId));
      setRegistrationCounts(prev => ({
        ...prev,
        [sessionId]: Math.max((prev[sessionId] || 1) - 1, 0)
      }));
    }

    setRegistering(null);
  };

  const isRegistered = (sessionId: string) => {
    return registrations.some(r => r.session_id === sessionId);
  };

  const getAvailableSpots = (session: TrialSession) => {
    const count = registrationCounts[session.id] || 0;
    return session.max_participants - count;
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  const formatSessionDate = (date: string) => {
    const parsedDate = parseISO(date);
    if (!isValid(parsedDate)) {
      return date;
    }

    return format(parsedDate, "EEEE, d. MMMM yyyy", { locale: de });
  };

  const filteredSessions = sessions.filter((session) => {
    if (activeFilter === "all") return true;
    const isHighlight = getExperienceLabel(session) === "Highlight-Erlebnis";
    if (activeFilter === "highlight") return isHighlight;
    return !isHighlight;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="space-y-6">
        <GrazSportsGallery />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GrazSportsGallery />

      <Card className="overflow-hidden border-0 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 text-white shadow-lg">
        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Try It</p>
          <h2 className="mt-2 text-2xl font-bold">Ein System, klar differenziert</h2>
          <p className="mt-3 max-w-3xl text-sm text-white/90">
            Try It bleibt ein gemeinsames Erlebnis. Die Differenzierung passiert über Vereine, Verbandsbranding
            und Bildwirkung, die Belohnung bleibt bewusst klar: jedes neue Try-It bringt {POINTS_PER_VISIT} Blitze.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge className="bg-white/20 text-white hover:bg-white/20">Probetraining</Badge>
            <Badge className="bg-white/20 text-white hover:bg-white/20">Highlight-Erlebnis</Badge>
            <Badge className="bg-white/20 text-white hover:bg-white/20">Vereinsbranding</Badge>
          <Badge className="bg-white/20 text-white hover:bg-white/20">Probetraining: {POINTS_PROBETRAINING}⚡</Badge>
            <Badge className="bg-white/20 text-white hover:bg-white/20">Kurs: {POINTS_KURS}⚡</Badge>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeFilter === "all" ? "default" : "outline"}
          onClick={() => setActiveFilter("all")}
        >
          Alle
        </Button>
        <Button
          variant={activeFilter === "probetraining" ? "default" : "outline"}
          onClick={() => setActiveFilter("probetraining")}
        >
          Probetraining
        </Button>
        <Button
          variant={activeFilter === "highlight" ? "default" : "outline"}
          onClick={() => setActiveFilter("highlight")}
        >
          Highlight-Erlebnis
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Weitere verfügbare Schnuppertermine</h2>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-yellow-500" />
          {POINTS_PROBETRAINING}–{POINTS_KURS} ⚡
        </Badge>
      </div>
      
      {filteredSessions.map((session) => {
        const availableSpots = getAvailableSpots(session);
        const isFull = availableSpots <= 0;
        const registered = isRegistered(session.id);
        const club = session.clubs;
        const clubName = club?.name || "Verein";
        const clubSportType = club?.sport_type || "Sport";
        const clubInitial = clubName.charAt(0).toUpperCase();
        const association = getAssociationInfo(clubName);
        const pointsReward = getSessionPoints(session);
        const experienceLabel = getExperienceLabel(session);

        return (
          <Card key={session.id} className="overflow-hidden bg-card p-0">
            <div className="relative border-b bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-6 py-5 text-white">
              <div className="absolute bottom-4 right-4">
                <Badge className={`${association.className} shadow-sm`}>
                  {association.label}
                </Badge>
              </div>
              <div className="pr-28">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">{experienceLabel}</p>
                <h3 className="mt-1 text-2xl font-bold">{session.title}</h3>
                <p className="mt-1 text-sm text-white/80">{clubName}</p>
              </div>
            </div>

            <div className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Club Info */}
              <div className="flex-shrink-0">
                {club?.logo_url ? (
                  <img 
                    src={club.logo_url} 
                    alt={clubName}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">
                      {clubInitial}
                    </span>
                  </div>
                )}
              </div>

              {/* Session Details */}
              <div className="flex-grow space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-primary font-medium">{clubName}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-sm">
                      {clubSportType}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      {experienceLabel}
                    </Badge>
                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                      +{pointsReward} Blitze
                    </Badge>
                  </div>
                </div>

                {session.description && (
                  <p className="text-muted-foreground">{session.description}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>{formatSessionDate(session.date)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-foreground">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>
                      {formatTime(session.start_time)}
                      {session.end_time && ` - ${formatTime(session.end_time)}`} Uhr
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>{session.location}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className={isFull ? "text-destructive font-medium" : "text-foreground"}>
                      {isFull ? "Ausgebucht" : `${availableSpots} Plätze frei`}
                    </span>
                  </div>
                </div>

                {session.address && (
                  <p className="text-sm text-muted-foreground">
                    📍 {session.address}
                  </p>
                )}

                {(session.min_age || session.max_age) && (
                  <p className="text-sm text-muted-foreground">
                    Alter: {session.min_age || "0"} - {session.max_age || "∞"} Jahre
                  </p>
                )}

                {session.requirements && (
                  <p className="text-sm text-muted-foreground">
                    ℹ️ {session.requirements}
                  </p>
                )}

                {/* Club Contact - Only show contact buttons, not raw data */}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2 border-t">
                  {club?.contact_email && (
                    <a 
                      href={`mailto:${club.contact_email}`}
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <Mail className="h-3 w-3" />
                      E-Mail senden
                    </a>
                  )}
                  {club?.contact_phone && (
                    <a 
                      href={`tel:${club.contact_phone}`}
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <Phone className="h-3 w-3" />
                      Anrufen
                    </a>
                  )}
                  {club?.website && (
                    <a 
                      href={club.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <Globe className="h-3 w-3" />
                      Website
                    </a>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex-shrink-0 flex items-start">
                {registered ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Angemeldet</span>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-600">
                      <Zap className="h-4 w-4" />
                      <span className="text-sm font-medium">+{pointsReward} Blitze</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelRegistration(session.id)}
                      disabled={registering === session.id}
                    >
                      {registering === session.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Stornieren"
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      onClick={() => handleRegister(session.id)}
                      disabled={isFull || registering === session.id}
                      className="min-w-[120px]"
                    >
                      {registering === session.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isFull ? (
                        "Ausgebucht"
                      ) : (
                        "Anmelden"
                      )}
                    </Button>
                    {!isFull && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Zap className="h-3 w-3 text-yellow-500" />
                        <span className="text-xs">+{pointsReward} Blitze</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            </div>
          </Card>
        );
      })}

      {filteredSessions.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-lg text-muted-foreground">
            Für diesen Filter sind aktuell keine Termine verfügbar.
          </p>
        </Card>
      )}
    </div>
  );
};

export default TrialSessionsList;
