import { BOOST_POINT_RULES } from "@/lib/gamification";

export const PointSystemCard = () => {
  const pointFacts = [
    { label: "3 Tage in Folge", value: `+${BOOST_POINT_RULES.streak3DaysBonus}` },
    { label: "7 Tage in Folge", value: `+${BOOST_POINT_RULES.streak7DaysBonus}` },
    { label: "Wochen-Quest", value: `+${BOOST_POINT_RULES.weeklyChallengeCompleted}` },
  ];

  return (
    <div className="overflow-hidden rounded-[24px] bg-gradient-primary shadow-[0_14px_34px_rgba(31,224,102,0.18)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <span className="inline-flex rounded-full bg-black/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
            Punktesystem
          </span>
          <p className="mt-2 text-lg font-black leading-tight text-zinc-950">Blitze sammeln</p>
        </div>
        <span className="rounded-full bg-black/80 px-3 py-1.5 text-[11px] font-black text-white">Kurz erklärt</span>
      </div>

      <div className="rounded-t-[22px] bg-white/96 p-3">
        <div className="grid grid-cols-2 gap-2">
          {pointFacts.map((fact) => (
            <div key={fact.label} className="rounded-[16px] bg-[#f7f7f1] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{fact.label}</p>
              <p className="mt-0.5 text-base font-black text-foreground">{fact.value} ⚡</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
