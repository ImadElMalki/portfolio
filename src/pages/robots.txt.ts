import type { APIRoute } from "astro"

/** Se genera desde `site` para que la URL del sitemap siga al dominio real. */
export const GET: APIRoute = ({ site }) => {
  const sitemap = site ? `Sitemap: ${new URL("sitemap-index.xml", site)}\n` : ""

  return new Response(`User-agent: *\nAllow: /\n\n${sitemap}`)
}
