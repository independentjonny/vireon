import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    incomingRequests: false,
  },
  allowedDevOrigins: [
    "192.168.0.9",
    "100.87.158.137",
  ],
};

export default nextConfig;