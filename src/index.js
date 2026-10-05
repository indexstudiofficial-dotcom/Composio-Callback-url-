/**
 * Reportli AI — Composio OAuth Callback Worker
 *
 * Callback URL:
 *
 * GET /
 * ?userId=...
 * &application_id=...
 * &appId=...
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

    // ==================================================
    // 1. ONLY ALLOW GET
    // ==================================================

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          "Content-Type": "text/plain"
        }
      });
    }

    // ==================================================
    // 2. IGNORE FAVICON
    // ==================================================

    if (url.pathname === "/favicon.ico") {
      return new Response(null, {
        status: 204
      });
    }

    // ==================================================
    // 3. READ COMPOSIO CALLBACK PARAMETERS
    // ==================================================

    const userId =
      url.searchParams.get("userId");

    const applicationId =
      url.searchParams.get("application_id") ||
      url.searchParams.get("appId") ||
      url.searchParams.get("applicationId");

    const toolId =
      url.searchParams.get("toolId");

    const status =
      url.searchParams.get("status");

    const connectionId =
      url.searchParams.get(
        "connected_account_id"
      );

    console.log(
      "========== COMPOSIO CALLBACK =========="
    );

    console.log(
      "Path:",
      url.pathname
    );

    console.log(
      "User ID:",
      userId
    );

    console.log(
      "Application ID:",
      applicationId
    );

    console.log(
      "Tool ID:",
      toolId
    );

    console.log(
      "Status:",
      status
    );

    console.log(
      "Connection ID:",
      connectionId
    );

    // ==================================================
    // 4. VALIDATE USER ID
    // ==================================================

    if (!userId) {
      console.error(
        "Missing userId"
      );

      return redirectError(
        "Missing userId"
      );
    }

    // ==================================================
    // 5. VALIDATE APPLICATION ID
    // ==================================================

    if (!applicationId) {
      console.error(
        "Missing application_id"
      );

      return redirectError(
        "Missing application_id"
      );
    }

    // ==================================================
    // 6. VALIDATE TOOL ID
    // ==================================================

    if (!toolId) {
      console.error(
        "Missing toolId"
      );

      return redirectError(
        "Missing toolId"
      );
    }

    // ==================================================
    // 7. VALIDATE CONNECTION ID
    // ==================================================

    if (!connectionId) {
      console.error(
        "Missing connected_account_id"
      );

      return redirectError(
        "Missing connected_account_id"
      );
    }

    // ==================================================
    // 8. CHECK OAUTH STATUS
    // ==================================================

    if (status !== "success") {
      console.error(
        "Composio OAuth was not successful:",
        status
      );

      return redirectError(
        "Composio connection was not successful"
      );
    }

    // ==================================================
    // 9. ALLOWED REPORTLI INTEGRATIONS
    // ==================================================

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

    // ==================================================
    // 10. CHECK SUPABASE SECRETS
    // ==================================================

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

    // ==================================================
    // 11. SAVE INTEGRATION TO SUPABASE
    // ==================================================

    try {
      const supabaseUrl =
        env.SUPABASE_URL.replace(
          /\/$/,
          ""
        );

      const endpoint =
        `${supabaseUrl}/rest/v1/user_integrations` +
        `?on_conflict=application_id,integration_id`;

      const payload = {
        user_id: userId,
        application_id: applicationId,
        integration_id: toolId,
        connection_id: connectionId,
        status: "connected",
        updated_at: new Date().toISOString()
      };

      console.log(
        "Saving integration:"
      );

      console.log(
        JSON.stringify(
          payload,
          null,
          2
        )
      );

      // ==================================================
      // 12. SUPABASE UPSERT
      // ==================================================

      const supabaseResponse =
        await fetch(
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

            body:
              JSON.stringify(payload)
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

      // ==================================================
      // 13. HANDLE SUPABASE FAILURE
      // ==================================================

      if (!supabaseResponse.ok) {
        console.error(
          "Supabase INSERT/UPSERT failed"
        );

        return redirectError(
          "Failed to save integration"
        );
      }

      // ==================================================
      // 14. SUCCESS LOG
      // ==================================================

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
        "Application:",
        applicationId
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

      // ==================================================
      // 15. REDIRECT BACK TO REPORTLI
      // ==================================================

      const successUrl =
        new URL(
          "https://reportliai.sbs"
        );

      successUrl.searchParams.set(
        "integration",
        "connected"
      );

      successUrl.searchParams.set(
        "application_id",
        applicationId
      );

      successUrl.searchParams.set(
        "tool",
        toolId
      );

      return Response.redirect(
        successUrl.toString(),
        302
      );

    } catch (error) {
      // ==================================================
      // 16. UNEXPECTED ERROR
      // ==================================================

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
 * ======================================================
 * ERROR REDIRECT
 * ======================================================
 */

function redirectError(message) {
  const redirectUrl =
    new URL(
      "https://reportliai.sbs"
    );

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
