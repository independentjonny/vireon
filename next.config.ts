import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    incomingRequests: false,
  },
  allowedDevOrigins: [
    "192.168.0.9",
    "100.87.158.137",
    "nottingham-log-brave-personalized.trycloudflare.com",
    "randy-hotel-bands-comment.trycloudflare.com",
    "volleyball-planes-posts-keen.trycloudflare.com",
  ],
};

export default nextConfig;
