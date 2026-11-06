import { createFileRoute } from "@tanstack/react-router";
import { getAllLinks } from "@/lib/db";

export const Route = createFileRoute("/api/v1/links/")({
  server: {
    handlers: {
      GET: async () => {
        const links = getAllLinks();
        return new Response(JSON.stringify(links), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
