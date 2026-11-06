export type ClientMetadata = {
  ip: string;
  country: string;
  referrer: string;
  device: "Mobile" | "Desktop" | "Tablet" | "Bot";
  browser: "Chrome" | "Safari" | "Edge" | "Firefox" | "Opera" | "Samsung Internet" | "Other";
  userAgent: string;
};

export function parseUserAgent(ua = ""): {
  device: ClientMetadata["device"];
  browser: ClientMetadata["browser"];
} {
  const s = ua.toLowerCase();

  // Device
  let device: ClientMetadata["device"] = "Desktop";
  if (/bot|crawl|slurp|spider|mediapartners/i.test(s)) {
    device = "Bot";
  } else if (/ipad|tablet|(android(?!.*mobile))/i.test(s)) {
    device = "Tablet";
  } else if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i.test(s)) {
    device = "Mobile";
  }

  // Browser
  let browser: ClientMetadata["browser"] = "Other";
  if (/edg\//i.test(s)) {
    browser = "Edge";
  } else if (/opr\/|opera/i.test(s)) {
    browser = "Opera";
  } else if (/samsungbrowser/i.test(s)) {
    browser = "Samsung Internet";
  } else if (/chrome|crios/i.test(s)) {
    browser = "Chrome";
  } else if (/firefox|fxios/i.test(s)) {
    browser = "Firefox";
  } else if (/safari/i.test(s) && !/chrome|crios/i.test(s)) {
    browser = "Safari";
  }

  return { device, browser };
}

export function parseReferrer(rawReferrer?: string | null): string {
  if (!rawReferrer || !rawReferrer.trim()) return "Direct";
  try {
    const parsed = new URL(rawReferrer);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return "Direct";
    // Clean common shortened platforms
    if (host === "t.co" || host === "x.com" || host === "twitter.com") return "x.com";
    if (host.includes("instagram.com")) return "instagram.com";
    if (host.includes("linkedin.com")) return "linkedin.com";
    if (host.includes("facebook.com")) return "facebook.com";
    if (host.includes("google.")) return "google.com";
    if (host.includes("github.com")) return "github.com";
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube.com";
    if (host.includes("reddit.com")) return "reddit.com";
    return host;
  } catch {
    return "Direct";
  }
}

export function getClientMetadata(
  headers: Headers | Record<string, string | string[] | undefined>,
): ClientMetadata {
  const getHeader = (name: string): string => {
    if (headers instanceof Headers) {
      return headers.get(name) || "";
    }
    const val = headers[name.toLowerCase()] || headers[name];
    if (Array.isArray(val)) return val[0] || "";
    return val || "";
  };

  const forwardedFor = getHeader("x-forwarded-for");
  const ip =
    (forwardedFor ? forwardedFor.split(",")[0]?.trim() : null) ||
    getHeader("cf-connecting-ip") ||
    getHeader("x-real-ip") ||
    "127.0.0.1";

  const cfCountry = getHeader("cf-ipcountry");
  const xCountry = getHeader("x-country-code");
  let country = cfCountry || xCountry || "";

  if (!country || country === "XX" || country === "T1") {
    // If local or private IP, assign realistic regional or default
    if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      country = "United States";
    } else {
      country = "Global";
    }
  }

  const rawUa = getHeader("user-agent") || "";
  const { device, browser } = parseUserAgent(rawUa);
  const rawRef = getHeader("referer") || getHeader("referrer") || "";
  const referrer = parseReferrer(rawRef);

  return {
    ip,
    country,
    referrer,
    device,
    browser,
    userAgent: rawUa,
  };
}
