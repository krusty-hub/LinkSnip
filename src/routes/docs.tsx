import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "API reference — LinkSnip" },
      {
        name: "description",
        content: "Create short links and resolve redirects with the LinkSnip REST API.",
      },
      { property: "og:title", content: "API reference — LinkSnip" },
      {
        property: "og:description",
        content: "Create short links and resolve redirects with the LinkSnip REST API.",
      },
    ],
  }),
  component: Docs,
});

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-sm border bg-muted px-4 py-3 font-mono text-[12.5px] leading-relaxed">
      {children}
    </pre>
  );
}

function Endpoint({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="flex items-center gap-3 border-b px-5 py-3">
        <span className="rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-medium">
          {method}
        </span>
        <code className="font-mono text-sm">{path}</code>
      </div>
      <div className="space-y-4 p-5 text-sm">{children}</div>
    </section>
  );
}

function Docs() {
  return (
    <AppShell>
      <PageHeader
        title="API reference"
        description="v1 · JSON over HTTPS · Rate limited to 30 req/min per IP"
      />
      <div className="max-w-3xl space-y-6 px-6 py-6 lg:px-10">
        <Endpoint method="POST" path="/api/v1/shorten">
          <p className="text-muted-foreground">
            Creates a shortened link. If <code className="font-mono">custom_alias</code> is omitted,
            a unique 7-character Base62 string is generated.
          </p>
          <p className="eyebrow">Request</p>
          <Code>{`POST /api/v1/shorten HTTP/1.1
Content-Type: application/json

{
  "long_url": "https://react.dev/learn",
  "custom_alias": "react-guide",
  "expires_at": "2026-12-31T23:59:59Z"
}`}</Code>
          <p className="eyebrow">Response · 201 Created</p>
          <Code>{`{
  "short_url": "https://linksnip.io/react-guide",
  "code": "react-guide",
  "long_url": "https://react.dev/learn",
  "expires_at": "2026-12-31T23:59:59Z",
  "created_at": "2026-11-06T12:00:00.000Z"
}`}</Code>
          <p className="text-xs text-muted-foreground">
            Status codes: <span className="font-mono">201</span> Created ·{" "}
            <span className="font-mono">409</span> Alias taken ·{" "}
            <span className="font-mono">422</span> Invalid URL / Expiry in past ·{" "}
            <span className="font-mono">429</span> Rate limit exceeded
          </p>
        </Endpoint>

        <Endpoint method="GET" path="/{short_code}">
          <p className="text-muted-foreground">
            Resolves a short code and responds with{" "}
            <span className="font-mono">HTTP 302 Found</span> redirecting to the destination URL
            while asynchronously logging click analytics.
          </p>
          <p className="eyebrow">Response</p>
          <Code>{`HTTP/1.1 302 Found
Location: https://react.dev/learn
Cache-Control: no-cache, no-store, must-revalidate`}</Code>
          <p className="text-xs text-muted-foreground">
            If the link is expired, automatically redirects to{" "}
            <code className="font-mono">/expired</code>. If unknown, returns{" "}
            <code className="font-mono">404 Not Found</code>.
          </p>
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/links">
          <p className="text-muted-foreground">
            Returns all short links in the workspace with current click counts and metadata.
          </p>
          <p className="eyebrow">Response · 200 OK</p>
          <Code>{`[
  {
    "code": "react-docs",
    "longUrl": "https://react.dev/learn",
    "title": "React Documentation",
    "createdAt": "2026-10-02T09:14:00Z",
    "expiresAt": "2026-12-31T23:59:00Z",
    "custom": true,
    "clicks": 4812
  }
]`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/links/{short_code}">
          <p className="text-muted-foreground">
            Fetches details and real 30-day click metrics (daily clicks, countries, referrers,
            devices, browsers) for a specific link.
          </p>
        </Endpoint>

        <Endpoint method="DELETE" path="/api/v1/links/{short_code}">
          <p className="text-muted-foreground">
            Deletes the link from SQLite and cascades deletion to all associated click records.
          </p>
          <p className="eyebrow">Response · 200 OK</p>
          <Code>{`{ "success": true, "deletedCode": "react-guide" }`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/analytics">
          <p className="text-muted-foreground">
            Returns workspace-wide aggregate statistics, 30-day daily click volumes, and top
            referring domains.
          </p>
        </Endpoint>
      </div>
    </AppShell>
  );
}
