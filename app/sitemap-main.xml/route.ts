import { getDripStates } from "@/lib/data";
import { AUTHORITY_HUBS } from "@/lib/hubs";
import { SITE_URL } from "@/lib/config";

export const revalidate = 0;

export async function GET() {
  const states = await getDripStates();
  const today = new Date().toISOString().split("T")[0];
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

  for (const st of states) {
    urls.push(`  <url>
    <loc>${SITE_URL}/${st.state_code.toLowerCase()}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
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
