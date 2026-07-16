import type { NextConfig } from "next";

// Déployé sur GitHub Pages en tant que "project page"
// (https://<user>.github.io/SaaS-Market-Pro/), donc servi depuis un
// sous-chemin : basePath/assetPrefix alignés sur le nom du dépôt.
const repoName = "SaaS-Market-Pro";

const nextConfig: NextConfig = {
  output: "export",
  basePath: `/${repoName}`,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
