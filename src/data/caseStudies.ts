import type { Localized } from "@/lib/locales"

/**
 * El caso de estudio de un proyecto: lo que no cabe en el currículum.
 *
 * ## Por qué fuera de `cv.json`
 *
 * `cv.json` sigue el esquema de JSON Resume y lo sirve `/cv.json` en público;
 * de él salen además el PDF de una hoja y `/cv.md`. Un caso de estudio son
 * entre quinientas y mil palabras por proyecto y por idioma: metido ahí
 * inflaría los tres sin que ninguno lo use —el PDF no cabría, y JSON Resume no
 * tiene dónde ponerlo—. Lo que el currículum dice de un proyecto es su
 * `overview` y sus `highlights`; esto es la capa de abajo, y sólo la lee la
 * ficha.
 *
 * ## Por qué es opcional
 *
 * Un caso de estudio se escribe con datos que sólo tiene quien hizo el
 * proyecto: qué decidió y por qué, qué salió, qué cambiaría. Escribirlo a
 * medias con frases de relleno es peor que no tenerlo, porque quien lee nota
 * la diferencia y deja de creerse el resto. Así que `ProjectDetail.astro`
 * pinta estas secciones **sólo** si existe la entrada, y un proyecto sin ella
 * se queda como estaba.
 *
 * `caseStudies.test.ts` comprueba que los ids existan en `cv.json` y que
 * ningún idioma se quede vacío; lo que no puede comprobar es que lo escrito
 * sea verdad.
 */
export interface CaseStudyDecision {
  /** Qué se decidió, en una línea. */
  title: Localized
  /** Por qué, y contra qué alternativa. Esto es lo que se lee de verdad. */
  why: Localized
}

export interface CaseStudy {
  /** El problema y de dónde salió. Sin esto, lo demás no se entiende. */
  context: Localized
  /** Qué hizo él en concreto, sobre todo si hubo más gente. */
  role: Localized
  decisions: readonly CaseStudyDecision[]
  /** Qué pasó. Con cifras cuando las haya; sin inventarlas cuando no. */
  outcome: readonly Localized[]
  /** Qué cambiaría hoy. Es la sección que más dice de quien la escribe. */
  lessons: Localized
}

export const CASE_STUDIES = {
  "100-cims": {
    context: {
      es: "El reto 100 Cims de la FEEC son 522 cimas, y la lista oficial vive en documentos pensados para imprimirse: no hay forma de filtrarla, ordenarla ni marcar por dónde vas. Quien lo intenta acaba con una hoja de cálculo a mano que se desactualiza sola. La idea era un catálogo público de las 522 y, detrás de una sesión, el progreso de cada uno.",
      ca: "El repte 100 Cims de la FEEC són 522 cims, i la llista oficial viu en documents pensats per imprimir-se: no hi ha manera de filtrar-la, ordenar-la ni marcar per on vas. Qui ho intenta acaba amb un full de càlcul a mà que es desactualitza sol. La idea era un catàleg públic dels 522 i, darrere d'una sessió, el progrés de cadascú.",
      en: "The FEEC's 100 Cims challenge is 522 summits, and the official list lives in documents meant to be printed: there is no way to filter it, sort it or mark how far you have got. Anyone who tries ends up with a hand-made spreadsheet that goes stale on its own. The idea was a public catalogue of all 522 and, behind a session, each person's progress.",
    },
    role: {
      es: "Todo: la interfaz en Angular, la API en Spring Boot, el esquema de PostgreSQL, la canalización de datos en Python y el empaquetado en Docker.",
      ca: "Tot: la interfície en Angular, l'API en Spring Boot, l'esquema de PostgreSQL, la canalització de dades en Python i l'empaquetat en Docker.",
      en: "Everything: the Angular interface, the Spring Boot API, the PostgreSQL schema, the Python data pipeline and the Docker packaging.",
    },
    decisions: [
      {
        title: {
          es: "Los datos los prepara un proceso, no una persona",
          ca: "Les dades les prepara un procés, no una persona",
          en: "A pipeline prepares the data, not a person",
        },
        why: {
          es: "Siete guiones de Python recogen las cimas, descargan sus imágenes, las optimizan a WebP, las insertan y pueden restaurar el conjunto entero desde el CSV. Teclear 522 filas a mano se hace una vez; cuando la FEEC corrige una altitud o cambia una foto hay que volver a empezar, y entonces el que se cansa reescribe sólo lo que recuerda. Con el proceso, rehacerlo es volver a lanzarlo.",
          ca: "Set guions de Python recullen els cims, descarreguen les seves imatges, les optimitzen a WebP, les insereixen i poden restaurar el conjunt sencer des del CSV. Teclejar 522 files a mà es fa una vegada; quan la FEEC corregeix una altitud o canvia una foto cal tornar a començar, i llavors el que es cansa reescriu només el que recorda. Amb el procés, refer-ho és tornar a llançar-lo.",
          en: "Seven Python scripts collect the summits, download their images, optimise them to WebP, insert them and can rebuild the whole dataset from the CSV. Typing 522 rows by hand happens once; when the FEEC corrects an altitude or swaps a photo you start again, and whoever gets tired rewrites only what they remember. With the pipeline, redoing it means running it again.",
        },
      },
      {
        title: {
          es: "La carga exige exactamente 522, o falla",
          ca: "La càrrega exigeix exactament 522, o falla",
          en: "The load demands exactly 522, or it fails",
        },
        why: {
          es: "La migración de Flyway es idempotente y comprueba el número. Una carga que inserta 500 de 522 y sigue adelante deja la aplicación en pie, con aspecto correcto y con veintidós cimas que no existen para nadie; nadie la mira hasta que alguien busca la suya y no está. Fallar en el arranque es ruidoso, y eso es exactamente lo que se quiere de un dato que se carga una vez.",
          ca: "La migració de Flyway és idempotent i comprova el número. Una càrrega que insereix 500 de 522 i continua endavant deixa l'aplicació dempeus, amb aspecte correcte i amb vint-i-dos cims que no existeixen per a ningú; ningú la mira fins que algú busca el seu i no hi és. Fallar a l'arrencada és sorollós, i això és exactament el que es vol d'una dada que es carrega una vegada.",
          en: "The Flyway migration is idempotent and checks the count. A load that inserts 500 of 522 and carries on leaves the application standing, looking right, with twenty-two summits that exist for nobody; no one notices until someone looks for theirs and it is not there. Failing at startup is loud, and that is exactly what you want from data loaded once.",
        },
      },
      {
        title: {
          es: "Las imágenes a R2, verificadas por hash",
          ca: "Les imatges a R2, verificades per hash",
          en: "Images to R2, verified by hash",
        },
        why: {
          es: "La sincronización con Cloudflare R2 es idempotente, vuelve a descargar cada objeto, compara su SHA-256 y exige que las claves sean exactamente 522. Un «subido correctamente» que nadie vuelve a leer no dice nada: lo que importa es que lo que está arriba sea byte a byte lo que se subió. En desarrollo las sirve Nginx desde la copia local, así que levantar el proyecto no depende del bucket.",
          ca: "La sincronització amb Cloudflare R2 és idempotent, torna a descarregar cada objecte, compara el seu SHA-256 i exigeix que les claus siguin exactament 522. Un «pujat correctament» que ningú torna a llegir no diu res: el que importa és que el que hi ha a dalt sigui byte a byte el que es va pujar. En desenvolupament les serveix Nginx des de la còpia local, així que aixecar el projecte no depèn del bucket.",
          en: "The Cloudflare R2 sync is idempotent, downloads every object back, compares its SHA-256 and demands exactly 522 keys. An «uploaded successfully» that nobody reads back says nothing: what matters is that what is up there is byte for byte what was sent. In development Nginx serves them from the local copy, so bringing the project up does not depend on the bucket.",
        },
      },
      {
        title: {
          es: "Las pruebas de integración van contra una base de verdad",
          ca: "Les proves d'integració van contra una base de veritat",
          en: "Integration tests run against a real database",
        },
        why: {
          es: "Testcontainers levanta PostgreSQL 18.4 para las pruebas del backend, y si no hay Docker se saltan en vez de caer a una base local. Una prueba contra una base simulada pasa mientras la migración real falla, que es el modo de fallo que de verdad importa aquí; y una que usa la base del portátil arrastra los datos de ayer. Las imágenes de Docker van fijadas por versión **y** digest, para que la de dentro de un año sea la misma.",
          ca: "Testcontainers aixeca PostgreSQL 18.4 per a les proves del backend, i si no hi ha Docker se salten en lloc de caure a una base local. Una prova contra una base simulada passa mentre la migració real falla, que és el mode de fallada que de debò importa aquí; i una que fa servir la base del portàtil arrossega les dades d'ahir. Les imatges de Docker van fixades per versió **i** digest, perquè la d'aquí a un any sigui la mateixa.",
          en: "Testcontainers brings up PostgreSQL 18.4 for the backend tests, and when Docker is missing they are skipped rather than falling back to a local database. A test against a mocked database passes while the real migration fails, which is the failure mode that matters here; and one using the laptop's database drags yesterday's data along. The Docker images are pinned by version **and** digest, so next year's is the same one.",
        },
      },
    ],
    outcome: [
      {
        es: "Las 522 cimas en un catálogo con filtros, fichas, fotografías y tabla ordenable, que se reconstruye entero desde el CSV con un comando.",
        ca: "Els 522 cims en un catàleg amb filtres, fitxes, fotografies i taula ordenable, que es reconstrueix sencer des del CSV amb una ordre.",
        en: "All 522 summits in a catalogue with filters, detail pages, photographs and a sortable table, rebuilt in full from the CSV with one command.",
      },
      {
        es: "El progreso personal queda detrás de Google OAuth, con CSRF para SPA y cookies de sesión `HttpOnly`, `SameSite=Lax` y `Secure`: el catálogo es público y lo que has subido tú, no.",
        ca: "El progrés personal queda darrere de Google OAuth, amb CSRF per a SPA i galetes de sessió `HttpOnly`, `SameSite=Lax` i `Secure`: el catàleg és públic i el que has pujat tu, no.",
        en: "Personal progress sits behind Google OAuth, with SPA CSRF and `HttpOnly`, `SameSite=Lax`, `Secure` session cookies: the catalogue is public and what you have climbed is not.",
      },
      {
        es: "Todo el stack arranca con un `docker compose up`: PostgreSQL 18, Flyway, la API en Java 25 y el Angular servido por Nginx, con cada imagen fijada por digest.",
        ca: "Tot l'stack arrenca amb un `docker compose up`: PostgreSQL 18, Flyway, l'API en Java 25 i l'Angular servit per Nginx, amb cada imatge fixada per digest.",
        en: "The whole stack starts with one `docker compose up`: PostgreSQL 18, Flyway, the Java 25 API and the Angular app served by Nginx, every image pinned by digest.",
      },
    ],
    lessons: {
      es: "Las 522 imágenes en WebP entraron en el repositorio antes de que existiera el bucket, y ahí siguen: el historial de Git carga con ellas y hay que purgarlo con `filter-repo` en cuanto el dominio de medios esté conectado. Un binario que entra en Git no se va solo, y reescribir el historial de un repositorio compartido es caro. Hoy empezaría por el almacenamiento de objetos aunque al principio pareciera desproporcionado para una carpeta de fotos.",
      ca: "Les 522 imatges en WebP van entrar al repositori abans que existís el bucket, i allà continuen: l'historial de Git carrega amb elles i cal purgar-lo amb `filter-repo` tan bon punt el domini de mitjans estigui connectat. Un binari que entra a Git no se'n va sol, i reescriure l'historial d'un repositori compartit és car. Avui començaria per l'emmagatzematge d'objectes encara que al principi semblés desproporcionat per a una carpeta de fotos.",
      en: "The 522 WebP images went into the repository before the bucket existed, and they are still there: the Git history carries them and will need purging with \`filter-repo\` as soon as the media domain is connected. A binary that enters Git does not leave on its own, and rewriting the history of a shared repository is expensive. Today I would start with object storage even if it looked like overkill for a folder of photos.",
    },
  },

  "strava-garmin-platform": {
    context: {
      es: "Strava titula cada entrenamiento «Carrera de la tarde» y la descripción se queda vacía, así que el historial de un año no dice nada de cómo fue ninguno de esos días. Los datos para contarlo sí están: el plan de entrenamiento, la meteorología de esa hora y, si la actividad era una carrera, su web oficial. Lo que faltaba era algo que los juntara solo, cada día, sin acordarse.",
      ca: "Strava titula cada entrenament «Cursa de la tarda» i la descripció es queda buida, així que l'historial d'un any no diu res de com va anar cap d'aquells dies. Les dades per explicar-ho sí que hi són: el pla d'entrenament, la meteorologia d'aquella hora i, si l'activitat era una cursa, el seu web oficial. El que faltava era alguna cosa que els ajuntés sola, cada dia, sense recordar-se'n.",
      en: "Strava titles every workout «Afternoon Run» and leaves the description empty, so a year of history says nothing about how any of those days went. The data to tell it does exist: the training plan, the weather at that hour and, if the activity was a race, its official page. What was missing was something to put them together on its own, every day, without having to remember.",
    },
    role: {
      es: "Todo: el Worker, el esquema de D1, las colas, el panel de administración en React y las herramientas locales que importan los ficheros de Garmin.",
      ca: "Tot: el Worker, l'esquema de D1, les cues, el tauler d'administració en React i les eines locals que importen els fitxers de Garmin.",
      en: "Everything: the Worker, the D1 schema, the queues, the React admin dashboard and the local tools that import Garmin files.",
    },
    decisions: [
      {
        title: {
          es: "El webhook encola y contesta; el trabajo va aparte",
          ca: "El webhook encua i contesta; la feina va a part",
          en: "The webhook enqueues and answers; the work happens elsewhere",
        },
        why: {
          es: "Strava da dos segundos para responder a un webhook, y lo que hay que hacer —leer la actividad, cruzarla con el plan, pedir el clima, generar el texto y volver a publicarlo— no cabe. El webhook deja un trabajo en una cola de Cloudflare y responde; la cola lo procesa con reintentos y lo que agota los reintentos cae en una cola muerta en vez de desaparecer. Sin esa segunda cola, un fallo de la API de terceros se traga el día sin dejar rastro.",
          ca: "Strava dona dos segons per respondre a un webhook, i el que cal fer —llegir l'activitat, creuar-la amb el pla, demanar el clima, generar el text i tornar-lo a publicar— no hi cap. El webhook deixa una feina en una cua de Cloudflare i respon; la cua la processa amb reintents i el que esgota els reintents cau en una cua morta en lloc de desaparèixer. Sense aquesta segona cua, una fallada de l'API de tercers s'empassa el dia sense deixar rastre.",
          en: "Strava gives two seconds to answer a webhook, and the work — read the activity, match it against the plan, fetch the weather, generate the copy and publish it back — does not fit. The webhook drops a job on a Cloudflare queue and answers; the queue processes it with retries, and whatever exhausts them lands in a dead-letter queue instead of vanishing. Without that second queue, a third-party API failure swallows the day without a trace.",
        },
      },
      {
        title: {
          es: "Al modelo no le llega dónde vives",
          ca: "Al model no li arriba on vius",
          en: "The model is not told where you live",
        },
        why: {
          es: "El punto de inicio de una tirada que sale de casa es el domicilio, y esa coordenada iba entera al prompt de un tercero y se quedaba guardada en claro en la tabla de carreras. Ahora se redondea a dos decimales, que son unos 1,1 km: suficiente para distinguir dos carreras con el mismo nombre en ciudades distintas, que es lo único para lo que estaba ahí, e insuficiente para señalar un portal. Los tokens de Strava, además, van cifrados con AES-GCM en la base.",
          ca: "El punt d'inici d'una tirada que surt de casa és el domicili, i aquesta coordenada anava sencera al prompt d'un tercer i es quedava desada en clar a la taula de curses. Ara s'arrodoneix a dos decimals, que són uns 1,1 km: suficient per distingir dues curses amb el mateix nom en ciutats diferents, que és l'única cosa per a la qual hi era, i insuficient per assenyalar un portal. Els tokens de Strava, a més, van xifrats amb AES-GCM a la base.",
          en: "The start point of a run that leaves from home is the home address, and that coordinate went whole into a third party's prompt and was stored in cleartext in the races table. It is now rounded to two decimals, about 1.1 km: enough to tell two races with the same name in different cities apart, which is all it was there for, and not enough to point at a doorway. The Strava tokens are also encrypted with AES-GCM in the database.",
        },
      },
      {
        title: {
          es: "El modelo escribe la prosa; los números los pone el código",
          ca: "El model escriu la prosa; els números els posa el codi",
          en: "The model writes the prose; the code writes the numbers",
        },
        why: {
          es: "El título y la entradilla los genera un modelo, pero el bloque de métricas es determinista y se calcula aparte. Un modelo que redacta bien también redondea ritmos, inventa un desnivel plausible y nadie lo nota hasta que alguien compara con el reloj. Separarlos deja que cada parte haga lo que sabe, y que un cambio de modelo no mueva ni una cifra.",
          ca: "El títol i l'entradeta els genera un model, però el bloc de mètriques és determinista i es calcula a part. Un model que redacta bé també arrodoneix ritmes, inventa un desnivell plausible i ningú ho nota fins que algú ho compara amb el rellotge. Separar-los deixa que cada part faci el que sap, i que un canvi de model no mogui ni una xifra.",
          en: "A model generates the title and the opening line, but the metrics block is deterministic and computed separately. A model that writes well also rounds paces, invents a plausible elevation gain, and nobody notices until someone checks against the watch. Keeping them apart lets each side do what it is good at, and means swapping the model moves no number.",
        },
      },
      {
        title: {
          es: "Garmin se importa desde fuera, no desde el Worker",
          ca: "Garmin s'importa des de fora, no des del Worker",
          en: "Garmin is imported from outside, not from the Worker",
        },
        why: {
          es: "Garmin Connect no tiene una API abierta como la de Strava: hay que iniciar sesión, pasar el segundo factor y decodificar ficheros FIT. Eso vive en herramientas locales que leen y envían al Worker, en vez de meter credenciales de Garmin y un decodificador binario dentro de algo que corre siempre y de cara a internet. La superficie expuesta se queda en lo que de verdad tiene que estar expuesto.",
          ca: "Garmin Connect no té una API oberta com la de Strava: cal iniciar sessió, passar el segon factor i descodificar fitxers FIT. Això viu en eines locals que llegeixen i envien al Worker, en lloc de ficar credencials de Garmin i un descodificador binari dins d'alguna cosa que corre sempre i de cara a internet. La superfície exposada es queda en el que de debò ha d'estar exposat.",
          en: "Garmin Connect has no open API like Strava's: you have to log in, pass the second factor and decode FIT files. That lives in local tools that read and push to the Worker, rather than putting Garmin credentials and a binary decoder inside something that runs permanently and faces the internet. The exposed surface stays limited to what actually has to be exposed.",
        },
      },
    ],
    outcome: [
      {
        es: "197 commits entre abril y septiembre de 2026, 387 ficheros de TypeScript y 36 migraciones de D1: un servicio que lleva meses publicando solo.",
        ca: "197 commits entre abril i setembre de 2026, 387 fitxers de TypeScript i 36 migracions de D1: un servei que porta mesos publicant sol.",
        en: "197 commits between April and September 2026, 387 TypeScript files and 36 D1 migrations: a service that has been publishing on its own for months.",
      },
      {
        es: "40 ficheros de pruebas con casi 11 000 líneas, corriendo dentro del propio runtime de Workers y no en un Node simulado.",
        ca: "40 fitxers de proves amb gairebé 11 000 línies, corrent dins del mateix runtime de Workers i no en un Node simulat.",
        en: "40 test files with nearly 11,000 lines, running inside the Workers runtime itself rather than a simulated Node.",
      },
      {
        es: "Dos fuentes de datos —Strava por webhook y Garmin por fichero FIT— acaban en el mismo historial, con clima y carrera oficial cuando los hay.",
        ca: "Dues fonts de dades —Strava per webhook i Garmin per fitxer FIT— acaben al mateix historial, amb clima i cursa oficial quan n'hi ha.",
        en: "Two data sources — Strava by webhook and Garmin by FIT file — land in the same history, with weather and the official race when they exist.",
      },
    ],
    lessons: {
      es: "La coordenada del domicilio llegó a viajar a un tercero antes de que nadie se preguntara qué se estaba enviando, y se arregló después, leyendo el código con otros ojos. Esa pregunta —qué sale de aquí y a dónde— no se puede dejar para una auditoría: va en el momento de escribir la primera llamada. Y el proyecto creció hasta las 62 000 líneas para algo que usa una persona; la mitad de las funciones del panel las he abierto dos veces.",
      ca: "La coordenada del domicili va arribar a viatjar a un tercer abans que ningú es preguntés què s'estava enviant, i es va arreglar després, llegint el codi amb altres ulls. Aquesta pregunta —què surt d'aquí i on va— no es pot deixar per a una auditoria: va en el moment d'escriure la primera crida. I el projecte va créixer fins a les 62 000 línies per a una cosa que fa servir una persona; la meitat de les funcions del tauler les he obert dues vegades.",
      en: "The home coordinate did travel to a third party before anyone asked what was being sent, and it was fixed afterwards, by rereading the code with fresh eyes. That question — what leaves here, and where does it go — cannot wait for an audit: it belongs at the moment you write the first call. And the project grew to 62,000 lines for something one person uses; half the dashboard's features I have opened twice.",
    },
  },

  "amazon-spending-tracker": {
    context: {
      es: "Amazon no enseña cuánto llevas gastado en el año. Está repartido entre pedidos, devoluciones y varias cuentas de país, y la única vista completa que existe son los correos de confirmación, que sí están todos juntos en el buzón. El problema era leerlos sin convertirlos en otro sitio donde tus compras están guardadas.",
      ca: "Amazon no ensenya quant portes gastat l'any. Està repartit entre comandes, devolucions i diversos comptes de país, i l'única vista completa que existeix són els correus de confirmació, que sí que són tots junts a la bústia. El problema era llegir-los sense convertir-los en un altre lloc on les teves compres estan desades.",
      en: "Amazon does not show how much you have spent this year. It is spread across orders, returns and several country accounts, and the only complete view that exists is the confirmation emails, which are all in one mailbox. The problem was reading them without turning them into yet another place where your purchases are stored.",
    },
    role: {
      es: "Todo: la extensión, el analizador de correos, la interfaz, la publicación en la tienda y la política de privacidad.",
      ca: "Tot: l'extensió, l'analitzador de correus, la interfície, la publicació a la botiga i la política de privacitat.",
      en: "Everything: the extension, the email parser, the interface, the store listing and the privacy policy.",
    },
    decisions: [
      {
        title: {
          es: "Lee el correo, y Amazon no lo ve nunca",
          ca: "Llegeix el correu, i Amazon no el veu mai",
          en: "It reads the mailbox, and never touches Amazon",
        },
        why: {
          es: "La extensión pide tres permisos —identidad, almacenamiento y alarmas— y como anfitriones sólo las APIs de Google, con el ámbito de Gmail de **sólo lectura**. No puede leer ninguna página que visites, ni la de Amazon. La alternativa obvia era raspar el historial de pedidos desde el navegador, y eso exige permiso sobre el dominio: un permiso que nadie puede verificar que uses sólo para eso.",
          ca: "L'extensió demana tres permisos —identitat, emmagatzematge i alarmes— i com a amfitrions només les API de Google, amb l'àmbit de Gmail de **només lectura**. No pot llegir cap pàgina que visitis, ni la d'Amazon. L'alternativa òbvia era raspar l'historial de comandes des del navegador, i això exigeix permís sobre el domini: un permís que ningú pot verificar que facis servir només per a això.",
          en: "The extension asks for three permissions — identity, storage and alarms — and only Google's APIs as hosts, with the **read-only** Gmail scope. It cannot read any page you visit, Amazon's included. The obvious alternative was scraping the order history from the browser, and that needs permission over the domain: a permission nobody can verify you only use for that.",
        },
      },
      {
        title: {
          es: "La clave de deduplicación es el número de pedido",
          ca: "La clau de deduplicació és el número de comanda",
          en: "The deduplication key is the order number",
        },
        why: {
          es: "Un pedido genera varios correos —confirmación, envío, entrega, a veces uno por paquete— y contarlos por correo multiplica el gasto. La clave es el número de pedido, y sólo cuando no aparece se cae al identificador del mensaje. Al revés —deduplicar por importe y fecha— junta dos compras iguales del mismo día, que es un error más difícil de ver porque el total parece razonable.",
          ca: "Una comanda genera diversos correus —confirmació, enviament, lliurament, a vegades un per paquet— i comptar-los per correu multiplica la despesa. La clau és el número de comanda, i només quan no apareix es cau a l'identificador del missatge. A l'inrevés —deduplicar per import i data— ajunta dues compres iguals del mateix dia, que és un error més difícil de veure perquè el total sembla raonable.",
          en: "One order generates several emails — confirmation, dispatch, delivery, sometimes one per parcel — and counting by email multiplies the spending. The key is the order number, falling back to the message id only when it is absent. The other way round — deduplicating by amount and date — merges two identical purchases on the same day, a mistake that is harder to spot because the total still looks reasonable.",
        },
      },
      {
        title: {
          es: "El .xlsx se escribe a mano, sin dependencias",
          ca: "L'.xlsx s'escriu a mà, sense dependències",
          en: "The .xlsx is written by hand, with no dependencies",
        },
        why: {
          es: "Un .xlsx es un ZIP con varios XML dentro, y la política de seguridad de una extensión prohíbe cargar librerías externas: meter una de hoja de cálculo no era una opción. Un CSV sí lo era, pero no admite cabeceras con formato, anchos de columna, filtros ni fila de totales, que es justo lo que se mira en una exportación de gastos. Las entradas del ZIP van sin comprimir: es válido, el código se queda síncrono y los ficheros son de pocos KB.",
          ca: "Un .xlsx és un ZIP amb diversos XML a dins, i la política de seguretat d'una extensió prohibeix carregar llibreries externes: ficar-ne una de full de càlcul no era una opció. Un CSV sí que ho era, però no admet capçaleres amb format, amplades de columna, filtres ni fila de totals, que és just el que es mira en una exportació de despeses. Les entrades del ZIP van sense comprimir: és vàlid, el codi es queda síncron i els fitxers són de pocs KB.",
          en: "An .xlsx is a ZIP with several XML files inside, and an extension's security policy forbids loading external libraries: pulling in a spreadsheet one was not an option. A CSV was, but it has no formatted headers, column widths, filters or totals row, which is exactly what you look at in a spending export. The ZIP entries go uncompressed: it is valid, the code stays synchronous and the files are a few KB.",
        },
      },
      {
        title: {
          es: "Incremental cada hora, completo cada semana",
          ca: "Incremental cada hora, complet cada setmana",
          en: "Incremental hourly, complete weekly",
        },
        why: {
          es: "Un escaneo anual del buzón son decenas de megabytes, así que lo habitual es pedir sólo lo nuevo. Pero un correo que llegó mientras la extensión estaba parada, o uno que Gmail reclasificó después, no vuelve a aparecer nunca en una consulta incremental. El repaso completo semanal es el que recoge eso; sin él, el total se queda corto y nadie sabe por qué.",
          ca: "Un escaneig anual de la bústia són desenes de megabytes, així que l'habitual és demanar només el nou. Però un correu que va arribar mentre l'extensió estava aturada, o un que Gmail va reclassificar després, no torna a aparèixer mai en una consulta incremental. El repàs complet setmanal és el que recull això; sense ell, el total es queda curt i ningú sap per què.",
          en: "A full year's mailbox scan is tens of megabytes, so the usual answer is to ask only for what is new. But an email that arrived while the extension was off, or one Gmail reclassified later, never shows up again in an incremental query. The weekly full pass is what catches those; without it the total runs short and nobody knows why.",
        },
      },
    ],
    outcome: [
      {
        es: "Publicada en la Chrome Web Store, con 21 mercados de Amazon y 15 divisas reconocidos y la interfaz en castellano e inglés.",
        ca: "Publicada a la Chrome Web Store, amb 21 mercats d'Amazon i 15 divises reconegudes i la interfície en castellà i anglès.",
        en: "Published on the Chrome Web Store, recognising 21 Amazon marketplaces and 15 currencies, with the interface in Spanish and English.",
      },
      {
        es: "2 628 líneas en seis módulos y cero dependencias en tiempo de ejecución: lo que se instala es lo que está escrito, incluido el generador de hojas de cálculo.",
        ca: "2 628 línies en sis mòduls i zero dependències en temps d'execució: el que s'instal·la és el que està escrit, inclòs el generador de fulls de càlcul.",
        en: "2,628 lines across six modules and zero runtime dependencies: what gets installed is what is written, the spreadsheet generator included.",
      },
      {
        es: "Siete ficheros de pruebas sobre el ejecutor de Node, sin framework: el analizador, los pedidos, la interfaz y el .xlsx se comprueban en cada cambio.",
        ca: "Set fitxers de proves sobre l'executor de Node, sense framework: l'analitzador, les comandes, la interfície i l'.xlsx es comproven a cada canvi.",
        en: "Seven test files on Node's own runner, with no framework: the parser, the orders, the interface and the .xlsx are checked on every change.",
      },
    ],
    lessons: {
      es: "Di por hecho que lo difícil era leer los correos, y lo difícil fue publicar: la política de privacidad, la justificación de cada permiso, las capturas, los textos de la ficha y la revisión de Google. Acabé escribiendo una lista de comprobación para la tienda **después** de pasar por ella, que es el orden equivocado. Lo que haría distinto es leer los requisitos de publicación antes de decidir la arquitectura, porque algunos —los permisos, sobre todo— condicionan el diseño y no el envoltorio.",
      ca: "Vaig donar per fet que el difícil era llegir els correus, i el difícil va ser publicar: la política de privacitat, la justificació de cada permís, les captures, els textos de la fitxa i la revisió de Google. Vaig acabar escrivint una llista de comprovació per a la botiga **després** de passar-hi, que és l'ordre equivocat. El que faria diferent és llegir els requisits de publicació abans de decidir l'arquitectura, perquè alguns —els permisos, sobretot— condicionen el disseny i no l'embolcall.",
      en: "I assumed the hard part was reading the emails, and the hard part was shipping: the privacy policy, justifying every permission, the screenshots, the listing copy and Google's review. I ended up writing a store checklist **after** going through it, which is the wrong order. What I would do differently is read the publishing requirements before deciding the architecture, because some of them — the permissions above all — shape the design and not just the wrapper.",
    },
  },

  portfolio: {
    context: {
      es: "Un CV en PDF se queda corto para una candidatura técnica —no se puede enlazar, no lo lee un buscador y no demuestra nada sobre cómo trabajas— pero sigue siendo lo que te piden. Y mantener a mano la web, el PDF y el perfil de cada portal significa que los tres acaban diciendo cosas distintas. La idea era tener una sola fuente y que todo lo demás saliera de ella.",
      ca: "Un CV en PDF es queda curt per a una candidatura tècnica —no es pot enllaçar, no el llegeix un cercador i no demostra res sobre com treballes— però continua sent el que et demanen. I mantenir a mà el web, el PDF i el perfil de cada portal significa que els tres acaben dient coses diferents. La idea era tenir una sola font i que tota la resta en sortís.",
      en: "A PDF CV falls short for a technical application — you cannot link to it, search engines cannot read it and it proves nothing about how you work — yet it is still what people ask for. And keeping the site, the PDF and every job-board profile up to date by hand means all three end up saying different things. The idea was one source, with everything else generated from it.",
    },
    role: {
      es: "Todo: el diseño, el código, la infraestructura y el contenido. No hay plantilla de partida ni framework de interfaz; lo que se descarga en el navegador son módulos propios.",
      ca: "Tot: el disseny, el codi, la infraestructura i el contingut. No hi ha plantilla de partida ni framework d'interfície; el que es descarrega al navegador són mòduls propis.",
      en: "Everything: the design, the code, the infrastructure and the content. There is no starter template and no UI framework; what the browser downloads is my own code.",
    },
    decisions: [
      {
        title: {
          es: "Un solo `cv.json`, y todo lo demás derivado",
          ca: "Un sol `cv.json`, i tota la resta derivada",
          en: "One `cv.json`, everything else derived",
        },
        why: {
          es: "El archivo sigue el esquema de JSON Resume y el build valida contra él. De ahí salen las páginas en tres idiomas, un PDF de una hoja por idioma, el JSON-LD de los buscadores y `/cv.json`, `/cv.md` y `/llms.txt`. La alternativa —mantener la web y el PDF por separado— es la que produce currículums que se contradicen, y además obliga a repetir cada corrección tres veces.",
          ca: "L'arxiu segueix l'esquema de JSON Resume i el build valida contra ell. D'aquí surten les pàgines en tres idiomes, un PDF d'un full per idioma, el JSON-LD dels cercadors i `/cv.json`, `/cv.md` i `/llms.txt`. L'alternativa —mantenir el web i el PDF per separat— és la que produeix currículums que es contradiuen, i a més obliga a repetir cada correcció tres vegades.",
          en: "The file follows the JSON Resume schema and the build validates against it. From it come the pages in three languages, a one-page PDF per language, the JSON-LD for search engines and `/cv.json`, `/cv.md` and `/llms.txt`. The alternative — maintaining the site and the PDF separately — is what produces CVs that contradict each other, and it means fixing everything three times.",
        },
      },
      {
        title: {
          es: "La calidad se comprueba en el build, no en la revisión",
          ca: "La qualitat es comprova al build, no a la revisió",
          en: "Quality is checked by the build, not by review",
        },
        why: {
          es: "El build falla si una página se pasa de su presupuesto de HTML, DOM, CSS o JavaScript, si un `<style>` no tiene su hash en la política de seguridad, si el PDF ocupa más de una hoja o si su texto no se puede extraer. Y un trabajo de Lighthouse bloquea el despliegue si la portada pasa de 2,5 s de LCP. Revisar a ojo funciona una vez; un techo que falla funciona siempre, y además explica qué se rompió.",
          ca: "El build falla si una pàgina passa del seu pressupost d'HTML, DOM, CSS o JavaScript, si un `<style>` no té el seu hash a la política de seguretat, si el PDF ocupa més d'un full o si el seu text no es pot extreure. I una feina de Lighthouse bloqueja el desplegament si la portada passa de 2,5 s d'LCP. Revisar a ull funciona una vegada; un sostre que falla funciona sempre, i a més explica què s'ha trencat.",
          en: "The build fails when a page goes over its HTML, DOM, CSS or JavaScript budget, when a `<style>` has no hash in the security policy, when the PDF spills onto a second sheet or when its text cannot be extracted. And a Lighthouse job blocks the deployment when the home page goes over 2.5 s of LCP. Reviewing by eye works once; a ceiling that fails works every time, and it says what broke.",
        },
      },
      {
        title: {
          es: "Nada de medir en local: sólo cuenta la CI",
          ca: "Res de mesurar en local: només compta la CI",
          en: "No measuring locally: only CI counts",
        },
        why: {
          es: "Las dos medidas que importan —el LCP simulado y las referencias visuales— dependen del renderizado de texto y de la CPU de la máquina. En local, además, un bloqueador de anuncios filtra las peticiones de cualquier navegador, incluido el de las pruebas. Las referencias se generan en el contenedor fijado de Playwright y Lighthouse corre en la misma imagen en la CI: tres tandas y la mediana.",
          ca: "Les dues mesures que importen —l'LCP simulat i les referències visuals— depenen del renderitzat de text i de la CPU de la màquina. En local, a més, un bloquejador d'anuncis filtra les peticions de qualsevol navegador, inclòs el de les proves. Les referències es generen al contenidor fixat de Playwright i Lighthouse corre a la mateixa imatge a la CI: tres tandes i la mediana.",
          en: "The two measurements that matter — simulated LCP and the visual references — depend on text rendering and on the machine's CPU. Locally, an ad blocker also filters requests from any browser, the test one included. The references are generated inside the pinned Playwright container, and Lighthouse runs in that same image on CI: three runs and the median.",
        },
      },
      {
        title: {
          es: "El asistente deja el expediente en el servidor",
          ca: "L'assistent deixa l'expedient al servidor",
          en: "The assistant keeps its dossier on the server",
        },
        why: {
          es: "Responde preguntas sobre el CV con un modelo, y eso abre dos problemas: lo que se le envía se puede sonsacar, y una API de pago abierta a internet se puede agotar. Lo primero se resuelve no enviando nada que no diría en una entrevista, y escribiendo las reglas en positivo: una regla «no hables de X» publica que X existe. Lo segundo, con límites por IP en D1, atómicos para que dos peticiones a la vez no cuenten como una.",
          ca: "Respon preguntes sobre el CV amb un model, i això obre dos problemes: el que se li envia es pot sonsacar, i una API de pagament oberta a internet es pot esgotar. El primer es resol no enviant res que no diria en una entrevista, i escrivint les regles en positiu: una regla «no parlis de X» publica que X existeix. El segon, amb límits per IP a D1, atòmics perquè dues peticions alhora no comptin com una.",
          en: "It answers questions about the CV with a model, which opens two problems: whatever you send it can be extracted, and a paid API open to the internet can be drained. The first is solved by sending nothing I would not say in an interview, and by writing the rules positively: a rule saying «do not discuss X» publishes that X exists. The second, with per-IP limits in D1, atomic so that two simultaneous requests do not count as one.",
        },
      },
    ],
    outcome: [
      {
        es: "La portada carga en 2,1 s de LCP simulado en la CI, con 21 peticiones y 166 KB. El JavaScript total son 17 KB con gzip, repartidos en nueve módulos propios.",
        ca: "La portada carrega en 2,1 s d'LCP simulat a la CI, amb 21 peticions i 166 KB. El JavaScript total són 17 KB amb gzip, repartits en nou mòduls propis.",
        en: "The home page loads at 2.1 s of simulated LCP on CI, with 21 requests and 166 KB. Total JavaScript is 17 KB gzipped, across nine of my own modules.",
      },
      {
        es: "Cero violaciones de accesibilidad con axe en las seis páginas, y una política de seguridad sin `unsafe-inline` que el build vuelve a calcular desde el HTML servido.",
        ca: "Zero violacions d'accessibilitat amb axe a les sis pàgines, i una política de seguretat sense `unsafe-inline` que el build torna a calcular des de l'HTML servit.",
        en: "Zero axe accessibility violations across the six pages, and a security policy with no `unsafe-inline` that the build recomputes from the served HTML.",
      },
      {
        es: "El mismo currículum se sirve en seis formatos sin escribirlo dos veces: tres idiomas de página, tres de PDF, `/cv.json`, `/cv.md`, `/llms.txt` y el JSON-LD.",
        ca: "El mateix currículum se serveix en sis formats sense escriure'l dues vegades: tres idiomes de pàgina, tres de PDF, `/cv.json`, `/cv.md`, `/llms.txt` i el JSON-LD.",
        en: "The same CV is served in six formats without writing it twice: three languages of pages, three PDFs, `/cv.json`, `/cv.md`, `/llms.txt` and the JSON-LD.",
      },
    ],
    lessons: {
      es: "Construí de más antes de mirar quién entraba. Hubo una consola interactiva, una vista en Markdown y una paleta de comandos; entre las tres, cuarenta días de datos dieron 69 usos frente a 383 visitas de la portada, y costaban unas 5 500 líneas. Las retiré, y con ellas se fue la mitad del JavaScript. Hoy empezaría por la medición: primero saber qué se usa, y construir lo siguiente con esa respuesta delante.",
      ca: "Vaig construir de més abans de mirar qui entrava. Hi va haver una consola interactiva, una vista en Markdown i una paleta d'ordres; entre les tres, quaranta dies de dades van donar 69 usos davant de 383 visites de la portada, i costaven unes 5 500 línies. Les vaig retirar, i amb elles se'n va anar la meitat del JavaScript. Avui començaria per la mesura: primer saber què s'usa, i construir el següent amb aquesta resposta al davant.",
      en: "I built too much before looking at who was coming. There was an interactive console, a Markdown view and a command palette; across forty days of data the three of them saw 69 uses against 383 home-page visits, and they cost around 5,500 lines. I removed them, and half the JavaScript went with them. Today I would start with the measurement: find out what gets used first, and build the next thing with that answer in front of me.",
    },
  },
} as const satisfies Record<string, CaseStudy>

export type CaseStudyId = keyof typeof CASE_STUDIES

export function caseStudyOf(projectId: string): CaseStudy | undefined {
  return (CASE_STUDIES as Record<string, CaseStudy>)[projectId]
}
