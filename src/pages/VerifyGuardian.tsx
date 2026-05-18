import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import boostLogo from "@/assets/boost-logo.png";

type State = "loading" | "success" | "error";

const VerifyGuardian = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setErrorMsg("Kein gültiger Link.");
      setState("error");
      return;
    }
    // Auto-confirm on page load — no button click needed
    const confirm = async () => {
      setState("loading");
      try {
        const { data, error } = await supabase.functions.invoke("confirm-guardian", {
          body: { token },
        });
        if (error) throw error;
        if (data?.error) {
          setErrorMsg(data.error);
          setState("error");
        } else {
          window.location.href = "https://www.boostschule.at/try-it/eltern-bestaetigung";
        }
      } catch (err) {
        setErrorMsg("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
        setState("error");
      }
    };
    confirm();
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-5">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <img src={boostLogo} alt="BOOST" className="h-12 object-contain" />
        </div>

        <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.10)] p-6 space-y-5">

          {state === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Bitte warten…</p>
            </div>
          )}


          {state === "success" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <h1 className="text-xl font-black text-foreground">Bestätigt! 🎉</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Danke! Dein Kind kann jetzt an dem Sportangebot teilnehmen. Die Bestätigung wurde gespeichert.
              </p>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <XCircle className="h-12 w-12 text-red-400" />
              <h1 className="text-xl font-black text-foreground">Link ungültig</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {errorMsg || "Dieser Link ist nicht mehr gültig. Bitte lass dein Kind einen neuen Link anfordern."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyGuardian;
