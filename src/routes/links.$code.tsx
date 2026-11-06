import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BreakdownList, ClicksChart, Stat } from "@/components/charts";
import { StatusTag } from "@/components/link-table";
import { SHORT_DOMAIN, useLinkDetailAnalytics, useLinks } from "@/lib/links-store";

export const Route = createFileRoute("/links/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.code} analytics — LinkSnip` },
      {
        name: "description",
        content: `Clicks, locations, referrers and devices for ${SHORT_DOMAIN}/${params.code}.`,
      },
      { property: "og:title", content: `${params.code} analytics — LinkSnip` },
      {
        property: "og:description",
        content: `Click analytics for ${SHORT_DOMAIN}/${params.code}.`,
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LinkDetail,
});

function LinkDetail() {
  const { code } = Route.useParams();
  const { link: liveLink, analytics, loading } = useLinkDetailAnalytics(code);
  const storeLink = useLinks().find((l) => l.code === code);
  const link = liveLink || storeLink;
  const [domainPrefix, setDomainPrefix] = useState(`${SHORT_DOMAIN}/`);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDomainPrefix(`${window.location.host}/`);
    }
  }, []);

  if (!link && !loading) {
    return (
      <AppShell>
        <div className="px-10 py-20">
          <p className="eyebrow">Not found</p>
          <h1 className="mt-2 text-xl font-semibold">No link with the code “{code}”</h1>
          <Link to="/links" className="mt-4 inline-block text-sm underline">
            Back to links
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!link) {
    return (
      <AppShell>
        <div className="px-10 py-20">
          <p className="eyebrow">Loading</p>
          <h1 className="mt-2 text-xl font-semibold">Fetching metrics for “{code}”...</h1>
        </div>
      </AppShell>
    );
  }

  const daily = analytics?.daily ?? [];
  const peak = daily.reduce(
    (m, d) => (d.clicks > m.clicks ? d : m),
    daily[0] ?? { date: new Date().toISOString().slice(0, 10), clicks: 0 },
  );

  const countries = analytics?.countries ?? [];
  const referrers = analytics?.referrers ?? [];
  const devices = analytics?.devices ?? [];
  const browsers = analytics?.browsers ?? [];

  return (
    <AppShell>
      <div className="px-6 pt-5 lg:px-10">
        <Link
          to="/links"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={12} /> All links
        </Link>
      </div>
      <PageHeader
        title={
          <span className="font-mono">
            {domainPrefix}
            <span className="text-signal">{link.code}</span>
          </span>
        }
        description={
          <a
            href={link.longUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-[60ch] items-center gap-1 truncate font-mono text-xs hover:text-foreground"
          >
            <span className="truncate">{link.longUrl}</span>{" "}
            <ArrowSquareOut size={12} className="shrink-0" />
          </a>
        }
        actions={<StatusTag link={link} />}
      />
      <div className="space-y-6 px-6 py-6 lg:px-10">
        <section className="panel grid grid-cols-2 divide-x divide-y lg:grid-cols-4 lg:divide-y-0">
          <Stat
            label="Total clicks"
            value={link.clicks.toLocaleString()}
            note="Live SQLite count"
          />
          <Stat
            label="Peak day"
            value={peak.clicks.toLocaleString()}
            note={peak.date ? format(new Date(peak.date), "d MMM") : "N/A"}
          />
          <Stat
            label="Created"
            value={format(new Date(link.createdAt), "d MMM")}
            note={format(new Date(link.createdAt), "yyyy")}
          />
          <Stat
            label="Expires"
            value={link.expiresAt ? format(new Date(link.expiresAt), "d MMM") : "Never"}
            note={
              link.expiresAt ? format(new Date(link.expiresAt), "yyyy, HH:mm") : "No expiry set"
            }
          />
        </section>

        <section className="panel">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-sm font-medium">Clicks per day</h2>
            <span className="eyebrow">Last 30 days (Live clicks)</span>
          </div>
          <div className="p-4">
            <ClicksChart data={daily} />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <BreakdownList title="Locations" data={countries} />
          <BreakdownList title="Referrers" data={referrers} />
          <BreakdownList title="Devices" data={devices} />
          <BreakdownList title="Browsers" data={browsers} />
        </div>
      </div>
    </AppShell>
  );
}
