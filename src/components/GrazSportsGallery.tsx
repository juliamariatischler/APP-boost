import { useMemo, useState, useEffect } from "react";
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
import { ArrowLeft, Calendar, CheckCircle2, Clock, ExternalLink, Loader2, MapPin, Users, Zap } from "lucide-react";
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
  trialAvailable: boolean;
  trialInfo: string;
  contactPhone?: string;
  contactEmail?: string;
};

type OfferFilter = "all" | "Probetraining" | "Kurs";

const TRIAL_STATUS = "Probetraining verfügbar";

const offers: SportOffer[] = [
  {
    id: "soccer-kainbach",
    sport: "Fußball",
    image: "/tryit-football.svg",
    club: "ESK Graz",
    federation: "ASKÖ",
    location: "Kainbach bei Graz",
    address: "ASKÖ Stadion Eggenberg, Schloßstraße 20, 8020 Graz",
    dateLabel: "Sonntags",
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
    websiteUrl: "https://www.eskgraz.at",
    bookingUrl: "https://www.eskgraz.at",
    trialAvailable: true,
    trialInfo: "Für genaue Termine bitte beim Verein anrufen.",
    contactPhone: "0676/889 44 80 44",
    contactEmail: "office@eskgraz.at",
  },
  {
    id: "football-giants",
    sport: "American Football",
    image: "/tryit-american-football.svg",
    club: "Graz Giants",
    federation: "ASKÖ",
    location: "Graz",
    address: "Weinzöttlstraße 16, 8054 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "8 bis 15 Jahre",
    meetingPoint: "Treffpunkt beim Vereinsgebäude 10 Minuten vorher",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "American Football mit Teamplay, Taktik und explosiver Athletik.",
    details:
      "Die Graz Giants sind einer der erfolgreichsten American-Football-Vereine Österreichs. Im Probetraining lernst du Wurftechnik, Laufspiel und Teamtaktik in einem motivierenden Umfeld. Sportschuhe und Trinkflasche reichen für den Einstieg.",
    imageHeadline: "Volle Kraft voraus",
    imageSubline: "Probetraining mit Taktik, Teamgeist und echtem Gameday-Feeling.",
    websiteUrl: "https://www.grazgiants.at/",
    bookingUrl: "https://www.grazgiants.at/",
    trialAvailable: true,
    trialInfo: "Probetraining jederzeit nach Vereinbarung möglich.",
    contactPhone: "0660/3217248",
    contactEmail: "office@grazgiants.at",
  },
  {
    id: "handball-graz",
    sport: "Handball",
    image: "/tryit-handball.svg",
    club: "ASKÖ Handball Graz",
    federation: "ASKÖ",
    location: "Graz",
    address: "ASKÖ Stadion Eggenberg, Schloßstraße 20, 8020 Graz",
    dateLabel: "Freitags",
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
    trialAvailable: true,
    trialInfo: "Für genaue Termine bitte beim Verein anrufen.",
  },
  {
    id: "volleyball-graz",
    sport: "Volleyball",
    image: "/tryit-volleyball.svg",
    club: "UVC Holding Graz",
    federation: "SPORTUNION",
    location: "Graz",
    address: "Pfanghofweg 2b, 8045 Graz",
    dateLabel: "Montags",
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
    trialAvailable: true,
    trialInfo: "Für genaue Termine bitte beim Verein anrufen.",
    contactPhone: "0664/4261804",
    contactEmail: "office@uvcgraz.at",
  },
  {
    id: "tennis-graz",
    sport: "Tennis",
    image: "/tryit-tennis.svg",
    club: "GAK Tennis",
    federation: "ASVÖ",
    location: "Graz",
    address: "Körösistraße 57, 8010 Graz",
    dateLabel: "Sonntags",
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
    websiteUrl: "https://www.gak-tennis.at/",
    bookingUrl: "https://www.gak-tennis.at/",
    trialAvailable: true,
    trialInfo: "Für genaue Termine bitte beim Verein anrufen.",
    contactPhone: "0664/541 41 02",
    contactEmail: "office@gak-tennis.at",
  },
  {
    id: "judo-graz",
    sport: "Judo",
    image: "/tryit-judo.svg",
    club: "ASKÖ-Judoclub Graz",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "7 bis 12 Jahre",
    meetingPoint: "Treffpunkt vor dem Dojo, barfuß erst in der Halle",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Judo-Probetraining mit Respekt, Balance und sichtbarem Fortschritt.",
    details:
      "Der ASKÖ-Judoclub Graz bietet ein offenes Probetraining für Kinder. Im Schnuppertraining lernen Kinder kontrollierte Bewegungen, Respekt im Dojo und erste Techniken. Lange Jogginghose und T-Shirt reichen für den Einstieg.",
    imageHeadline: "Stärke mit Haltung",
    imageSubline: "Probetraining mit Respekt, Mut und Körperkontrolle.",
    websiteUrl: "https://www.askoe-steiermark.at/de/service/vereinssuche",
    bookingUrl: "https://www.askoe-steiermark.at/de/service/vereinssuche",
    trialAvailable: true,
    trialInfo: "Probetraining nach Vereinbarung möglich.",
    contactPhone: "0650/4206694",
    contactEmail: "office@judo-graz.at",
  },
  {
    id: "basketball-graz",
    sport: "Basketball",
    image: "/tryit-basketball.svg",
    club: "Damen-Basketballclub Graz (DBBC)",
    federation: "ASKÖ",
    location: "Graz",
    address: "8047 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "10 bis 13 Jahre",
    meetingPoint: "Treffpunkt im Foyer beim Court A",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Basketball-Probetraining mit Energie, Teamplay und klarer Nachwuchsorientierung.",
    details:
      "Der Damen-Basketballclub Graz (DBBC) ist laut ASKÖ-Steiermark ein Grazer ASKÖ-Basketballverein. Das Probetraining verbindet Dribbling, Wurf und kleine Spielformen mit klarer Trainerstruktur. Hallenschuhe und Trinkflasche genügen.",
    imageHeadline: "Volle Energie auf dem Court",
    imageSubline: "Probetraining mit Tempo, Teamplay und starker Clubidentität.",
    websiteUrl: "https://www.dbbc.at",
    bookingUrl: "https://www.dbbc.at",
    trialAvailable: true,
    trialInfo: "Probetraining jederzeit nach Vereinbarung möglich.",
    contactPhone: "0664/1870654",
    contactEmail: "peter.dudau@dbbc.at",
  },
  {
    id: "swimming-graz",
    sport: "Fechten",
    image: "/tryit-swimming.svg",
    club: "Steirischer Landesfechtclub Graz",
    federation: "ASVÖ",
    location: "Graz",
    address: "8010 Graz",
    dateLabel: "Sonntags",
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
    websiteUrl: "https://www.fechtclub.at/de",
    bookingUrl: "https://www.fechtclub.at/de",
    trialAvailable: true,
    trialInfo: "Für genaue Termine bitte beim Verein anrufen.",
    contactPhone: "0676/845276301",
  },
  // --- Neue Anbieter mit Probetraining verfügbar ---
  {
    id: "aikido-graz",
    sport: "Aikido",
    image: "/tryit-judo.svg",
    club: "ASKÖ-Aikido-Club Graz",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Kinder und Erwachsene",
    meetingPoint: "Nach Vereinbarung",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Aikido – die Kampfkunst der harmonischen Bewegung für alle Altersgruppen.",
    details:
      "Der ASKÖ-Aikido-Club Graz bietet offenes Probetraining für Kinder und Erwachsene. Im Training lernst du fließende Bewegungen, Gleichgewicht und Selbstverteidigung ohne Wettkampf. Bequeme Kleidung genügt für den Einstieg.",
    imageHeadline: "Harmonie und Kraft",
    imageSubline: "Probetraining für Einsteiger aller Altersgruppen.",
    websiteUrl: "mailto:guenther.steger@gmx.at",
    bookingUrl: "mailto:guenther.steger@gmx.at",
    trialAvailable: true,
    trialInfo: "Probetraining für Kinder und Erwachsene nach Vereinbarung.",
    contactPhone: "0664/1012658",
    contactEmail: "guenther.steger@gmx.at",
  },
  {
    id: "badminton-smash",
    sport: "Badminton",
    image: "/tryit-tennis.svg",
    club: "BC Smash Graz",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Alle Altersgruppen",
    meetingPoint: "Nach Vereinbarung",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Badminton mit Speed, Technik und echtem Spielfeeling im Verein.",
    details:
      "Der BC Smash Graz ist ein etablierter Badmintonverein in Graz. Im Probetraining lernst du Grundschläge, Spielpositionen und erste Matches. Schläger können vor Ort ausgeliehen werden.",
    imageHeadline: "Smash in die Saison",
    imageSubline: "Badminton-Probetraining für alle Levels.",
    websiteUrl: "mailto:ruediger_rudolf@yahoo.de",
    bookingUrl: "mailto:ruediger_rudolf@yahoo.de",
    trialAvailable: true,
    trialInfo: "Probetraining nach Vereinbarung möglich.",
    contactPhone: "0650/5809058",
    contactEmail: "ruediger_rudolf@yahoo.de",
  },
  {
    id: "badminton-dropin",
    sport: "Badminton",
    image: "/tryit-tennis.svg",
    club: "Drop In Badminton",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Alle Altersgruppen",
    meetingPoint: "Nach Vereinbarung",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Badminton zum Reinschnuppern – flexibel und unkompliziert.",
    details:
      "Drop In Badminton macht den Einstieg in den Badmintonsport so leicht wie möglich. Ohne komplizierte Anmeldung kannst du einfach vorbeikommen und das Spiel erleben. Einfach anrufen oder schreiben und Termin vereinbaren.",
    imageHeadline: "Einfach reinkommen",
    imageSubline: "Flexibles Badminton-Probetraining ohne große Vorbereitung.",
    websiteUrl: "mailto:schmidt@dropin.at",
    bookingUrl: "mailto:schmidt@dropin.at",
    trialAvailable: true,
    trialInfo: "Flexibles Probetraining nach Vereinbarung.",
    contactPhone: "0699/11881222",
    contactEmail: "schmidt@dropin.at",
  },
  {
    id: "baseball-dirtysox",
    sport: "Baseball",
    image: "/tryit-american-football.svg",
    club: "Baseballverein Dirty Sox",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "November bis März",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Alle Altersgruppen",
    meetingPoint: "Nach Vereinbarung",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Baseball – amerikanischer Teamsport mit viel Technik und Dynamik.",
    details:
      "Der Baseballverein Dirty Sox lädt von November bis März zum Probetraining ein. Du lernst Wurfarm, Schlagtechnik und Spielpositionen im Teamumfeld. Sportschuhe und Motivation reichen für den Start.",
    imageHeadline: "Raus aufs Feld",
    imageSubline: "Baseball-Probetraining von November bis März.",
    websiteUrl: "mailto:baseball@dirtysoxgraz.com",
    bookingUrl: "mailto:baseball@dirtysoxgraz.com",
    trialAvailable: true,
    trialInfo: "Probetraining November bis März nach Vereinbarung.",
    contactPhone: "0650/3006954",
    contactEmail: "baseball@dirtysoxgraz.com",
  },
  {
    id: "cheerleading-giants",
    sport: "Cheerleading",
    image: "/tryit-volleyball.svg",
    club: "GIANTS Graz Cheerleading",
    federation: "ASKÖ",
    location: "Graz",
    address: "Weinzöttlstraße 16, 8054 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Alle Altersgruppen",
    meetingPoint: "Treffpunkt beim Vereinsgebäude",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Cheerleading mit Energie, Synchronität und echtem Teamgeist.",
    details:
      "Die Graz Giants bieten Cheerleading als eigenes Sportangebot. Im Probetraining erlernst du erste Cheer-Choreografien und erlebst die Energie des Teamsports hautnah.",
    imageHeadline: "Power, Tempo, Team",
    imageSubline: "Cheerleading-Probetraining mit den Graz Giants.",
    websiteUrl: "https://www.grazgiants.at/",
    bookingUrl: "https://www.grazgiants.at/",
    trialAvailable: true,
    trialInfo: "Probetraining nach Vereinbarung möglich.",
    contactPhone: "0660/3217248",
    contactEmail: "office@grazgiants.at",
  },
  {
    id: "cheerleading-royals",
    sport: "Cheerleading",
    image: "/tryit-volleyball.svg",
    club: "Graz Cheerleading Royals",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Alle Altersgruppen",
    meetingPoint: "Nach Vereinbarung",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Cheerleading mit Stil, Kraft und mitreißender Teamatmosphäre.",
    details:
      "Die Graz Cheerleading Royals sind ein aufstrebendes Cheerleading-Team in Graz. Im Probetraining zeigst du ersten Einsatz, lernst Grundbewegungen und wirst Teil des Teams.",
    imageHeadline: "Zeig deine Energie",
    imageSubline: "Cheerleading-Probetraining mit den Graz Royals.",
    websiteUrl: "mailto:office@grazroyals.at",
    bookingUrl: "mailto:office@grazroyals.at",
    trialAvailable: true,
    trialInfo: "Probetraining nach Vereinbarung möglich.",
    contactPhone: "0664/1256882",
    contactEmail: "office@grazroyals.at",
  },
  {
    id: "futsal-panthera",
    sport: "Futsal",
    image: "/tryit-football.svg",
    club: "Panthera Graz Futsal Akademie",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Alle Altersgruppen",
    meetingPoint: "Nach Vereinbarung",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Futsal – der Hallenfußball mit noch mehr Technik und Tempo.",
    details:
      "Die Panthera Graz Futsal Akademie bietet intensives Futsal-Probetraining. Futsal wird in der Halle gespielt und fördert Balltechnik, Schnelligkeit und Kreativität besonders stark.",
    imageHeadline: "Futsal: schneller Fußball",
    imageSubline: "Probetraining in der Futsal Akademie Graz.",
    websiteUrl: "mailto:office@panthera-graz.at",
    bookingUrl: "mailto:office@panthera-graz.at",
    trialAvailable: true,
    trialInfo: "Probetraining nach Vereinbarung möglich.",
    contactPhone: "6607245799",
    contactEmail: "office@panthera-graz.at",
  },
  {
    id: "fuenfkampf-atus",
    sport: "Moderner Fünfkampf",
    image: "/tryit-swimming.svg",
    club: "ATUS Graz – Moderner Fünfkampf",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Alle Altersgruppen",
    meetingPoint: "Nach Vereinbarung",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Moderner Fünfkampf – Schwimmen, Reiten, Fechten, Laufen und Schießen in einem.",
    details:
      "ATUS Graz bietet Einblicke in den Modernen Fünfkampf, eine olympische Sportart. Im Probetraining erlebst du die Vielseitigkeit dieser einzigartigen Disziplin aus fünf Teilsportarten.",
    imageHeadline: "Fünf Sportarten, ein Athlet",
    imageSubline: "Moderner Fünfkampf als olympische Herausforderung.",
    websiteUrl: "mailto:familie@kranacher.at",
    bookingUrl: "mailto:familie@kranacher.at",
    trialAvailable: true,
    trialInfo: "Probetraining nach Vereinbarung möglich.",
    contactPhone: "0676/3971712",
    contactEmail: "familie@kranacher.at",
  },
  {
    id: "handball-hcssv",
    sport: "Handball",
    image: "/tryit-handball.svg",
    club: "HC SSV Graz",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Alle Altersgruppen",
    meetingPoint: "Nach Vereinbarung",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Handball – schnelles Spieltempo, starkes Team, großes Gefühl.",
    details:
      "Der HC SSV Graz lädt zum Handball-Probetraining ein. Du lernst Wurfkraft, schnelle Pässe und echten Hallensport mit motivierender Teamatmosphäre.",
    imageHeadline: "Teamplay im Höchstformat",
    imageSubline: "Handball-Probetraining beim HC SSV Graz.",
    websiteUrl: "mailto:hsggraz@aon.at",
    bookingUrl: "mailto:hsggraz@aon.at",
    trialAvailable: true,
    trialInfo: "Probetraining nach Vereinbarung möglich.",
    contactPhone: "0676/6508281",
    contactEmail: "hsggraz@aon.at",
  },
  {
    id: "kickboxen-askoe",
    sport: "Kickboxen",
    image: "/tryit-judo.svg",
    club: "ASKÖ-Kickboxcenter Graz",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Ab 16 Jahren",
    meetingPoint: "Nach Vereinbarung",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Kickboxen – Stärke, Koordination und Selbstsicherheit für Jugendliche ab 16.",
    details:
      "Das ASKÖ-Kickboxcenter Graz bietet strukturiertes Kickbox-Training ab 16 Jahren. Im Probetraining lernst du Grundtechniken, sichere Übungsformen und die Grundlagen des Kampfsports.",
    imageHeadline: "Technik, Kraft, Disziplin",
    imageSubline: "Kickboxen ab 16 Jahren im ASKÖ-Kickboxcenter.",
    websiteUrl: "mailto:peter.jerovsek@kickboxcenter.at",
    bookingUrl: "mailto:peter.jerovsek@kickboxcenter.at",
    trialAvailable: true,
    trialInfo: "Probetraining ab 16 Jahren nach Vereinbarung.",
    contactPhone: "0664/9660066",
    contactEmail: "peter.jerovsek@kickboxcenter.at",
  },
  {
    id: "selbst-tigerdrache",
    sport: "Selbstverteidigung",
    image: "/tryit-judo.svg",
    club: "Tiger und Drache",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Kinder und Erwachsene",
    meetingPoint: "Nach Vereinbarung",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Selbstverteidigung mit östlicher Kampfkunst für Kinder und Erwachsene.",
    details:
      "Tiger und Drache bieten kindgerechte und erwachsenengerechte Selbstverteidigungstechniken. Im Probetraining erlebst du erste Bewegungsformen und lernst Selbstvertrauen aufzubauen.",
    imageHeadline: "Stark für jede Situation",
    imageSubline: "Selbstverteidigung für Kinder und Erwachsene.",
    websiteUrl: "mailto:info@tigerdrache.at",
    bookingUrl: "mailto:info@tigerdrache.at",
    trialAvailable: true,
    trialInfo: "Probetraining für Kinder und Erwachsene nach Vereinbarung.",
    contactPhone: "0650/5678335",
    contactEmail: "info@tigerdrache.at",
  },
  {
    id: "spikeball-roundnet",
    sport: "Spikeball / Roundnet",
    image: "/tryit-volleyball.svg",
    club: "Roundnet Club Graz",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Alle Altersgruppen",
    meetingPoint: "Nach Vereinbarung",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Roundnet (Spikeball) – der dynamische Outdoor-Teamsport für alle.",
    details:
      "Der Roundnet Club Graz bringt einen der angesagtesten Trendsports nach Graz. Im Probetraining lernst du die Grundregeln, Spieltechniken und erlebst viel Spaß und Dynamik.",
    imageHeadline: "Ball ins Netz",
    imageSubline: "Spikeball/Roundnet – der neue Trendsport in Graz.",
    websiteUrl: "mailto:contact@roundnetclubgraz.at",
    bookingUrl: "mailto:contact@roundnetclubgraz.at",
    trialAvailable: true,
    trialInfo: "Probetraining nach Vereinbarung möglich.",
    contactEmail: "contact@roundnetclubgraz.at",
  },
  {
    id: "trampolin-graz",
    sport: "Trampolinturnen",
    image: "/tryit-swimming.svg",
    club: "Trampolin- und Freestyle-Club Graz",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Alle Altersgruppen",
    meetingPoint: "Nach Vereinbarung",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Trampolinturnen und Freestyle – Höhe, Kontrolle und pure Freude.",
    details:
      "Der Trampolin- und Freestyle-Club Graz bietet Einstieg in akrobatischen Sprungsport. Im Probetraining erlebst du erste Sprünge und lernst Grundsicherheit auf dem Trampolin.",
    imageHeadline: "Hoch hinaus mit Stil",
    imageSubline: "Trampolinturnen und Freestyle für alle.",
    websiteUrl: "mailto:hayngu@yahoo.com",
    bookingUrl: "mailto:hayngu@yahoo.com",
    trialAvailable: true,
    trialInfo: "Probetraining nach Vereinbarung möglich.",
    contactPhone: "0650/3907017",
    contactEmail: "hayngu@yahoo.com",
  },
  {
    id: "turnen-abenteuer",
    sport: "Abenteuer- / Zirkusturnen / Parkour",
    image: "/tryit-swimming.svg",
    club: "ATUS Graz – Abenteuer- / Zirkusturnen / Parkour",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Kinder",
    meetingPoint: "Nach Vereinbarung",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Abenteuerturnen, Zirkuskunst und Parkour – kreative Bewegung für neugierige Kinder.",
    details:
      "ATUS Graz bietet eine einzigartige Mischung aus Abenteuerturnen, Zirkuselementen und Parkour-Grundlagen. Im Probetraining entdeckst du kreative Bewegungsformen in einer inspirierenden Umgebung.",
    imageHeadline: "Bewegen wie ein Künstler",
    imageSubline: "Abenteuerturnen, Zirkus und Parkour für Kinder.",
    websiteUrl: "mailto:veronika@sport-abenteuer-kittler.at",
    bookingUrl: "mailto:veronika@sport-abenteuer-kittler.at",
    trialAvailable: true,
    trialInfo: "Probetraining für Kinder nach Vereinbarung.",
    contactPhone: "0681/81429142",
    contactEmail: "veronika@sport-abenteuer-kittler.at",
  },
  {
    id: "turnen-senioren",
    sport: "Seniorenturnen",
    image: "/tryit-swimming.svg",
    club: "ATUS Graz – Seniorenturnen",
    federation: "ASKÖ",
    location: "Graz",
    address: "8020 Graz",
    dateLabel: "Nach Vereinbarung",
    timeLabel: "Nach Vereinbarung",
    ageLabel: "Erwachsene / Senioren",
    meetingPoint: "Nach Vereinbarung",
    rewardLabel: `Nimm teil und sichere dir ${BOOST_POINT_RULES.tryItCompleted} Blitze`,
    rewardPoints: BOOST_POINT_RULES.tryItCompleted,
    formatLabel: "Probetraining",
    summary: "Seniorenturnen – sanfte Bewegung, Gemeinschaft und Wohlbefinden für Erwachsene.",
    details:
      "ATUS Graz bietet altersgerechtes Seniorenturnen mit sanften Übungen für Kraft, Balance und Koordination. Im Probetraining erlernst du einfache Übungen und wirst herzlich im Team aufgenommen.",
    imageHeadline: "Aktiv und fit bleiben",
    imageSubline: "Seniorenturnen für gesundes Wohlbefinden.",
    websiteUrl: "mailto:fit@atus-graz.at",
    bookingUrl: "mailto:fit@atus-graz.at",
    trialAvailable: true,
    trialInfo: "Probetraining für Senioren nach Vereinbarung.",
    contactPhone: "0650/7700424",
    contactEmail: "fit@atus-graz.at",
  },
];

const validateGuardianPhone = (phone: string): boolean =>
  /^\+?[0-9\s\/\-()]{7,20}$/.test(phone.trim());

const GrazSportsGallery = () => {
  const [selectedOffer, setSelectedOffer] = useState<SportOffer | null>(null);
  const [activeFilter, setActiveFilter] = useState<OfferFilter>("all");
  const [claimingOfferId, setClaimingOfferId] = useState<string | null>(null);

  // Inquiry form state
  const [inquiryState, setInquiryState] = useState<"idle" | "form" | "submitting" | "success">("idle");
  const [childName, setChildName] = useState("");
  const [childNameError, setChildNameError] = useState("");
  const [childAge, setChildAge] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianPhoneError, setGuardianPhoneError] = useState("");

  useEffect(() => {
    if (!selectedOffer) {
      setInquiryState("idle");
      setChildName("");
      setChildNameError("");
      setChildAge("");
      setGuardianPhone("");
      setGuardianPhoneError("");
    }
  }, [selectedOffer]);

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

  const handleInquirySubmit = async () => {
    if (!selectedOffer) return;

    let hasError = false;
    if (!childName.trim()) {
      setChildNameError("Bitte gib den Namen des Kindes ein.");
      hasError = true;
    } else {
      setChildNameError("");
    }
    if (!validateGuardianPhone(guardianPhone)) {
      setGuardianPhoneError("Bitte gib eine gültige Telefonnummer eines Erziehungsberechtigten ein.");
      hasError = true;
    } else {
      setGuardianPhoneError("");
    }
    if (hasError) return;

    setInquiryState("submitting");
    try {
      const { error } = await (supabase as any).from("try_it_trial_requests").insert({
        sport_type: selectedOffer.sport,
        provider_name: selectedOffer.club,
        child_name: childName.trim(),
        child_age: childAge ? parseInt(childAge, 10) : null,
        guardian_phone: guardianPhone.trim(),
        trial_training_status: TRIAL_STATUS,
        trial_training_info: selectedOffer.trialInfo,
        request_status: "requested",
      });

      if (error) {
        console.error("Inquiry submit error:", error);
        toast.error("Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.");
        setInquiryState("form");
        return;
      }

      setInquiryState("success");
    } catch (e) {
      console.error("Inquiry submit error:", e);
      toast.error("Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.");
      setInquiryState("form");
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
              {offer.trialAvailable && (
                <div className="absolute left-3 top-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
                    ✓ {TRIAL_STATUS}
                  </span>
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className={getFormatBadgeClassName(offer.formatLabel)}>{offer.formatLabel}</Badge>
                <Badge className={getFederationBadgeClassName(offer.federation)}>{offer.federation}</Badge>
                {offer.trialAvailable && (
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{TRIAL_STATUS}</Badge>
                )}
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
              {offer.trialAvailable && (
                <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  {offer.trialInfo}
                </div>
              )}
              {!offer.trialAvailable && (
                <div className="mb-3 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                  Nächstes Training am {offer.dateLabel.replace(/^[^,]+, /, "")} um{" "}
                  {offer.timeLabel.split(" bis ")[0]} in {offer.location}
                </div>
              )}
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
              {/* --- Inquiry form view --- */}
              {(inquiryState === "form" || inquiryState === "submitting") && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setInquiryState("idle")}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Zurück
                  </button>
                  <DialogHeader>
                    <DialogTitle className="text-xl">Probetraining anfragen</DialogTitle>
                    <DialogDescription>
                      {selectedOffer.club} · {selectedOffer.sport}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    ✓ {TRIAL_STATUS} · {selectedOffer.trialInfo}
                  </div>

                  <div className="space-y-3">
                    {/* child_name */}
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-foreground">
                        Vorname Kind <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={childName}
                        onChange={(e) => { setChildName(e.target.value); if (childNameError) setChildNameError(""); }}
                        placeholder="z. B. Lena"
                        className={cn(
                          "w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors",
                          childNameError
                            ? "border-red-400 bg-red-50 focus:border-red-500"
                            : "border-border bg-background focus:border-primary"
                        )}
                      />
                      {childNameError && (
                        <p className="mt-1 text-xs font-medium text-red-500">{childNameError}</p>
                      )}
                    </div>

                    {/* child_age */}
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-foreground">
                        Alter Kind
                      </label>
                      <input
                        type="number"
                        value={childAge}
                        onChange={(e) => setChildAge(e.target.value)}
                        placeholder="z. B. 10"
                        min={3}
                        max={99}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary"
                      />
                    </div>

                    {/* guardian_phone */}
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-foreground">
                        Telefonnummer Erziehungsberechtigte:r <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={guardianPhone}
                        onChange={(e) => { setGuardianPhone(e.target.value); if (guardianPhoneError) setGuardianPhoneError(""); }}
                        placeholder="z. B. +43 660 1234567"
                        className={cn(
                          "w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors",
                          guardianPhoneError
                            ? "border-red-400 bg-red-50 focus:border-red-500"
                            : "border-border bg-background focus:border-primary"
                        )}
                      />
                      {guardianPhoneError && (
                        <p className="mt-1 text-xs font-medium text-red-500">{guardianPhoneError}</p>
                      )}
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Die Telefonnummer wird verwendet, um die Freigabe durch eine erziehungsberechtigte Person zu ermöglichen.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    disabled={inquiryState === "submitting"}
                    onClick={() => void handleInquirySubmit()}
                    className="w-full"
                  >
                    {inquiryState === "submitting" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Wird gesendet…</>
                    ) : (
                      "Anfragen absenden"
                    )}
                  </Button>
                </div>
              )}

              {/* --- Success view --- */}
              {inquiryState === "success" && (
                <div className="space-y-4 text-center">
                  <div className="flex justify-center">
                    <CheckCircle2 className="h-16 w-16 text-emerald-500" />
                  </div>
                  <DialogHeader>
                    <DialogTitle className="text-xl">Anfrage gesendet!</DialogTitle>
                    <DialogDescription className="text-base">
                      Deine Anfrage beim <span className="font-semibold text-foreground">{selectedOffer.club}</span> wurde erfolgreich übermittelt.
                    </DialogDescription>
                  </DialogHeader>
                  {(selectedOffer.contactPhone || selectedOffer.contactEmail) && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-sm text-left space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Direkt Kontakt aufnehmen</p>
                      {selectedOffer.contactPhone && (
                        <a href={`tel:${selectedOffer.contactPhone}`} className="flex items-center gap-2 font-semibold text-foreground hover:text-primary">
                          <span>📞</span>{selectedOffer.contactPhone}
                        </a>
                      )}
                      {selectedOffer.contactEmail && (
                        <a href={`mailto:${selectedOffer.contactEmail}`} className="flex items-center gap-2 font-semibold text-primary hover:underline">
                          <span>✉️</span>{selectedOffer.contactEmail}
                        </a>
                      )}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedOffer(null)}
                    className="w-full"
                  >
                    Schließen
                  </Button>
                </div>
              )}

              {/* --- Normal offer detail view --- */}
              {inquiryState === "idle" && (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-2xl">{selectedOffer.sport}</DialogTitle>
                    <DialogDescription className="text-base text-muted-foreground">
                      {selectedOffer.club} in {selectedOffer.location}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    {selectedOffer.trialAvailable && (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <div>
                          <span>{TRIAL_STATUS}</span>
                          {selectedOffer.trialInfo && (
                            <span className="ml-1 font-normal text-emerald-600">· {selectedOffer.trialInfo}</span>
                          )}
                        </div>
                      </div>
                    )}

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

                    {/* Contact info */}
                    {(selectedOffer.contactPhone || selectedOffer.contactEmail) && (
                      <Card className="p-3 space-y-1">
                        <p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">Kontakt</p>
                        {selectedOffer.contactPhone && (
                          <a href={`tel:${selectedOffer.contactPhone}`} className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary">
                            <span>📞</span>{selectedOffer.contactPhone}
                          </a>
                        )}
                        {selectedOffer.contactEmail && (
                          <a href={`mailto:${selectedOffer.contactEmail}`} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                            <span>✉️</span>{selectedOffer.contactEmail}
                          </a>
                        )}
                      </Card>
                    )}

                    <Card className="border-primary/20 bg-primary/5 p-4">
                      <p className="text-sm font-semibold text-foreground">
                        {selectedOffer.dateLabel === "Nach Vereinbarung"
                          ? `Termin nach Vereinbarung in ${selectedOffer.location} bei ${selectedOffer.club}.`
                          : selectedOffer.dateLabel.includes(",")
                            ? `Nächstes Training am ${selectedOffer.dateLabel.replace(/^[^,]+, /, "")} um ${selectedOffer.timeLabel.split(" bis ")[0]} Uhr in ${selectedOffer.location} bei ${selectedOffer.club}.`
                            : `Training ${selectedOffer.dateLabel.toLowerCase()} um ${selectedOffer.timeLabel.split(" bis ")[0]} Uhr in ${selectedOffer.location} bei ${selectedOffer.club}.`
                        }
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <RewardPill points={selectedOffer.rewardPoints} />
                        <Badge className={getFormatBadgeClassName(selectedOffer.formatLabel)}>{selectedOffer.formatLabel}</Badge>
                        <Badge className={getFederationBadgeClassName(selectedOffer.federation)}>{selectedOffer.federation}</Badge>
                        {selectedOffer.trialAvailable && (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{TRIAL_STATUS}</Badge>
                        )}
                      </div>
                    </Card>

                    <div className="flex flex-wrap gap-2">
                      {selectedOffer.trialAvailable ? (
                        <>
                          <Button
                            type="button"
                            onClick={() => setInquiryState("form")}
                            className="flex-1 inline-flex items-center gap-2"
                          >
                            Anfragen
                          </Button>
                          <Button asChild variant="outline" className="flex-1">
                            <a
                              href={selectedOffer.websiteUrl}
                              target={selectedOffer.websiteUrl.startsWith("mailto:") ? undefined : "_blank"}
                              rel="noopener noreferrer"
                            >
                              Mehr Infos
                              <ExternalLink className="ml-2 h-4 w-4" />
                            </a>
                          </Button>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GrazSportsGallery;
