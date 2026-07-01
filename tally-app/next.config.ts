import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use webpack instead of Turbopack to support platforms without native SWC bindings
  turbopack: undefined,
};

export default nextConfig;
