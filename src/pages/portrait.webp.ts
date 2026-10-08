import type { APIRoute } from "astro"
import sharp from "sharp"
import { readProjectFile } from "@/lib/dataUri"

/**
 * Retrato en una URL estable, la que declaran `basics.image` (JSON Resume) y el
 * `image` del JSON-LD. La web usa la versión que optimiza `astro:assets` con sus
 * densidades, pero esas rutas llevan hash y cambian en cada build, así que no
 * sirven como dato público.
 *
 * Se deriva de `src/assets/me.webp`, el único original del repo: antes había una
 * segunda copia idéntica en `public/` (1920×2240, 172 KB) que se publicaba tal
 * cual.
 */
export const GET: APIRoute = async () => {
  const portrait = await sharp(await readProjectFile("src/assets/me.webp"))
    .resize(800, 1000, { fit: "cover", position: "centre" })
    .webp({ quality: 82 })
    .toBuffer()

  return new Response(new Uint8Array(portrait))
}
