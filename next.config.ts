import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Support the IPv4 loopback URL in addition to Next.js's default localhost.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
