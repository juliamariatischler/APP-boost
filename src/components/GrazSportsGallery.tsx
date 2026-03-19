import { useState } from "react";
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
import { Calendar, Clock, ExternalLink, MapPin, Users } from "lucide-react";

type SportOffer = {
  id: string;
  sport: string;
  image: string;
  club: string;
  location: string;
  address: string;
  dateLabel: string;
  timeLabel: string;
  ageLabel: string;
  meetingPoint: string;
  rewardLabel: string;
  summary: string;
  details: string;
  websiteUrl: string;
  bookingUrl: string;
};

const offers: SportOffer[] = [
  {
    id: "soccer-kainbach",
    sport: "Fußball",
    image: "/tryit-football.svg",
    club: "SV Kainbach-Hönigtal",
    location: "Kainbach bei Graz",
    address: "Sportplatz Kainbach, Schaftalstraße 157, 8044 Kainbach",
    dateLabel: "Sonntag, 22.03.2026",
    timeLabel: "15:30 bis 17:00 Uhr",
    ageLabel: "8 bis 12 Jahre",
    meetingPoint: "Treffpunkt 15 Minuten vorher beim Vereinsheim",
    rewardLabel: "Nimm teil und sichere dir 3 Blitze",
    summary: "Techniktraining und Team-Probetraining für Einsteiger:innen.",
    details:
      "Du lernst Passspiel, Ballkontrolle und bekommst einen Einblick ins Vereinstraining. Optimal für alle, die Fußball in der Nähe von Graz ausprobieren wollen. Hallenschuhe oder Noppenschuhe mitnehmen.",
    websiteUrl: "https://www.google.com/search?q=SV+Kainbach-H%C3%B6nigtal",
    bookingUrl:
      "https://www.google.com/search?q=SV+Kainbach-H%C3%B6nigtal+Probetraining",
  },
  {
    id: "football-giants",
    sport: "Football",
    image: "/tryit-american-football.svg",
    club: "Graz Giants",
    location: "Graz",
    address: "ASKÖ Stadion Eggenberg, Schloßstraße 20, 8020 Graz",
    dateLabel: "Montag, 23.03.2026",
    timeLabel: "18:00 bis 19:30 Uhr",
    ageLabel: "11 bis 15 Jahre",
    meetingPoint: "Treffpunkt beim Haupteingang Nord",
    rewardLabel: "Nimm teil und sichere dir 3 Blitze",
    summary: "Erstes Football-Training mit Basics zu Technik, Positionen und Sicherheit.",
    details:
      "Beim Tryout der Graz Giants bekommst du eine Einführung in Tackling-Basics, Laufwege und Teamplay. Sportkleidung und Wasserflasche reichen für den Einstieg.",
    websiteUrl: "https://www.grazgiants.at/",
    bookingUrl: "https://www.grazgiants.at/",
  },
  {
    id: "handball-graz",
    sport: "Handball",
    image: "/tryit-handball.svg",
    club: "HSG Holding Graz",
    location: "Graz",
    address: "Sporthalle Bruckner, Billrothstraße 1, 8010 Graz",
    dateLabel: "Freitag, 20.03.2026",
    timeLabel: "18:00 bis 19:30 Uhr",
    ageLabel: "9 bis 13 Jahre",
    meetingPoint: "Treffpunkt direkt beim Halleneingang links",
    rewardLabel: "Nimm teil und sichere dir 3 Blitze",
    summary: "Schnuppertraining mit Wurftechnik, Koordination und Spielpraxis.",
    details:
      "Du probierst verschiedene Handball-Stationen aus und trainierst in einer Gruppe mit Altersfokus. Perfekt, wenn du eine schnelle Teamsportart kennenlernen willst. Hallenschuhe mit heller Sohle empfohlen.",
    websiteUrl: "https://www.hsggraz.at/",
    bookingUrl: "https://www.hsggraz.at/",
  },
  {
    id: "volleyball-graz",
    sport: "Volleyball",
    image: "/tryit-volleyball.svg",
    club: "UVC Graz",
    location: "Graz",
    address: "Blue Box Arena, Herrgottwiesgasse 260, 8055 Graz",
    dateLabel: "Montag, 23.03.2026",
    timeLabel: "17:15 bis 18:45 Uhr",
    ageLabel: "10 bis 14 Jahre",
    meetingPoint: "Treffpunkt vor Court 2",
    rewardLabel: "Nimm teil und sichere dir 3 Blitze",
    summary: "Schnuppertraining mit Aufschlag, Annahme und Teamspiel.",
    details:
      "Du trainierst die Volleyball-Grundlagen mit Coach-Betreuung und steigst direkt in einfache Spielsituationen ein. Ideal zum Reinschnuppern in den Teamsport. Knieschoner sind optional.",
    websiteUrl: "https://www.uvcgraz.at/",
    bookingUrl: "https://www.uvcgraz.at/",
  },
  {
    id: "tennis-graz",
    sport: "Tennis",
    image: "/tryit-tennis.svg",
    club: "Grazer Tennis Club",
    location: "Graz",
    address: "Grazer Tennis Club, Rosenberggürtel 63, 8010 Graz",
    dateLabel: "Sonntag, 22.03.2026",
    timeLabel: "10:00 bis 11:30 Uhr",
    ageLabel: "8 bis 14 Jahre",
    meetingPoint: "Treffpunkt am Clubhaus beim Platzplan",
    rewardLabel: "Nimm teil und sichere dir 3 Blitze",
    summary: "Einstiegstraining zu Vorhand, Rückhand und Aufschlag.",
    details:
      "Beim Probetraining lernst du Schlagtechnik, Bewegung am Platz und kurze Matchformen kennen. Schläger können vor Ort ausgeliehen werden, Sportschuhe bitte mitbringen.",
    websiteUrl: "https://www.google.com/search?q=Grazer+Tennis+Club",
    bookingUrl: "https://www.google.com/search?q=Grazer+Tennis+Club+Probetraining",
  },
  {
    id: "judo-graz",
    sport: "Judo",
    image: "/tryit-judo.svg",
    club: "Judo Club Graz",
    location: "Graz",
    address: "ASKÖ Halle Eggenberg, Georgigasse 1, 8020 Graz",
    dateLabel: "Dienstag, 24.03.2026",
    timeLabel: "17:00 bis 18:15 Uhr",
    ageLabel: "7 bis 12 Jahre",
    meetingPoint: "Treffpunkt vor dem Dojo, barfuß erst in der Halle",
    rewardLabel: "Nimm teil und sichere dir 3 Blitze",
    summary: "Sicher fallen, erste Wurftechniken und Partnerübungen.",
    details:
      "Im Judo-Schnuppertraining lernst du kontrollierte Bewegungen, Respekt im Dojo und grundlegende Techniken. Lange Jogginghose und T-Shirt reichen für den Einstieg.",
    websiteUrl: "https://www.google.com/search?q=Judo+Club+Graz",
    bookingUrl: "https://www.google.com/search?q=Judo+Club+Graz+Schnuppertraining",
  },
  {
    id: "basketball-graz",
    sport: "Basketball",
    image: "/tryit-basketball.svg",
    club: "UBSC Graz",
    location: "Graz",
    address: "Raiffeisen Sportpark, Hüttenbrennergasse 31, 8010 Graz",
    dateLabel: "Montag, 23.03.2026",
    timeLabel: "16:45 bis 18:00 Uhr",
    ageLabel: "10 bis 13 Jahre",
    meetingPoint: "Treffpunkt im Foyer beim Court A",
    rewardLabel: "Nimm teil und sichere dir 3 Blitze",
    summary: "Dribbling, Wurf und schnelles Teamplay im Probetraining.",
    details:
      "Du bekommst eine strukturierte Einführung in die Basketball-Basics und kannst direkt in kleine Spielformen einsteigen. Hallenschuhe und Trinkflasche genügen.",
    websiteUrl: "https://www.ubscgraz.at/",
    bookingUrl: "https://www.ubscgraz.at/",
  },
  {
    id: "swimming-graz",
    sport: "Schwimmen",
    image: "/tryit-swimming.svg",
    club: "ATUS Graz Schwimmen",
    location: "Graz",
    address: "Auster Sportbad, Janzgasse 21, 8020 Graz",
    dateLabel: "Sonntag, 22.03.2026",
    timeLabel: "09:00 bis 10:15 Uhr",
    ageLabel: "9 bis 14 Jahre",
    meetingPoint: "Treffpunkt beim Drehkreuz im Eingangsbereich",
    rewardLabel: "Nimm teil und sichere dir 3 Blitze",
    summary: "Techniktraining für Wasserlage, Atmung und Kraul-Grundlagen.",
    details:
      "Beim Schwimm-Schnuppertermin arbeitest du an Technik und Ausdauer in kleinen Gruppen. Schwimmbrille und Badekappe empfohlen, Eintritt über die Gruppe organisiert.",
    websiteUrl: "https://www.google.com/search?q=ATUS+Graz+Schwimmen",
    bookingUrl: "https://www.google.com/search?q=ATUS+Graz+Schwimmen+Schnuppertraining",
  },
];

const GrazSportsGallery = () => {
  const [selectedOffer, setSelectedOffer] = useState<SportOffer | null>(null);

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((offer) => (
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
              <div className="absolute inset-x-0 bottom-0 bg-black/65 p-3">
                <p className="text-white text-lg font-semibold leading-tight">{offer.sport}</p>
                <p className="text-white/85 text-xs">{offer.club}</p>
              </div>
            </div>
            <div className="p-4">
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

      <Dialog open={Boolean(selectedOffer)} onOpenChange={(open) => !open && setSelectedOffer(null)}>
        <DialogContent className="sm:max-w-[560px]">
          {selectedOffer && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedOffer.sport}</DialogTitle>
                <DialogDescription className="text-base text-muted-foreground">
                  {selectedOffer.club} in {selectedOffer.location}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <img
                  src={selectedOffer.image}
                  alt={selectedOffer.sport}
                  className="h-48 w-full rounded-md object-cover"
                />
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
                  <p className="mt-1 text-sm text-primary">{selectedOffer.rewardLabel}</p>
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

                  <Button asChild>
                    <a
                      href={selectedOffer.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Nimm teil und sichere dir 3 Blitze
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
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
