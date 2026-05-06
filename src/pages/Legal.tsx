import { FileText, ShieldCheck, Scale } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { TopHeader } from "@/components/TopHeader";

const legalSections = [
  {
    title: "Impressum",
    text: "Angaben zum Anbieter, Kontakt und Verantwortlichkeiten werden hier gebuendelt.",
    icon: FileText,
  },
  {
    title: "Datenschutz",
    text: "Informationen zur Verarbeitung von Profil-, Aktivitaets- und App-Daten.",
    icon: ShieldCheck,
  },
  {
    title: "Nutzungsbedingungen",
    text: "Regeln fuer die Nutzung von BOOST, Challenges, Rewards und Klassenfunktionen.",
    icon: Scale,
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
                Hier findest du die rechtlichen Bereiche der BOOST App.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {legalSections.map((section) => {
              const Icon = section.icon;
              return (
                <div
                  key={section.title}
                  className="rounded-[20px] border border-black/5 bg-white px-4 py-3 shadow-[0_10px_22px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.72)]"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-bold text-foreground">{section.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{section.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default Legal;
