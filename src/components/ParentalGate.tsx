import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Parental Gate – eine einfache Erwachsenen-Hürde vor Aktionen, die aus der App
 * hinausführen (externe Links, Store, Vereins-Websites). Erfüllt die Google-Play-
 * Families-Anforderung für kinder-zugewandte Apps. Es findet KEINE echte
 * Altersverifikation statt und es werden KEINE Daten gespeichert – die Hürde soll
 * lediglich verhindern, dass jüngere Kinder unbeabsichtigt nach außen navigieren.
 */

type GateResolver = (passed: boolean) => void;

interface ParentalGateContextValue {
  /** Öffnet das Parental Gate und löst mit true auf, wenn die Aufgabe gelöst wurde. */
  requestParentalGate: () => Promise<boolean>;
}

const ParentalGateContext = createContext<ParentalGateContextValue | null>(null);

function buildQuestion() {
  // Zwei einstellige Faktoren (2–9) – für Erwachsene trivial, für sehr junge
  // Kinder eine bewusste Hürde.
  const a = Math.floor(Math.random() * 8) + 2;
  const b = Math.floor(Math.random() * 8) + 2;
  return { a, b, answer: a * b };
}

export function ParentalGateProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState(buildQuestion);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const resolverRef = useRef<GateResolver | null>(null);

  const settle = useCallback((passed: boolean) => {
    resolverRef.current?.(passed);
    resolverRef.current = null;
    setOpen(false);
    setValue("");
    setError(false);
  }, []);

  const requestParentalGate = useCallback(() => {
    setQuestion(buildQuestion());
    setValue("");
    setError(false);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (Number(value.trim()) === question.answer) {
      settle(true);
    } else {
      setError(true);
      setValue("");
      setQuestion(buildQuestion());
    }
  }, [value, question.answer, settle]);

  return (
    <ParentalGateContext.Provider value={{ requestParentalGate }}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Schließen ohne Lösung = abgebrochen.
          if (!next) settle(false);
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Frag einen Erwachsenen</DialogTitle>
            <DialogDescription>
              Dieser Link führt aus der BOOST-App heraus. Bitte lass eine
              erwachsene Person die Aufgabe lösen, um fortzufahren.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-center text-2xl font-black text-foreground">
              {question.a} × {question.b} = ?
            </p>
            <Input
              type="number"
              inputMode="numeric"
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder="Antwort eingeben"
              className="text-center text-lg"
            />
            {error && (
              <p className="text-center text-sm font-semibold text-destructive">
                Leider falsch. Versuch es noch einmal.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => settle(false)}>
              Abbrechen
            </Button>
            <Button className="flex-1" onClick={handleSubmit}>
              Weiter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ParentalGateContext.Provider>
  );
}

export function useParentalGate(): ParentalGateContextValue {
  const ctx = useContext(ParentalGateContext);
  if (!ctx) {
    throw new Error("useParentalGate muss innerhalb von <ParentalGateProvider> verwendet werden");
  }
  return ctx;
}
