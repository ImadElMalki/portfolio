import type { AstroIcon } from "@/types"
import {
  technologyMetadata,
  type TechnologyDefinition,
  type TechnologyId,
} from "./technologyRegistry"

import Angular from "@/icons/angular.astro"
import Astro from "@/icons/astroicon.astro"
import Capacitor from "@/icons/capacitor.astro"
import Chrome from "@/icons/chrome.astro"
import Cloudflare from "@/icons/cloudflare.astro"
import CSS from "@/icons/css.astro"
import Docker from "@/icons/docker.astro"
import Git from "@/icons/git.astro"
import GitHub from "@/icons/GitHub.astro"
import Gmail from "@/icons/gmail.astro"
import HTML from "@/icons/html.astro"
import Java from "@/icons/java.astro"
import JavaScript from "@/icons/javascript.astro"
import Kotlin from "@/icons/kotlin.astro"
import MySQL from "@/icons/sql.astro"
import Postgresql from "@/icons/postgresql.astro"
import Python from "@/icons/python.astro"
import React from "@/icons/react.astro"
import Springboot from "@/icons/springboot.astro"
import Supabase from "@/icons/supabase.astro"
import Svelte from "@/icons/svelte.astro"
import TypeScript from "@/icons/type.astro"

const ICON_BY_ID: Partial<Record<TechnologyId, AstroIcon>> = {
  angular: Angular,
  astro: Astro,
  capacitor: Capacitor,
  "chrome-extensions": Chrome,
  "cloudflare-workers": Cloudflare,
  "cloudflare-d1": Cloudflare,
  "cloudflare-queues": Cloudflare,
  "cloudflare-r2": Cloudflare,
  css: CSS,
  docker: Docker,
  git: Git,
  github: GitHub,
  "gmail-api": Gmail,
  html: HTML,
  java: Java,
  javascript: JavaScript,
  kotlin: Kotlin,
  mysql: MySQL,
  postgresql: Postgresql,
  python: Python,
  react: React,
  "spring-boot": Springboot,
  supabase: Supabase,
  svelte: Svelte,
  typescript: TypeScript,
}

export type TechnologyPresentation = TechnologyDefinition & {
  readonly Icon?: AstroIcon
}

/** El nombre fuente se resuelve primero a ID estable; el icono solo usa ese ID. */
export function technologyDefinition(
  name: string,
): TechnologyPresentation | undefined {
  const definition = technologyMetadata(name)
  if (!definition) return undefined
  const Icon = ICON_BY_ID[definition.id]
  return Icon ? { ...definition, Icon } : definition
}
