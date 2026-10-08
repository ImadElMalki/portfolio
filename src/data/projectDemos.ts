import type { Localized } from "@/cv"
import list from "@/assets/projects/race-hub/01-list.webp"
import summary from "@/assets/projects/race-hub/02-summary.webp"
import strategy from "@/assets/projects/race-hub/03-strategy.webp"
import logistics from "@/assets/projects/race-hub/04-logistics.webp"
import appearance from "@/assets/projects/race-hub/05-appearance.webp"
import listCyan from "@/assets/projects/race-hub/06-list-cyan.webp"
import amazonSummary from "@/assets/projects/amazon-spending-tracker/01-resumen.webp"
import amazonLight from "@/assets/projects/amazon-spending-tracker/02-comparativa.webp"
import amazonOrders from "@/assets/projects/amazon-spending-tracker/03-pedidos.webp"
import amazonReview from "@/assets/projects/amazon-spending-tracker/04-revision.webp"
import amazonConnect from "@/assets/projects/amazon-spending-tracker/05-conexion.webp"
import raceNext from "@/assets/projects/race-spending-tracker/01-proximas.webp"
import raceHistory from "@/assets/projects/race-spending-tracker/02-historial.webp"
import raceSpend from "@/assets/projects/race-spending-tracker/03-gasto.webp"
import raceReview from "@/assets/projects/race-spending-tracker/04-revisar.webp"
import raceSettings from "@/assets/projects/race-spending-tracker/05-ajustes.webp"
import caixaMonth from "@/assets/projects/caixabank-spending-tracker/01-mes.webp"
import caixaEditor from "@/assets/projects/caixabank-spending-tracker/02-editor.webp"
import caixaSettings from "@/assets/projects/caixabank-spending-tracker/03-ajustes.webp"
import caixaConnect from "@/assets/projects/caixabank-spending-tracker/04-conexion.webp"
import stravaLanding from "@/assets/projects/plataforma-strava-garmin/00-portada.webp"
import stravaPanel from "@/assets/projects/plataforma-strava-garmin/01-panel.webp"
import stravaPerformance from "@/assets/projects/plataforma-strava-garmin/02-rendimiento.webp"
import stravaLoad from "@/assets/projects/plataforma-strava-garmin/03-carga.webp"
import stravaPlan from "@/assets/projects/plataforma-strava-garmin/04-plan.webp"
import stravaOps from "@/assets/projects/plataforma-strava-garmin/05-operaciones.webp"
import cimsGrid from "@/assets/projects/100-cims/01-cims.webp"
import cimsTable from "@/assets/projects/100-cims/02-taula.webp"
import cimsDetail from "@/assets/projects/100-cims/03-detall.webp"
import portfolioHome from "@/assets/projects/portfolio/01-portada.webp"
import portfolioProjects from "@/assets/projects/portfolio/02-proyectos.webp"
import portfolioAsk from "@/assets/projects/portfolio/03-asistente.webp"
import portfolioDetail from "@/assets/projects/portfolio/04-ficha-oscuro.webp"
import riolanCover from "@/assets/projects/riolan-solutions/01-portada.webp"
import riolanAbout from "@/assets/projects/riolan-solutions/02-nosotros.webp"
import riolanServices from "@/assets/projects/riolan-solutions/03-servicios.webp"
import riolanWork from "@/assets/projects/riolan-solutions/04-proyectos.webp"
import riolanContact from "@/assets/projects/riolan-solutions/05-contacto.webp"

/**
 * Forma de una captura: decide el ancho del máster, el marco de la galería y
 * las variantes que se sirven. Las tres cosas están acopladas en
 * `scripts/shot-shapes.mjs`, que enumera estas mismas claves.
 */
export type ShotShape = "phone" | "popup" | "browser"

/**
 * Una captura de la demo de un proyecto.
 *
 * Las imágenes se importan de forma estática: `astro:assets` necesita el módulo
 * para optimizar y calcular dimensiones, y una ruta en texto no le sirve.
 */
export interface DemoShot {
  src: ImageMetadata
  /** Describe la pantalla, no el hecho de ser una captura. */
  alt: Localized
  caption: Localized
  /** Solo si esta captura rompe la forma del proyecto. Por defecto, la suya. */
  shape?: ShotShape
}

export interface ProjectDemo {
  /**
   * Forma de la mayoría de sus capturas.
   *
   * Una tira se lee mejor con una sola forma. Si hay que mezclar, las del mismo
   * tipo van seguidas: los pies de foto se alinean abajo y el salto se nota
   * menos.
   */
  shape: ShotShape
  shots: readonly DemoShot[]
}

/**
 * Clave: el `id` estable del proyecto en `cv.json`. El nombre visible puede
 * localizarse o cambiar sin desconectar la galería.
 *
 * Vive aparte de `cv.json` a propósito: `localizedCv.ts` reparte cada proyecto
 * con un `spread` hacia `/cv.json`, así que un campo aquí acabaría publicando
 * las rutas internas del build en un endpoint con CORS abierto. Y JSON no puede
 * contener los `import` que `astro:assets` exige.
 *
 * Un proyecto sin entrada abre su modal sin galería.
 */
export const PROJECT_DEMOS: Readonly<Record<string, ProjectDemo>> = {
  "amazon-spending-tracker": {
    shape: "popup",
    shots: [
      {
        src: amazonSummary,
        alt: {
          es: "Gasto anual en Amazon con la variación respecto al año anterior, el número de pedidos, la media por pedido y un gráfico de barras por mes.",
          ca: "Despesa anual a Amazon amb la variació respecte a l'any anterior, el nombre de comandes, la mitjana per comanda i un gràfic de barres per mes.",
          en: "Yearly Amazon spending with the change against last year, the order count, the average per order and a monthly bar chart.",
        },
        caption: {
          es: "Gasto anual y desglose por mes",
          ca: "Despesa anual i desglossament per mes",
          en: "Yearly spending broken down by month",
        },
      },
      {
        src: amazonLight,
        alt: {
          es: "La misma vista de resumen en tema claro.",
          ca: "La mateixa vista de resum en tema clar.",
          en: "The same summary view in the light theme.",
        },
        caption: {
          es: "La misma vista en tema claro",
          ca: "La mateixa vista en tema clar",
          en: "The same view in the light theme",
        },
      },
      {
        src: amazonOrders,
        alt: {
          es: "Lista de los últimos pedidos con su fecha e importe, etiquetados como reembolso, suscripción o compra general.",
          ca: "Llista de les darreres comandes amb data i import, etiquetades com a reemborsament, subscripció o compra general.",
          en: "List of recent orders with date and amount, tagged as refund, subscription or general purchase.",
        },
        caption: {
          es: "Últimos pedidos, con reembolsos y suscripciones aparte",
          ca: "Darreres comandes, amb reemborsaments i subscripcions a part",
          en: "Recent orders, with refunds and subscriptions set apart",
        },
      },
      {
        src: amazonReview,
        alt: {
          es: "Revisión manual: dos correos cuyo importe no se pudo leer, cada uno con un campo para introducirlo.",
          ca: "Revisió manual: dos correus amb un import que no s'ha pogut llegir, cadascun amb un camp per introduir-lo.",
          en: "Manual review: two emails whose amount could not be read, each with a field to enter it.",
        },
        caption: {
          es: "Revisión manual de los importes que el correo no deja leer",
          ca: "Revisió manual dels imports que el correu no deixa llegir",
          en: "Manual review of amounts the email does not expose",
        },
      },
      {
        src: amazonConnect,
        alt: {
          es: "Pantalla de conexión: explica que hace falta acceso de solo lectura a Gmail para buscar las confirmaciones de Amazon.",
          ca: "Pantalla de connexió: explica que cal accés de només lectura a Gmail per buscar les confirmacions d'Amazon.",
          en: "Connect screen: explains that read-only Gmail access is needed to find the Amazon confirmations.",
        },
        caption: {
          es: "Conexión con Gmail, con permiso de solo lectura",
          ca: "Connexió amb Gmail, amb permís de només lectura",
          en: "Gmail connection, read-only scope",
        },
      },
    ],
  },
  "100-cims": {
    shape: "browser",
    shots: [
      {
        src: cimsGrid,
        alt: {
          es: "Rejilla de cimas con foto, nombre, comarca y una insignia para las cimas esenciales del reto.",
          ca: "Graella de cims amb foto, nom, comarca i una insígnia per als cims essencials del repte.",
          en: "Grid of summits with photo, name, county and a badge for the challenge's essential peaks.",
        },
        caption: {
          es: "Las 522 cimas del reto, con desplazamiento infinito",
          ca: "Els 522 cims del repte, amb desplaçament infinit",
          en: "All 522 summits of the challenge, with infinite scroll",
        },
      },
      {
        src: cimsTable,
        alt: {
          es: "Modo tabla: columnas ordenables con altitud, comarca y coordenadas, con filtro y selector de columnas.",
          ca: "Mode taula: columnes ordenables amb altitud, comarca i coordenades, amb filtre i selector de columnes.",
          en: "Table mode: sortable columns with elevation, county and coordinates, plus a filter and a column picker.",
        },
        caption: {
          es: "Modo tabla, con filtro y columnas ordenables",
          ca: "Mode taula, amb filtre i columnes ordenables",
          en: "Table mode, with filtering and sortable columns",
        },
      },
      {
        src: cimsDetail,
        alt: {
          es: "Diálogo de detalle de una cima con sus datos y enlaces a las rutas de Wikiloc y a Google Maps.",
          ca: "Diàleg de detall d'un cim amb les seves dades i enllaços a les rutes de Wikiloc i a Google Maps.",
          en: "Detail dialog for a summit with its data and links to Wikiloc routes and Google Maps.",
        },
        caption: {
          es: "Detalle de una cima, con rutas y cómo llegar",
          ca: "Detall d'un cim, amb rutes i com arribar-hi",
          en: "Summit detail, with routes and directions",
        },
      },
    ],
  },
  "strava-garmin-platform": {
    shape: "browser",
    shots: [
      {
        src: stravaLanding,
        alt: {
          es: "Portada pública de la consola, sin ningún dato del atleta.",
          ca: "Portada pública de la consola, sense cap dada de l'atleta.",
          en: "Public landing page of the console, with no athlete data at all.",
        },
        caption: {
          es: "Portada pública, deliberadamente sin datos",
          ca: "Portada pública, deliberadament sense dades",
          en: "Public landing page, deliberately data-free",
        },
      },
      {
        src: stravaPanel,
        alt: {
          es: "Panel con volumen, TRIMP semanal, CTL, ATL, TSB, ACWR, monotonía y días activos, cada uno con su miniatura de tendencia.",
          ca: "Tauler amb volum, TRIMP setmanal, CTL, ATL, TSB, ACWR, monotonia i dies actius, cadascun amb la seva miniatura de tendència.",
          en: "Dashboard with volume, weekly TRIMP, CTL, ATL, TSB, ACWR, monotony and active days, each with its trend sparkline.",
        },
        caption: {
          es: "Panel de carga y forma, con la tendencia de cada métrica",
          ca: "Tauler de càrrega i forma, amb la tendència de cada mètrica",
          en: "Load and form dashboard, with each metric's trend",
        },
      },
      {
        src: stravaPerformance,
        alt: {
          es: "Pestaña de rendimiento: preparación para la carrera objetivo, predicciones y mejores marcas.",
          ca: "Pestanya de rendiment: preparació per a la cursa objectiu, prediccions i millors marques.",
          en: "Performance tab: readiness for the target race, predictions and personal bests.",
        },
        caption: {
          es: "Rendimiento: preparación, predicciones y mejores marcas",
          ca: "Rendiment: preparació, prediccions i millors marques",
          en: "Performance: readiness, predictions and personal bests",
        },
      },
      {
        src: stravaLoad,
        alt: {
          es: "Pestaña de carga con la evolución de la carga aguda y crónica a lo largo del año.",
          ca: "Pestanya de càrrega amb l'evolució de la càrrega aguda i crònica al llarg de l'any.",
          en: "Load tab with acute and chronic training load over the year.",
        },
        caption: {
          es: "Evolución de la carga aguda y crónica",
          ca: "Evolució de la càrrega aguda i crònica",
          en: "Acute and chronic load over time",
        },
      },
      {
        src: stravaPlan,
        alt: {
          es: "Calendario de entrenamiento por semanas, con la sesión de cada día, lo planificado frente a lo realizado y la actividad enlazada desde Strava o Garmin.",
          ca: "Calendari d'entrenament per setmanes, amb la sessió de cada dia, el planificat davant el fet i l'activitat enllaçada des de Strava o Garmin.",
          en: "Weekly training calendar with each day's session, planned against actual, and the activity linked from Strava or Garmin.",
        },
        caption: {
          es: "Calendario de entrenamientos: lo planificado frente a lo realizado",
          ca: "Calendari d'entrenaments: el que estava planificat i el que s'ha fet",
          en: "Training calendar: planned versus completed",
        },
      },
      {
        src: stravaOps,
        alt: {
          es: "Vista de operaciones con la cola de trabajos, los errores, el registro, las ejecuciones y los webhooks recibidos.",
          ca: "Vista d'operacions amb la cua de tasques, els errors, el registre, les execucions i els webhooks rebuts.",
          en: "Operations view with the job queue, errors, log, runs and received webhooks.",
        },
        caption: {
          es: "Operaciones: cola, errores, registro y webhooks",
          ca: "Operacions: cua, errors, registre i webhooks",
          en: "Operations: queue, errors, log and webhooks",
        },
      },
    ],
  },
  "caixabank-spending-tracker": {
    shape: "popup",
    shots: [
      {
        src: caixaMonth,
        alt: {
          es: "Resumen del mes: gasto contra el presupuesto, saldo disponible, neto, ingresos, ahorro y media diaria.",
          ca: "Resum del mes: despesa contra el pressupost, saldo disponible, net, ingressos, estalvi i mitjana diària.",
          en: "Monthly summary: spending against budget, available balance, net, income, savings and daily average.",
        },
        caption: {
          es: "Resumen del mes contra el presupuesto",
          ca: "Resum del mes contra el pressupost",
          en: "Monthly summary against the budget",
        },
      },
      {
        src: caixaEditor,
        alt: {
          es: "Editor de un movimiento: permite corregir su categoría o dejarlo fuera del gasto del mes.",
          ca: "Editor d'un moviment: permet corregir-ne la categoria o deixar-lo fora de la despesa del mes.",
          en: "Transaction editor: lets you change its category or leave it out of the month's spending.",
        },
        caption: {
          es: "Corregir la categoría de un movimiento y recordarla",
          ca: "Corregir la categoria d'un moviment i recordar-la",
          en: "Changing a transaction's category and remembering it",
        },
      },
      {
        src: caixaSettings,
        alt: {
          es: "Ajustes: liquidaciones de tarjeta, fecha desde la que leer correos y presupuesto mensual.",
          ca: "Ajustos: liquidacions de targeta, data des de la qual llegir correus i pressupost mensual.",
          en: "Settings: card settlements, the date to read emails from and the monthly budget.",
        },
        caption: {
          es: "Ajustes: alcance de la lectura y presupuesto mensual",
          ca: "Ajustos: abast de la lectura i pressupost mensual",
          en: "Settings: reading scope and monthly budget",
        },
      },
      {
        src: caixaConnect,
        alt: {
          es: "Pantalla inicial antes de conectar la cuenta de correo.",
          ca: "Pantalla inicial abans de connectar el compte de correu.",
          en: "Initial screen before connecting the mail account.",
        },
        caption: {
          es: "Pantalla inicial, antes de conectar el correo",
          ca: "Pantalla inicial, abans de connectar el correu",
          en: "Initial screen, before connecting the mailbox",
        },
      },
    ],
  },
  "race-spending-tracker": {
    shape: "popup",
    shots: [
      {
        src: raceNext,
        alt: {
          es: "Próximas carreras con su fecha, distancia, plataforma de inscripción e importe pagado.",
          ca: "Properes curses amb data, distància, plataforma d'inscripció i import pagat.",
          en: "Upcoming races with date, distance, entry platform and amount paid.",
        },
        caption: {
          es: "Próximas carreras, con lo que costó cada inscripción",
          ca: "Properes curses, amb el que va costar cada inscripció",
          en: "Upcoming races, with what each entry cost",
        },
      },
      {
        src: raceHistory,
        alt: {
          es: "Historial de carreras ya disputadas, ordenadas de más reciente a más antigua.",
          ca: "Historial de curses ja disputades, ordenades de més recent a més antiga.",
          en: "History of races already run, newest first.",
        },
        caption: {
          es: "Historial de las carreras ya disputadas",
          ca: "Historial de les curses ja disputades",
          en: "History of races already run",
        },
      },
      {
        src: raceSpend,
        alt: {
          es: "Gasto del año contra el presupuesto anual, con euros por kilómetro, media por carrera y un gráfico por mes de inscripción.",
          ca: "Despesa de l'any contra el pressupost anual, amb euros per quilòmetre, mitjana per cursa i un gràfic per mes d'inscripció.",
          en: "Yearly spending against the annual budget, with euros per kilometre, average per race and a chart by entry month.",
        },
        caption: {
          es: "Gasto del año frente al presupuesto y euros por kilómetro",
          ca: "Despesa de l'any davant del pressupost i euros per quilòmetre",
          en: "Yearly spending against budget and euros per kilometre",
        },
      },
      {
        src: raceReview,
        alt: {
          es: "Cola de revisión: correos que no dieron evidencia suficiente para crear una carrera automáticamente.",
          ca: "Cua de revisió: correus que no van donar prou evidència per crear una cursa automàticament.",
          en: "Review queue: emails that gave too little evidence to create a race automatically.",
        },
        caption: {
          es: "Cola de revisión para los correos ambiguos",
          ca: "Cua de revisió per als correus ambigus",
          en: "Review queue for the ambiguous emails",
        },
      },
      {
        src: raceSettings,
        alt: {
          es: "Ajustes: fecha desde la que escanear, lectura de PDF y comprobantes web, presupuesto anual y copias de seguridad.",
          ca: "Ajustos: data des de la qual escanejar, lectura de PDF i comprovants web, pressupost anual i còpies de seguretat.",
          en: "Settings: scan-from date, PDF and web-receipt parsing, annual budget and backups.",
        },
        caption: {
          es: "Ajustes: alcance del escaneo, presupuesto y copias",
          ca: "Ajustos: abast de l'escaneig, pressupost i còpies",
          en: "Settings: scan scope, budget and backups",
        },
      },
    ],
  },
  "race-hub": {
    shape: "phone",
    shots: [
      {
        src: list,
        alt: {
          es: "Lista de carreras con la cuenta atrás de cada una, la distancia y el estado de inscripción.",
          ca: "Llista de curses amb el compte enrere de cadascuna, la distància i l'estat d'inscripció.",
          en: "Race list showing each countdown, the distance and the entry status.",
        },
        caption: {
          es: "Carreras planificadas, ordenadas por cuenta atrás",
          ca: "Curses planificades, ordenades pel compte enrere",
          en: "Planned races, sorted by countdown",
        },
      },
      {
        src: summary,
        alt: {
          es: "Resumen de una media maratón: distancia, desnivel, hora de salida, tiempo meta y cronograma del día de carrera.",
          ca: "Resum d'una mitja marató: distància, desnivell, hora de sortida, temps meta i cronograma del dia de cursa.",
          en: "Half marathon summary: distance, elevation, start time, goal time and race-day timeline.",
        },
        caption: {
          es: "Resumen de la carrera y cronograma del día",
          ca: "Resum de la cursa i cronograma del dia",
          en: "Race summary and race-day timeline",
        },
      },
      {
        src: strategy,
        alt: {
          es: "Tabla de parciales por kilómetro con el ritmo objetivo y el gráfico de ritmo, con estrategias uniforme, negativa, positiva y por desnivel.",
          ca: "Taula de parcials per quilòmetre amb el ritme objectiu i el gràfic de ritme, amb estratègies uniforme, negativa, positiva i per desnivell.",
          en: "Per-kilometre split table with the target pace and pace chart, offering even, negative, positive and elevation-based strategies.",
        },
        caption: {
          es: "Parciales y ritmo calculados en el motor nativo",
          ca: "Parcials i ritme calculats al motor natiu",
          en: "Splits and pace computed by the native engine",
        },
      },
      {
        src: logistics,
        alt: {
          es: "Logística del día de carrera: hora prevista de dormir y levantarse, y desplazamiento con ruta, distancia y duración.",
          ca: "Logística del dia de cursa: hora prevista d'anar a dormir i llevar-se, i desplaçament amb ruta, distància i durada.",
          en: "Race-day logistics: planned bedtime and wake-up, plus the drive with route, distance and duration.",
        },
        caption: {
          es: "Descanso y desplazamiento, calculados hacia atrás desde la salida",
          ca: "Descans i desplaçament, calculats enrere des de la sortida",
          en: "Rest and travel, worked backwards from the start time",
        },
      },
      {
        src: appearance,
        alt: {
          es: "Ajustes de la aplicación con el tema claro, oscuro o de sistema, diez acentos de color, el idioma y las unidades.",
          ca: "Ajustos de l'aplicació amb el tema clar, fosc o de sistema, deu accents de color, l'idioma i les unitats.",
          en: "App settings with light, dark or system theme, ten colour accents, the language and the units.",
        },
        caption: {
          es: "Tema, diez acentos de color, idioma y unidades",
          ca: "Tema, deu accents de color, idioma i unitats",
          en: "Theme, ten colour accents, language and units",
        },
      },
      {
        src: listCyan,
        alt: {
          es: "La misma lista de carreras con el acento cian en vez del rojo: cambia todo el color de la interfaz.",
          ca: "La mateixa llista de curses amb l'accent cian en lloc del vermell: canvia tot el color de la interfície.",
          en: "The same race list with the cyan accent instead of red: the whole interface recolours.",
        },
        caption: {
          es: "La misma pantalla con otro acento seleccionado",
          ca: "La mateixa pantalla amb un altre accent seleccionat",
          en: "The same screen with a different accent selected",
        },
      },
    ],
  },
  portfolio: {
    shape: "browser",
    shots: [
      {
        src: portfolioHome,
        alt: {
          es: "Portada con el nombre en dos líneas, el rol, la situación laboral, los botones de descargar el CV y escribir, y el retrato a la derecha.",
          ca: "Portada amb el nom en dues línies, el rol, la situació laboral, els botons de descarregar el CV i escriure, i el retrat a la dreta.",
          en: "Home page with the name on two lines, the role, the availability line, the download CV and contact buttons, and the portrait on the right.",
        },
        caption: {
          es: "La portada: quién es, qué busca y las dos formas de seguir",
          ca: "La portada: qui és, què busca i les dues formes de seguir",
          en: "The home page: who he is, what he wants and the two ways on",
        },
      },
      {
        src: portfolioProjects,
        alt: {
          es: "Sección de proyectos con tres tarjetas en fila, cada una con miniatura, título, estado y resumen, y un «Ver 5 más» debajo.",
          ca: "Secció de projectes amb tres targetes en fila, cadascuna amb miniatura, títol, estat i resum, i un «Veure 5 més» a sota.",
          en: "Projects section with three cards in a row, each with a thumbnail, title, status and summary, and a «Show 5 more» below.",
        },
        caption: {
          es: "Tres destacados a la vista; el resto, a un clic",
          ca: "Tres destacats a la vista; la resta, a un clic",
          en: "Three featured in view; the rest one click away",
        },
      },
      {
        src: portfolioAsk,
        alt: {
          es: "Panel del asistente abierto sobre la portada, con una pregunta escrita y su respuesta en texto monoespaciado.",
          ca: "Panell de l'assistent obert sobre la portada, amb una pregunta escrita i la seva resposta en text monoespaiat.",
          en: "The assistant panel open over the home page, with a typed question and its answer in monospaced text.",
        },
        caption: {
          es: "El asistente responde sobre el CV, en streaming y con el expediente en el servidor",
          ca: "L'assistent respon sobre el CV, en streaming i amb l'expedient al servidor",
          en: "The assistant answers about the CV, streamed and with the dossier kept server-side",
        },
      },
      {
        src: portfolioDetail,
        alt: {
          es: "Ficha de un proyecto en tema oscuro, con dos capturas en tira, el resumen técnico, los logros y los chips de tecnología.",
          ca: "Fitxa d'un projecte en tema fosc, amb dues captures en tira, el resum tècnic, els assoliments i els xips de tecnologia.",
          en: "A project page in dark theme, with two screenshots in a strip, the technical summary, the highlights and the technology chips.",
        },
        caption: {
          es: "Una ficha de proyecto, en tema oscuro",
          ca: "Una fitxa de projecte, en tema fosc",
          en: "A project page, in dark theme",
        },
      },
    ],
  },
  "riolan-solutions": {
    shape: "browser",
    shots: [
      {
        src: riolanCover,
        alt: {
          es: "Portada con el logotipo centrado sobre un fondo azul claro y cinco especialidades en píldoras: electricidad, fontanería, calefacción, aire acondicionado y reformas integrales.",
          ca: "Portada amb el logotip centrat sobre un fons blau clar i cinc especialitats en píndoles: electricitat, lampisteria, calefacció, aire condicionat i reformes integrals.",
          en: "Home page with the logo centred on a pale blue background and five specialities as pills: electrics, plumbing, heating, air conditioning and full renovations.",
        },
        caption: {
          es: "Portada, con las cinco especialidades de la empresa",
          ca: "Portada, amb les cinc especialitats de l'empresa",
          en: "Home page, with the company's five specialities",
        },
      },
      {
        src: riolanAbout,
        alt: {
          es: "Sección «Sobre Nosotros» con un texto de presentación y tres tarjetas: garantía de calidad, asistencia individual y reformas integrales.",
          ca: "Secció «Sobre Nosaltres» amb un text de presentació i tres targetes: garantia de qualitat, assistència individual i reformes integrals.",
          en: "«About us» section with an introduction and three cards: quality guarantee, individual support and full renovations.",
        },
        caption: {
          es: "Presentación de la empresa en tres compromisos",
          ca: "Presentació de l'empresa en tres compromisos",
          en: "The company introduced through three commitments",
        },
      },
      {
        src: riolanServices,
        alt: {
          es: "Rejilla de seis servicios en tarjetas oscuras con icono propio: servicios generales, inspección, electricidad, fontanería, mantenimiento y reformas.",
          ca: "Graella de sis serveis en targetes fosques amb icona pròpia: serveis generals, inspecció, electricitat, lampisteria, manteniment i reformes.",
          en: "Grid of six services on dark cards with their own icon: general services, inspection, electrics, plumbing, maintenance and renovations.",
        },
        caption: {
          es: "Los seis servicios, con la iconografía hecha a medida",
          ca: "Els sis serveis, amb la iconografia feta a mida",
          en: "The six services, with the bespoke iconography",
        },
      },
      {
        src: riolanWork,
        alt: {
          es: "Galería de trabajos con fotos de obra reales: cuadros eléctricos, instalaciones de fontanería, estructuras metálicas y montajes en cubierta.",
          ca: "Galeria de treballs amb fotos d'obra reals: quadres elèctrics, instal·lacions de lampisteria, estructures metàl·liques i muntatges en coberta.",
          en: "Work gallery with real job-site photos: distribution boards, plumbing installations, metal structures and roof assemblies.",
        },
        caption: {
          es: "Galería de obra, con 32 trabajos de la empresa",
          ca: "Galeria d'obra, amb 32 treballs de l'empresa",
          en: "Work gallery, with 32 of the company's jobs",
        },
      },
      {
        src: riolanContact,
        alt: {
          es: "Formulario de contacto con nombre, correo, comentarios y teléfono, sobre el pie con el menú, el número de la empresa y las redes sociales.",
          ca: "Formulari de contacte amb nom, correu, comentaris i telèfon, sobre el peu amb el menú, el número de l'empresa i les xarxes socials.",
          en: "Contact form with name, email, comments and phone, above the footer with the menu, the company number and the social links.",
        },
        caption: {
          es: "Contacto y pie, con el teléfono siempre a la vista",
          ca: "Contacte i peu, amb el telèfon sempre a la vista",
          en: "Contact and footer, with the phone always in sight",
        },
      },
    ],
  },
}
