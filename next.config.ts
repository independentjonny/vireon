import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval'";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VIREON_DEV_AUTH_BYPASS: process.env.NEXT_PUBLIC_VIREON_DEV_AUTH_BYPASS,
  },
  turbopack: {
    root: projectRoot,
  },
  logging: {
    incomingRequests: false,
  },
  allowedDevOrigins: [
    "192.168.0.9",
    "100.87.158.137",
  ],
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        { key: "Content-Security-Policy", value: `default-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src ${scriptSrc}; connect-src 'self'` },
      ],
    }];
  },
};

export default nextConfig;
