/**
 * Reportli AI — Composio OAuth Callback Worker
 *
 * Composio callback:
 * GET /
 * ?userId=...
 * &toolId=gmail
 * &status=success
 * &connected_account_id=ca_...
 *
 * Required Cloudflare secrets:
 * SUPABASE_URL
 * SUPABASE_SERVICE_ROLE_KEY
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --------------------------------------------------
    // 1. Only allow GET
    // --------------------------------------------------

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          "Content-Type": "text/plain"
        }
      });
    }

    // --------------------------------------------------
    // 2. Handle favicon so browser doesn't create noise
    // --------------------------------------------------

    if (url.pathname === "/favicon.ico") {
      return new Response(null, {
        status: 204
      });
    }

    // --------------------------------------------------
    // 3. Read Composio callback parameters
    // --------------------------------------------------

    const userId = url.searchParams.get("userId");
    const toolId = url.searchParams.get("toolId");
    const status = url.searchParams.get("status");
    const connectionId = url.searchParams.get(
      "connected_account_id"
    );

    console.log("========== COMPOSIO CALLBACK ==========");

    console.log("Path:", url.pathname);
    console.log("User ID:", userId);
    console.log("Tool ID:", toolId);
    console.log("Status:", status);
    console.log("Connection ID:", connectionId);

    // --------------------------------------------------
    // 4. Validate required parameters
    // --------------------------------------------------

    if (!userId) {
      console.error("Missing userId");

      return redirectError(
        "Missing userId"
      );
    }

    if (!toolId) {
      console.error("Missing toolId");

      return redirectError(
        "Missing toolId"
      );
    }

    if (!connectionId) {
      console.error(
        "Missing connected_account_id"
      );

      return redirectError(
        "Missing connected_account_id"
      );
    }

    // --------------------------------------------------
    // 5. Check OAuth status
    // --------------------------------------------------

    if (status !== "success") {
      console.error(
        "Composio OAuth was not successful:",
        status
      );

      return redirectError(
        "Composio connection was not successful"
      );
    }

    // --------------------------------------------------
    // 6. Allow only Reportli integrations
    // --------------------------------------------------

    const allowedIntegrations = [
      "gmail",
      "reddit",
      "google-calendar",
      "google-meet",
      "apollo",
      "x"
    ];

    if (!allowedIntegrations.includes(toolId)) {
      console.error(
        "Invalid integration:",
        toolId
      );

      return redirectError(
        "Invalid integration"
      );
    }

    // --------------------------------------------------
    // 7. Check Supabase environment variables
    // --------------------------------------------------

    if (!env.SUPABASE_URL) {
      console.error(
        "SUPABASE_URL secret is missing"
      );

      return redirectError(
        "Supabase URL is not configured"
      );
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error(
        "SUPABASE_SERVICE_ROLE_KEY secret is missing"
      );

      return redirectError(
        "Supabase service role key is not configured"
      );
    }

    // --------------------------------------------------
    // 8. Save integration to Supabase
    // --------------------------------------------------

    try {
      const supabaseUrl =
        env.SUPABASE_URL.replace(/\/$/, "");

      const endpoint =
        `${supabaseUrl}/rest/v1/user_integrations` +
        `?on_conflict=user_id,integration_id`;

      const payload = {
        user_id: userId,
        integration_id: toolId,
        connection_id: connectionId,
        status: "connected",
        updated_at: new Date().toISOString()
      };

      console.log(
        "Saving integration:",
        JSON.stringify(payload)
      );

      const supabaseResponse = await fetch(
        endpoint,
        {
          method: "POST",

          headers: {
            "apikey":
              env.SUPABASE_SERVICE_ROLE_KEY,

            "Authorization":
              `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,

            "Content-Type":
              "application/json",

            "Prefer":
              "resolution=merge-duplicates,return=representation"
          },

          body: JSON.stringify(payload)
        }
      );

      const responseText =
        await supabaseResponse.text();

      console.log(
        "Supabase HTTP status:",
        supabaseResponse.status
      );

      console.log(
        "Supabase response:",
        responseText
      );

      // --------------------------------------------------
      // 9. Handle Supabase failure
      // --------------------------------------------------

      if (!supabaseResponse.ok) {
        console.error(
          "Supabase INSERT/UPSERT failed"
        );

        return redirectError(
          "Failed to save integration"
        );
      }

      // --------------------------------------------------
      // 10. Success
      // --------------------------------------------------

      console.log(
        "========================================"
      );

      console.log(
        "INTEGRATION SAVED SUCCESSFULLY"
      );

      console.log(
        "User:",
        userId
      );

      console.log(
        "Integration:",
        toolId
      );

      console.log(
        "Connection:",
        connectionId
      );

      console.log(
        "========================================"
      );

      return Response.redirect(
        "https://reportliai.sbs?integration=connected",
        302
      );

    } catch (error) {
      console.error(
        "Unexpected Worker error:",
        error
      );

      return redirectError(
        "Callback processing failed"
      );
    }
  }
};


/**
 * Redirect user back to Reportli with an error.
 */
function redirectError(message) {
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
