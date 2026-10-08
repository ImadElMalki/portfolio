import type { AskQuestionTuple } from "@/lib/askQuestionRotation"

export interface AskQuestionSet {
  es: AskQuestionTuple
  ca: AskQuestionTuple
  en: AskQuestionTuple
}

/**
 * Las preguntas que el sitio propone: doce grupos de cuatro, rotando.
 *
 * ## Los cuatro huecos, y por qué son estos
 *
 * Cada grupo cubre cuatro ángulos distintos, siempre en el mismo orden:
 *
 * 1. **Quién es** — perfil, trayectoria, formación.
 * 2. **Qué sabe hacer** — técnico, calidad, IA.
 * 3. **Qué ha hecho** — proyectos, empresas, este mismo sitio.
 * 4. **Qué puede hacer por ti** — encargo, freelance, disponibilidad.
 *
 * Así las cuatro que se ven a la vez no son cuatro variantes de lo mismo, y
 * cualquiera de las tres cosas que trae a alguien aquí —reclutar, encargar,
 * curiosear un perfil— encuentra una puerta abierta en el primer vistazo.
 *
 * ## Ni una de ocio, y es deliberado
 *
 * El cuarto hueco estuvo reservado a lo personal —correr, montaña, lectura— y
 * eso hacía que **una de cada cuatro** sugerencias de un panel que se
 * llama «Asistente del portfolio» apuntara al sitio equivocado para quien
 * recluta o viene a encargar algo.
 *
 * Lo personal **no se ha quitado del expediente**: las secciones «Running y
 * montaña», «Lectura y aprendizaje» y «Vida, criterio y
 * preferencias» de `askProfile.ts` siguen enteras y el asistente las cuenta en
 * cuanto alguien pregunta. Lo que ha cambiado es que ya no se ofrecen sin que
 * nadie las pida: salen al indagar, que es cuando interesan de verdad.
 *
 * Fuera también «¿Cuántos años tiene Imad?», que abría un grupo. El dato se da
 * si lo piden; proponerlo desde el sitio es invitar a filtrar por edad antes de
 * leer una sola línea del perfil.
 *
 * ## La regla al añadir una
 *
 * **Que el expediente sepa contestarla.** Una sugerencia que acaba en «eso no
 * consta» es peor que no ofrecerla, porque la propone el sitio y no quien
 * pregunta. Antes de dar una por buena, comprobar que el tema está en
 * `askProfile.ts`, `askNotes.ts`, `cv.json` o `services.ts`.
 *
 * ## Y no se editan a mano las copias
 *
 * `public/ask-questions/{es,ca,en}.json` se generan de aquí con
 * `npm run ask:questions`. Ver `scripts/build-ask-questions.mjs`.
 */
export const ASK_QUESTION_SETS = [
  {
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
  },
  {
    es: [
      "¿Cómo pasó de la industria a la programación?",
      "¿Es frontend, backend o full stack?",
      "¿Qué es Race Hub?",
      "¿Puede crear una web para mi negocio?",
    ],
    ca: [
      "Com va passar de la indústria a la programació?",
      "És frontend, backend o full stack?",
      "Què és Race Hub?",
      "Pot crear un web per al meu negoci?",
    ],
    en: [
      "How did he move from industry into software development?",
      "Is he frontend, backend or full stack?",
      "What is Race Hub?",
      "Can he build a website for my business?",
    ],
  },
  {
    es: [
      "¿A qué se dedica actualmente?",
      "¿Qué tecnologías domina y cuáles conoce a nivel básico?",
      "¿Qué hace en CIRNM, SIVCA y MiNT?",
      "¿Está disponible para proyectos freelance?",
    ],
    ca: [
      "A què es dedica actualment?",
      "Quines tecnologies domina i quines coneix a nivell bàsic?",
      "Què fa a CIRNM, SIVCA i MiNT?",
      "Està disponible per a projectes freelance?",
    ],
    en: [
      "What does he currently do?",
      "Which technologies is he strong in and which does he know at a basic level?",
      "What does he do on CIRNM, SIVCA and MiNT?",
      "Is he available for freelance projects?",
    ],
  },
  {
    es: [
      "¿Cuál ha sido su evolución profesional?",
      "¿Cómo integra la IA en su flujo de desarrollo?",
      "¿Qué problemas reales resuelven sus proyectos?",
      "¿Puede automatizar tareas repetitivas de mi empresa?",
    ],
    ca: [
      "Quina ha estat la seva evolució professional?",
      "Com integra la IA en el seu flux de desenvolupament?",
      "Quins problemes reals resolen els seus projectes?",
      "Pot automatitzar tasques repetitives de la meva empresa?",
    ],
    en: [
      "How has his career evolved?",
      "How does he integrate AI into his development workflow?",
      "Which real problems do his projects solve?",
      "Can he automate repetitive tasks in my company?",
    ],
  },
  {
    es: [
      "Resume el perfil de Imad para un recruiter",
      "¿Qué pruebas y controles de calidad aplica?",
      "¿Cómo está construido este portfolio?",
      "¿Qué servicio podría ofrecer a una pequeña empresa?",
    ],
    ca: [
      "Resumeix el perfil de l'Imad per a un recruiter",
      "Quines proves i controls de qualitat aplica?",
      "Com està construït aquest portafolis?",
      "Quin servei podria oferir a una petita empresa?",
    ],
    en: [
      "Summarise Imad's profile for a recruiter",
      "Which tests and quality controls does he apply?",
      "How is this portfolio built?",
      "Which service could he offer a small business?",
    ],
  },
  {
    es: [
      "¿En qué empresas ha trabajado?",
      "¿Tiene experiencia con CI/CD, Sonar y despliegues?",
      "¿Qué hacía en INETUM?",
      "¿Qué tipo de aplicaciones puede desarrollar?",
    ],
    ca: [
      "En quines empreses ha treballat?",
      "Té experiència amb CI/CD, Sonar i desplegaments?",
      "Què feia a INETUM?",
      "Quin tipus d'aplicacions pot desenvolupar?",
    ],
    en: [
      "Which companies has he worked for?",
      "Does he have experience with CI/CD, Sonar and deployments?",
      "What did he do at INETUM?",
      "What kinds of applications can he build?",
    ],
  },
  {
    es: [
      "¿Qué formación y certificaciones tiene?",
      "¿Qué herramientas de IA utiliza?",
      "¿Qué es el Asistente Strava/Garmin?",
      "¿Qué puede hacer por un comercio o un restaurante?",
    ],
    ca: [
      "Quina formació i certificacions té?",
      "Quines eines d'IA utilitza?",
      "Què és l'Assistent Strava/Garmin?",
      "Què pot fer per un comerç o un restaurant?",
    ],
    en: [
      "What education and certifications does he have?",
      "Which AI tools does he use?",
      "What is the Strava/Garmin Training Assistant?",
      "What can he do for a shop or a restaurant?",
    ],
  },
  {
    es: [
      "¿Dónde vive y desde dónde trabaja?",
      "¿Angular o React, frontend o backend?",
      "¿Cómo decide qué tecnología usar en un proyecto propio?",
      "¿Cómo lleva un proyecto desde la idea hasta el despliegue?",
    ],
    ca: [
      "On viu i des d'on treballa?",
      "Angular o React, frontend o backend?",
      "Com decideix quina tecnologia fa servir en un projecte propi?",
      "Com porta un projecte des de la idea fins al desplegament?",
    ],
    en: [
      "Where does he live and where does he work from?",
      "Angular or React, frontend or backend?",
      "How does he decide which technology to use in his own projects?",
      "How does he take a project from idea to deployment?",
    ],
  },
  {
    es: [
      "¿Qué objetivos profesionales tiene?",
      "¿Cómo decide cómo construir un proyecto nuevo?",
      "¿Qué aprendió trabajando en Países Bajos?",
      "¿Por qué contratar a Imad?",
    ],
    ca: [
      "Quins objectius professionals té?",
      "Com decideix com construir un projecte nou?",
      "Què va aprendre treballant als Països Baixos?",
      "Per què contractar l'Imad?",
    ],
    en: [
      "What are his professional goals?",
      "How does he decide how to build a new project?",
      "What did he learn from working in the Netherlands?",
      "Why hire Imad?",
    ],
  },
  {
    es: [
      "¿Qué tres rasgos le definen?",
      "¿Qué experiencia tiene con bases de datos y Docker?",
      "¿De qué proyecto está más orgulloso?",
      "¿Puede mantener y mejorar una aplicación ya hecha?",
    ],
    ca: [
      "Quins tres trets el defineixen?",
      "Quina experiència té amb bases de dades i Docker?",
      "De quin projecte està més orgullós?",
      "Pot mantenir i millorar una aplicació ja feta?",
    ],
    en: [
      "Which three traits best describe him?",
      "What experience does he have with databases and Docker?",
      "Which project is he proudest of?",
      "Can he maintain and improve an existing application?",
    ],
  },
  {
    es: [
      "¿Qué dato curioso hay sobre su trayectoria?",
      "¿Cómo trabaja con Git y con el resto del equipo?",
      "¿Qué proyecto demuestra mejor sus conocimientos?",
      "¿Qué tipo de encargos le interesan?",
    ],
    ca: [
      "Quina dada curiosa hi ha sobre la seva trajectòria?",
      "Com treballa amb Git i amb la resta de l'equip?",
      "Quin projecte demostra millor els seus coneixements?",
      "Quin tipus d'encàrrecs li interessen?",
    ],
    en: [
      "What is an interesting fact about his career path?",
      "How does he work with Git and with the rest of the team?",
      "Which project best demonstrates his skills?",
      "What kind of work is he interested in?",
    ],
  },
  {
    es: [
      "¿Qué parte del stack le gusta más y por qué?",
      "¿Qué sabe de Kotlin, Astro y Cloudflare?",
      "¿Qué construiría si tuviera un mes libre?",
      "¿Cómo se puede contactar con él para un proyecto?",
    ],
    ca: [
      "Quina part de l'stack li agrada més i per què?",
      "Què sap de Kotlin, Astro i Cloudflare?",
      "Què construiria si tingués un mes lliure?",
      "Com se'l pot contactar per a un projecte?",
    ],
    en: [
      "Which part of the stack does he enjoy most, and why?",
      "What does he know about Kotlin, Astro and Cloudflare?",
      "What would he build with a free month?",
      "How can I get in touch with him about a project?",
    ],
  },
] as const satisfies readonly AskQuestionSet[]
