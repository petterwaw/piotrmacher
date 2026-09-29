import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));

const securityHeaders = [
  // Clickjacking protection (the app is never meant to be framed).
  // Not a full script CSP (Next's inline scripts would need nonces), but it
  // blocks framing, plugins, <base> hijacking and off-site form posts.
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Client router cache. Every room page is dynamic (per-user cookies), and
    // since Next 15 dynamic pages are not kept at all by default, so every tab
    // switch was a fresh server render behind a skeleton. Keep visited pages
    // for 5 minutes: switching tabs back and forth is instant. Mutations call
    // router.refresh(), which drops the stale entry, and the Bets tab re-fetches
    // live scores itself when it is shown from cache (see BetsByDay).
    staleTimes: {
      dynamic: 300,
      static: 300,
    },
  },
  turbopack: {
    root: appRoot,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
