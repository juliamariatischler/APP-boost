import { ChevronRight, FileText, Scale, ShieldCheck } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { TopHeader } from "@/components/TopHeader";

const imprintIntro = [
  "BOOST ist eine digitale Bewegungs- und Motivationsplattform für Schulen und Schüler/innen. Die Plattform unterstützt Kinder und Jugendliche dabei, Bewegung spielerisch in den Alltag zu integrieren - sowohl im schulischen Kontext als auch eigenständig zu Hause oder gemeinsam mit Freund/innen.",
  "BOOST verbindet kurze Bewegungsaufgaben, Klassen-Challenges, Tagesaufgaben und Belohnungssysteme, um regelmäßige Bewegung einfach, motivierend und alltagstauglich zu machen.",
  "Für Rückfragen, Kooperationen oder Support-Anliegen kannst du uns jederzeit kontaktieren. Bitte beschreibe dein Anliegen möglichst genau, damit wir es rasch und zielgerichtet bearbeiten können.",
];

const imprintDetails = [
  "BOOST",
  "Rafaela Kamper und Julia Tischler",
  "Sonnenweg 10",
  "8301 Hart bei Graz",
  "office@boostschule.at",
  "Geschäftsführer: Rafaela Kamper, Julia Tischler",
  "Unternehmensform: GMBH",
  "Firmenbuchnummer: ATUXXX",
  "Firmenbuchgericht: GRAZ",
  "UID-Nummer: XXX",
  "Inhaltlich verantwortlich: Rafaela Kamper und Julia Tischler",
];

const privacySections = [
  {
    title: "1. Allgemeines",
    paragraphs: [
      "BOOST ist eine digitale Bewegungs- und Motivationsplattform für Schulen, Schüler/innen, Lehrkräfte und Erziehungsberechtigte. Die App unterstützt Kinder und Jugendliche dabei, Bewegung spielerisch und regelmäßig in den Alltag zu integrieren - etwa durch Tagesaufgaben, Klassen-Challenges, Friendquests, Bewegungsübungen, Schritteziele und Belohnungen.",
      "Der Schutz personenbezogener Daten, insbesondere jener von Kindern und Jugendlichen, ist uns besonders wichtig. Wir verarbeiten personenbezogene Daten daher nur, soweit dies für den Betrieb von BOOST erforderlich ist oder eine entsprechende Einwilligung bzw. gesetzliche Grundlage vorliegt.",
      "Verantwortlich für die Datenverarbeitung ist BOOST, Rafaela Kamper und Julia Tischler, Sonnenweg 10, 8301 Hart bei Graz, office@boostschule.at.",
      "Geschäftsführer: Rafaela Kamper, Julia Tischler. Unternehmensform: GMBH. Firmenbuchnummer: ATUXXX. Firmenbuchgericht: GRAZ. UID-Nummer: XXX. Inhaltlich verantwortlich: Rafaela Kamper und Julia Tischler.",
      "Für Datenschutzanfragen erreichst du uns unter office@boostschule.at.",
    ],
  },
  {
    title: "2. Welche Daten verarbeitet BOOST?",
    paragraphs: [
      "BOOST folgt dem Grundsatz der Datensparsamkeit. Wir erheben nur jene Daten, die für die Nutzung der App, die Durchführung der Challenges, die Verwaltung durch Schulen und die Sicherheit der Plattform notwendig sind.",
      "Daten von Schüler/innen können insbesondere Vorname, Klasse, Schule, anonymer oder pseudonymer Nutzer-Code, Avatar oder Profilfigur, Challenge-Teilnahmen, Punkte, Blitze, Abzeichen, Belohnungen, Schrittzahlen oder Bewegungsdaten, absolvierte Übungen, Team-, Klassen- oder Schulzugehörigkeit sowie technische Nutzungsdaten umfassen.",
      "Die Anmeldung von Schüler/innen erfolgt vorrangig über einen Code, der über Sportlehrer/innen weitergegeben wird und einer Schule und Klasse zugeordnet ist. In diesem Fall wird keine E-Mail-Adresse des Kindes benötigt. Alternativ kann eine Registrierung mit E-Mail-Adresse, Passwort und Altersangabe erfolgen; in diesem Fall werden diese Daten zur Konto-Verwaltung verarbeitet. Bei Kindern unter 14 Jahren setzt eine solche Registrierung die Zustimmung der Erziehungsberechtigten voraus.",
      "Bei Lehrkräften können insbesondere Vorname, Nachname, Schule, zugeordnete Klassen, Login-Code oder Zugangsdaten, E-Mail-Adresse, Informationen zur Verwaltung von Klassen, Challenges und Auswertungen sowie Support- und Kommunikationsdaten verarbeitet werden.",
      "Soweit BOOST Funktionen wie Try It enthält, bei denen eine Zustimmung oder Information der Erziehungsberechtigten erforderlich ist, können insbesondere Name, E-Mail-Adresse, Telefonnummer, Zustimmungen zur Nutzung der App oder bestimmter Funktionen sowie Kommunikation zu Teilnahme, Datenschutz, Support oder Vereins-/Schnupperangeboten verarbeitet werden.",
      "BOOST kann Bewegungsdaten wie Schritte, aktive Minuten oder absolvierte Übungen verarbeiten, um Challenges zu bewerten, Fortschritte sichtbar zu machen und Punkte bzw. Blitze zu vergeben.",
      "Auf iOS kann die Schrittzahl aus Apple Health gelesen werden; auf Android wird sie über den Schrittzähler-Sensor des Geräts ermittelt. Dies erfolgt nur, wenn die entsprechende Berechtigung am Gerät erteilt wurde. Die Berechtigung kann jederzeit in den Geräteeinstellungen widerrufen werden.",
      "BOOST verarbeitet keine medizinischen Diagnosen und erstellt keine Gesundheitsprofile. Die App dient der Motivation zu Bewegung und ersetzt keine medizinische Beratung.",
      "Funktionen zur Übungserkennung über die Kamera verarbeiten Bewegungen direkt auf dem Gerät. Dabei werden keine Videos gespeichert oder für Externe ersichtlich.",
      "Bei der Nutzung der App können technische Daten wie IP-Adresse, Geräteinformationen, Betriebssystem, App-Version, Nutzungszeitpunkt, Fehler- und Absturzberichte, Serverprotokolle und Sicherheitsereignisse verarbeitet werden.",
    ],
  },
  {
    title: "3. Wofür verwendet BOOST die Daten?",
    paragraphs: [
      "Die Daten werden insbesondere zur Bereitstellung der App, Anmeldung und Zuordnung zu Schule, Klasse oder Gruppe, Durchführung von Tagesaufgaben, Klassen-Challenges und Friendquests, Vergabe von Punkten, Blitzen, Abzeichen und Belohnungen, Darstellung von Fortschritten, Verwaltung durch Lehrkräfte und Schulen, Information von Erziehungsberechtigten, technischem Betrieb, Sicherheit, Fehlerbehebung, Verbesserung der App, Support und Erfüllung gesetzlicher Pflichten verarbeitet.",
      "BOOST verwendet Daten von Kindern nicht für personalisierte Werbung.",
    ],
  },
  {
    title: "4. Rechtsgrundlagen der Verarbeitung",
    paragraphs: [
      "Die Verarbeitung personenbezogener Daten erfolgt je nach Funktion auf Basis von Art. 6 Abs. 1 lit. b DSGVO, wenn sie zur Bereitstellung der App oder zur Durchführung eines Vertrags bzw. vorvertraglicher Maßnahmen erforderlich ist.",
      "Weitere Rechtsgrundlagen können Art. 6 Abs. 1 lit. a DSGVO bei Einwilligungen, Art. 6 Abs. 1 lit. c DSGVO bei gesetzlichen Verpflichtungen und Art. 6 Abs. 1 lit. f DSGVO bei berechtigten Interessen wie IT-Sicherheit, Missbrauchsprävention, Fehlerbehebung und Verbesserung der App sein.",
      "Soweit besondere Kategorien personenbezogener Daten betroffen sein könnten, erfolgt die Verarbeitung nur, wenn eine passende Rechtsgrundlage nach Art. 9 DSGVO vorliegt.",
      "Bei Kindern unter 14 Jahren wird eine erforderliche Einwilligung grundsätzlich durch die Erziehungsberechtigten oder mit deren Zustimmung eingeholt.",
    ],
  },
  {
    title: "5. Sichtbarkeit innerhalb von BOOST",
    paragraphs: [
      "BOOST ist als schul- und klassenzentrierte Plattform konzipiert. Andere Schüler/innen können je nach Funktion Vorname, Avatar, Punkte, Blitze oder Rang innerhalb einer Challenge, Team- oder Klassenzugehörigkeit, gemeinsam absolvierte Friendquests und Challenge-Erfolge sehen.",
      "Lehrkräfte können jene Daten sehen, die für die Verwaltung ihrer Klassen erforderlich sind, insbesondere Teilnahmestatus, Challenge-Fortschritt, erreichte Punkte oder Blitze, Klassenübersichten und notwendige technische Probleminformationen.",
      "Schulen oder Schuladministrator/innen können nur jene Informationen sehen, die für die Verwaltung der Schule, Klassen und Zugänge erforderlich sind.",
      "BOOST veröffentlicht keine echten Namen, E-Mail-Adressen, Telefonnummern oder genauen Bewegungsprofile von Kindern öffentlich im Internet.",
    ],
  },
  {
    title: "6. Bestenlisten und Challenges",
    paragraphs: [
      "BOOST kann Bestenlisten innerhalb einer Klasse, Schule oder zwischen Schulen anzeigen. Dabei achten wir darauf, Kinder nicht bloßzustellen oder unter Druck zu setzen.",
      "Bestenlisten können daher auf Klassen-, Team- oder Gruppenergebnisse fokussiert sein. Einzelwertungen werden nur dem Nutzer selbst oder von den besten 3 in einem kindgerechten und datensparsamen Rahmen angezeigt.",
      "Bei schulübergreifenden Challenges werden Ergebnisse anonymisiert, pseudonymisiert oder nur aggregiert dargestellt, etwa als Klassen- oder Schulscore.",
    ],
  },
  {
    title: "7. Werden Daten an Dritte weitergegeben?",
    paragraphs: [
      "BOOST gibt personenbezogene Daten nicht an Dritte weiter, außer dies ist für den Betrieb der App erforderlich, gesetzlich vorgeschrieben oder ausdrücklich erlaubt.",
      "Eine Weitergabe kann insbesondere an Hosting- und Serveranbieter, Datenbank- und Authentifizierungsanbieter, technische Dienstleister für App-Betrieb und Fehleranalyse, E-Mail- oder Support-Dienstleister sowie Apple, Google oder vergleichbare Anbieter erfolgen, soweit Bewegungsdaten über deren Schnittstellen eingebunden werden.",
      "Dienstleister werden sorgfältig ausgewählt und, soweit erforderlich, durch Auftragsverarbeitungsverträge gemäß Art. 28 DSGVO verpflichtet.",
      "BOOST verkauft keine personenbezogenen Daten und gibt Daten von Kindern nicht an Werbenetzwerke zur personalisierten Werbung weiter.",
    ],
  },
  {
    title: "8. Serverstandort und internationale Übermittlungen",
    paragraphs: [
      "BOOST ist darauf ausgerichtet, personenbezogene Daten auf Servern innerhalb der Europäischen Union bzw. des Europäischen Wirtschaftsraums zu verarbeiten.",
      "Sollte im Einzelfall eine Übermittlung in ein Drittland erforderlich sein, erfolgt diese nur, wenn die gesetzlichen Voraussetzungen erfüllt sind, etwa durch einen Angemessenheitsbeschluss, Standardvertragsklauseln oder eine andere geeignete Garantie nach der DSGVO.",
    ],
  },
  {
    title: "9. Speicherdauer",
    paragraphs: [
      "Personenbezogene Daten werden nur so lange gespeichert, wie dies für die jeweiligen Zwecke erforderlich ist.",
      "Nutzerdaten von Schüler/innen werden grundsätzlich gelöscht oder anonymisiert, wenn der Account gelöscht wird, die Schule oder Klasse nicht mehr teilnimmt, die Daten für den Zweck nicht mehr erforderlich sind, eine berechtigte Löschanfrage gestellt wurde oder gesetzliche Aufbewahrungsfristen abgelaufen sind.",
      "Technische Protokolldaten werden nur für einen begrenzten Zeitraum gespeichert, soweit sie nicht aus Sicherheitsgründen, zur Fehleranalyse oder zur Erfüllung rechtlicher Pflichten länger benötigt werden.",
      "Anonymisierte Daten können länger gespeichert werden, da sie keinen Rückschluss auf einzelne Personen zulassen.",
    ],
  },
  {
    title: "10. Sicherheit der Daten",
    paragraphs: [
      "BOOST setzt technische und organisatorische Maßnahmen ein, um personenbezogene Daten vor Verlust, Missbrauch, unbefugtem Zugriff und unbefugter Weitergabe zu schützen.",
      "Dazu gehören insbesondere verschlüsselte Datenübertragung, zugriffsbeschränkte Verwaltungssysteme, rollenbasierte Zugriffsrechte, regelmäßige technische Kontrollen, datensparsame Nutzerprofile, Trennung von Schul-, Klassen- und Nutzerbereichen sowie Beschränkung der Einsicht auf berechtigte Personen.",
      "Trotz sorgfältiger Schutzmaßnahmen kann kein digitales System absolute Sicherheit garantieren. Sollte es zu einem relevanten Sicherheitsvorfall kommen, werden wir die gesetzlich vorgesehenen Schritte setzen und betroffene Personen informieren, soweit dies erforderlich ist.",
    ],
  },
  {
    title: "11. Kinder und Jugendliche",
    paragraphs: [
      "BOOST richtet sich besonders an Schüler/innen. Deshalb gelten erhöhte Schutzstandards.",
      "BOOST achtet insbesondere darauf, dass nur notwendige Daten erhoben werden, Kinder keine unnötigen Kontaktdaten angeben müssen, keine personalisierte Werbung an Kinder ausgespielt wird, Profile nicht öffentlich im Internet auffindbar sind, Klassen- und Schulbereiche geschützt sind, Lehrkräfte nur berechtigte Klassen sehen, Bewegungsdaten nur für App-Funktionen verwendet werden und Erziehungsberechtigte einbezogen werden, soweit dies rechtlich oder organisatorisch erforderlich ist.",
      "Bewegungs- und Gesundheitsdaten wie Schrittzahlen werden ausschließlich zur Motivation und für App-Funktionen wie Challenges und Belohnungen verwendet. Sie werden niemals für Entscheidungen über Beschäftigung, Versicherung oder vergleichbare Zwecke herangezogen und nicht ohne Einwilligung in sozialen Netzwerken geteilt.",
      "Bei Kindern unter 14 Jahren werden zustimmungspflichtige Funktionen nur mit Zustimmung der Erziehungsberechtigten ermöglicht.",
    ],
  },
  {
    title: "12. Cookies, Analyse und Tracking",
    paragraphs: [
      "Falls BOOST eine Website betreibt, können technisch notwendige Cookies eingesetzt werden. Diese sind erforderlich, um die Website sicher und funktionsfähig bereitzustellen.",
      "Nicht notwendige Cookies, Analyse- oder Marketingtools werden nur eingesetzt, wenn dafür eine entsprechende Einwilligung vorliegt.",
      "In der App können technische Analysefunktionen verwendet werden, um Fehler zu erkennen, Abstürze zu analysieren und die Stabilität zu verbessern. Dabei wird auf Datensparsamkeit geachtet. Für Kinder werden keine Analysefunktionen eingesetzt, die der personalisierten Werbung dienen.",
    ],
  },
  {
    title: "13. Push-Benachrichtigungen",
    paragraphs: [
      "BOOST kann Push-Benachrichtigungen senden, etwa für Tages-Challenges, Erinnerungen oder wichtige Informationen. Push-Benachrichtigungen werden nur aktiviert, wenn dies am Gerät erlaubt wurde.",
      "Die Berechtigung kann jederzeit in den Einstellungen des Geräts deaktiviert werden.",
    ],
  },
  {
    title: "14. Rechte der betroffenen Personen",
    paragraphs: [
      "Betroffene Personen haben nach der DSGVO insbesondere Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit, Widerspruch, Widerruf einer Einwilligung und Beschwerde bei einer Aufsichtsbehörde.",
      "Eine erteilte Einwilligung kann jederzeit mit Wirkung für die Zukunft widerrufen werden. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt davon unberührt.",
      "Anfragen können an office@boostschule.at gerichtet werden. Zur Bearbeitung einer Anfrage kann es erforderlich sein, die Identität der anfragenden Person zu prüfen.",
    ],
  },
  {
    title: "15. Beschwerde bei der Aufsichtsbehörde",
    paragraphs: [
      "Betroffene Personen haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren.",
      "Für Österreich ist die Österreichische Datenschutzbehörde, Barichgasse 40-42, 1030 Wien, www.dsb.gv.at zuständig.",
    ],
  },
  {
    title: "16. Änderungen dieser Datenschutzerklärung",
    paragraphs: [
      "BOOST kann diese Datenschutzerklärung anpassen, wenn sich die App, technische Funktionen, rechtliche Anforderungen oder Datenverarbeitungen ändern.",
      "Die jeweils aktuelle Version wird in der App oder auf der Website veröffentlicht. Bei wesentlichen Änderungen informieren wir Nutzer/innen, Schulen oder Erziehungsberechtigte in geeigneter Weise.",
    ],
  },
];

const Legal = () => {
  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <TopHeader backTo="/profil" />

      <div className="mx-auto max-w-screen-xl px-4 pb-8">
        <div className="mb-5">
          <p className="text-[18px] font-semibold text-muted-foreground">Profil</p>
          <h1 className="mt-1 text-[2.1rem] font-black leading-none tracking-tight text-primary">
            Rechtliches
          </h1>
        </div>

        <Card className="overflow-hidden rounded-[28px] border border-primary/25 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(240,253,244,0.9)_56%,rgba(255,255,255,0.94)_100%)] p-5 shadow-[0_18px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(31,224,102,0.18)]">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black leading-tight text-foreground">Rechtliche Informationen</h2>
              <p className="mt-2 text-sm font-medium leading-snug text-muted-foreground">
                Impressum und Datenschutzerklärung der BOOST App.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <section className="rounded-[20px] border border-black/5 bg-white px-4 py-4 shadow-[0_10px_22px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.72)]">
              <div className="mb-3 flex items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <h3 className="text-lg font-black text-foreground">Impressum</h3>
              </div>
              <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                {imprintIntro.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <div className="rounded-2xl bg-primary/5 p-3 font-medium text-foreground/80">
                  {imprintDetails.map((detail) => (
                    <p key={detail}>{detail}</p>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[20px] border border-black/5 bg-white px-4 py-4 shadow-[0_10px_22px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.72)]">
              <div className="mb-3 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h3 className="text-lg font-black text-foreground">Datenschutzerklärung BOOST</h3>
                  <p className="text-xs font-semibold text-muted-foreground">Zuletzt aktualisiert: 19.06.2026</p>
                </div>
              </div>
              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                {privacySections.map((section) => (
                  <div key={section.title}>
                    <h4 className="mb-1.5 font-black text-foreground">{section.title}</h4>
                    <div className="space-y-2">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[20px] border border-black/10 bg-white/80 px-4 py-4">
              <a href="/nutzungsbedingungen.html" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 group">
                <Scale className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-bold text-foreground group-hover:text-green-700 transition-colors">Nutzungsbedingungen</p>
                  <p className="mt-1 text-sm text-muted-foreground">Allgemeine Nutzungsbedingungen für die BOOST-App</p>
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-green-700 transition-colors" />
              </a>
            </section>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default Legal;
