import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/** Origins the page may talk to: the data API (and tile host, if tiles are served from a CDN). */
const dataOrigins = [process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000", process.env.NEXT_PUBLIC_TILE_URL]
  .filter((u): u is string => Boolean(u))
  .map((u) => new URL(u).origin);

// Next.js injects inline bootstrap scripts, so script-src needs 'unsafe-inline' (no eval in production).
// Development additionally needs 'unsafe-eval' for hot reloading, so the CSP is only enforced in production builds.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${dataOrigins.join(" ")}`,
  `connect-src 'self' ${dataOrigins.join(" ")}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isProd ? [{ key: "Content-Security-Policy", value: csp }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: false, // the render loop owns long-lived GPU resources; avoid double-mount churn in dev
  poweredByHeader: false,
  turbopack: { root: process.cwd() }, // pin the project root (a stray lockfile higher up can confuse detection)
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
