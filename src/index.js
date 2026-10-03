/**
 * Reportli AI — Composio OAuth Callback Worker
 *
 * Flow:
 * Composio
 *    ↓
 * /composio-callback
 *    ↓
 * Find connected account
 *    ↓
 * Save to Supabase user_integrations
 *    ↓
 * Redirect to https://reportliai.sbs
 *
 * Required Cloudflare secrets:
 * SUPABASE_URL
 * SUPABASE_SERVICE_ROLE_KEY
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only allow GET callback
    if (url.pathname !== "/composio-callback") {
      return new Response("Not Found", { status: 404 });
    }

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      /**
       * ---------------------------------------------------------
       * 1. Read callback parameters
       * ---------------------------------------------------------
       */

      const userId = url.searchParams.get("user_id");
      const integrationId = url.searchParams.get("integration_id");

      // Composio connected account ID.
      // The exact parameter name depends on your Composio flow.
      const connectionId =
        url.searchParams.get("connection_id") ||
        url.searchParams.get("connected_account_id");

      const accountName =
        url.searchParams.get("account_name") ||
        url.searchParams.get("name") ||
        null;

      const accountEmail =
        url.searchParams.get("account_email") ||
        url.searchParams.get("email") ||
        null;

      /**
       * ---------------------------------------------------------
       * 2. Validate required information
       * ---------------------------------------------------------
       */

      if (!userId) {
        return redirectWithError(
          "Missing user_id",
          env
        );
      }

      if (!integrationId) {
        return redirectWithError(
          "Missing integration_id",
          env
        );
      }

      if (!connectionId) {
        return redirectWithError(
          "Missing Composio connection ID",
          env
        );
      }

      /**
       * ---------------------------------------------------------
       * 3. Validate integration
       * ---------------------------------------------------------
       */

      const allowedIntegrations = [
        "gmail",
        "x",
        "reddit",
        "google-meet"
      ];

      if (!allowedIntegrations.includes(integrationId)) {
        return redirectWithError(
          "Invalid integration",
          env
        );
      }

      /**
       * ---------------------------------------------------------
       * 4. Save to Supabase
       * ---------------------------------------------------------
       */

      const supabaseUrl = env.SUPABASE_URL.replace(/\/$/, "");

      const response = await fetch(
        `${supabaseUrl}/rest/v1/user_integrations?on_conflict=user_id,integration_id`,
        {
          method: "POST",

          headers: {
            "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation"
          },

          body: JSON.stringify({
            user_id: userId,
            integration_id: integrationId,
            connection_id: connectionId,
            account_name: accountName,
            account_email: accountEmail,
            status: "connected",
            updated_at: new Date().toISOString()
          })
        }
      );

      /**
       * ---------------------------------------------------------
       * 5. Check Supabase result
       * ---------------------------------------------------------
       */

      if (!response.ok) {
        const errorText = await response.text();

        console.error(
          "Supabase error:",
          errorText
        );

        return redirectWithError(
          "Failed to save integration",
          env
        );
      }

      /**
       * ---------------------------------------------------------
       * 6. Success
       * ---------------------------------------------------------
       */

      const saved = await response.json();

      console.log(
        "Integration saved successfully:",
        JSON.stringify(saved)
      );

      /**
       * ---------------------------------------------------------
       * 7. Redirect user back to Reportli
       * ---------------------------------------------------------
       */

      return Response.redirect(
        "https://reportliai.sbs?integration=connected",
        302
      );

    } catch (error) {

      console.error(
        "Callback error:",
        error
      );

      return redirectWithError(
        "OAuth callback failed",
        env
      );
    }
  }
};


/**
 * Redirect back to Reportli with an error.
 *
 * Do NOT expose internal errors,
 * Supabase keys, or stack traces.
 */
function redirectWithError(message, env) {

  const redirectUrl =
    new URL("https://reportliai.sbs");

  redirectUrl.searchParams.set(
    "integration",
    "error"
  );

  redirectUrl.searchParams.set(
    "message",
    message
  );

  return Response.redirect(
    redirectUrl.toString(),
    302
  );
  }
