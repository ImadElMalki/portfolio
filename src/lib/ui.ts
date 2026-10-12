import { LOCALE_CODES, type Locale, type Localized } from "@/lib/locales"

/**
 * El diccionario de la interfaz y las constantes de idioma, **sin** tocar
 * `astro:i18n`.
 *
 * Vivía todo dentro de `i18n.ts`, y eso lo hacía inservible desde el navegador:
 * `localizedPath` importa `getRelativeLocaleUrl`, así que cualquier módulo de
 * cliente que sólo quisiera `t()` se arrastraba el runtime de i18n de Astro
 * entero. Medido con la consola: 13,3 KB → 50,9 KB de JS comprimido.
 *
 * Aquí no hay ni una importación de `astro:*`. `i18n.ts` reexporta todo esto,
 * de modo que el resto del sitio sigue importando de donde importaba.
 */

export const LOCALES = LOCALE_CODES

/** El castellano no lleva prefijo: vive en la raíz del sitio. */
export const DEFAULT_LOCALE: Locale = "es"

/**
 * Primer grupo de respaldo si el banco estático de `ask` no se puede cargar.
 *
 * El banco completo vive en `/public/ask-questions`: mantener aquí sólo cuatro
 * preguntas por idioma evita sumar las 144 cadenas al JavaScript inicial.
 *
 * Es **copia literal del primer grupo** de `src/data/askQuestions.ts`, así que
 * al tocar aquél hay que tocar éste. No lo escribe `npm run ask:questions`
 * porque este archivo es código y no datos, y generar dentro de un módulo
 * TypeScript costaría más de lo que ahorra para cuatro cadenas por idioma.
 */
export const ASK_SUGGESTION_FALLBACK = {
  es: [
    "¿Cuál es su perfil profesional?",
    "¿Qué experiencia tiene con Angular y Java?",
    "¿Qué hace en VIEWNEXT?",
    "¿Puede encargarse de un proyecto de principio a fin?",
  ],
  ca: [
    "Quin és el seu perfil professional?",
    "Quina experiència té amb Angular i Java?",
    "Què fa a VIEWNEXT?",
    "Pot encarregar-se d'un projecte de principi a fi?",
  ],
  en: [
    "What is his professional profile?",
    "What experience does he have with Angular and Java?",
    "What does he do at VIEWNEXT?",
    "Can he handle a project from start to finish?",
  ],
} as const satisfies Record<Locale, readonly [string, string, string, string]>

/** Etiqueta del idioma en su propia lengua, para el conmutador. */
export const LOCALE_NAMES: Record<Locale, string> = {
  es: "Castellano",
  ca: "Català",
  en: "English",
}

/** `lang` del documento y `hreflang` de los enlaces alternativos. */
export const LOCALE_TAGS: Record<Locale, string> = {
  es: "es",
  ca: "ca",
  en: "en",
}

/** Etiqueta que espera Open Graph. */
export const OG_LOCALES: Record<Locale, string> = {
  es: "es_ES",
  ca: "ca_ES",
  en: "en_US",
}

/** Etiqueta BCP-47 para `Intl`, que necesita la región para las fechas. */
export const INTL_LOCALES: Record<Locale, string> = {
  es: "es-ES",
  ca: "ca-ES",
  en: "en-GB",
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.some((locale) => locale === value)
}

/**
 * Idioma de la ruta actual. `/` es castellano; `/ca/…` y `/en/…` llevan prefijo.
 */
export function localeFromPath(pathname: string): Locale {
  const [, first] = pathname.split("/")
  return isLocale(first) ? first : DEFAULT_LOCALE
}

/** Lee un campo traducido del CV. */
export function localized<T>(field: Localized<T>, locale: Locale): T {
  return field[locale]
}

const UI = {
  skipToContent: {
    es: "Saltar al contenido",
    ca: "Vés al contingut",
    en: "Skip to content",
  },
  viewPreferences: {
    es: "Preferencias de visualización",
    ca: "Preferències de visualització",
    en: "Display preferences",
  },
  language: { es: "Idioma", ca: "Idioma", en: "Language" },
  /**
   * El aviso de idioma, y por qué su traducción se usa al revés que las demás.
   *
   * Todo lo que hay en este diccionario se pinta en el idioma **de la página**.
   * Esto no: el aviso le dice a quien llega que existe su versión, así que va
   * escrito en el idioma **que se sugiere**. Un inglés que cae en la portada
   * castellana tiene que leerlo en inglés o no se entera de nada.
   *
   * Por eso `Layout.astro` emite los tres idiomas en `data-*` y `localeSuggest.ts`
   * elige uno en el navegador, en vez de resolverse aquí con el `locale` de la
   * página como hace el resto.
   */
  localeHintBody: {
    es: "Esta página también está en castellano.",
    ca: "Aquesta pàgina també està en català.",
    en: "This page is also available in English.",
  },
  localeHintAction: { es: "Verla", ca: "Veure-la", en: "View it" },
  localeHintDismiss: { es: "Descartar", ca: "Descarta", en: "Dismiss" },
  downloadPdf: {
    es: "Descargar el CV en PDF",
    ca: "Descarrega el CV en PDF",
    en: "Download the CV as PDF",
  },
  darkMode: { es: "Modo oscuro", ca: "Mode fosc", en: "Dark mode" },
  switchToDark: {
    es: "Cambiar a modo oscuro",
    ca: "Canvia a mode fosc",
    en: "Switch to dark mode",
  },
  switchToLight: {
    es: "Cambiar a modo claro",
    ca: "Canvia a mode clar",
    en: "Switch to light mode",
  },
  cvSections: {
    es: "Secciones del CV",
    ca: "Seccions del CV",
    en: "CV sections",
  },
  home: { es: "Inicio", ca: "Inici", en: "Home" },
  aboutMore: {
    es: "Leer sobre mí",
    ca: "Llegir sobre mi",
    en: "Read about me",
  },
  /* Etiqueta del yaz (ⵣ) del pie. El símbolo va como SVG —ninguna de las tres
     fuentes servidas trae el rango tifinagh—, así que sin esto no tiene nombre
     para quien lo escuche en vez de verlo. */
  amazigh: {
    es: "Yaz, símbolo amazigh",
    ca: "Yaz, símbol amazic",
    en: "Yaz, Amazigh symbol",
  },
  contactAndSocial: {
    es: "Contacto y redes",
    ca: "Contacte i xarxes",
    en: "Contact and social",
  },
  emailTitle: {
    es: "Enviar un correo electrónico a",
    ca: "Envia un correu electrònic a",
    en: "Send an email to",
  },
  email: { es: "Correo electrónico", ca: "Correu electrònic", en: "Email" },
  whatsapp: { es: "WhatsApp", ca: "WhatsApp", en: "WhatsApp" },
  whatsappTitle: {
    es: "Escribir por WhatsApp a",
    ca: "Escriu per WhatsApp a",
    en: "Message on WhatsApp",
  },
  /* El mensaje con el que se abre el chat. Corto y en primera persona: quien lo
     recibe ve una frase escrita por la otra parte, no una plantilla. Se puede
     borrar antes de enviar, así que no fuerza a decir nada. */
  whatsappText: {
    es: "Hola Imad, te escribo desde tu portfolio.",
    ca: "Hola Imad, t'escric des del teu portfolio.",
    en: "Hi Imad, I'm writing from your portfolio.",
  },
  profileTitle: {
    es: "Visitar el perfil de",
    ca: "Visita el perfil de",
    en: "Visit the profile of",
  },
  markdownAlternate: {
    es: "CV en Markdown",
    ca: "CV en Markdown",
    en: "CV in Markdown",
  },
  jsonAlternate: {
    es: "CV en JSON Resume",
    ca: "CV en JSON Resume",
    en: "CV in JSON Resume",
  },
  llmsMachineVersions: {
    es: "Versiones legibles por máquinas",
    ca: "Versions llegibles per màquines",
    en: "Machine-readable versions",
  },
  viewDemo: { es: "Ver la demo", ca: "Veure la demo", en: "View demo" },
  jobDetails: { es: "Detalles", ca: "Detalls", en: "Details" },
  /* El pliegue de los empleos de antes de programar. Sin años en la cadena: el
     rango lo calcula `Experience.astro` desde `otherWork`, así que no se queda
     desfasado cuando cambie el archivo. */
  priorWork: {
    es: "Antes de programar",
    ca: "Abans de programar",
    en: "Before coding",
  },
  priorSkills: {
    es: "Otras habilidades",
    ca: "Altres habilitats",
    en: "Other skills",
  },
  /* La cabecera de la sección: escala de un vistazo, sin obligar a contar. Los
     tres marcadores los sustituye el componente, como en `certificatesMore`. */
  certificatesSummary: {
    es: "{n} certificados · {h} h · {i} emisores",
    ca: "{n} certificats · {h} h · {i} emissors",
    en: "{n} certificates · {h} h · {i} issuers",
  },
  /* El nombre del certificado enlaza a la ficha del curso, no a una
     verificación: ver el comentario de `certificateSchema`. La clave se llama
     como lo que hace para que no vuelva a decir una cosa y llevar a otra. */
  certificateCourse: {
    es: "Ver el curso de",
    ca: "Veure el curs de",
    en: "See the course for",
  },
  /** `{n}` lo sustituye el componente: el diccionario no compone texto. */
  /**
   * Los dos rótulos del pliegue, compartidos por certificados y proyectos.
   *
   * Se llamaba `certificatesMore` y sólo tenía el de abrir: el `<summary>`
   * seguía diciendo «Ver 13 más» con las trece filas ya desplegadas, que es
   * exactamente lo contrario de lo que hace el botón en ese momento.
   */
  showMore: {
    es: "Ver {n} más",
    ca: "Veure'n {n} més",
    en: "Show {n} more",
  },
  showLess: {
    es: "Ver menos",
    ca: "Veure'n menys",
    en: "Show less",
  },
  closeDetail: {
    es: "Cerrar el detalle",
    ca: "Tanca el detall",
    en: "Close details",
  },
  /* El hero: lo que quien contrata busca en el primer pantallazo. Era la vista
     rápida, una pantalla aparte tras un icono; desde el 06-10-2026 va en la
     portada. */
  heroDownloadCv: {
    es: "Descargar CV",
    ca: "Descarrega el CV",
    en: "Download CV",
  },
  heroWriteMe: { es: "Escríbeme", ca: "Escriu-me", en: "Get in touch" },
  /* `{n}` lo pone `Hero.astro` con `experienceYears`. Singular y plural van
     aparte: «1 años» no lo arregla ninguna concordancia automática. */
  heroYear: {
    es: "{n} año de experiencia",
    ca: "{n} any d'experiència",
    en: "{n} year of experience",
  },
  heroYears: {
    es: "{n} años de experiencia",
    ca: "{n} anys d'experiència",
    en: "{n} years of experience",
  },
  previousProject: {
    es: "Proyecto anterior",
    ca: "Projecte anterior",
    en: "Previous project",
  },
  nextProject: {
    es: "Proyecto siguiente",
    ca: "Projecte següent",
    en: "Next project",
  },
  demoScreens: {
    es: "Capturas de",
    ca: "Captures de",
    en: "Screenshots of",
  },
  enlargeShot: {
    es: "Ampliar la captura",
    ca: "Ampliar la captura",
    en: "Enlarge screenshot",
  },
  closeShot: {
    es: "Cerrar la captura",
    ca: "Tanca la captura",
    en: "Close screenshot",
  },
  previousShot: {
    es: "Captura anterior",
    ca: "Captura anterior",
    en: "Previous screenshot",
  },
  nextShot: {
    es: "Captura siguiente",
    ca: "Captura següent",
    en: "Next screenshot",
  },
  /** `{n}` y `{total}` los sustituye quien la usa: el script no compone texto. */
  shotPosition: {
    es: "Captura {n} de {total}",
    ca: "Captura {n} de {total}",
    en: "Screenshot {n} of {total}",
  },
  technologiesOf: {
    es: "Tecnologías de",
    ca: "Tecnologies de",
    en: "Technologies of",
  },
  linksOf: { es: "Enlaces de", ca: "Enllaços de", en: "Links of" },
  openLink: { es: "Abrir", ca: "Obrir", en: "Open" },
  viewProject: { es: "Ver", ca: "Veure", en: "View" },
  portfolioOf: {
    es: "Portafolio de",
    ca: "Portafolis de",
    en: "Portfolio of",
  },
  current: { es: "Actualidad", ca: "Actualitat", en: "Present" },
  /**
   * Los tres estados de un proyecto hablan del proyecto, no de quién lo paga.
   *
   * «Proyecto personal» decía a la vez dos cosas y ninguna útil: quien lee la
   * tarjeta quiere saber si puede ir a verlo, y «personal» no contesta a eso —un
   * proyecto personal puede estar publicado, y de hecho dos lo están—. Los tres
   * rótulos de ahora son una sola escala: se puede usar, se está haciendo, el
   * código no se enseña. Es la misma escala que dibuja el medidor de tres
   * segmentos de `ProjectDetail.astro`.
   */
  statusPublished: {
    es: "En línea",
    ca: "En línia",
    en: "Live",
  },
  statusInDevelopment: {
    es: "En desarrollo",
    ca: "En desenvolupament",
    en: "In development",
  },
  statusPrivate: {
    es: "Código privado",
    ca: "Codi privat",
    en: "Private code",
  },
  sectionAbout: { es: "Sobre mí", ca: "Sobre mi", en: "About me" },
  /* El mismo bloque, en papel. Un ATS trocea el PDF buscando rótulos de
     currículum, y «Sobre mí» no lo es. Ver la prop `printTitle` de
     `Section.astro`. */
  sectionAboutPrint: {
    es: "Perfil profesional",
    ca: "Perfil professional",
    en: "Professional profile",
  },
  sectionExperience: {
    es: "Experiencia laboral",
    ca: "Experiència laboral",
    en: "Work experience",
  },
  sectionEducation: {
    es: "Educación",
    ca: "Educació",
    en: "Education",
  },
  sectionCertificates: {
    es: "Certificaciones",
    ca: "Certificacions",
    en: "Certifications",
  },
  sectionLanguages: { es: "Idiomas", ca: "Idiomes", en: "Languages" },
  sectionProjects: {
    es: "Proyectos",
    ca: "Projectes",
    en: "Projects",
  },
  sectionSkills: {
    es: "Habilidades",
    ca: "Habilitats",
    en: "Skills",
  },
  /* Los grupos de la sección de habilidades. El reparto —qué tecnología cae en
     cuál— vive en `technologyRegistry.ts`, que es donde ya está el mapa de
     nombre a identificador; aquí sólo se traduce el rótulo.

     «Mobile y otras» se queda declarado aunque hoy no salga: la sección se
     recortó a las diez tecnologías que importan y ninguna cae en ese grupo, pero
     `Skills.astro` no pinta los grupos vacíos y el registro sigue sabiendo
     colocarlas si vuelven. */
  skillsFrontend: { es: "Frontend", ca: "Frontend", en: "Frontend" },
  skillsBackend: { es: "Backend", ca: "Backend", en: "Backend" },
  skillsCloudData: {
    es: "Cloud y datos",
    ca: "Cloud i dades",
    en: "Cloud & data",
  },
  skillsMobileOther: {
    es: "Mobile y otras",
    ca: "Mobile i altres",
    en: "Mobile & other",
  },
  skillsTools: { es: "Herramientas", ca: "Eines", en: "Tools" },
  markdownHeadingContact: {
    es: "Contacto",
    ca: "Contacte",
    en: "Contact",
  },
  markdownLabelLocation: {
    es: "Ubicación",
    ca: "Ubicació",
    en: "Location",
  },
  markdownLabelEmail: { es: "Email", ca: "Correu", en: "Email" },
  markdownLabelProfiles: { es: "Perfiles", ca: "Perfils", en: "Profiles" },
  markdownLabelTechnologies: {
    es: "Tecnologías",
    ca: "Tecnologies",
    en: "Technologies",
  },
  markdownLabelHighlights: {
    es: "Destacado",
    ca: "Destacat",
    en: "Highlights",
  },
  markdownLabelStatus: { es: "Estado", ca: "Estat", en: "Status" },
  markdownLabelLinks: { es: "Enlaces", ca: "Enllaços", en: "Links" },
  markdownEducationJoin: { es: "en", ca: "en", en: "in" },
  notFoundTitle: {
    es: "Página no encontrada",
    ca: "Pàgina no trobada",
    en: "Page not found",
  },
  notFoundBody: {
    es: "Esta página no existe o ya no está disponible.",
    ca: "Aquesta pàgina no existeix o ja no està disponible.",
    en: "This page does not exist or is no longer available.",
  },
  notFoundNext: {
    es: "Por dónde seguir",
    ca: "Per on seguir",
    en: "Where to go next",
  },
  /* El rótulo de los cuatro controles con corchetes. Estuvo escrito tres veces
     —aquí, en `about.ts` y en `privacy.ts`— con dos castellanos y tres
     catalanes distintos; ahora sale de un sitio. */
  backToPortfolio: {
    es: "Volver al portfolio",
    ca: "Tornar al portafolis",
    en: "Back to the portfolio",
  },
  /* El mismo control, para quien ha llegado desde nineproject.es. Ver la nota
     de `ServicesLanding.astro`: allí se decide cuál de los dos se pinta. La
     marca va en minúscula también al empezar, que es como se escribe. */
  backToNineproject: {
    es: "Volver a nineproject",
    ca: "Tornar a nineproject",
    en: "Back to nineproject",
  },
  footerBuiltBy: { es: "Hecho por", ca: "Fet per", en: "Built by" },
  mailAskEmail: {
    es: "Tu correo",
    ca: "El teu correu",
    en: "Your email",
  },
  mailAskSubject: { es: "Asunto", ca: "Assumpte", en: "Subject" },
  mailBadEmail: {
    es: "Esa dirección no es válida. Prueba otra vez.",
    ca: "Aquesta adreça no és vàlida. Torna-ho a provar.",
    en: "That address is not valid. Try again.",
  },
  /* La corrección de un dedazo en el dominio. `{mail}` lo sustituye el guion
     con la dirección ya arreglada, igual que `{n}` en los pliegues. */
  mailEmailSuggestion: {
    es: "¿Quisiste decir {mail}?",
    ca: "Volies dir {mail}?",
    en: "Did you mean {mail}?",
  },
  mailBadSubject: {
    es: "El asunto no puede quedar vacío.",
    ca: "L'assumpte no pot quedar buit.",
    en: "The subject cannot be empty.",
  },
  mailBadMessage: {
    es: "El mensaje no puede quedar vacío.",
    ca: "El missatge no pot quedar buit.",
    en: "The message cannot be empty.",
  },
  mailSent: {
    es: "Enviado. Te responderé a esa dirección.",
    ca: "Enviat. Et respondré a aquesta adreça.",
    en: "Sent. I will reply to that address.",
  },
  mailFailed: {
    es: "No se pudo enviar desde aquí.",
    ca: "No s'ha pogut enviar des d'aquí.",
    en: "It could not be sent from here.",
  },
  mailFallback: {
    es: "Abrir en tu programa de correo",
    ca: "Obre-ho al teu programa de correu",
    en: "Open in your mail app",
  },
  askThinking: { es: "pensando…", ca: "pensant…", en: "thinking…" },
  askTooLong: {
    es: "La pregunta es demasiado larga. Acórtala un poco.",
    ca: "La pregunta és massa llarga. Escurça-la una mica.",
    en: "That question is too long. Trim it a little.",
  },
  askRateLimited: {
    es: "Demasiadas preguntas seguidas. Prueba dentro de un rato.",
    ca: "Massa preguntes seguides. Prova-ho d'aquí una estona.",
    en: "Too many questions in a row. Try again later.",
  },
  /* El techo diario de todos, no el de quien pregunta: no se le culpa a él y
     se le ofrece el camino que sí funciona. */
  askDailyCap: {
    es: "El asistente ha llegado a su límite de hoy. Escríbele con «mail».",
    ca: "L'assistent ha arribat al seu límit d'avui. Escriu-li amb «mail».",
    en: "The assistant has reached today's limit. Write to him with “mail”.",
  },
  /* Sin clave configurada el endpoint responde 503, igual que el buzón: se
     dice que no está disponible y se ofrece el camino que sí funciona. */
  askUnavailable: {
    es: "Ahora mismo no puedo responder. Escríbele con «mail».",
    ca: "Ara mateix no puc respondre. Escriu-li amb «mail».",
    en: "I can't answer right now. Write to him with “mail”.",
  },
  askFailed: {
    es: "Se ha cortado la respuesta. Vuelve a intentarlo.",
    ca: "S'ha tallat la resposta. Torna-ho a provar.",
    en: "The answer was cut off. Try again.",
  },
  /* Distinto de `askFailed`: aquí no ha fallado nada, la respuesta ha llegado
     entera hasta donde cabía. Decirlo evita que una frase a medias parezca una
     avería, y sugiere lo que sí funciona: preguntar por una parte. */
  askTruncated: {
    es: "(respuesta cortada por longitud · pregunta por una parte concreta)",
    ca: "(resposta tallada per longitud · pregunta per una part concreta)",
    en: "(answer cut short by length · ask about one part)",
  },
  /* El rótulo de la píldora del asistente. */
  askOpen: {
    es: "Preguntar sobre Imad",
    ca: "Preguntar sobre l'Imad",
    en: "Ask about Imad",
  },
  askOpenHint: {
    es: "Pregunta lo que quieras sobre Imad",
    ca: "Pregunta el que vulguis sobre l'Imad",
    en: "Ask anything about Imad",
  },
  /* El pie del panel: cómo se cierra. Hasta el 06-10-2026 llevaba también el
     puente a la consola. */
  askPanelClose: {
    es: "Esc para cerrar",
    ca: "Esc per tancar",
    en: "Esc to close",
  },
  /* El título del panel. Es un diálogo, así que necesita nombre accesible; y
     como el panel se abre encima de la página, el nombre es lo que dice qué es
     esto y no de dónde ha salido. */
  askPanelTitle: {
    es: "Asistente del portfolio",
    ca: "Assistent del portfolio",
    en: "Portfolio assistant",
  },
  /* El aspa del panel. Propia y no `closeDetail`: aquélla habla de una ficha
     de proyecto, y un rótulo accesible que nombra otra cosa es peor que uno
     genérico. */
  askPanelDismiss: {
    es: "Cerrar el asistente",
    ca: "Tancar l'assistent",
    en: "Close the assistant",
  },
  /* Aviso de cupo. El endpoint devuelve cuántas preguntas quedan en una
     cabecera y aquí se dice, pero **sólo al acercarse al techo**: un contador
     siempre visible convierte una conversación en un medidor. Ver
     `x-ratelimit-remaining` en `functions/api/ask.ts`. */
  askRemaining: {
    es: "Te quedan {n} preguntas en esta hora.",
    ca: "Et queden {n} preguntes en aquesta hora.",
    en: "You have {n} questions left this hour.",
  },
  askRemainingOne: {
    es: "Te queda una pregunta en esta hora.",
    ca: "Et queda una pregunta en aquesta hora.",
    en: "You have one question left this hour.",
  },
  /* El botón del renglón, que es uno solo y cambia de oficio: envía cuando no
     hay nada en vuelo y para cuando sí. Dos botones obligarían a esconder uno
     de los dos, y un botón que desaparece al pulsarlo mueve el renglón. */
  askSend: { es: "Preguntar", ca: "Preguntar", en: "Ask" },
  askStop: { es: "Parar", ca: "Aturar", en: "Stop" },
  /* Parar no es que falle: lo que había llegado se queda y se dice por qué no
     sigue. Por eso no es `askFailed` ni va en el tono de aviso. */
  askStopped: {
    es: "(respuesta detenida)",
    ca: "(resposta aturada)",
    en: "(answer stopped)",
  },
  /* Empezar de cero. Sólo aparece con algo que borrar: en un panel vacío sería
     un botón que no hace nada. */
  askNew: { es: "Nueva", ca: "Nova", en: "New" },
  askNewHint: {
    es: "Empezar una conversación nueva",
    ca: "Començar una conversa nova",
    en: "Start a new conversation",
  },
  /* La salida de un fallo. Sólo donde volver a intentarlo puede funcionar: con
     el cupo agotado o el techo del día no se ofrece, que sería una trampa. */
  askRetry: { es: "Reintentar", ca: "Torna-ho a provar", en: "Try again" },
  /* El nombre accesible de la ficha que el panel enlaza bajo una respuesta. La
     píldora enseña el nombre del proyecto a secas —en su fila se entiende—, y un
     lector de pantalla que lo recorra fuera de contexto oiría un nombre suelto
     sin saber que es un enlace a su ficha. */
  askOpenProject: {
    es: "Ver la ficha de {n}",
    ca: "Veure la fitxa de {n}",
    en: "View the page for {n}",
  },
  /* El aviso de que sigue escribiendo abajo, para quien ha subido a releer. */
  askJump: { es: "nuevo", ca: "nou", en: "new" },
  askJumpHint: {
    es: "Ir al final de la respuesta",
    ca: "Anar al final de la resposta",
    en: "Jump to the end of the answer",
  },
  mailRateLimited: {
    es: "Demasiados envíos seguidos. Prueba dentro de un rato.",
    ca: "Massa enviaments seguits. Prova-ho d'aquí una estona.",
    en: "Too many messages in a row. Try again later.",
  },
  /* Cierre de la portada. Los mensajes de estado del envío —enviado, fallo,
     límite, respaldo— son los mismos `mail*` de la consola: son las dos caras
     del mismo buzón y decirlo distinto en cada una sería confuso. */
  contactHeading: { es: "Hablemos", ca: "Parlem-ne", en: "Let's talk" },
  contactIntro: {
    es: "¿Tienes una vacante o un proyecto en mente? Escríbeme y hablamos.",
    ca: "Tens una vacant o un projecte en ment? Escriu-me i en parlem.",
    en: "Have a role or a project in mind? Send me a message and let's talk.",
  },
  contactLabelMessage: { es: "Mensaje", ca: "Missatge", en: "Message" },
  contactSend: {
    es: "Enviar mensaje",
    ca: "Envia el missatge",
    en: "Send message",
  },
  contactSending: { es: "Enviando…", ca: "Enviant…", en: "Sending…" },
  /**
   * Rótulos del estado del formulario, los que van entre corchetes delante del
   * mensaje. Una palabra cada uno: es una marca de panel, no una frase —la
   * frase la ponen `mailSent` y `mailFailed`—. En versalitas por el CSS, así
   * que aquí se escriben normales.
   */
  statusTagSent: { es: "Enviado", ca: "Enviat", en: "Sent" },
  statusTagError: { es: "Error", ca: "Error", en: "Error" },
  /* El tercero de la serie lleva los puntos suspensivos dentro del valor: el
     corchete lo pone el CSS, y «enviando» sin la espera no dice lo mismo. */
  statusTagSending: { es: "Enviando…", ca: "Enviant…", en: "Sending…" },
  /**
   * La hora de la barra, que enciende la tira Glyph.
   *
   * Nombra la acción y no la pieza: quien llega con teclado o lector necesita
   * saber qué pasa al pulsarla, y «la hora» no lo dice. Estuvo en el punto y
   * coma del pie hasta que ése se fue.
   */
  glyphShow: {
    es: "Encender la tira Glyph",
    ca: "Encén la tira Glyph",
    en: "Light up the Glyph strip",
  },
  /**
   * El acuse del chip de correo del hero.
   *
   * No reaprovecha `copied` / `copyFailed`: aquéllas dicen «Markdown copiado» y
   * una frase de dos líneas explicando el respaldo de la vista Markdown. Aquí es
   * un rótulo de panel dentro de una fila de 44 px, y lo que se ha copiado es
   * una dirección.
   *
   * Sin corchetes en el texto: los pone el CSS. Se leen como parte del lenguaje
   * del sitio, y quien escucha la página no tiene por qué oírlos.
   */
  emailCopied: {
    es: "Copiado",
    ca: "Copiat",
    en: "Copied",
  },
  emailCopyFailed: {
    es: "No se pudo copiar",
    ca: "No s'ha pogut copiar",
    en: "Could not copy",
  },
  /**
   * El botón que cubre el retrato.
   *
   * Dice lo que el gesto hace ver —las escuadras cerrándose— y **no** adónde
   * lleva. Es deliberado: la página «Sobre mí» está escondida detrás de este
   * gesto, y una etiqueta que la nombrara la desharía para quien navega con
   * teclado o con lector. Lo que promete es exactamente lo que cumple aunque no
   * se llegue a mantener pulsado: enfocar el visor.
   */
  portraitFocus: {
    es: "Enfocar el visor",
    ca: "Enfocar el visor",
    en: "Focus the viewfinder",
  },
  /* Las secciones del caso de estudio de una ficha, que sólo se pintan cuando
     hay caso escrito. Ver `src/data/caseStudies.ts`. */
  caseContext: {
    es: "El problema",
    ca: "El problema",
    en: "The problem",
  },
  caseRole: {
    es: "Mi papel",
    ca: "El meu paper",
    en: "My role",
  },
  caseDecisions: {
    es: "Decisiones",
    ca: "Decisions",
    en: "Decisions",
  },
  caseOutcome: {
    es: "Resultado",
    ca: "Resultat",
    en: "Outcome",
  },
  caseLessons: {
    es: "Qué cambiaría",
    ca: "Què canviaria",
    en: "What I would change",
  },
  /* El enlace del diálogo de la portada a la ficha entera. Sólo aparece cuando
     esa ficha tiene caso: si no, lleva a lo mismo que ya se está leyendo. */
  caseReadFull: {
    es: "Ver el caso completo",
    ca: "Veure el cas complet",
    en: "Read the full case study",
  },
  /* Migas de pan de las fichas. Visibles desde el 07-10-2026: quien llega por
     un buscador aterriza aquí sin haber pasado por el portfolio, y el
     `BreadcrumbList` del JSON-LD ya decía este mismo camino sin que se viera. */
  breadcrumb: {
    es: "Dónde estás",
    ca: "On ets",
    en: "Breadcrumb",
  },
  projectsIndexLabel: {
    es: "Proyectos",
    ca: "Projectes",
    en: "Projects",
  },
  /* El cierre de la ficha. Las mismas dos salidas que el hero, por el mismo
     motivo: es el final de la página y quien llegó por un enlace compartido no
     ha visto ninguna. */
  projectCtaHeading: {
    es: "¿Buscas a alguien que construya esto?",
    ca: "Busques algú que construeixi això?",
    en: "Looking for someone who builds this?",
  },
} as const satisfies Record<string, Localized>

export type UiKey = keyof typeof UI

/** Todas las claves del diccionario, para recorrerlo en las pruebas. */
export const UI_KEYS = Object.keys(UI) as UiKey[]

export function t(locale: Locale, key: UiKey): string {
  return UI[key][locale]
}
