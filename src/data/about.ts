/* Desde `locales.ts` y no desde `@/cv`: es donde el tipo se declara de verdad,
   y `@/cv` abre con `import { getEntry } from "astro:content"`. Da igual que
   aquí sólo se pida un tipo — quien tenga que **comprobar** este archivo
   necesita resolver esa cadena, y el Worker de `/api/ask`, que lee estos dos
   módulos, no vive dentro de Astro. Es el mismo motivo por el que `locales.ts`
   se separó de `cvSchema.ts`; ver su cabecera. */
import type { Localized } from "@/lib/locales"

export interface AboutSection {
  id: string
  title: Localized
  paragraphs: readonly Localized[]
}

/**
 * La presentación personal larga, separada del currículum.
 *
 * `cv.json` mantiene un resumen corto compatible con JSON Resume. Este relato
 * no entra en Markdown, ni en el PDF, ni en el endpoint público del CV: los
 * tres son el currículum, y esto no lo es.
 *
 * ## Lo que cambió con `ask`
 *
 * Antes esta nota decía «ni consola», y era verdad mientras la consola sólo
 * sabía imprimir campos del CV. Desde que existe `/api/ask`, este módulo **sí**
 * llega a la consola: el Worker lo lee para componer el expediente del modelo,
 * porque preguntar «¿cómo trabaja?» o «¿de dónde es?» se responde justo con
 * esto y no con una lista de empleos.
 *
 * La diferencia con el resto de canales es que aquí el texto no se publica tal
 * cual: se usa para responder. Aun así conviene leerlo como público — ver el
 * aviso sobre `ASK_DOSSIER` en `functions/api/ask.ts` —, y nada de lo que hay
 * aquí desentona con eso: es lo mismo que ya se lee en `/sobre-mi/`.
 */
export const ABOUT_COPY = {
  pageTitle: {
    es: "Sobre mí",
    ca: "Sobre mi",
    en: "About me",
  },
  /* Es la `meta name="description"`, o sea lo que sale en Google. Prometía «por
     qué el running, la montaña y los proyectos propios forman parte de mi forma
     de aprender», que era exacto mientras «Fuera del código» ocupaba dos
     párrafos largos sobre ritmos, rutas y constancia. Con la página acortada eso
     ya no se argumenta en ningún sitio, así que la descripción pasa a decir lo
     que el cuerpo dice hoy: de dónde vengo, cómo trabajo y de dónde salen los
     proyectos. */
  pageDescription: {
    es: "Mi recorrido hasta el desarrollo, cómo enfoco los problemas y de dónde salen mis proyectos personales.",
    ca: "El meu recorregut fins al desenvolupament, com enfoco els problemes i d'on surten els meus projectes personals.",
    en: "My path into development, how I approach problems, and where my personal projects come from.",
  },
  eyebrow: {
    es: "La persona detrás del código",
    ca: "La persona darrere del codi",
    en: "The person behind the code",
  },
  headline: {
    es: "Me gusta entender bien un problema y construir algo que de verdad ayude.",
    ca: "M'agrada entendre bé un problema i construir alguna cosa que ajudi de veritat.",
    en: "I like getting to the bottom of a problem and building something that genuinely helps.",
  },
  intro: {
    es: "Soy Imad, desarrollador de software. Trabajo principalmente con Angular y Java, aunque en mis proyectos personales también desarrollo para web, Android y la nube.",
    ca: "Soc l'Imad, desenvolupador de programari. Treballo principalment amb Angular i Java, tot i que en els meus projectes personals també desenvolupo per a web, Android i el núvol.",
    en: "I'm Imad, a software developer. I work mainly with Angular and Java, although in my own projects I also build for the web, Android and the cloud.",
  },
  sections: [
    {
      id: "path",
      title: {
        es: "Cómo llegué hasta aquí",
        ca: "Com he arribat fins aquí",
        en: "How I got here",
      },
      paragraphs: [
        {
          es: "Antes de dedicarme al desarrollo trabajé en sectores muy distintos: logística, industria, hostelería y atención al cliente.",
          ca: "Abans de dedicar-me al desenvolupament vaig treballar en sectors molt diferents: logística, indústria, hostaleria i atenció al client.",
          en: "Before moving into development I worked in very different sectors: logistics, industry, hospitality and customer service.",
        },
        {
          es: "En 2021 decidí estudiar Desarrollo de Aplicaciones Web. Empecé profesionalmente en INETUM y desde 2023 trabajo en VIEWNEXT desarrollando aplicaciones Angular para el sector público junto a equipos Java y QA.",
          ca: "El 2021 vaig decidir estudiar Desenvolupament d'Aplicacions Web. Vaig començar professionalment a INETUM i des del 2023 treballo a VIEWNEXT desenvolupant aplicacions Angular per al sector públic al costat d'equips Java i QA.",
          en: "In 2021 I decided to study Web Application Development. I started professionally at INETUM and since 2023 I have been at VIEWNEXT, building Angular applications for the public sector alongside Java and QA teams.",
        },
      ],
    },
    {
      id: "work",
      title: {
        es: "Cómo trabajo",
        ca: "Com treballo",
        en: "How I work",
      },
      paragraphs: [
        {
          es: "Me gusta entender primero el problema y después buscar la solución más sencilla posible. Intento construir aplicaciones claras, mantenibles y cómodas de utilizar, evitando añadir complejidad innecesaria.",
          ca: "M'agrada entendre primer el problema i després buscar la solució més senzilla possible. Intento construir aplicacions clares, mantenibles i còmodes d'utilitzar, evitant afegir complexitat innecessària.",
          en: "I like to understand the problem first and then look for the simplest possible solution. I try to build applications that are clear, maintainable and comfortable to use, without adding unnecessary complexity.",
        },
      ],
    },
    {
      id: "outside-code",
      title: {
        es: "Fuera del código",
        ca: "Fora del codi",
        en: "Outside code",
      },
      paragraphs: [
        {
          es: "El running y la montaña ocupan buena parte de mi tiempo libre.",
          ca: "Córrer i la muntanya ocupen bona part del meu temps lliure.",
          en: "Running and the mountains take up a good part of my free time.",
        },
        {
          es: "También son el origen de algunos de mis proyectos. Race Hub y mi plataforma para Strava nacieron de necesidades que tenía yo mismo: primero apareció el problema y después construí la herramienta que quería utilizar.",
          ca: "També són l'origen d'alguns dels meus projectes. Race Hub i la meva plataforma per a Strava van néixer de necessitats que tenia jo mateix: primer va aparèixer el problema i després vaig construir l'eina que volia utilitzar.",
          en: "They are also where some of my projects come from. Race Hub and my Strava platform grew out of needs I had myself: the problem came first, then I built the tool I wanted to use.",
        },
      ],
    },
  ] as const satisfies readonly AboutSection[],
  closingTitle: {
    es: "Si te encaja",
    ca: "Si t'encaixa",
    en: "If it fits",
  },
  closingBody: {
    es: "Si quieres conocer mejor lo que hago, puedes ver mis proyectos o contactar conmigo.",
    ca: "Si vols conèixer millor el que faig, pots veure els meus projectes o contactar amb mi.",
    en: "If you'd like to get a better sense of what I do, take a look at my projects or get in touch.",
  },
  projectsLabel: {
    es: "Ver mis proyectos",
    ca: "Veure els meus projectes",
    en: "See my projects",
  },
  contactLabel: {
    es: "Contactar",
    ca: "Contactar",
    en: "Get in touch",
  },
} as const
