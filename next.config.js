/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  allowedDevOrigins: ["*.replit.dev", "*.pike.replit.dev", "*"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=604800, stale-while-revalidate=2592000",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/sitemap.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate, no-cache",
          },
        ],
      },
      {
        source: "/sitemap-main.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate, no-cache",
          },
        ],
      },
      {
        source: "/sitemap/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate, no-cache",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/high-water-pressure",
        destination: "/high-water-pressure-pressure-reducing-valve",
        permanent: true,
      },
      {
        source: "/pressure-reducing-valve",
        destination: "/high-water-pressure-pressure-reducing-valve",
        permanent: true,
      },
      {
        source: "/pressure-reducing-valve-replacement",
        destination: "/high-water-pressure-pressure-reducing-valve",
        permanent: true,
      },
      {
        source: "/backflow-preventer",
        destination: "/backflow-preventer-repair-installation",
        permanent: true,
      },
      {
        source: "/backflow-preventer-installation",
        destination: "/backflow-preventer-repair-installation",
        permanent: true,
      },
      {
        source: "/backflow-repair",
        destination: "/backflow-preventer-repair-installation",
        permanent: true,
      },
      {
        source: "/cost-guide",
        destination: "/pipe-pressure-backflow-cost-guide",
        permanent: true,
      },
      {
        source: "/plumbing-cost-guide",
        destination: "/pipe-pressure-backflow-cost-guide",
        permanent: true,
      },
      {
        source: "/repipe",
        destination: "/whole-house-repipe",
        permanent: true,
      },
      {
        source: "/cast-iron-pipe-replacement",
        destination: "/cast-iron-galvanized-pipe-replacement",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
