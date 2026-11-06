import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { ShortenForm } from "@/components/shorten-form";
import { LinkTable } from "@/components/link-table";
import { BreakdownList, ClicksChart, Stat } from "@/components/charts";
import { linkStatus, useLinks, useWorkspaceAnalytics } from "@/lib/links-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — LinkSnip" },
      {
        name: "description",
        content:
          "Shorten links, set custom aliases and expiry dates, and track every click in one dashboard.",
      },
      { property: "og:title", content: "Overview — LinkSnip" },
      {
        property: "og:description",
        content:
          "Shorten links, set custom aliases and expiry dates, and track every click in one dashboard.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const links = useLinks();
  const workspaceStats = useWorkspaceAnalytics();

  const total = workspaceStats
    ? workspaceStats.totalClicks
    : links.reduce((a, l) => a + l.clicks, 0);
  const active = workspaceStats
    ? workspaceStats.activeCount
    : links.filter((l) => linkStatus(l) !== "expired").length;
  const expired = workspaceStats ? workspaceStats.expiredCount : Math.max(0, links.length - active);
  const last30 = workspaceStats ? workspaceStats.last30DaysClicks : 0;
  const daily = workspaceStats ? workspaceStats.daily : [];
  const referrers = workspaceStats ? workspaceStats.topReferrers : [];
  const top = [...links].sort((x, y) => y.clicks - x.clicks).slice(0, 5);
  const avgClicks = links.length > 0 ? Math.round(total / links.length) : 0;

  return (
    <AppShell>
      <PageHeader title="Overview" description="Workspace activity for the last 30 days" />
      <div className="space-y-6 px-6 py-6 lg:px-10">
        <ShortenForm />

        <section className="panel grid grid-cols-2 divide-x divide-y lg:grid-cols-4 lg:divide-y-0">
          <Stat label="Total clicks" value={total.toLocaleString()} note="All time" />
          <Stat label="Last 30 days" value={last30.toLocaleString()} note="Live SQLite metrics" />
          <Stat label="Active links" value={String(active)} note={`${expired} expired`} />
          <Stat
            label="Avg. clicks / link"
            value={avgClicks.toLocaleString()}
            note="Across all links"
          />
        </section>

        <section className="panel">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-sm font-medium">Clicks per day</h2>
            <span className="eyebrow">Last 30 days</span>
          </div>
          <div className="p-4">
            <ClicksChart data={daily} />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <section className="panel">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="text-sm font-medium">Top links</h2>
              <Link to="/links" className="text-xs text-muted-foreground hover:text-foreground">
                View all
              </Link>
            </div>
            <LinkTable links={top} compact />
          </section>
          <BreakdownList title="Traffic sources" data={referrers} />
        </div>
      </div>
    </AppShell>
  );
}
