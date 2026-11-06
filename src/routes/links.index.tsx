import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { LinkTable } from "@/components/link-table";
import { ShortenForm } from "@/components/shorten-form";
import { linkStatus, useLinks } from "@/lib/links-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/links/")({
  head: () => ({
    meta: [
      { title: "Links — LinkSnip" },
      {
        name: "description",
        content: "Search, filter and manage every short link in your workspace.",
      },
      { property: "og:title", content: "Links — LinkSnip" },
      {
        property: "og:description",
        content: "Search, filter and manage every short link in your workspace.",
      },
    ],
  }),
  component: LinksPage,
});

const filters = ["all", "active", "expiring", "expired"] as const;

function LinksPage() {
  const links = useLinks();
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof filters)[number]>("all");
  const shown = links.filter((l) => {
    if (f !== "all" && linkStatus(l) !== f) return false;
    const s = q.toLowerCase();
    return (
      !s ||
      l.code.toLowerCase().includes(s) ||
      l.longUrl.toLowerCase().includes(s) ||
      l.title.toLowerCase().includes(s)
    );
  });

  return (
    <AppShell>
      <PageHeader title="Links" description={`${links.length} links in this workspace`} />
      <div className="space-y-6 px-6 py-6 lg:px-10">
        <ShortenForm />
        <section className="panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
            <div className="flex rounded-sm border border-input p-0.5">
              {filters.map((x) => (
                <button
                  key={x}
                  onClick={() => setF(x)}
                  className={cn(
                    "rounded-[2px] px-3 py-1 text-xs capitalize",
                    f === x
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {x}
                </button>
              ))}
            </div>
            <label className="relative">
              <MagnifyingGlass
                size={14}
                className="absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search links"
                aria-label="Search links"
                className="h-8 w-56 rounded-sm border border-input bg-card pr-3 pl-8 text-sm outline-none focus:border-ring"
              />
            </label>
          </div>
          <LinkTable links={shown} />
        </section>
      </div>
    </AppShell>
  );
}
