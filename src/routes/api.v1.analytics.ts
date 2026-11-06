import { createFileRoute } from "@tanstack/react-router";
import { getWorkspaceAnalytics } from "@/lib/db";

export const Route = createFileRoute("/api/v1/analytics")({
  server: {
    handlers: {
      GET: async () => {
        const stats = getWorkspaceAnalytics(30);
        return new Response(JSON.stringify(stats), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
