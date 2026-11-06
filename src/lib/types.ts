export type LinkRecord = {
  code: string;
  longUrl: string;
  title: string;
  createdAt: string;
  expiresAt: string | null;
  clicks: number;
  custom: boolean;
};

export type AnalyticsBreakdown = {
  name: string;
  value: number;
};

export type DailyClick = {
  date: string;
  clicks: number;
};

export type LinkAnalytics = {
  totalClicks: number;
  daily: DailyClick[];
  countries: AnalyticsBreakdown[];
  referrers: AnalyticsBreakdown[];
  devices: AnalyticsBreakdown[];
  browsers: AnalyticsBreakdown[];
};

export const SHORT_DOMAIN = "linksnip.io";
export const ALIAS_PATTERN = /^[A-Za-z0-9-_]{3,32}$/;

const BASE62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function toBase62(num: bigint): string {
  if (num === 0n) return "0";
  let s = "";
  let n = num;
  while (n > 0n) {
    const rem = Number(n % 62n);
    s = BASE62_CHARS[rem] + s;
    n = n / 62n;
  }
  return s;
}

export function generateBase62Code(length = 7): string {
  const ts = BigInt(Date.now() - 1700000000000);
  const rnd = BigInt(Math.floor(Math.random() * 14776336));
  const composite = (ts << 24n) | rnd;
  let code = toBase62(composite);
  if (code.length > length) {
    code = code.slice(-length);
  } else {
    while (code.length < length) {
      code = BASE62_CHARS[Math.floor(Math.random() * 62)] + code;
    }
  }
  return code;
}

export function linkStatus(
  l: Pick<LinkRecord, "expiresAt">,
  now = new Date(),
): "active" | "expiring" | "expired" {
  if (!l.expiresAt) return "active";
  const t = new Date(l.expiresAt).getTime();
  if (t < now.getTime()) return "expired";
  if (t - now.getTime() < 1000 * 60 * 60 * 24 * 14) return "expiring";
  return "active";
}
