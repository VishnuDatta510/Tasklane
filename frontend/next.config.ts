import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a minimal server.js and only the
  // node_modules actually reached, which is what the Docker runtime
  // stage copies.
  output: "standalone",
  /* config options here */
};

export default nextConfig;
