import { defineCollection } from "astro:content"
import { file } from "astro/loaders"
import { parseCvFile } from "@/lib/cvFileParser"
import { cvSchema } from "@/lib/cvSchema"

const portfolio = defineCollection({
  loader: file("cv.json", { parser: parseCvFile }),
  schema: cvSchema,
})

export const collections = { portfolio }
