import { createFileRoute } from "@tanstack/react-router";
import { checkRateLimit, createLink } from "@/lib/db";
import { getClientMetadata } from "@/lib/user-agent";

export const Route = createFileRoute("/api/v1/shorten")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const clientMeta = getClientMetadata(request.headers);

        // Apply Sliding Window Rate Limiting (30 requests per minute per IP)
        const rateLimit = checkRateLimit(clientMeta.ip, "shorten", 30, 60);
        if (!rateLimit.allowed) {
          return new Response(
            JSON.stringify({
              error: "Rate limit exceeded. Maximum 30 requests per minute.",
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "60",
                "X-RateLimit-Limit": "30",
                "X-RateLimit-Remaining": "0",
              },
            },
          );
        }

        let body: {
          long_url?: string;
          custom_alias?: string;
          expires_at?: string | null;
        };

        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!body.long_url || typeof body.long_url !== "string") {
          return new Response(
            JSON.stringify({ error: "long_url is required and must be a string" }),
            {
              status: 422,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const result = createLink({
          longUrl: body.long_url,
          alias: body.custom_alias,
          expiresAt: body.expires_at,
        });

        if (!result.success) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: result.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        const urlObj = new URL(request.url);
        const protocol =
          request.headers.get("x-forwarded-proto") || urlObj.protocol.replace(":", "");
        const host =
          request.headers.get("x-forwarded-host") || request.headers.get("host") || urlObj.host;
        const shortUrl = `${protocol}://${host}/${result.link.code}`;

        return new Response(
          JSON.stringify({
            short_url: shortUrl,
            code: result.link.code,
            long_url: result.link.longUrl,
            expires_at: result.link.expiresAt,
            created_at: result.link.createdAt,
          }),
          {
            status: 201,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": "30",
              "X-RateLimit-Remaining": String(rateLimit.remaining),
            },
          },
        );
      },
    },
  },
});
