import { createFileRoute } from "@tanstack/react-router";
import { getLinkByCode, getLinkAnalytics, deleteLink } from "@/lib/db";

export const Route = createFileRoute("/api/v1/links/$code")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const link = getLinkByCode(params.code);
        if (!link) {
          return new Response(JSON.stringify({ error: "Link not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        const analytics = getLinkAnalytics(params.code, 30);
        return new Response(JSON.stringify({ link, analytics }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      DELETE: async ({ params }) => {
        const deleted = deleteLink(params.code);
        if (!deleted) {
          return new Response(JSON.stringify({ error: "Link not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true, deletedCode: params.code }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
