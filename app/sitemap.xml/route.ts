import {
  getDripLocations,
  getDripStates,
  getServicesByLocationTier,
} from "@/lib/data";
import { AUTHORITY_HUBS } from "@/lib/hubs";
import { SITE_URL } from "@/lib/config";

export const revalidate = 0; // Fresh on every request

const SINGLE_SITEMAP_THRESHOLD = 45000;

export async function GET() {
  const dripLocations = await getDripLocations();
  const today = new Date().toISOString().split("T")[0];

  // Cache tier service slices so we don't recompute per city
  const tierServicesMap = new Map<number, Awaited<ReturnType<typeof getServicesByLocationTier>>>();
  let totalServiceUrls = 0;
  for (const loc of dripLocations) {
    let svcs = tierServicesMap.get(loc.tier);
    if (!svcs) {
      svcs = await getServicesByLocationTier(loc.tier);
      tierServicesMap.set(loc.tier, svcs);
    }
    totalServiceUrls += svcs.length;
  }

  const totalUrls = 1 + AUTHORITY_HUBS.length + totalServiceUrls;

  // When unlocked URLs exceed 45,000 (Script A Day-1 or Script B Month 4+),
  // serve a <sitemapindex> pointing to /sitemap-main.xml + per-state sub-sitemaps
  // to stay strictly under Google's 50,000-URL / 50MB per-sitemap limit.
  if (totalUrls > SINGLE_SITEMAP_THRESHOLD) {
    const states = await getDripStates();
    const sitemaps: string[] = [
      `  <sitemap>\n    <loc>${SITE_URL}/sitemap-main.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`,
      ...states.map(
        (st) =>
          `  <sitemap>\n    <loc>${SITE_URL}/sitemap/${st.state_code.toLowerCase()}.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`
      ),
    ];

    const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.join("\n")}
</sitemapindex>`;

    return new Response(indexXml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate, no-cache",
      },
    });
  }

  const urls: string[] = [];

  urls.push(`  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`);

  for (const hub of AUTHORITY_HUBS) {
    urls.push(`  <url>
    <loc>${SITE_URL}/${hub.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`);
  }

  for (const loc of dripLocations) {
    const svcs = tierServicesMap.get(loc.tier) ?? [];
    for (const svc of svcs) {
      urls.push(`  <url>
    <loc>${SITE_URL}/${loc.state_code.toLowerCase()}/${loc.place_slug}/${svc.service_slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate, no-cache",
    },
  });
}
