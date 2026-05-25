import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, redirect_to } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "E-Mail fehlt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirect_to ?? "https://app.boostschule.at/reset-password" },
    });

    if (error || !data?.properties?.action_link) {
      // Don't reveal whether the email exists — always return success
      console.error("generateLink error:", error?.message);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetUrl = data.properties.action_link;
    const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL") ?? "noreply@boostschule.at";

    const emailBody = {
      sender: { name: "BOOST", email: senderEmail },
      to: [{ email }],
      subject: "Passwort zurücksetzen – BOOST",
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <a href="https://www.boostschule.at" style="text-decoration:none">
            <img src="https://srzhxzwxtrcotfhffhww.supabase.co/storage/v1/object/public/assets/boost-logo.png" alt="BOOST" style="height:44px;margin-bottom:24px;display:block" onerror="this.style.display='none';document.getElementById('boost-text').style.display='block'" />
            <span id="boost-text" style="display:none;font-size:24px;font-weight:900;color:#16C653;letter-spacing:-0.5px">BOOST</span>
          </a>
          <h2 style="margin:0 0 12px;color:#111">Passwort zurücksetzen</h2>
          <p style="color:#555;line-height:1.6">
            Du hast eine Anfrage zum Zurücksetzen deines BOOST-Passworts gestellt.
            Klicke auf den Button, um ein neues Passwort zu vergeben:
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;margin:20px 0;padding:14px 28px;background:#16C653;color:#fff;
                    font-weight:700;border-radius:12px;text-decoration:none;font-size:15px">
            Passwort zurücksetzen
          </a>
          <p style="color:#999;font-size:12px;margin-top:8px">
            Dieser Link ist 1 Stunde gültig. Falls du diese E-Mail nicht angefordert hast,
            kannst du sie ignorieren – dein Passwort bleibt unverändert.
          </p>
          <p style="margin-top:20px;padding-top:16px;border-top:1px solid #eee">
            <a href="https://www.boostschule.at" style="color:#16C653;font-size:13px;font-weight:700;text-decoration:none">
              🌐 www.boostschule.at
            </a>
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
      console.error("Brevo error:", emailResult);
    }

    // Always return success to not reveal whether an account exists
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
