import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CaretDown, Copy, Check } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  ALIAS_PATTERN,
  SHORT_DOMAIN,
  addLink,
  isAliasTaken,
  type LinkRecord,
} from "@/lib/links-store";
import { cn } from "@/lib/utils";

const fieldCls =
  "h-10 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-subtle focus:border-ring focus:ring-2 focus:ring-ring/15";

export function ShortenForm() {
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expires, setExpires] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LinkRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [domainPrefix, setDomainPrefix] = useState(`${SHORT_DOMAIN}/`);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDomainPrefix(`${window.location.host}/`);
    }
  }, []);

  const aliasState = !alias
    ? null
    : !ALIAS_PATTERN.test(alias)
      ? "invalid"
      : isAliasTaken(alias)
        ? "taken"
        : "available";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const u = new URL(url.trim());
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch {
      setError("Enter a full URL starting with http:// or https://");
      return;
    }
    if (alias && aliasState !== "available") {
      setError(
        aliasState === "taken"
          ? "That alias is already in use."
          : "Aliases use 3–32 letters, numbers, - or _.",
      );
      return;
    }
    if (expires && new Date(expires) <= new Date()) {
      setError("Expiry must be in the future.");
      return;
    }

    try {
      setSubmitting(true);
      const rec = await addLink({
        longUrl: url.trim(),
        alias: alias || undefined,
        expiresAt: expires ? new Date(expires).toISOString() : null,
      });
      setResult(rec);
      setCopied(false);
      setUrl("");
      setAlias("");
      setExpires("");
      toast.success("Short link generated!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to shorten link";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(code: string) {
    const origin =
      typeof window !== "undefined" ? window.location.origin : `https://${SHORT_DOMAIN}`;
    const fullUrl = `${origin}/${code}`;
    await navigator.clipboard?.writeText(fullUrl).catch(() => {});
    setCopied(true);
    toast("Copied to clipboard");
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="panel">
      <form onSubmit={submit} className="p-5">
        <label htmlFor="long-url" className="eyebrow">
          Destination URL
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="long-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/my-org/my-project"
            className={cn(fieldCls, "h-11 font-mono text-[13px]")}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-sm bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Shortening..." : "Shorten"} <ArrowRight size={14} weight="bold" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <CaretDown size={12} className={cn("transition-transform", open && "rotate-180")} />
          Custom alias and expiry
        </button>

        {open && (
          <div className="mt-3 grid gap-4 border-t pt-4 sm:grid-cols-2">
            <div>
              <label htmlFor="alias" className="eyebrow">
                Custom alias
              </label>
              <div className="mt-2 flex">
                <span className="inline-flex items-center rounded-l-sm border border-r-0 border-input bg-muted px-3 font-mono text-xs text-muted-foreground">
                  {domainPrefix}
                </span>
                <input
                  id="alias"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="custom-slug"
                  className={cn(fieldCls, "rounded-l-none font-mono text-[13px]")}
                />
              </div>
              <p
                className={cn(
                  "mt-1.5 text-xs",
                  aliasState === "available"
                    ? "text-signal"
                    : aliasState
                      ? "text-destructive"
                      : "text-muted-foreground",
                )}
              >
                {aliasState === "available" && "Available"}
                {aliasState === "taken" && "Already taken"}
                {aliasState === "invalid" && "3–32 characters: letters, numbers, - or _"}
                {!aliasState && "Leave blank for a random 7-character code"}
              </p>
            </div>
            <div>
              <label htmlFor="expires" className="eyebrow">
                Expires
              </label>
              <input
                id="expires"
                type="datetime-local"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
                className={cn(fieldCls, "mt-2")}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                After this, visitors see the expired-link page
              </p>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </form>

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-signal-soft/60 px-5 py-3">
          <div className="min-w-0">
            <p className="font-mono text-sm font-medium">
              {domainPrefix}
              <span className="text-signal">{result.code}</span>
            </p>
            <p className="truncate text-xs text-muted-foreground">{result.longUrl}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => copy(result.code)}
              className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-input bg-card px-3 text-xs font-medium hover:bg-accent"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
            <Link
              to="/links/$code"
              params={{ code: result.code }}
              className="inline-flex h-8 items-center rounded-sm px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              View stats
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
