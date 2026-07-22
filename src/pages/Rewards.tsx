import { Clock, Gift, Lock } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { TopHeader } from "@/components/TopHeader";
import { Card } from "@/components/ui/card";

const Rewards = () => {
  return (
    <div className="min-h-screen bg-zinc-100 pb-nav-safe text-zinc-900">
      <TopHeader />

      <main className="mx-auto max-w-screen-xl px-4 pb-8 pt-2">
        <section className="relative overflow-hidden rounded-2xl border border-zinc-300 bg-zinc-200 p-5 shadow-sm">
          <div className="absolute inset-0 bg-zinc-400/20" />

          <div className="relative flex min-h-[68vh] flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-zinc-300 bg-zinc-100 text-zinc-500 shadow-inner">
              <Gift className="h-10 w-10" />
            </div>

            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
              <Clock className="h-3.5 w-3.5" />
              Coming soon
            </p>

            <h1 className="text-3xl font-black text-zinc-800">Belohnungen</h1>
            <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-zinc-600">
              Die Belohnungsseite wird gerade vorbereitet und ist bald wieder verfuegbar.
            </p>

            <Card className="mt-8 w-full max-w-sm border-zinc-300 bg-zinc-100/80 p-4 shadow-none">
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-zinc-500">
                <Lock className="h-4 w-4" />
                Rewards sind aktuell deaktiviert
              </div>
            </Card>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default Rewards;
