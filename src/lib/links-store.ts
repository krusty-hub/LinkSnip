import { useSyncExternalStore, useState, useEffect } from "react";
import {
  type LinkRecord,
  type LinkAnalytics,
  type DailyClick,
  type AnalyticsBreakdown,
  linkStatus,
  SHORT_DOMAIN,
  ALIAS_PATTERN,
  generateBase62Code,
} from "./types";

export {
  linkStatus,
  SHORT_DOMAIN,
  ALIAS_PATTERN,
  type LinkRecord,
  type LinkAnalytics,
  type DailyClick,
  type AnalyticsBreakdown,
};

export function generateCode(length = 7) {
  return generateBase62Code(length);
}

let links: LinkRecord[] = [];
let hasFetched = false;
let isFetching = false;

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const emit = () => listeners.forEach((l) => l());

export async function refreshLinks(): Promise<LinkRecord[]> {
  if (typeof window === "undefined") return links;
  try {
    isFetching = true;
    const res = await fetch("/api/v1/links");
    if (res.ok) {
      const data = (await res.json()) as LinkRecord[];
      links = data;
      hasFetched = true;
      emit();
      return data;
    }
  } catch (err) {
    console.error("Failed to fetch links from server:", err);
  } finally {
    isFetching = false;
  }
  return links;
}

export function useLinks(): LinkRecord[] {
  useEffect(() => {
    if (!hasFetched && !isFetching) {
      refreshLinks();
    }
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => links,
    () => links,
  );
}

export function isAliasTaken(alias: string) {
  return links.some((l) => l.code.toLowerCase() === alias.toLowerCase());
}

export async function addLink(input: {
  longUrl: string;
  alias?: string | undefined;
  expiresAt?: string | null;
}): Promise<LinkRecord> {
  const payload = {
    long_url: input.longUrl.trim(),
    custom_alias: input.alias?.trim() || undefined,
    expires_at: input.expiresAt || null,
  };

  const res = await fetch("/api/v1/shorten", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to create short link");
  }

  const rec: LinkRecord = {
    code: data.code,
    longUrl: data.long_url,
    title: input.longUrl,
    createdAt: data.created_at || new Date().toISOString(),
    expiresAt: data.expires_at || null,
    clicks: 0,
    custom: Boolean(input.alias),
  };

  links = [rec, ...links.filter((l) => l.code !== rec.code)];
  emit();
  refreshLinks(); // background sync full record with derived title
  return rec;
}

export async function deleteLink(code: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/v1/links/${code}`, {
      method: "DELETE",
    });
    if (res.ok) {
      links = links.filter((l) => l.code !== code);
      emit();
      return true;
    }
  } catch (err) {
    console.error("Failed to delete link:", err);
  }
  return false;
}

export type WorkspaceAnalyticsData = {
  totalClicks: number;
  last30DaysClicks: number;
  activeCount: number;
  expiredCount: number;
  daily: DailyClick[];
  topReferrers: AnalyticsBreakdown[];
};

export function useWorkspaceAnalytics(): WorkspaceAnalyticsData | null {
  const [data, setData] = useState<WorkspaceAnalyticsData | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/v1/analytics");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch workspace analytics:", err);
    }
  };

  useEffect(() => {
    fetchStats();
    const unsubscribe = subscribe(() => {
      fetchStats();
    });
    return unsubscribe;
  }, []);

  return data;
}

export function useLinkDetailAnalytics(code: string): {
  link: LinkRecord | null;
  analytics: LinkAnalytics | null;
  loading: boolean;
} {
  const [link, setLink] = useState<LinkRecord | null>(null);
  const [analytics, setAnalytics] = useState<LinkAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/links/${code}`);
        if (res.ok && active) {
          const json = await res.json();
          setLink(json.link);
          setAnalytics(json.analytics);
        }
      } catch (err) {
        console.error("Failed to load link analytics:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [code]);

  return { link, analytics, loading };
}

// Fallback analytics helper for backwards compatibility
export function analyticsFor(seed: string, total: number, days = 30) {
  const now = new Date();
  const daily: DailyClick[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getTime() - (days - 1 - i) * 86400000);
    return {
      date: d.toISOString().slice(0, 10),
      clicks: 0,
    };
  });

  return {
    daily,
    countries: [{ name: "Direct", value: total }],
    referrers: [{ name: "Direct", value: total }],
    devices: [{ name: "Desktop", value: total }],
    browsers: [{ name: "Chrome", value: total }],
  };
}
