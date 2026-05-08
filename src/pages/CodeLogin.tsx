import { useState, useRef, type KeyboardEvent, type ClipboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { toast } from "sonner";
import boostLogo from "@/assets/boost-logo.png";
import { Loader2 } from "lucide-react";

// 8 segments, each one character
const CODE_LENGTH = 8;

// Valid chars: uppercase A-Z and 2-9 (no O, 0, I, 1)
const VALID = /^[A-HJ-NP-Z2-9]$/;

function normalise(char: string): string {
  const c = char.toUpperCase();
  // Replace ambiguous characters
  if (c === "O" || c === "0") return "";
  if (c === "I" || c === "1") return "";
  return VALID.test(c) ? c : "";
}

export default function CodeLogin() {
  const navigate   = useNavigate();
  const { login }  = useCodeAuth();
  const [digits, setDigits]   = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

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
      navigate(session.user_type === "student" ? "/dashboard" : "/teacher-home");
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

        {/* Logo */}
        <img src={boostLogo} alt="Boost" className="h-16 w-auto" />

        {/* Headline */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Gib deinen Code ein</h1>
          <p className="text-sm text-muted-foreground">
            Dein persönlicher 8-stelliger Login-Code
          </p>
        </div>

        {/* Code input */}
        <div className="flex gap-2" role="group" aria-label="Login-Code Eingabe">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el; }}
              type="text"
              inputMode="text"
              maxLength={1}
              value={d}
              autoFocus={i === 0}
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

        {/* Separator for visual grouping (4 + 4) */}
        {/* Handled by gap, but we can add a divider in the middle */}

        {/* Submit */}
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
