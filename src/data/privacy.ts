import type { Localized } from "@/lib/locales"

interface PrivacySection {
  title: Localized
  paragraphs: readonly Localized[]
}

/**
 * La primera capa, y sólo la primera.
 *
 * Eran 281 caracteres —responsable, finalidad, bases, proveedores, plazo y
 * derechos— repetidos íntegros bajo el formulario y bajo la consola. Ese es el
 * contenido de la **segunda** capa, y ponerlo entero delante de un campo de
 * texto no informa a nadie: se salta. Las bases jurídicas, los encargados y los
 * 12 meses viven en `PRIVACY_COPY`, a un clic.
 *
 * ## Y después se cayó el nombre
 *
 * De aquellos 281 quedaron 58 —«Imad El Malki Jaddi trata tus datos solo para
 * responderte»— y de esos 58 quedan 21. Lo que se ha ido es el responsable, y
 * se ha ido porque **es su web**: el nombre está en el titular de la portada,
 * en el pie de cada página y en la primera línea de la política. Repetirlo aquí
 * no identifica a nadie que no estuviera ya identificado, y era la mitad de la
 * frase.
 *
 * Lo que **no** se toca es la pareja que el modelo por capas de la AEPD pide
 * arriba: la finalidad —para qué— y el enlace a donde está todo lo demás. Con
 * eso la línea entra en versalitas de 11 px al lado del campo, que es donde una
 * primera capa se lee de verdad.
 */
export const PRIVACY_NOTICE = {
  short: {
    es: "Solo para responderte",
    ca: "Només per respondre't",
    en: "Only to reply to you",
  },
  link: {
    es: "Más información y derechos",
    ca: "Més informació i drets",
    en: "More information and your rights",
  },
} as const

export const PRIVACY_COPY = {
  navLabel: { es: "Privacidad", ca: "Privacitat", en: "Privacy" },
  pageTitle: {
    es: "Política de privacidad",
    ca: "Política de privacitat",
    en: "Privacy policy",
  },
  pageDescription: {
    es: "Cómo se tratan los datos enviados mediante el formulario y el asistente de este portfolio.",
    ca: "Com es tracten les dades enviades mitjançant el formulari i l'assistent d'aquest portfolio.",
    en: "How data submitted through this portfolio's form and assistant is handled.",
  },
  eyebrow: {
    es: "Información sobre datos personales",
    ca: "Informació sobre dades personals",
    en: "Personal data information",
  },
  intro: {
    es: "Esta política explica de forma sencilla qué datos se usan cuando escribes desde el portfolio y qué puedes pedir sobre ellos.",
    ca: "Aquesta política explica de manera senzilla quines dades es fan servir quan escrius des del portfolio i què pots demanar sobre aquestes dades.",
    en: "This policy explains in plain language what data is used when you write through the portfolio and what you can ask me to do with it.",
  },
  updated: {
    es: "Última actualización: 31 de agosto de 2026.",
    ca: "Darrera actualització: 31 d'agost de 2026.",
    en: "Last updated: 31 August 2026.",
  },
  sections: [
    {
      title: { es: "Responsable", ca: "Responsable", en: "Controller" },
      paragraphs: [
        {
          es: "El responsable del tratamiento es Imad El Malki Jaddi. Puedes contactar en imadelmalkij@gmail.com.",
          ca: "El responsable del tractament és Imad El Malki Jaddi. Pots contactar a imadelmalkij@gmail.com.",
          en: "The data controller is Imad El Malki Jaddi. You can contact me at imadelmalkij@gmail.com.",
        },
      ],
    },
    {
      title: {
        es: "Datos y finalidades",
        ca: "Dades i finalitats",
        en: "Data and purposes",
      },
      paragraphs: [
        {
          es: "El formulario y el comando mail tratan el correo, asunto y mensaje que escribes para poder responder a tu consulta o preparar los servicios que solicites. El asistente envía a OpenAI la pregunta y el historial reciente de esa conversación para generar la respuesta.",
          ca: "El formulari i l'ordre mail tracten el correu, l'assumpte i el missatge que escrius per poder respondre la consulta o preparar els serveis que demanis. L'assistent envia a OpenAI la pregunta i l'historial recent d'aquella conversa per generar la resposta.",
          en: "The form and mail command process the email address, subject and message you enter so I can answer your enquiry or prepare the services you request. The assistant sends your question and its recent conversation history to OpenAI to generate a response.",
        },
        {
          es: "Para evitar abusos se transforma la dirección IP mediante HMAC antes de contar peticiones. La analítica propia sólo registra el tipo de evento, la ruta y la vista, sin IP, cookies, agente de usuario ni identificadores de sesión.",
          ca: "Per evitar abusos, l'adreça IP es transforma mitjançant HMAC abans de comptar peticions. L'analítica pròpia només registra el tipus d'esdeveniment, la ruta i la vista, sense IP, galetes, agent d'usuari ni identificadors de sessió.",
          en: "To prevent abuse, the IP address is transformed with an HMAC before requests are counted. First-party analytics records only the event type, path and view, with no IP, cookies, user agent or session identifier.",
        },
      ],
    },
    {
      title: {
        es: "Base jurídica",
        ca: "Base jurídica",
        en: "Legal basis",
      },
      paragraphs: [
        {
          es: "La respuesta a una consulta sobre un posible encargo se basa en aplicar medidas precontractuales solicitadas por ti. Las demás consultas y la seguridad del servicio se basan en el interés legítimo de responder, mantener el portfolio disponible y prevenir usos abusivos. No se utiliza una casilla de consentimiento porque el envío solicitado no se apoya en ese consentimiento.",
          ca: "La resposta a una consulta sobre un possible encàrrec es basa a aplicar mesures precontractuals que has demanat. La resta de consultes i la seguretat del servei es basen en l'interès legítim de respondre, mantenir el portfolio disponible i prevenir usos abusius. No s'utilitza cap casella de consentiment perquè l'enviament sol·licitat no es basa en aquest consentiment.",
          en: "Answering an enquiry about a possible engagement relies on taking pre-contractual steps at your request. Other enquiries and service security rely on the legitimate interests of replying, keeping the portfolio available and preventing abuse. There is no consent checkbox because the requested submission does not rely on consent.",
        },
      ],
    },
    {
      title: {
        es: "Proveedores y destinatarios",
        ca: "Proveïdors i destinataris",
        en: "Providers and recipients",
      },
      paragraphs: [
        {
          es: "Cloudflare presta la infraestructura, el control de frecuencia, la analítica y el envío técnico del correo. El proveedor del buzón de correo aloja la conversación recibida. OpenAI procesa las preguntas dirigidas al asistente. Actúan como encargados o categorías de destinatarios necesarios para prestar cada función; no se venden los datos.",
          ca: "Cloudflare presta la infraestructura, el control de freqüència, l'analítica i l'enviament tècnic del correu. El proveïdor de la bústia de correu allotja la conversa rebuda. OpenAI processa les preguntes adreçades a l'assistent. Actuen com a encarregats o categories de destinataris necessaris per prestar cada funció; les dades no es venen.",
          en: "Cloudflare provides the infrastructure, rate limiting, analytics and technical email delivery. The mailbox provider stores the received conversation. OpenAI processes questions sent to the assistant. They act as processors or necessary categories of recipient for each feature; data is not sold.",
        },
      ],
    },
    {
      title: {
        es: "Transferencias internacionales",
        ca: "Transferències internacionals",
        en: "International transfers",
      },
      paragraphs: [
        {
          es: "Las preguntas dirigidas al asistente las procesa OpenAI, con sede en Estados Unidos, así que ese tratamiento concreto sale del Espacio Económico Europeo y debe apoyarse en una decisión de adecuación o en garantías como las cláusulas contractuales tipo. La base de datos que cuenta la frecuencia de peticiones está creada en la jurisdicción europea de Cloudflare. Puedes pedir información sobre las garantías aplicables escribiendo al responsable.",
          ca: "Les preguntes adreçades a l'assistent les processa OpenAI, amb seu als Estats Units, de manera que aquell tractament concret surt de l'Espai Econòmic Europeu i s'ha de basar en una decisió d'adequació o en garanties com les clàusules contractuals tipus. La base de dades que compta la freqüència de peticions està creada a la jurisdicció europea de Cloudflare. Pots demanar informació sobre les garanties aplicables escrivint al responsable.",
          en: "Questions sent to the assistant are processed by OpenAI, based in the United States, so that particular processing leaves the European Economic Area and must rely on an adequacy decision or safeguards such as standard contractual clauses. The database that counts request frequency is created in Cloudflare's European jurisdiction. You can ask the controller for information about the safeguards that apply.",
        },
      ],
    },
    {
      title: {
        es: "Conservación",
        ca: "Conservació",
        en: "Retention",
      },
      paragraphs: [
        {
          es: "Las consultas y la correspondencia asociada se conservarán sólo mientras sea necesario para responder y, como máximo, 12 meses, salvo que exista una obligación legal o una relación posterior que justifique otro plazo. Los contadores HMAC de frecuencia dejan de tener efecto al vencer su ventana, que dura como máximo 24 horas, y su fila se borra en la primera petición posterior a ese vencimiento.",
          ca: "Les consultes i la correspondència associada es conservaran només mentre calgui per respondre i, com a màxim, 12 mesos, llevat que hi hagi una obligació legal o una relació posterior que justifiqui un altre termini. Els comptadors HMAC de freqüència deixen de tenir efecte quan venç la seva finestra, que dura com a màxim 24 hores, i la fila s'esborra en la primera petició posterior a aquell venciment.",
          en: "Enquiries and related correspondence are kept only as long as needed to reply and for no longer than 12 months, unless a legal obligation or subsequent relationship justifies another period. HMAC rate-limit counters stop having any effect once their window expires, which lasts at most 24 hours, and the row itself is deleted on the first request after that expiry.",
        },
      ],
    },
    {
      title: { es: "Tus derechos", ca: "Els teus drets", en: "Your rights" },
      paragraphs: [
        {
          es: "Puedes solicitar acceso, rectificación, supresión, oposición, limitación o portabilidad cuando corresponda escribiendo a imadelmalkij@gmail.com. También puedes retirar un consentimiento si alguna operación futura llegara a basarse en él, sin afectar al tratamiento anterior.",
          ca: "Pots demanar accés, rectificació, supressió, oposició, limitació o portabilitat quan correspongui escrivint a imadelmalkij@gmail.com. També pots retirar un consentiment si alguna operació futura s'hi arribés a basar, sense afectar el tractament anterior.",
          en: "You can request access, correction, erasure, objection, restriction or portability where applicable by writing to imadelmalkij@gmail.com. You may also withdraw consent if a future operation ever relies on it, without affecting earlier processing.",
        },
        {
          es: "Si consideras que tus derechos no han sido atendidos, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).",
          ca: "Si consideres que els teus drets no han estat atesos, pots reclamar davant l'Agència Espanyola de Protecció de Dades (www.aepd.es).",
          en: "If you believe your rights have not been respected, you can complain to the Spanish Data Protection Agency (www.aepd.es).",
        },
      ],
    },
  ] satisfies readonly PrivacySection[],
} as const
