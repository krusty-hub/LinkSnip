import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { type ClientMetadata } from "./user-agent";
import {
  type LinkRecord,
  type AnalyticsBreakdown,
  type DailyClick,
  type LinkAnalytics,
  SHORT_DOMAIN,
  ALIAS_PATTERN,
  toBase62,
  generateBase62Code,
  linkStatus,
} from "./types";

export {
  type LinkRecord,
  type AnalyticsBreakdown,
  type DailyClick,
  type LinkAnalytics,
  SHORT_DOMAIN,
  ALIAS_PATTERN,
  toBase62,
  generateBase62Code,
  linkStatus,
};

// Persistent Database Directory & Connection
const DATA_DIR = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_PATH = path.join(DATA_DIR, "linksnip.db");

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec("PRAGMA journal_mode = WAL;");
    dbInstance.exec("PRAGMA foreign_keys = ON;");
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      code TEXT PRIMARY KEY,
      long_url TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      custom INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL REFERENCES links(code) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      ip TEXT,
      country TEXT,
      referrer TEXT,
      device TEXT,
      browser TEXT,
      user_agent TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_clicks_code ON clicks(code);
    CREATE INDEX IF NOT EXISTS idx_clicks_timestamp ON clicks(timestamp);
    CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at);

    CREATE TABLE IF NOT EXISTS rate_limits (
      ip TEXT NOT NULL,
      action TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_time ON rate_limits(ip, timestamp);
  `);

  // Seed initial data if database is fresh
  seedInitialData(db);
}

// In-memory cache for low-latency redirection (<5ms)
type CacheEntry = {
  longUrl: string;
  expiresAt: string | null;
};
const redirectCache = new Map<string, CacheEntry>();

export function getCachedRedirect(code: string): CacheEntry | null | "expired" {
  const cached = redirectCache.get(code);
  if (cached) {
    if (cached.expiresAt && new Date(cached.expiresAt).getTime() <= Date.now()) {
      return "expired";
    }
    return cached;
  }
  return null;
}

export function setCachedRedirect(code: string, entry: CacheEntry) {
  // Keep cache bounded
  if (redirectCache.size > 10000) {
    const firstKey = redirectCache.keys().next().value;
    if (firstKey) redirectCache.delete(firstKey);
  }
  redirectCache.set(code, entry);
}

export function invalidateRedirectCache(code: string) {
  redirectCache.delete(code);
}

// Sliding Window Rate Limiter
export function checkRateLimit(
  ip: string,
  action = "shorten",
  limit = 30,
  windowSeconds = 60,
): { allowed: boolean; remaining: number } {
  const db = getDb();
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  // Clean old rate limit entries
  db.prepare("DELETE FROM rate_limits WHERE timestamp < ?").run(windowStart);

  const countRow = db
    .prepare(
      "SELECT COUNT(*) as count FROM rate_limits WHERE ip = ? AND action = ? AND timestamp >= ?",
    )
    .get(ip, action, windowStart) as { count: number };

  const currentCount = countRow ? countRow.count : 0;
  if (currentCount >= limit) {
    return { allowed: false, remaining: 0 };
  }

  db.prepare("INSERT INTO rate_limits (ip, action, timestamp) VALUES (?, ?, ?)").run(
    ip,
    action,
    now,
  );

  return { allowed: true, remaining: limit - currentCount - 1 };
}

// Derive title from long URL
export function deriveTitle(longUrl: string): string {
  try {
    const u = new URL(longUrl);
    const domain = u.hostname.replace(/^www\./, "");
    const pathPart = u.pathname !== "/" ? u.pathname : "";
    return `${domain}${pathPart}`.slice(0, 80);
  } catch {
    return longUrl.slice(0, 80);
  }
}

// Database operations
export function getAllLinks(): LinkRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT code, long_url, title, created_at, expires_at, custom, clicks FROM links ORDER BY created_at DESC",
    )
    .all() as Array<{
    code: string;
    long_url: string;
    title: string;
    created_at: string;
    expires_at: string | null;
    custom: number;
    clicks: number;
  }>;

  return rows.map((r) => ({
    code: r.code,
    longUrl: r.long_url,
    title: r.title,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    custom: Boolean(r.custom),
    clicks: r.clicks,
  }));
}

export function getLinkByCode(code: string): LinkRecord | null {
  const db = getDb();
  const r = db
    .prepare(
      "SELECT code, long_url, title, created_at, expires_at, custom, clicks FROM links WHERE code = ?",
    )
    .get(code) as
    | {
        code: string;
        long_url: string;
        title: string;
        created_at: string;
        expires_at: string | null;
        custom: number;
        clicks: number;
      }
    | undefined;

  if (!r) return null;

  return {
    code: r.code,
    longUrl: r.long_url,
    title: r.title,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    custom: Boolean(r.custom),
    clicks: r.clicks,
  };
}

export function isAliasTaken(alias: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT 1 FROM links WHERE LOWER(code) = LOWER(?)").get(alias);
  return Boolean(row);
}

export function createLink(input: {
  longUrl: string;
  alias?: string | undefined;
  expiresAt?: string | null;
  title?: string;
}): { success: true; link: LinkRecord } | { success: false; error: string; status: number } {
  const db = getDb();
  const trimmedUrl = input.longUrl.trim();

  try {
    const parsed = new URL(trimmedUrl);
    if (!/^https?:$/.test(parsed.protocol)) {
      return {
        success: false,
        error: "Enter a valid URL starting with http:// or https://",
        status: 422,
      };
    }
  } catch {
    return { success: false, error: "Invalid URL provided", status: 422 };
  }

  let code = input.alias?.trim();
  let isCustom = false;

  if (code) {
    if (!ALIAS_PATTERN.test(code)) {
      return {
        success: false,
        error: "Aliases must be 3–32 letters, numbers, - or _",
        status: 422,
      };
    }
    if (isAliasTaken(code)) {
      return { success: false, error: "That custom alias is already in use.", status: 409 };
    }
    isCustom = true;
  } else {
    // Generate unique Base62 code
    let attempts = 0;
    do {
      code = generateBase62Code(7);
      attempts++;
    } while (isAliasTaken(code) && attempts < 10);
  }

  if (input.expiresAt) {
    const expTime = new Date(input.expiresAt).getTime();
    if (isNaN(expTime) || expTime <= Date.now()) {
      return { success: false, error: "Expiration date must be in the future.", status: 422 };
    }
  }

  const title = input.title || deriveTitle(trimmedUrl);
  const createdAt = new Date().toISOString();
  const expiresAt = input.expiresAt || null;

  db.prepare(
    "INSERT INTO links (code, long_url, title, created_at, expires_at, custom, clicks) VALUES (?, ?, ?, ?, ?, ?, 0)",
  ).run(code, trimmedUrl, title, createdAt, expiresAt, isCustom ? 1 : 0);

  const newLink: LinkRecord = {
    code,
    longUrl: trimmedUrl,
    title,
    createdAt,
    expiresAt,
    clicks: 0,
    custom: isCustom,
  };

  setCachedRedirect(code, { longUrl: trimmedUrl, expiresAt });

  return { success: true, link: newLink };
}

export function deleteLink(code: string): boolean {
  const db = getDb();
  invalidateRedirectCache(code);
  const res = db.prepare("DELETE FROM links WHERE code = ?").run(code);
  return res.changes > 0;
}

export function recordClickAndGetDestination(
  code: string,
  meta: ClientMetadata,
): { status: "found"; destination: string } | { status: "expired" } | { status: "not_found" } {
  const db = getDb();

  // Check cache first for instant redirect
  const cached = getCachedRedirect(code);
  let longUrl = "";
  let expiresAt: string | null = null;

  if (cached === "expired") {
    return { status: "expired" };
  } else if (cached) {
    longUrl = cached.longUrl;
    expiresAt = cached.expiresAt;
  } else {
    const link = getLinkByCode(code);
    if (!link) {
      return { status: "not_found" };
    }
    longUrl = link.longUrl;
    expiresAt = link.expiresAt;
    setCachedRedirect(code, { longUrl, expiresAt });
  }

  // Check expiration
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return { status: "expired" };
  }

  // Asynchronously record click (in SQLite WAL mode this is sub-millisecond)
  try {
    const nowIso = new Date().toISOString();
    db.prepare(
      "INSERT INTO clicks (code, timestamp, ip, country, referrer, device, browser, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      code,
      nowIso,
      meta.ip,
      meta.country,
      meta.referrer,
      meta.device,
      meta.browser,
      meta.userAgent,
    );

    db.prepare("UPDATE links SET clicks = clicks + 1 WHERE code = ?").run(code);
  } catch (err) {
    console.error("Failed to record click:", err);
  }

  return { status: "found", destination: longUrl };
}

export function getLinkAnalytics(code: string, days = 30): LinkAnalytics {
  const db = getDb();
  const link = getLinkByCode(code);
  const totalClicks = link?.clicks ?? 0;

  // Real aggregate: clicks per day for the last N days
  const now = new Date();
  const dayBuckets: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    dayBuckets[d.toISOString().slice(0, 10)] = 0;
  }

  const startDateIso = new Date(now.getTime() - days * 86400000).toISOString();

  const dailyRows = db
    .prepare(
      "SELECT SUBSTR(timestamp, 1, 10) as date, COUNT(*) as clicks FROM clicks WHERE code = ? AND timestamp >= ? GROUP BY SUBSTR(timestamp, 1, 10)",
    )
    .all(code, startDateIso) as Array<{ date: string; clicks: number }>;

  for (const r of dailyRows) {
    if (dayBuckets[r.date] !== undefined) {
      dayBuckets[r.date] = r.clicks;
    }
  }

  const daily: DailyClick[] = Object.entries(dayBuckets).map(([date, clicks]) => ({
    date,
    clicks,
  }));

  // Countries breakdown
  const countryRows = db
    .prepare(
      "SELECT country as name, COUNT(*) as value FROM clicks WHERE code = ? AND country IS NOT NULL AND country != '' GROUP BY country ORDER BY value DESC LIMIT 7",
    )
    .all(code) as AnalyticsBreakdown[];

  // Referrers breakdown
  const referrerRows = db
    .prepare(
      "SELECT referrer as name, COUNT(*) as value FROM clicks WHERE code = ? AND referrer IS NOT NULL AND referrer != '' GROUP BY referrer ORDER BY value DESC LIMIT 7",
    )
    .all(code) as AnalyticsBreakdown[];

  // Devices breakdown
  const deviceRows = db
    .prepare(
      "SELECT device as name, COUNT(*) as value FROM clicks WHERE code = ? AND device IS NOT NULL AND device != '' GROUP BY device ORDER BY value DESC",
    )
    .all(code) as AnalyticsBreakdown[];

  // Browsers breakdown
  const browserRows = db
    .prepare(
      "SELECT browser as name, COUNT(*) as value FROM clicks WHERE code = ? AND browser IS NOT NULL AND browser != '' GROUP BY browser ORDER BY value DESC LIMIT 7",
    )
    .all(code) as AnalyticsBreakdown[];

  return {
    totalClicks,
    daily,
    countries: countryRows.length > 0 ? countryRows : [{ name: "No data", value: 0 }],
    referrers: referrerRows.length > 0 ? referrerRows : [{ name: "Direct", value: 0 }],
    devices: deviceRows.length > 0 ? deviceRows : [{ name: "Desktop", value: 0 }],
    browsers: browserRows.length > 0 ? browserRows : [{ name: "Chrome", value: 0 }],
  };
}

export function getWorkspaceAnalytics(days = 30): {
  totalClicks: number;
  last30DaysClicks: number;
  activeCount: number;
  expiredCount: number;
  daily: DailyClick[];
  topReferrers: AnalyticsBreakdown[];
} {
  const db = getDb();
  const allLinks = getAllLinks();
  const totalClicks = allLinks.reduce((acc, l) => acc + l.clicks, 0);

  let activeCount = 0;
  let expiredCount = 0;
  for (const l of allLinks) {
    if (linkStatus(l) === "expired") {
      expiredCount++;
    } else {
      activeCount++;
    }
  }

  const now = new Date();
  const dayBuckets: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    dayBuckets[d.toISOString().slice(0, 10)] = 0;
  }

  const startDateIso = new Date(now.getTime() - days * 86400000).toISOString();

  const dailyRows = db
    .prepare(
      "SELECT SUBSTR(timestamp, 1, 10) as date, COUNT(*) as clicks FROM clicks WHERE timestamp >= ? GROUP BY SUBSTR(timestamp, 1, 10)",
    )
    .all(startDateIso) as Array<{ date: string; clicks: number }>;

  let last30DaysClicks = 0;
  for (const r of dailyRows) {
    if (dayBuckets[r.date] !== undefined) {
      dayBuckets[r.date] = r.clicks;
      last30DaysClicks += r.clicks;
    }
  }

  const daily: DailyClick[] = Object.entries(dayBuckets).map(([date, clicks]) => ({
    date,
    clicks,
  }));

  const topReferrers = db
    .prepare(
      "SELECT referrer as name, COUNT(*) as value FROM clicks WHERE referrer IS NOT NULL AND referrer != '' GROUP BY referrer ORDER BY value DESC LIMIT 7",
    )
    .all() as AnalyticsBreakdown[];

  return {
    totalClicks,
    last30DaysClicks,
    activeCount,
    expiredCount,
    daily,
    topReferrers: topReferrers.length > 0 ? topReferrers : [{ name: "Direct", value: 0 }],
  };
}

// Seed realistic initial records if DB is empty
function seedInitialData(db: DatabaseSync) {
  const countRow = db.prepare("SELECT COUNT(*) as count FROM links").get() as { count: number };
  if (countRow && countRow.count > 0) return;

  const initialLinks = [
    {
      code: "react-docs",
      longUrl: "https://react.dev/learn",
      title: "React Documentation",
      createdAt: "2026-10-02T09:14:00Z",
      expiresAt: "2026-12-31T23:59:00Z",
      custom: 1,
      clicks: 4812,
    },
    {
      code: "aB3x9Qz",
      longUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status",
      title: "MDN: HTTP Status Codes",
      createdAt: "2026-10-18T14:02:00Z",
      expiresAt: null,
      custom: 0,
      clicks: 12904,
    },
    {
      code: "gh-actions",
      longUrl: "https://github.com/features/actions",
      title: "GitHub Actions Automation",
      createdAt: "2026-10-25T11:40:00Z",
      expiresAt: "2026-11-20T18:00:00Z",
      custom: 1,
      clicks: 2231,
    },
    {
      code: "Tk82mPa",
      longUrl: "https://tanstack.com/router",
      title: "TanStack Router Documentation",
      createdAt: "2026-09-11T08:00:00Z",
      expiresAt: null,
      custom: 0,
      clicks: 7390,
    },
    {
      code: "sqlite-wal",
      longUrl: "https://sqlite.org/wal.html",
      title: "SQLite Write-Ahead Logging",
      createdAt: "2026-03-01T10:00:00Z",
      expiresAt: "2026-04-30T23:59:00Z",
      custom: 1,
      clicks: 18450,
    },
    {
      code: "9fLq2Wd",
      longUrl: "https://tailwindcss.com/docs",
      title: "Tailwind CSS Documentation",
      createdAt: "2026-10-30T16:20:00Z",
      expiresAt: null,
      custom: 0,
      clicks: 642,
    },
  ];

  const insertLink = db.prepare(
    "INSERT INTO links (code, long_url, title, created_at, expires_at, custom, clicks) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  const insertClick = db.prepare(
    "INSERT INTO clicks (code, timestamp, ip, country, referrer, device, browser, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const countries = [
    "United States",
    "Nigeria",
    "United Kingdom",
    "Germany",
    "India",
    "Canada",
    "Brazil",
  ];
  const referrers = [
    "instagram.com",
    "Direct",
    "x.com",
    "linkedin.com",
    "google.com",
    "newsletter",
  ];
  const devices = ["Mobile", "Desktop", "Tablet"];
  const browsers = ["Chrome", "Safari", "Edge", "Firefox", "Other"];

  db.exec("BEGIN TRANSACTION;");
  try {
    for (const l of initialLinks) {
      insertLink.run(l.code, l.longUrl, l.title, l.createdAt, l.expiresAt, l.custom, l.clicks);

      // Seed click distribution across past 30 days
      const clickEventsCount = Math.min(l.clicks, 40); // representative sample stored in clicks table
      for (let c = 0; c < clickEventsCount; c++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const hour = Math.floor(Math.random() * 24);
        const min = Math.floor(Math.random() * 60);
        const d = new Date(Date.now() - daysAgo * 86400000 - hour * 3600000 - min * 60000);

        const country = countries[Math.floor(Math.random() * countries.length)]!;
        const referrer = referrers[Math.floor(Math.random() * referrers.length)]!;
        const device = devices[Math.floor(Math.random() * devices.length)]!;
        const browser = browsers[Math.floor(Math.random() * browsers.length)]!;

        insertClick.run(l.code, d.toISOString(), "127.0.0.1", country, referrer, device, browser, "Mozilla/5.0");
      }
    }
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}
