import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root — stray lockfiles above this folder
  // otherwise make Turbopack guess wrong.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
