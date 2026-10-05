/**
 * Reportli AI — Composio OAuth Callback Worker
 *
 * Callback URL:
 *
 * GET /
 * ?userId=...
 * &application_id=...
 * &appId=...
 * &applicationId=...
 * &activeAppId=...
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
      url.searchParams.get("userId") ||
      url.searchParams.get("user_id");

    const toolId =
      url.searchParams.get("toolId") ||
      url.searchParams.get("tool_id");

    const status =
      url.searchParams.get("status");

    const connectionId =
      url.searchParams.get("connected_account_id") ||
      url.searchParams.get("connection_id");

    // ==================================================
    // 4. APPLICATION ID
    //
    // Accept every name used by your frontend/API.
    // ==================================================

    const applicationId =
      url.searchParams.get("application_id") ||
      url.searchParams.get("applicationId") ||
      url.searchParams.get("appId") ||
      url.searchParams.get("activeAppId") ||
      url.searchParams.get("active_app_id");

    // ==================================================
    // 5. LOG EVERYTHING
    // ==================================================

    console.log(
      "========== COMPOSIO CALLBACK =========="
    );

    console.log(
      "Full URL:",
      request.url
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

    console.log(
      "========================================"
    );

    // ==================================================
    // 6. VALIDATE USER ID
    // ==================================================

    if (!userId) {
      console.error(
        "❌ Missing userId"
      );

      return redirectError(
        "Missing userId"
      );
    }

    // ==================================================
    // 7. VALIDATE APPLICATION ID
    // ==================================================

    if (!applicationId) {
      console.error(
        "❌ Missing application_id"
      );

      console.error(
        "Received query parameters:"
      );

      for (const [key, value] of url.searchParams.entries()) {
        console.error(
          `${key} = ${value}`
        );
      }

      return redirectError(
        "Missing application_id"
      );
    }

    // ==================================================
    // 8. VALIDATE TOOL ID
    // ==================================================

    if (!toolId) {
      console.error(
        "❌ Missing toolId"
      );

      return redirectError(
        "Missing toolId"
      );
    }

    // ==================================================
    // 9. VALIDATE CONNECTION ID
    // ==================================================

    if (!connectionId) {
      console.error(
        "❌ Missing connected_account_id"
      );

      return redirectError(
        "Missing connected_account_id"
      );
    }

    // ==================================================
    // 10. CHECK OAUTH STATUS
    // ==================================================

    if (status !== "success") {
      console.error(
        "❌ Composio OAuth was not successful:",
        status
      );

      return redirectError(
        "Composio connection was not successful"
      );
    }

    // ==================================================
    // 11. ALLOWED REPORTLI INTEGRATIONS
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
        "❌ Invalid integration:",
        toolId
      );

      return redirectError(
        "Invalid integration"
      );
    }

    // ==================================================
    // 12. CHECK SUPABASE SECRETS
    // ==================================================

    if (!env.SUPABASE_URL) {
      console.error(
        "❌ SUPABASE_URL secret is missing"
      );

      return redirectError(
        "Supabase URL is not configured"
      );
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error(
        "❌ SUPABASE_SERVICE_ROLE_KEY secret is missing"
      );

      return redirectError(
        "Supabase service role key is not configured"
      );
    }

    // ==================================================
    // 13. SAVE INTEGRATION TO SUPABASE
    // ==================================================

    try {
      const supabaseUrl =
        env.SUPABASE_URL.replace(
          /\/$/,
          ""
        );

      // IMPORTANT:
      //
      // Your database constraint must be:
      //
      // UNIQUE(application_id, integration_id)
      //
      const endpoint =
        `${supabaseUrl}/rest/v1/user_integrations` +
        `?on_conflict=application_id,integration_id`;

      // ==================================================
      // 14. CREATE DATABASE PAYLOAD
      // ==================================================

      const payload = {
        user_id: userId,

        application_id: applicationId,

        integration_id: toolId,

        connection_id: connectionId,

        status: "connected",

        updated_at:
          new Date().toISOString()
      };

      console.log(
        "========== SUPABASE UPSERT =========="
      );

      console.log(
        "Payload:",
        JSON.stringify(
          payload,
          null,
          2
        )
      );

      console.log(
        "Endpoint:",
        endpoint
      );

      // ==================================================
      // 15. UPSERT INTO SUPABASE
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

      // ==================================================
      // 16. READ SUPABASE RESPONSE
      // ==================================================

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
      // 17. HANDLE SUPABASE FAILURE
      // ==================================================

      if (!supabaseResponse.ok) {
        console.error(
          "❌ Supabase INSERT/UPSERT failed"
        );

        return redirectError(
          "Failed to save integration"
        );
      }

      // ==================================================
      // 18. SUCCESS
      // ==================================================

      console.log(
        "========================================"
      );

      console.log(
        "✅ INTEGRATION SAVED SUCCESSFULLY"
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
      // 19. REDIRECT BACK TO REPORTLI
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
      // 20. UNEXPECTED ERROR
      // ==================================================

      console.error(
        "❌ Unexpected Worker error:",
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
