import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  // Turbopack (used by default for next build in Next 16) – ensures tailwind resolves from project root
  turbopack: {
    root: path.join(process.cwd()),
    resolveAlias: {
      tailwindcss: path.join(process.cwd(), "node_modules", "tailwindcss"),
    },
  },
  // Webpack (used when running next dev --webpack) – same alias for dev
  webpack: (config, { dir }) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      tailwindcss: path.join(dir, "node_modules", "tailwindcss"),
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
