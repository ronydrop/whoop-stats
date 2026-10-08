import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  skipProxyUrlNormalize: true,
  experimental: { cpus: 2 },
};

export default nextConfig;
