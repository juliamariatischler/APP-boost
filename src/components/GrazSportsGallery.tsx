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
import { ExternalLink, MapPin } from "lucide-react";

type SportOffer = {
  id: string;
  sport: string;
  image: string;
  club: string;
  location: string;
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
    summary: "Techniktraining und Team-Probetraining für Einsteiger:innen.",
    details:
      "Du lernst Passspiel, Ballkontrolle und bekommst einen Einblick ins Vereinstraining. Optimal für alle, die Fußball in der Nähe von Graz ausprobieren wollen.",
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
    summary: "Erstes Football-Training mit Basics zu Technik, Positionen und Sicherheit.",
    details:
      "Beim Tryout der Graz Giants bekommst du eine Einführung in Tackling-Basics, Laufwege und Teamplay. Es sind regelmäßig Einstiegsangebote für neue Spieler:innen verfügbar.",
    websiteUrl: "https://www.grazgiants.at/",
    bookingUrl: "https://www.grazgiants.at/",
  },
  {
    id: "handball-graz",
    sport: "Handball",
    image: "/tryit-handball.svg",
    club: "HSG Holding Graz",
    location: "Graz",
    summary: "Schnuppertraining mit Wurftechnik, Koordination und Spielpraxis.",
    details:
      "Du probierst verschiedene Handball-Stationen aus und trainierst in einer Gruppe mit Altersfokus. Perfekt, wenn du eine schnelle Teamsportart kennenlernen willst.",
    websiteUrl: "https://www.hsggraz.at/",
    bookingUrl: "https://www.hsggraz.at/",
  },
  {
    id: "volleyball-graz",
    sport: "Volleyball",
    image: "/tryit-volleyball.svg",
    club: "UVC Graz",
    location: "Graz",
    summary: "Schnuppertraining mit Aufschlag, Annahme und Teamspiel.",
    details:
      "Du trainierst die Volleyball-Grundlagen mit Coach-Betreuung und steigst direkt in einfache Spielsituationen ein. Ideal zum Reinschnuppern in den Teamsport.",
    websiteUrl: "https://www.uvcgraz.at/",
    bookingUrl: "https://www.uvcgraz.at/",
  },
  {
    id: "tennis-graz",
    sport: "Tennis",
    image: "/tryit-tennis.svg",
    club: "Grazer Tennis Club",
    location: "Graz",
    summary: "Einstiegstraining zu Vorhand, Rückhand und Aufschlag.",
    details:
      "Beim Probetraining lernst du Schlagtechnik, Bewegung am Platz und kurze Matchformen kennen. Schläger können meist vor Ort ausgeliehen werden.",
    websiteUrl: "https://www.google.com/search?q=Grazer+Tennis+Club",
    bookingUrl: "https://www.google.com/search?q=Grazer+Tennis+Club+Probetraining",
  },
  {
    id: "judo-graz",
    sport: "Judo",
    image: "/tryit-judo.svg",
    club: "Judo Club Graz",
    location: "Graz",
    summary: "Sicher fallen, erste Wurftechniken und Partnerübungen.",
    details:
      "Im Judo-Schnuppertraining lernst du kontrollierte Bewegungen, Respekt im Dojo und grundlegende Techniken. Geeignet für Anfänger:innen.",
    websiteUrl: "https://www.google.com/search?q=Judo+Club+Graz",
    bookingUrl: "https://www.google.com/search?q=Judo+Club+Graz+Schnuppertraining",
  },
  {
    id: "basketball-graz",
    sport: "Basketball",
    image: "/tryit-basketball.svg",
    club: "UBSC Graz",
    location: "Graz",
    summary: "Dribbling, Wurf und schnelles Teamplay im Probetraining.",
    details:
      "Du bekommst eine strukturierte Einführung in die Basketball-Basics und kannst direkt in kleine Spielformen einsteigen.",
    websiteUrl: "https://www.ubscgraz.at/",
    bookingUrl: "https://www.ubscgraz.at/",
  },
  {
    id: "swimming-graz",
    sport: "Schwimmen",
    image: "/tryit-swimming.svg",
    club: "ATUS Graz Schwimmen",
    location: "Graz",
    summary: "Techniktraining für Wasserlage, Atmung und Kraul-Grundlagen.",
    details:
      "Beim Schwimm-Schnuppertermin arbeitest du an Technik und Ausdauer in kleinen Gruppen. Geeignet für verschiedene Leistungsniveaus.",
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
        Wähle eine Sportart und tippe auf die Karte, um Details und den Link zum Verein
        oder Probetraining zu sehen.
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
                <p className="text-sm text-foreground">{selectedOffer.details}</p>

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
                      Probetraining anfragen
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
