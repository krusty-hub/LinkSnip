import { describe, expect, it, beforeEach } from "vitest";
import {
  toBase62,
  generateBase62Code,
  createLink,
  getLinkByCode,
  getAllLinks,
  deleteLink,
  recordClickAndGetDestination,
  getLinkAnalytics,
  getWorkspaceAnalytics,
  checkRateLimit,
  isAliasTaken,
  linkStatus,
  getDb,
} from "@/lib/db";
import { parseUserAgent, parseReferrer } from "@/lib/user-agent";

describe("Base62 Encoding", () => {
  it("encodes bigints correctly", () => {
    expect(toBase62(0n)).toBe("0");
    expect(toBase62(61n)).toBe("Z");
    expect(toBase62(62n)).toBe("10");
  });

  it("generates 7-character Base62 codes", () => {
    const code = generateBase62Code(7);
    expect(code).toHaveLength(7);
    expect(/^[0-9a-zA-Z]{7}$/.test(code)).toBe(true);
  });
});

describe("User-Agent & Referrer Parsing", () => {
  it("detects mobile and browser correctly", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const res = parseUserAgent(ua);
    expect(res.device).toBe("Mobile");
    expect(res.browser).toBe("Safari");
  });

  it("detects desktop Chrome correctly", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const res = parseUserAgent(ua);
    expect(res.device).toBe("Desktop");
    expect(res.browser).toBe("Chrome");
  });

  it("parses referrers cleanly", () => {
    expect(parseReferrer("https://www.instagram.com/p/123")).toBe("instagram.com");
    expect(parseReferrer("https://t.co/abc")).toBe("x.com");
    expect(parseReferrer("https://www.google.com/search?q=test")).toBe("google.com");
    expect(parseReferrer("")).toBe("Direct");
  });
});

describe("Database & Business Logic", () => {
  it("creates a shortened link and retrieves it from SQLite", () => {
    const longUrl = "https://example.com/test-article-" + Date.now();
    const res = createLink({ longUrl });

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.link.code).toHaveLength(7);
    expect(res.link.longUrl).toBe(longUrl);
    expect(res.link.clicks).toBe(0);

    const fetched = getLinkByCode(res.link.code);
    expect(fetched).not.toBeNull();
    expect(fetched?.code).toBe(res.link.code);
  });

  it("creates and enforces custom alias uniqueness", () => {
    const alias = "my-custom-slug-" + Date.now().toString().slice(-6);
    const res1 = createLink({
      longUrl: "https://example.com/promo-1",
      alias,
    });
    expect(res1.success).toBe(true);
    expect(isAliasTaken(alias)).toBe(true);

    // Duplicate attempt
    const res2 = createLink({
      longUrl: "https://example.com/promo-2",
      alias,
    });
    expect(res2.success).toBe(false);
    if (!res2.success) {
      expect(res2.status).toBe(409);
    }
  });

  it("handles link expiration correctly", () => {
    // Past expiration should be rejected during creation
    const pastRes = createLink({
      longUrl: "https://example.com/expired-test",
      expiresAt: new Date(Date.now() - 10000).toISOString(),
    });
    expect(pastRes.success).toBe(false);

    // Create a link expiring in future
    const futureDate = new Date(Date.now() + 100000).toISOString();
    const futureRes = createLink({
      longUrl: "https://example.com/future-test",
      expiresAt: futureDate,
    });
    expect(futureRes.success).toBe(true);
    if (futureRes.success) {
      expect(linkStatus(futureRes.link)).toBe("expiring");
    }
  });

  it("records click and retrieves live analytics", () => {
    const longUrl = "https://example.com/analytics-destination-" + Date.now();
    const created = createLink({ longUrl });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const code = created.link.code;

    // Simulate 3 clicks with different metadata
    const click1 = recordClickAndGetDestination(code, {
      ip: "1.1.1.1",
      country: "United States",
      referrer: "x.com",
      device: "Mobile",
      browser: "Safari",
      userAgent: "Mozilla...",
    });
    expect(click1.status).toBe("found");
    if (click1.status === "found") {
      expect(click1.destination).toBe(longUrl);
    }

    recordClickAndGetDestination(code, {
      ip: "2.2.2.2",
      country: "Germany",
      referrer: "google.com",
      device: "Desktop",
      browser: "Chrome",
      userAgent: "Mozilla...",
    });

    // Check updated link
    const updated = getLinkByCode(code);
    expect(updated?.clicks).toBe(2);

    // Check analytics breakdowns
    const analytics = getLinkAnalytics(code);
    expect(analytics.totalClicks).toBe(2);
    expect(analytics.countries.some((c) => c.name === "United States")).toBe(true);
    expect(analytics.countries.some((c) => c.name === "Germany")).toBe(true);
    expect(analytics.referrers.some((r) => r.name === "x.com")).toBe(true);
    expect(analytics.referrers.some((r) => r.name === "google.com")).toBe(true);
    expect(analytics.devices.some((d) => d.name === "Mobile")).toBe(true);
    expect(analytics.devices.some((d) => d.name === "Desktop")).toBe(true);
  });

  it("enforces sliding window rate limits", () => {
    const testIp = "192.168.99." + Math.floor(Math.random() * 200);
    // Limit to 3 requests
    const r1 = checkRateLimit(testIp, "test_action", 3, 10);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(testIp, "test_action", 3, 10);
    expect(r2.allowed).toBe(true);

    const r3 = checkRateLimit(testIp, "test_action", 3, 10);
    expect(r3.allowed).toBe(true);

    const r4 = checkRateLimit(testIp, "test_action", 3, 10);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it("deletes a link and cascades associated records", () => {
    const created = createLink({ longUrl: "https://example.com/delete-me" });
    if (!created.success) return;
    const code = created.link.code;

    recordClickAndGetDestination(code, {
      ip: "1.1.1.1",
      country: "United States",
      referrer: "Direct",
      device: "Desktop",
      browser: "Chrome",
      userAgent: "test",
    });

    const deleted = deleteLink(code);
    expect(deleted).toBe(true);
    expect(getLinkByCode(code)).toBeNull();

    // Redirection after deletion should return not_found
    const redirected = recordClickAndGetDestination(code, {
      ip: "1.1.1.1",
      country: "United States",
      referrer: "Direct",
      device: "Desktop",
      browser: "Chrome",
      userAgent: "test",
    });
    expect(redirected.status).toBe("not_found");
  });
});
