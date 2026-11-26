import { getDripLocationsByState, getServicesByLocationTier } from "@/lib/data";
import { SITE_URL } from "@/lib/config";

export const revalidate = 0;

interface Props {
  params: Promise<{ file: string }>;
}

export async function GET(_req: Request, { params }: Props) {
  const { file } = await params;
  const stateCode = file.replace(/\.xml$/i, "").toUpperCase();

  if (!/^[A-Z]{2}$/.test(stateCode)) {
    return new Response("Not Found", { status: 404 });
  }

  const stateLocs = await getDripLocationsByState(stateCode);
  if (stateLocs.length === 0) {
    return new Response("Not Found", { status: 404 });
  }

  const today = new Date().toISOString().split("T")[0];
  const tierServicesMap = new Map<number, Awaited<ReturnType<typeof getServicesByLocationTier>>>();
  const urls: string[] = [];

  for (const loc of stateLocs) {
    urls.push(`  <url>
    <loc>${SITE_URL}/${stateCode.toLowerCase()}/${loc.place_slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);

    let svcs = tierServicesMap.get(loc.tier);
    if (!svcs) {
      svcs = await getServicesByLocationTier(loc.tier);
      tierServicesMap.set(loc.tier, svcs);
    }

    for (const svc of svcs) {
      urls.push(`  <url>
    <loc>${SITE_URL}/${stateCode.toLowerCase()}/${loc.place_slug}/${svc.service_slug}</loc>
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
