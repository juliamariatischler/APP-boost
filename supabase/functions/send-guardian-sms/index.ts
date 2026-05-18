import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const { session_id, guardian_email } = await req.json();
    if (!session_id || !guardian_email) {
      return new Response("Missing session_id or guardian_email", { status: 400, headers: corsHeaders });
    }

    // Generate token
    const tokenBytes = new Uint8Array(24);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Invalidate existing pending verifications
    await supabase
      .from("guardian_verifications")
      .delete()
      .eq("user_id", user.id)
      .eq("session_id", session_id)
      .is("confirmed_at", null);

    // Store token (reusing guardian_phone column for the email)
    const { error: insertError } = await supabase
      .from("guardian_verifications")
      .insert({
        user_id: user.id,
        session_id,
        guardian_phone: guardian_email,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("DB insert error:", JSON.stringify(insertError));
      return new Response(
        JSON.stringify({ error: `Datenbankfehler: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appUrl = Deno.env.get("APP_URL") ?? "https://boostschule.at";
    const confirmUrl = `${appUrl}/verify-guardian?token=${token}`;
    const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL") ?? "noreply@boostschule.at";

    const emailBody = {
      sender: { name: "BOOST", email: senderEmail },
      to: [{ email: guardian_email }],
      subject: "Freigabe für BOOST Try-It-Teilnahme",
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <img src="https://boostschule.at/boost-logo.png" alt="BOOST" style="height:40px;margin-bottom:24px" />
          <h2 style="margin:0 0 12px;color:#111">Freigabe erforderlich 👋</h2>
          <p style="color:#555;line-height:1.6">
            Dein Kind möchte an einem <strong>BOOST Try-It-Angebot</strong> teilnehmen –
            einer kostenlosen Schnupperstunde bei einem Sportverein in Graz.
          </p>
          <p style="color:#555;line-height:1.6">
            Bitte bestätige die Teilnahme mit einem Klick auf den Button:
          </p>
          <a href="${confirmUrl}"
             style="display:inline-block;margin:16px 0;padding:14px 28px;background:#16C653;color:#fff;
                    font-weight:700;border-radius:12px;text-decoration:none;font-size:15px">
            ✓ Teilnahme bestätigen
          </a>
          <p style="color:#999;font-size:12px;margin-top:24px">
            Dieser Link ist 30 Minuten gültig. Falls du diese E-Mail nicht erwartet hast,
            kannst du sie ignorieren.
          </p>
        </div>
      `,
    };

    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": Deno.env.get("BREVO_API_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailBody),
    });

    const emailResult = await emailResponse.text();
    console.log("Brevo response:", emailResponse.status, emailResult);

    if (!emailResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Brevo Fehler ${emailResponse.status}: ${emailResult}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
