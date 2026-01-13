import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  type?: "confirmation" | "recovery" | "email_change";
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { to, subject, html, type }: EmailRequest = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing RESEND_API_KEY secret" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Send email via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "E-Cell GLA <noreply@ecell-gla.com>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: error }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    console.log(`Email sent successfully to ${to}:`, data);

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
