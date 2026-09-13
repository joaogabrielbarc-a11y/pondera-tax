import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: isGitHubPages ? "/pondera-tax" : "",
  assetPrefix: isGitHubPages ? "/pondera-tax/" : "",
};

export default nextConfig;
