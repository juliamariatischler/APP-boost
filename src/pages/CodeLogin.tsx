import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { toast } from "sonner";
import boostLogo from "@/assets/boost-logo.png";
import { Loader2, ShieldCheck } from "lucide-react";

const CODE_LENGTH = 8;
const VALID = /^[A-HJ-NP-Z2-9]$/;
const CONSENT_KEY = "boost:consent_given";
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

function normalise(char: string): string {
  const c = char.toUpperCase();
  if (c === "O" || c === "0") return "";
  if (c === "I" || c === "1") return "";
  return VALID.test(c) ? c : "";
}

function hasValidConsent(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Date.now() - ts < CONSENT_MAX_AGE_MS;
  } catch {
    return false;
  }
}

function ConsentScreen({ onAccept }: { onAccept: () => void }) {
  const [checkedPrivacy, setCheckedPrivacy] = useState(false);
  const [checkedParental, setCheckedParental] = useState(false);

  const canProceed = checkedPrivacy && checkedParental;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">

        <img src={boostLogo} alt="Boost" className="h-16 w-auto" />

        <div className="flex flex-col items-center gap-2 text-center">
          <ShieldCheck className="h-10 w-10 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">Datenschutz & Einwilligung</h1>
          <p className="text-sm text-muted-foreground">
            Bitte bestätige vor dem Einloggen folgende Punkte:
          </p>
        </div>

        <div className="w-full flex flex-col gap-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checkedPrivacy}
              onChange={e => setCheckedPrivacy(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border accent-primary flex-shrink-0"
            />
            <span className="text-sm text-foreground leading-snug">
              Ich habe die{" "}
              <a
                href="/datenschutz.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Datenschutzerklärung
              </a>{" "}
              gelesen und stimme der Verarbeitung meiner Daten gemäß DSGVO zu.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checkedParental}
              onChange={e => setCheckedParental(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border accent-primary flex-shrink-0"
            />
            <span className="text-sm text-foreground leading-snug">
              Meine Eltern / Erziehungsberechtigten haben ihr Einverständnis zur
              Nutzung dieser App gegeben (Pflicht für Schüler*innen unter 14 Jahren).
            </span>
          </label>
        </div>

        <button
          onClick={() => {
            try {
              localStorage.setItem(CONSENT_KEY, String(Date.now()));
            } catch {
              // storage unavailable — proceed anyway, consent was expressed in UI
            }
            onAccept();
          }}
          disabled={!canProceed}
          className={[
            "w-full h-12 rounded-xl font-semibold text-base",
            "bg-primary text-primary-foreground",
            "transition-opacity",
            canProceed ? "hover:opacity-90" : "opacity-40 cursor-not-allowed",
          ].join(" ")}
        >
          Weiter zum Login
        </button>

        <p className="text-xs text-muted-foreground text-center">
          Diese Einwilligung gilt für ein Jahr und kann jederzeit widerrufen werden.
        </p>
      </div>
    </div>
  );
}

export default function CodeLogin() {
  const navigate   = useNavigate();
  const { login }  = useCodeAuth();
  const [step, setStep]           = useState<"consent" | "code">(() =>
    hasValidConsent() ? "code" : "consent"
  );
  const [digits, setDigits]   = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (step === "code") inputs.current[0]?.focus();
  }, [step]);

  if (step === "consent") {
    return <ConsentScreen onAccept={() => setStep("code")} />;
  }

  const focusNext = (idx: number) => inputs.current[idx + 1]?.focus();
  const focusPrev = (idx: number) => inputs.current[idx - 1]?.focus();

  const handleChange = (idx: number, value: string) => {
    const c = normalise(value.slice(-1));
    if (!c) return;
    const next = [...digits];
    next[idx] = c;
    setDigits(next);
    if (idx < CODE_LENGTH - 1) focusNext(idx);
    else maybeSubmit(next);
  };

  const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[idx]) {
        next[idx] = "";
        setDigits(next);
      } else {
        focusPrev(idx);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusPrev(idx);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusNext(idx);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").toUpperCase().replace(/\s/g, "");
    const filtered: string[] = [];
    for (const ch of pasted) {
      const c = normalise(ch);
      if (c) filtered.push(c);
      if (filtered.length === CODE_LENGTH) break;
    }
    const next = [...digits];
    filtered.forEach((c, i) => { next[i] = c; });
    setDigits(next);
    const nextFocus = Math.min(filtered.length, CODE_LENGTH - 1);
    inputs.current[nextFocus]?.focus();
    if (filtered.length === CODE_LENGTH) maybeSubmit(next);
  };

  const maybeSubmit = (d: string[]) => {
    if (d.every(c => c !== "")) submit(d.join(""));
  };

  const submit = async (code: string) => {
    setLoading(true);
    try {
      const session = await login(code);
      toast.success(
        session.user_type === "student"
          ? `Hallo ${session.display_name}, bereit für deine nächste Challenge?`
          : `Willkommen, ${session.display_name}!`
      );
      navigate(session.user_type === "student" ? "/student-home" : "/teacher-home");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast.error(msg);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitButton = () => {
    const code = digits.join("");
    if (code.length < CODE_LENGTH) {
      toast.error("Bitte gib deinen vollständigen 8-stelligen Code ein.");
      return;
    }
    submit(code);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        <img src={boostLogo} alt="Boost" className="h-16 w-auto" />

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Gib deinen Code ein</h1>
          <p className="text-sm text-muted-foreground">
            Dein persönlicher 8-stelliger Login-Code
          </p>
        </div>

        <div className="flex gap-2" role="group" aria-label="Login-Code Eingabe">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el; }}
              type="text"
              inputMode="text"
              maxLength={1}
              value={d}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
              aria-label={`Zeichen ${i + 1}`}
              className={[
                "w-10 h-12 text-center text-lg font-bold uppercase",
                "rounded-lg border-2 bg-card",
                "focus:outline-none focus:border-primary",
                "transition-colors",
                d ? "border-primary text-foreground" : "border-border text-muted-foreground",
                loading ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
              onFocus={e => e.target.select()}
            />
          ))}
        </div>

        <button
          onClick={handleSubmitButton}
          disabled={loading || digits.some(d => !d)}
          className={[
            "w-full h-12 rounded-xl font-semibold text-base",
            "bg-primary text-primary-foreground",
            "transition-opacity",
            loading || digits.some(d => !d) ? "opacity-50 cursor-not-allowed" : "hover:opacity-90",
          ].join(" ")}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Anmelden…
            </span>
          ) : (
            "Anmelden"
          )}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          Deinen Code bekommst du von deiner Lehrkraft.
        </p>
      </div>
    </div>
  );
}
