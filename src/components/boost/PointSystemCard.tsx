import { BOOST_POINT_RULES } from "@/lib/gamification";

export const PointSystemCard = () => {
  const pointFacts = [
    { label: "1 Wdh. / 1 Sek.", value: `+${BOOST_POINT_RULES.repOrSecond}` },
    { label: "3 Tage in Folge", value: `+${BOOST_POINT_RULES.streak3DaysBonus}` },
    { label: "7 Tage in Folge", value: `+${BOOST_POINT_RULES.streak7DaysBonus}` },
    { label: "Wochen-Quest", value: `+${BOOST_POINT_RULES.weeklyChallengeCompleted}` },
  ];

  return (
    <div className="overflow-hidden rounded-[30px] bg-gradient-primary shadow-[0_22px_60px_rgba(31,224,102,0.24)]">
      <div className="p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex rounded-full bg-black/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
              Punktesystem
            </span>
            <p className="mt-3 text-3xl font-black leading-none text-zinc-950">
              So sammelst du
              <br />
              Blitze
            </p>
          </div>
          <div className="rounded-[24px] bg-black/80 px-4 py-3 text-white">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">Kurz erklärt</p>
            <p className="mt-1 text-lg font-black">Einfach & klar</p>
          </div>
        </div>
      </div>

      <div className="rounded-t-[28px] bg-white/96 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">Blitze</h3>
          <span className="text-xs font-medium text-muted-foreground">Deine wichtigsten Rewards</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {pointFacts.map((fact) => (
            <div key={fact.label} className="rounded-[20px] bg-[#f7f7f1] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{fact.label}</p>
              <p className="mt-1 text-lg font-black text-foreground">{fact.value} ⚡</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
