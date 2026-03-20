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

const POINTS_PER_VISIT = 25;

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

const TrialSessionsList = () => {
  const [sessions, setSessions] = useState<TrialSession[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationCounts, setRegistrationCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

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
          points_to_add: POINTS_PER_VISIT 
        });
        toast.success(`Erfolgreich angemeldet! +${POINTS_PER_VISIT} ⚡ Blitze`);
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
        <Card className="p-8 text-center">
          <p className="text-muted-foreground text-lg">
            Aktuell sind keine zusätzlichen Schnuppertermine verfügbar.
          </p>
          <p className="text-muted-foreground mt-2">
            Schau bald wieder vorbei!
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GrazSportsGallery />

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Weitere verfügbare Schnuppertermine</h2>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-yellow-500" />
          +{POINTS_PER_VISIT} pro Anmeldung
        </Badge>
      </div>
      
      {sessions.map((session) => {
        const availableSpots = getAvailableSpots(session);
        const isFull = availableSpots <= 0;
        const registered = isRegistered(session.id);
        const club = session.clubs;
        const clubName = club?.name || "Verein";
        const clubSportType = club?.sport_type || "Sport";
        const clubInitial = clubName.charAt(0).toUpperCase();

        return (
          <Card key={session.id} className="p-6 bg-card">
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
                    <h3 className="text-xl font-bold text-foreground">{session.title}</h3>
                    <p className="text-primary font-medium">{clubName}</p>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    {clubSportType}
                  </Badge>
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
                      <span className="text-sm font-medium">+{POINTS_PER_VISIT} Blitze</span>
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
                        <span className="text-xs">+{POINTS_PER_VISIT} Blitze</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default TrialSessionsList;
