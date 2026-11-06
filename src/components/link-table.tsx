import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Copy, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { SHORT_DOMAIN, deleteLink, linkStatus, type LinkRecord } from "@/lib/links-store";
import { cn } from "@/lib/utils";

export function StatusTag({ link }: { link: LinkRecord }) {
  const s = linkStatus(link);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "size-1.5 rounded-full",
          s === "active" && "bg-signal",
          s === "expiring" && "bg-warn",
          s === "expired" && "bg-subtle",
        )}
      />
      {s === "active" ? "Active" : s === "expiring" ? "Expiring soon" : "Expired"}
    </span>
  );
}

export function LinkTable({ links, compact = false }: { links: LinkRecord[]; compact?: boolean }) {
  const [domainPrefix, setDomainPrefix] = useState(`${SHORT_DOMAIN}/`);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setDomainPrefix(`${window.location.host}/`);
    }
  }, []);

  if (!links.length) {
    return <p className="px-5 py-10 text-center text-sm text-muted-foreground">No links match.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="eyebrow px-5 py-2.5 font-normal">Short link</th>
            <th className="eyebrow hidden px-3 py-2.5 font-normal lg:table-cell">Destination</th>
            <th className="eyebrow px-3 py-2.5 font-normal">Status</th>
            {!compact && (
              <th className="eyebrow hidden px-3 py-2.5 font-normal md:table-cell">Created</th>
            )}
            <th className="eyebrow px-3 py-2.5 text-right font-normal">Clicks</th>
            {!compact && <th className="w-20 px-5" />}
          </tr>
        </thead>
        <tbody>
          {links.map((l) => (
            <tr key={l.code} className="group border-b last:border-0 hover:bg-muted/50">
              <td className="px-5 py-3">
                <Link
                  to="/links/$code"
                  params={{ code: l.code }}
                  className="font-mono text-[13px] font-medium whitespace-nowrap hover:underline"
                >
                  <span className="text-muted-foreground">{domainPrefix}</span>
                  {l.code}
                </Link>
                <p className="mt-0.5 max-w-[16rem] truncate text-xs text-muted-foreground">
                  {l.title}
                </p>
              </td>
              <td className="hidden max-w-[22rem] truncate px-3 py-3 font-mono text-xs text-muted-foreground lg:table-cell">
                {l.longUrl}
              </td>
              <td className="px-3 py-3">
                <StatusTag link={l} />
              </td>
              {!compact && (
                <td className="hidden px-3 py-3 text-xs text-muted-foreground md:table-cell">
                  {format(new Date(l.createdAt), "d MMM yyyy")}
                </td>
              )}
              <td className="num px-3 py-3 text-right">{l.clicks.toLocaleString()}</td>
              {!compact && (
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      aria-label={`Copy ${l.code}`}
                      onClick={() => {
                        const origin =
                          typeof window !== "undefined"
                            ? window.location.origin
                            : `https://${SHORT_DOMAIN}`;
                        navigator.clipboard?.writeText(`${origin}/${l.code}`).catch(() => {});
                        toast.success("Copied to clipboard");
                      }}
                      className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      aria-label={`Delete ${l.code}`}
                      onClick={async () => {
                        await deleteLink(l.code);
                        toast.success(`Deleted ${l.code}`);
                      }}
                      className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-destructive"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
