import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, Clock, ExternalLink, MapPin, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOOST_POINT_RULES } from "@/lib/gamification";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SportOffer = {
  id: string;
  sport: string;
  image: string;
  club: string;
  federation: "ASVÖ" | "ASKÖ" | "SPORTUNION";
  location: string;
  address: string;
  dateLabel: string;
  timeLabel: string;
  ageLabel: string;
  meetingPoint: string;
  rewardLabel: string;
  rewardPoints: number;
  formatLabel: string;
  summary: string;
  details: string;
  imageHeadline: string;
  imageSubline: string;
  websiteUrl: string;
  bookingUrl: string;
};

type OfferFilter = "all" | "Probetraining" | "Kurs";

const offers: SportOffer[] = [
  {
    id: "soccer-kainbach",
    sport: "Fußball",
    image: "/tryit-football.svg",
    club: "ESK Graz",
    federation: "ASKÖ",
    location: "Kainbach bei Graz",
    address: "ASKÖ Stadion Eggenberg, Schloßstraße 20, 8020 Graz",
    dateLabel: "Sonntag, 29.03.2026",
    timeLabel: "15:30 bis 17:00 Uhr",
    ageLabel: "8 bis 12 Jahre",
    meetingPoint: "Treffpunkt 15 Minuten vorher beim Vereinsheim",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Fußball-Probetraining mit echtem Teamgefühl, Tempo und viel Ballkontakt.",
    details:
      "Du lernst Passspiel, Ballkontrolle und bekommst einen direkten Einblick in das Vereinsleben. Die ASKÖ-Vereinszuordnung von ESK Graz ist über die ASKÖ-Steiermark-Vereinssuche belegt. Sportschuhe und Trinkflasche mitnehmen.",
    imageHeadline: "Spür den Teamspirit",
    imageSubline: "Offenes Probetraining mit echtem Stadiongefühl.",
    websiteUrl: "http://www.eskgraz.at",
    bookingUrl: "http://www.eskgraz.at",
  },
  {
    id: "football-giants",
    sport: "American Football",
    image: "/tryit-american-football.svg",
    club: "Graz Giants",
    federation: "SPORTUNION",
    location: "Graz",
    address: "Weinzöttlstraße 16, 8054 Graz",
    dateLabel: "Montag, 30.03.2026",
    timeLabel: "18:00 bis 19:30 Uhr",
    ageLabel: "8 bis 15 Jahre",
    meetingPoint: "Treffpunkt beim Vereinsgebäude 10 Minuten vorher",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Kurs",
    summary: "American Football mit Teamplay, Taktik und explosiver Athletik.",
    details:
      "Die Graz Giants sind einer der erfolgreichsten American-Football-Vereine Österreichs. Im Jugendkurs lernst du Wurftechnik, Laufspiel und Teamtaktik in einem motivierenden Umfeld. Sportschuhe und Trinkflasche reichen für den Einstieg.",
    imageHeadline: "Volle Kraft voraus",
    imageSubline: "Football-Kurs mit Taktik, Teamgeist und echtem Gameday-Feeling.",
    websiteUrl: "https://www.grazgiants.at/",
    bookingUrl: "https://www.grazgiants.at/",
  },
  {
    id: "handball-graz",
    sport: "Handball",
    image: "/tryit-handball.svg",
    club: "ASKÖ Handball Graz",
    federation: "ASKÖ",
    location: "Graz",
    address: "ASKÖ Stadion Eggenberg, Schloßstraße 20, 8020 Graz",
    dateLabel: "Freitag, 27.03.2026",
    timeLabel: "18:00 bis 19:30 Uhr",
    ageLabel: "9 bis 13 Jahre",
    meetingPoint: "Treffpunkt direkt beim Halleneingang links",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Schnuppertraining mit Tempo, Wurfkraft und echtem Hallenfeeling.",
    details:
      "Das Angebot orientiert sich an ASKÖ-nahen Hallensportstrukturen in Graz und setzt auf einen direkten Einstieg in Technik und Spielpraxis. Hallenschuhe mit heller Sohle empfohlen.",
    imageHeadline: "Volle Halle, voller Fokus",
    imageSubline: "Probetraining für schnelle Entscheidungen und starke Würfe.",
    websiteUrl: "https://www.askoe-steiermark.at/de/service/vereinssuche",
    bookingUrl: "https://www.askoe-steiermark.at/de/service/vereinssuche",
  },
  {
    id: "volleyball-graz",
    sport: "Volleyball",
    image: "/tryit-volleyball.svg",
    club: "UVC Holding Graz",
    federation: "SPORTUNION",
    location: "Graz",
    address: "Pfanghofweg 2b, 8045 Graz",
    dateLabel: "Montag, 30.03.2026",
    timeLabel: "17:15 bis 18:45 Uhr",
    ageLabel: "10 bis 14 Jahre",
    meetingPoint: "Treffpunkt vor Court 2",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Kurs",
    summary: "Volleyball-Kurs mit sichtbarem Leistungsumfeld und starkem Nachwuchscharakter.",
    details:
      "UVC Holding Graz ist laut SPORTUNION-Vereinsprofil ein SPORTUNION-Verein in Graz. Der Kurs vermittelt Aufschlag, Annahme und Teamspiel in einem Umfeld mit starker Nachwuchsarbeit. Knieschoner sind optional.",
    imageHeadline: "Spring rein ins Spiel",
    imageSubline: "Volleyball-Kurs mit Vereinsdynamik und Teamenergie.",
    websiteUrl: "https://www.uvcgraz.at/",
    bookingUrl: "https://www.uvcgraz.at/",
  },
  {
    id: "tennis-graz",
    sport: "Tennis",
    image: "/tryit-tennis.svg",
    club: "GAK Tennis",
    federation: "ASVÖ",
    location: "Graz",
    address: "Körösistraße 57, 8010 Graz",
    dateLabel: "Sonntag, 29.03.2026",
    timeLabel: "10:00 bis 11:30 Uhr",
    ageLabel: "8 bis 14 Jahre",
    meetingPoint: "Treffpunkt am Clubhaus beim Platzplan",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Tennis-Probetraining mit Clubatmosphäre, Tempo und klaren Erfolgsmomenten.",
    details:
      "GAK Tennis wird in einem aktuellen ASVÖ-Steiermark-Beitrag als ASVÖ-Verein im Vereinscoaching-Kontext genannt. Das Probetraining setzt auf Schlagtechnik, Bewegung am Platz und schnelle Matchformen. Schläger können vor Ort ausgeliehen werden.",
    imageHeadline: "Dein erster sauberer Treffer",
    imageSubline: "Probetraining mit Clubfeeling auf rotem Sand.",
    websiteUrl: "https://www.asvoe-steiermark.at/de/aktuelles-service/newsshow-fit-fuer-die-zukunft-8211-verein.vernetzt-2025",
    bookingUrl: "https://www.asvoe-steiermark.at/de/aktuelles-service/newsshow-fit-fuer-die-zukunft-8211-verein.vernetzt-2025",
  },
  {
    id: "judo-graz",
    sport: "Judo",
    image: "/tryit-judo.svg",
    club: "ASKÖ-Judo-Club-Graz",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Dienstag, 24.03.2026",
    timeLabel: "17:00 bis 18:15 Uhr",
    ageLabel: "7 bis 12 Jahre",
    meetingPoint: "Treffpunkt vor dem Dojo, barfuß erst in der Halle",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Judo-Probetraining mit Respekt, Balance und sichtbarem Fortschritt.",
    details:
      "Der ASKÖ-Judo-Club-Graz ist in der ASKÖ-Steiermark-Vereinssuche als Grazer Judo-Verein aufgeführt. Im Schnuppertraining lernen Kinder kontrollierte Bewegungen, Respekt im Dojo und erste Techniken. Lange Jogginghose und T-Shirt reichen für den Einstieg.",
    imageHeadline: "Stärke mit Haltung",
    imageSubline: "Probetraining mit Respekt, Mut und Körperkontrolle.",
    websiteUrl: "https://www.askoe-steiermark.at/de/service/vereinssuche",
    bookingUrl: "https://www.askoe-steiermark.at/de/service/vereinssuche",
  },
  {
    id: "basketball-graz",
    sport: "Basketball",
    image: "/tryit-basketball.svg",
    club: "Damen-Basketballclub Graz",
    federation: "ASKÖ",
    location: "Graz",
    address: "8047 Graz",
    dateLabel: "Montag, 30.03.2026",
    timeLabel: "16:45 bis 18:00 Uhr",
    ageLabel: "10 bis 13 Jahre",
    meetingPoint: "Treffpunkt im Foyer beim Court A",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Kurs",
    summary: "Basketball-Kurs mit Energie, Teamplay und klarer Nachwuchsorientierung.",
    details:
      "Der Damen-Basketballclub Graz ist laut ASKÖ-Steiermark-Vereinssuche ein Grazer ASKÖ-Basketballverein. Der Kurs verbindet Dribbling, Wurf und kleine Spielformen mit klarer Trainerstruktur. Hallenschuhe und Trinkflasche genügen.",
    imageHeadline: "Volle Energie auf dem Court",
    imageSubline: "Kurs mit Tempo, Teamplay und starker Clubidentität.",
    websiteUrl: "http://www.dbbc.at",
    bookingUrl: "http://www.dbbc.at",
  },
  {
    id: "swimming-graz",
    sport: "Fechten",
    image: "/tryit-swimming.svg",
    club: "Steirischer Landesfechtclub Graz",
    federation: "ASVÖ",
    location: "Graz",
    address: "8010 Graz",
    dateLabel: "Sonntag, 29.03.2026",
    timeLabel: "09:00 bis 10:15 Uhr",
    ageLabel: "9 bis 14 Jahre",
    meetingPoint: "Treffpunkt beim Drehkreuz im Eingangsbereich",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Kurs",
    summary: "Fechtkurs mit Fokus, Reaktion und einem starken ersten Aha-Moment.",
    details:
      "Der Steirische Landesfechtclub in Graz wird in einem ASVÖ-Steiermark-Beitrag als ASVÖ-Verein genannt. Der Kurs fokussiert Reaktion, Koordination und den spielerischen Einstieg in eine besondere Sportart.",
    imageHeadline: "Schnell denken, schnell reagieren",
    imageSubline: "Fechtkurs mit Stil, Fokus und echtem Neugierfaktor.",
    websiteUrl: "https://www.asvoe-steiermark.at/de/newsshow-richtig-fit-fuer-asvoe-vereine",
    bookingUrl: "https://www.asvoe-steiermark.at/de/newsshow-richtig-fit-fuer-asvoe-vereine",
  },
];

const GrazSportsGallery = () => {
  const [selectedOffer, setSelectedOffer] = useState<SportOffer | null>(null);
  const [activeFilter, setActiveFilter] = useState<OfferFilter>("all");
  const [claimingOfferId, setClaimingOfferId] = useState<string | null>(null);

  const filterCounts = useMemo(
    () => ({
      all: offers.length,
      Probetraining: offers.filter((offer) => offer.formatLabel === "Probetraining").length,
      Kurs: offers.filter((offer) => offer.formatLabel === "Kurs").length,
    }),
    []
  );

  const visibleOffers = useMemo(() => {
    if (activeFilter === "all") return offers;
    return offers.filter((offer) => offer.formatLabel === activeFilter);
  }, [activeFilter]);

  const getFormatBadgeClassName = (formatLabel: SportOffer["formatLabel"]) =>
    formatLabel === "Probetraining"
      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
      : "bg-sky-100 text-sky-700 hover:bg-sky-100";

  const getFederationBadgeClassName = (federation: SportOffer["federation"]) => {
    if (federation === "ASKÖ") return "bg-red-600 text-white";
    if (federation === "ASVÖ") return "bg-blue-600 text-white";
    return "bg-emerald-600 text-white";
  };

  const RewardPill = ({ points, label = "gesamt" }: { points: number; label?: string }) => (
    <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-500">
      <Zap className="h-4 w-4 fill-emerald-500 text-emerald-500" />
      <span className="text-2xl font-black leading-none">{points}</span>
      <span className="text-base font-semibold">{label}</span>
    </div>
  );

  const getClaimStorageKey = (offerId: string, userId: string) => `boost:tryit-claimed:${userId}:${offerId}`;

  const handleClaimReward = async (offer: SportOffer) => {
    setClaimingOfferId(offer.id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id;
      if (!userId) {
        toast.error("Du musst angemeldet sein, um Blitze zu sichern.");
        return;
      }

      const claimKey = getClaimStorageKey(offer.id, userId);
      const alreadyClaimed = typeof window !== "undefined" && window.localStorage.getItem(claimKey) === "1";

      if (!alreadyClaimed) {
        const { error } = await supabase.rpc("increment_points", {
          points_to_add: offer.rewardPoints,
        });

        if (error) {
          console.error("Try-It reward failed", error);
          toast.error("Weiterleitung möglich, aber die Blitze konnten nicht gutgeschrieben werden.");
          return;
        }

        window.dispatchEvent(new CustomEvent("points-updated", { detail: { delta: offer.rewardPoints } }));
        window.localStorage.setItem(claimKey, "1");
        toast.success(`+${offer.rewardPoints} ⚡ gutgeschrieben!`);
      } else {
        toast.info("Für dieses Angebot hast du die Blitze bereits gesichert.");
      }

      window.location.href = offer.bookingUrl;
    } finally {
      setClaimingOfferId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-bold text-foreground">Sportangebote in Graz</h2>
        <Badge variant="secondary">Try It</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Wähle eine Sportart und tippe auf die Karte, um genaue Termine mit Datum, Uhrzeit,
        Treffpunkt und Ort zu sehen.
      </p>

      <div className="rounded-2xl border bg-muted/20 p-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all" as const, label: "Alle Angebote", count: filterCounts.all },
            { key: "Probetraining" as const, label: "Probetraining", count: filterCounts.Probetraining },
            { key: "Kurs" as const, label: "Kurse", count: filterCounts.Kurs },
          ].map((filter) => {
            const isActive = activeFilter === filter.key;

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-foreground hover:border-primary hover:text-primary"
                )}
              >
                <span>{filter.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    isActive ? "bg-white/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Probetrainings sind einzelne Schnuppertermine. Kurse laufen strukturierter und meist in einer festen Gruppe.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleOffers.map((offer) => (
          <Card
            key={offer.id}
            className="overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
            onClick={() => setSelectedOffer(offer)}
          >
            <div className="relative aspect-[16/10]">
              <img
                src={offer.image}
                alt={offer.sport}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 top-0 p-3">
                <p className="max-w-[80%] text-lg font-bold leading-tight text-white">{offer.imageHeadline}</p>
                <p className="mt-1 max-w-[85%] text-xs text-white/85">{offer.imageSubline}</p>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="text-white text-lg font-semibold leading-tight">{offer.sport}</p>
                <p className="text-white/85 text-xs">{offer.club}</p>
                <div className="mt-3 flex justify-end">
                  <span className={cn("rounded-full px-3 py-1 text-[11px] font-bold tracking-wide shadow-lg", getFederationBadgeClassName(offer.federation))}>
                    {offer.federation}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className={getFormatBadgeClassName(offer.formatLabel)}>{offer.formatLabel}</Badge>
                <Badge className={getFederationBadgeClassName(offer.federation)}>{offer.federation}</Badge>
              </div>
              <div className="mb-3">
                <RewardPill points={offer.rewardPoints} />
              </div>
              <div className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{offer.location}</span>
              </div>
              <div className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                <span>{offer.dateLabel}</span>
              </div>
              <div className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span>{offer.timeLabel}</span>
              </div>
              <div className="mb-3 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                Nächstes Training am {offer.dateLabel.replace(/^[^,]+, /, "")} um{" "}
                {offer.timeLabel.split(" bis ")[0]} in {offer.location}
              </div>
              <p className="text-sm text-foreground">{offer.summary}</p>
            </div>
          </Card>
        ))}
      </div>

      {visibleOffers.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-background px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Für diesen Filter gibt es aktuell keine Angebote.</p>
          <p className="mt-1 text-sm text-muted-foreground">Wechsle auf einen anderen Filter, um weitere Try-It-Angebote zu sehen.</p>
        </div>
      )}

      <Dialog open={Boolean(selectedOffer)} onOpenChange={(open) => !open && setSelectedOffer(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          {selectedOffer && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedOffer.sport}</DialogTitle>
                <DialogDescription className="text-base text-muted-foreground">
                  {selectedOffer.club} in {selectedOffer.location}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="relative h-48 w-full overflow-hidden rounded-md">
                  <img
                    src={selectedOffer.image}
                    alt={selectedOffer.sport}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                  <div className="absolute inset-x-0 top-0 p-4">
                    <p className="max-w-[80%] text-2xl font-bold leading-tight text-white">
                      {selectedOffer.imageHeadline}
                    </p>
                    <p className="mt-1 max-w-[85%] text-sm text-white/85">{selectedOffer.imageSubline}</p>
                  </div>
                  <div className="absolute bottom-4 right-4">
                    <span className={cn("rounded-full px-3 py-1 text-xs font-bold tracking-wide shadow-lg", getFederationBadgeClassName(selectedOffer.federation))}>
                      {selectedOffer.federation}
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Card className="p-3">
                    <div className="flex items-start gap-2 text-sm text-foreground">
                      <Calendar className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-semibold">Datum</p>
                        <p className="text-muted-foreground">{selectedOffer.dateLabel}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-start gap-2 text-sm text-foreground">
                      <Clock className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-semibold">Uhrzeit</p>
                        <p className="text-muted-foreground">{selectedOffer.timeLabel}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-start gap-2 text-sm text-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-semibold">Ort</p>
                        <p className="text-muted-foreground">{selectedOffer.address}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-start gap-2 text-sm text-foreground">
                      <Users className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-semibold">Alter / Treffpunkt</p>
                        <p className="text-muted-foreground">{selectedOffer.ageLabel}</p>
                        <p className="text-muted-foreground">{selectedOffer.meetingPoint}</p>
                      </div>
                    </div>
                  </Card>
                </div>
                <p className="text-sm text-foreground">{selectedOffer.details}</p>
                <Card className="border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Nächstes Training am {selectedOffer.dateLabel.replace(/^[^,]+, /, "")} um{" "}
                    {selectedOffer.timeLabel.split(" bis ")[0]} Uhr in {selectedOffer.location}
                    {" "}bei {selectedOffer.club}.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <RewardPill points={selectedOffer.rewardPoints} />
                    <Badge className={getFormatBadgeClassName(selectedOffer.formatLabel)}>{selectedOffer.formatLabel}</Badge>
                    <Badge className={getFederationBadgeClassName(selectedOffer.federation)}>{selectedOffer.federation}</Badge>
                  </div>
                </Card>

                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <a
                      href={selectedOffer.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Vereinsseite
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handleClaimReward(selectedOffer)}
                    disabled={claimingOfferId === selectedOffer.id}
                    className="inline-flex items-center gap-2"
                  >
                      <Zap className="h-4 w-4 fill-current" />
                      {claimingOfferId === selectedOffer.id ? "Wird gesichert..." : `${selectedOffer.rewardPoints} Blitze sichern`}
                      <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GrazSportsGallery;
