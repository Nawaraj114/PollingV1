import type { NextConfig } from "next";

function supabaseStorageRemotePatterns(): NonNullable<
  NextConfig["images"]
>["remotePatterns"] {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) return [];

  const url = new URL(supabaseUrl);

  return ["avatars", "bill-receipts"].map((bucket) => ({
    hostname: url.hostname,
    pathname: `/storage/v1/object/sign/${bucket}/**`,
    port: url.port,
    protocol: url.protocol === "http:" ? "http" : "https",
  }));
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  images: {
    remotePatterns: supabaseStorageRemotePatterns(),
  },
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
