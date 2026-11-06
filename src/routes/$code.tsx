import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { recordClickAndGetDestination } from "@/lib/db";
import { getClientMetadata } from "@/lib/user-agent";

export const Route = createFileRoute("/$code")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const clientMeta = getClientMetadata(request.headers);
        const result = recordClickAndGetDestination(params.code, clientMeta);

        if (result.status === "found") {
          return new Response(null, {
            status: 302,
            headers: {
              Location: result.destination,
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          });
        }

        if (result.status === "expired") {
          const urlObj = new URL(request.url);
          return new Response(null, {
            status: 302,
            headers: {
              Location: `${urlObj.origin}/expired`,
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          });
        }

        return new Response("404 Not Found: Short code does not exist.", {
          status: 404,
          headers: { "Content-Type": "text/plain" },
        });
      },
    },
  },
  loader: async ({ params }) => {
    // Client-side fallback if routed internally
    if (typeof window !== "undefined") {
      window.location.href = `/${params.code}`;
      return;
    }
  },
});
