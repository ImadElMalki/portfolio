/* Desde `locales.ts` y no desde `@/cv`: es donde el tipo se declara de verdad,
   y `@/cv` abre con `import { getEntry } from "astro:content"`. Da igual que
   aquí sólo se pida un tipo — quien tenga que **comprobar** este archivo
   necesita resolver esa cadena, y el Worker de `/api/ask`, que lee estos dos
   módulos, no vive dentro de Astro. Es el mismo motivo por el que `locales.ts`
   se separó de `cvSchema.ts`; ver su cabecera. */
import type { Localized } from "@/lib/locales"

/**
 * Texto de la landing de servicios, en los tres idiomas.
 *
 * Vive aquí y no en `cv.json` porque ese archivo lo valida el esquema de JSON
 * Resume y lo consumen `cv.md`, `cv.json`, `llms.txt` y el PDF: una oferta
 * comercial no es parte del currículum. Y no en el diccionario `UI` de
 * `i18n.ts`, que es para etiquetas de interfaz de dos palabras.
 *
 * `services.test.ts` recorre este módulo y comprueba que ningún campo se quede
 * sin traducir ni vacío.
 *
 * ## La página volvió a crecer, y no es un descuido
 *
 * Esto llegó a tener cuatro bloques, se recortó a dos —«la lista de problemas y
 * el repaso de lo ya construido decían con doce párrafos lo que aquí dicen
 * cuatro tarjetas y un enlace»— y ahora vuelve a cuatro. No es deshacer aquel
 * recorte: lo que se quitó entonces eran párrafos, y lo que entra ahora son
 * datos. Nueve problemas concretos en vez de prosa, y cuatro pasos que dicen
 * **qué pasa después de escribir**, que es lo que la versión corta no contaba y
 * lo que decide si alguien rellena el formulario o cierra la pestaña.
 */

/** Formulario propio y localizado; no saca a la persona a un tercero. */
export const CONTACT_URLS = {
  es: "https://imadelmalki.com/servicios/#booking",
  ca: "https://imadelmalki.com/ca/serveis/#booking",
  en: "https://imadelmalki.com/en/services/#booking",
} as const satisfies Record<"es" | "ca" | "en", string>

export interface ServiceItem {
  title: Localized
  body: Localized
}

export const SERVICES_COPY = {
  // --- Entrada desde el hero del portfolio ---------------------------------
  /** Ojo del banner: una etiqueta, no una frase. Va en versalitas y en mono. */
  bannerEyebrow: {
    es: "Para negocios",
    ca: "Per a negocis",
    en: "For businesses",
  },
  /* Los tres campos del banner se quedan como estaban aunque la landing se haya
     reescrito entera. Se pintan en un panel de 918 × 108 en las **tres**
     portadas, con su ancho medido en `ch` y sus presupuestos de bytes en
     `check-build.mjs`: alargarlos mueve la home, que no es lo que se está
     tocando aquí. */
  heroPitch: {
    es: "Creo webs, aplicaciones y automatizaciones para ahorrar trabajo manual y ordenar mejor el día a día de un negocio.",
    ca: "Creo webs, aplicacions i automatitzacions per estalviar feina manual i ordenar millor el dia a dia d'un negoci.",
    en: "I build websites, applications and automations that save manual work and make a business easier to run.",
  },
  heroServicesCta: {
    es: "Servicios para negocios",
    ca: "Serveis per a negocis",
    en: "Services for businesses",
  },
  // --- Cabecera de la landing ---------------------------------------------
  pageTitle: {
    es: "Servicios para negocios",
    ca: "Serveis per a negocis",
    en: "Services for businesses",
  },
  pageDescription: {
    es: "Creo webs, renuevo las que ya tienes y desarrollo automatizaciones y aplicaciones a medida para pequeños negocios.",
    ca: "Creo webs, renovo les que ja tens i desenvolupo automatitzacions i aplicacions a mida per a petits negocis.",
    en: "I build websites, refresh the ones you have, and develop automations and custom applications for small businesses.",
  },
  headline: {
    es: "Software y webs que hacen tu negocio más fácil",
    ca: "Programari i webs que fan el teu negoci més fàcil",
    en: "Software and websites that make your business easier",
  },
  subheadline: {
    es: "Creo webs, mejoro las que ya tienes y desarrollo herramientas que te ayudan a ahorrar tiempo y trabajar mejor.",
    ca: "Creo webs, milloro les que ja tens i desenvolupo eines que t'ajuden a estalviar temps i treballar millor.",
    en: "I build websites, improve the ones you already have and develop tools that save you time and help you work better.",
  },

  // --- Qué hago ------------------------------------------------------------
  servicesTitle: { es: "Qué hago", ca: "Què faig", en: "What I do" },
  /* Cinco y no cuatro: entra «Rediseño web», que es por donde llega la mayoría
     de negocios pequeños —ya tienen web, y lo que les pasa es que se les ha
     quedado vieja—. Iba dentro de «Webs para negocios» y ahí no lo encontraba
     quien venía buscando exactamente eso. */
  services: [
    {
      title: {
        es: "Webs para negocios",
        ca: "Webs per a negocis",
        en: "Websites for businesses",
      },
      body: {
        es: "Webs rápidas, claras y adaptadas a móvil para presentar tu negocio y facilitar que nuevos clientes contacten contigo.",
        ca: "Webs ràpides, clares i adaptades a mòbil per presentar el teu negoci i facilitar que nous clients et contactin.",
        en: "Fast, clear, mobile-ready websites that present your business and make it easy for new clients to reach you.",
      },
    },
    {
      title: {
        es: "Rediseño web",
        ca: "Redisseny web",
        en: "Website redesign",
      },
      body: {
        es: "Si tu web se ha quedado antigua o no transmite lo que haces, renuevo el diseño, mejoro la experiencia de uso y la adapto bien a móvil.",
        ca: "Si la teva web s'ha quedat antiga o no transmet el que fas, renovo el disseny, milloro l'experiència d'ús i l'adapto bé a mòbil.",
        en: "If your site looks dated or does not convey what you do, I refresh the design, improve the experience and make it work properly on mobile.",
      },
    },
    {
      title: {
        es: "Automatizaciones",
        ca: "Automatitzacions",
        en: "Automations",
      },
      body: {
        es: "Si pierdes tiempo copiando datos, revisando correos o actualizando hojas de cálculo, automatizo parte de ese trabajo.",
        ca: "Si perds temps copiant dades, revisant correus o actualitzant fulls de càlcul, automatitzo part d'aquesta feina.",
        en: "If you lose time copying data, checking emails or updating spreadsheets, I automate part of that work.",
      },
    },
    {
      title: {
        es: "Aplicaciones a medida",
        ca: "Aplicacions a mida",
        en: "Custom applications",
      },
      body: {
        es: "Herramientas internas, paneles de gestión o aplicaciones adaptadas a la forma de trabajar de tu negocio.",
        ca: "Eines internes, panells de gestió o aplicacions adaptades a la manera de treballar del teu negoci.",
        en: "Internal tools, management dashboards or applications built around how your business works.",
      },
    },
    {
      title: {
        es: "Integraciones",
        ca: "Integracions",
        en: "Integrations",
      },
      body: {
        es: "Conecto las herramientas que ya utilizas para que compartan información y trabajen juntas automáticamente.",
        ca: "Connecto les eines que ja utilitzes perquè comparteixin informació i treballin juntes automàticament.",
        en: "I connect the tools you already use so they share information and work together automatically.",
      },
    },
  ] satisfies ServiceItem[],
  /** Sube a la cabecera, junto al botón de escribir: la prueba de que esto ya
   *  está construido son los proyectos, y esa prueba conviene ofrecerla antes de
   *  pedir nada, no al final de un bloque. */
  projectsCta: {
    es: "Ver proyectos",
    ca: "Veure projectes",
    en: "See projects",
  },

  // --- Algunas cosas que podemos mejorar -----------------------------------
  /**
   * Nueve encargos concretos, y ése es justo el punto.
   *
   * «Automatizaciones» es una categoría y no se parece a ningún problema que
   * alguien tenga; «extraer y organizar información de correos» sí. Las tarjetas
   * de arriba dicen qué hago, y esto dice en qué se nota — que es lo que permite
   * reconocerse en la lista y escribir.
   */
  improvementsTitle: {
    es: "Algunas cosas que podemos mejorar",
    ca: "Algunes coses que podem millorar",
    en: "Some things we can improve",
  },
  improvements: [
    {
      es: "Renovar una web antigua",
      ca: "Renovar una web antiga",
      en: "Refresh an outdated website",
    },
    {
      es: "Crear una web desde cero",
      ca: "Crear una web des de zero",
      en: "Build a website from scratch",
    },
    {
      es: "Automatizar tareas repetitivas",
      ca: "Automatitzar tasques repetitives",
      en: "Automate repetitive tasks",
    },
    {
      es: "Gestionar clientes, pedidos o citas",
      ca: "Gestionar clients, comandes o cites",
      en: "Manage clients, orders or appointments",
    },
    {
      es: "Crear paneles internos",
      ca: "Crear panells interns",
      en: "Create internal dashboards",
    },
    {
      es: "Extraer y organizar información de correos",
      ca: "Extreure i organitzar informació de correus",
      en: "Extract and organise information from emails",
    },
    {
      es: "Generar documentos automáticamente",
      ca: "Generar documents automàticament",
      en: "Generate documents automatically",
    },
    {
      es: "Conectar formularios, hojas de cálculo y otras herramientas",
      ca: "Connectar formularis, fulls de càlcul i altres eines",
      en: "Connect forms, spreadsheets and other tools",
    },
    {
      es: "Crear una aplicación para una necesidad específica",
      ca: "Crear una aplicació per a una necessitat específica",
      en: "Build an application for a specific need",
    },
  ] satisfies Localized[],
  /** La frase que quita el miedo a escribir sin tener nada decidido. Va en su
   *  propia banda y no al final de la lista: ahí la leería quien ya ha llegado
   *  hasta el noveno punto, que es precisamente quien no la necesita. */
  improvementsNote: {
    es: "No necesitas saber qué tecnología utilizar ni tener la solución definida. Cuéntame el problema y buscamos la forma más sencilla de resolverlo.",
    ca: "No cal que sàpigues quina tecnologia utilitzar ni que tinguis la solució definida. Explica'm el problema i busquem la manera més senzilla de resoldre'l.",
    en: "You do not need to know which technology to use or have the solution defined. Tell me the problem and we will find the simplest way to solve it.",
  },

  // --- Cómo trabajo --------------------------------------------------------
  /**
   * Lo que la versión corta no contaba: qué pasa después de escribir.
   *
   * La página pedía un mensaje y no decía si detrás venía un presupuesto, una
   * llamada o una factura. Cuatro pasos con su orden lo responden antes de que
   * nadie tenga que preguntarlo, y el segundo —«te explico el coste antes de
   * empezar»— es el que de verdad desbloquea a un negocio pequeño.
   */
  processTitle: { es: "Cómo trabajo", ca: "Com treballo", en: "How I work" },
  process: [
    {
      title: {
        es: "Me cuentas qué necesitas",
        ca: "M'expliques què necessites",
        en: "You tell me what you need",
      },
      body: {
        es: "Hablamos sobre tu negocio, qué quieres mejorar y cuál es el problema actual.",
        ca: "Parlem del teu negoci, què vols millorar i quin és el problema actual.",
        en: "We talk about your business, what you want to improve and what the current problem is.",
      },
    },
    {
      title: {
        es: "Te propongo una solución",
        ca: "Et proposo una solució",
        en: "I propose a solution",
      },
      body: {
        es: "Te explico qué haría, cómo funcionaría y el coste antes de empezar.",
        ca: "T'explico què faria, com funcionaria i el cost abans de començar.",
        en: "I explain what I would do, how it would work and the cost before starting.",
      },
    },
    {
      title: {
        es: "Lo construyo",
        ca: "El construeixo",
        en: "I build it",
      },
      body: {
        es: "Desarrollo la solución y vamos revisando el resultado durante el proceso.",
        ca: "Desenvolupo la solució i anem revisant el resultat durant el procés.",
        en: "I develop the solution and we review the result as it progresses.",
      },
    },
    {
      title: {
        es: "Lo ponemos en marcha",
        ca: "El posem en marxa",
        en: "We put it live",
      },
      body: {
        es: "Te entrego el proyecto funcionando y preparado para utilizarlo.",
        ca: "T'entrego el projecte funcionant i preparat per utilitzar-lo.",
        en: "I hand over the project working and ready to use.",
      },
    },
  ] satisfies ServiceItem[],

  // --- Reserva -------------------------------------------------------------
  bookingTitle: {
    es: "Cuéntame qué problema quieres resolver",
    ca: "Explica'm quin problema vols resoldre",
    en: "Tell me the problem you want to solve",
  },
  bookingLead: {
    es: "Consulta inicial · 20 minutos · gratis",
    ca: "Consulta inicial · 20 minuts · gratis",
    en: "Intro call · 20 minutes · free",
  },
  /** Lleva del bloque de entrada al formulario, sin salir de la página. */
  bookingWriteCta: {
    es: "Cuéntame qué necesitas",
    ca: "Explica'm què necessites",
    en: "Tell me what you need",
  },
  /**
   * Las cuatro preguntas pasan a ser lo que conviene poner en el mensaje: el
   * formulario está justo debajo y no obliga a salir a una agenda externa.
   */
  bookingAskTitle: {
    es: "Cuéntame en el mensaje:",
    ca: "Explica'm al missatge:",
    en: "Tell me in the message:",
  },
  bookingFormIntro: {
    es: "Escríbeme desde aquí y te responderé al correo que indiques.",
    ca: "Escriu-me des d'aquí i et respondré al correu que indiquis.",
    en: "Write to me here and I will reply to the email address you provide.",
  },
  bookingAsk: [
    { es: "Nombre y empresa", ca: "Nom i empresa", en: "Name and company" },
    {
      es: "Qué te gustaría mejorar",
      ca: "Què t'agradaria millorar",
      en: "What you would like to improve",
    },
    {
      es: "Web, automatización, aplicación u otro",
      ca: "Web, automatització, aplicació o altre",
      en: "Website, automation, application or something else",
    },
    {
      es: "Teléfono o correo electrónico",
      ca: "Telèfon o correu electrònic",
      en: "Phone or email",
    },
  ] satisfies Localized[],
  mailSubject: {
    es: "Consulta sobre un proyecto",
    ca: "Consulta sobre un projecte",
    en: "Enquiry about a project",
  },
} as const
