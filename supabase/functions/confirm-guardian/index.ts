import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token) return new Response("Missing token", { status: 400, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up the verification
    const { data: verification, error: fetchError } = await supabase
      .from("guardian_verifications")
      .select("*")
      .eq("token", token)
      .is("confirmed_at", null)
      .single();

    if (fetchError || !verification) {
      return new Response(
        JSON.stringify({ error: "Link ungültig oder bereits verwendet." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(verification.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Dieser Link ist abgelaufen. Bitte fordere einen neuen an." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as confirmed
    const { error: updateError } = await supabase
      .from("guardian_verifications")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("id", verification.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
