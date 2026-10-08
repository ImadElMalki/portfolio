# Capturas de la galería de proyectos

Un script por proyecto. Cada uno reutiliza el arnés de Playwright del repositorio
que captura —su servidor, su stub de `chrome.*`, su semilla— en vez de
reimplementarlo. Lo que vive aquí es la decisión editorial del portafolio: qué
pantallas se enseñan, en qué orden, con qué tema, y qué no puede salir en una
imagen publicada.

Los scripts **no arrancan servidores**. Si falta uno, salen con el comando exacto
que hay que ejecutar. Orquestar Node, Vite, Spring Boot y Angular desde Python es
donde estas cosas se pudren, y el fallo silencioso es capturar una página de
error creyendo que es la aplicación.

## Flujo

```bash
# 1. capturar en crudo (a .shots/, que está en .gitignore)
python scripts/shots/<proyecto>.py

# 2. convertir a los másteres que consume la galería
node scripts/prepare-project-shots.mjs \
     .shots/<slug> src/assets/projects/<slug> --shape phone|popup|browser

# 3. dar de alta las capturas en src/data/projectDemos.ts
#    y subir EXPECTED_GALLERIES en scripts/check-build.mjs
```

Los PNG se nombran `01-…`, `02-…`: el conversor ordena por nombre y ese es el
orden de la tira.

## Por proyecto

| Proyecto           | Antes hay que levantar                         | Forma     |
| ------------------ | ---------------------------------------------- | --------- |
| `amazon.py`        | nada                                           | `popup`   |
| `race_spending.py` | nada                                           | `popup`   |
| `caixabank.py`     | `npm run serve:test` en su repo → `:4173`      | `popup`   |
| `strava.py`        | `npm run dev` en su repo → `:5173`             | `browser` |
| `cims.py`          | Postgres + Spring Boot + Angular, ver abajo    | `browser` |
| `portfolio.mjs`    | `npm run build` y `npx vite preview` → `:4321` | `browser` |

Race Hub no tiene script: son capturas de un móvil real por `adb`, y la
secuencia está en el historial de git, no automatizada.

Este portafolio es el único en `.mjs`. La regla de la carpeta es reutilizar el
arnés del proyecto que se captura, y el suyo es el de este repositorio:
`@playwright/test`, ya instalado y fijado en el lockfile. Instalar Playwright
para Python sólo para fotografiarse a sí mismo sería la segunda copia de lo
mismo. Interpone `/api/ask` con una respuesta fija: contra el modelo real la
imagen saldría distinta cada vez.

### 100 Cims

Cuatro piezas, en este orden. Docker **no** hace falta.

```bash
# 1. Postgres 17 nativo, ya escuchando en :5432 · base summitCims · postgres/nine

# 2. la API primero, para que Hibernate cree cims_feec con los tipos numéricos
#    correctos. La primera vez el wrapper descarga Maven.
cd "…/100_cims/summits-cims-api-rest" && ./mvnw spring-boot:run     # :8080

# 3. los 522 cims
psql -h localhost -U postgres -d summitCims \
  -c "\copy cims_feec(id,url,nombre,comarca,altitud,latitud,longitud,utm_x,utm_y,es_esencial,url_imagen) FROM '…/cims_feec.csv' WITH (FORMAT csv, HEADER true)"

# 4. las imágenes locales. update_webp.sql apunta a /images_opt/, pero los
#    archivos viven en static/images/: hay que sustituirlo al aplicarlo.
sed 's|/images_opt/|/images/|g' update_webp.sql | psql -h localhost -U postgres -d summitCims

# 5. el frontend
cd "…/100_cims/catalonia-peaks-app" && npm start                     # :4200
```

Los iconos de Material y las fuentes vienen de un CDN: **sin conexión cada icono
se dibuja como su nombre en texto plano**. El script lo comprueba y aborta.

Solo hay tres pantallas terminadas —rejilla, modo tabla y diálogo de detalle—.
`peaks-details/:id` y `peaks-done` son plantillas sin hacer.

## Datos publicables

Ningún proyecto necesita credenciales externas para capturarse, y ninguno usa
datos reales del propietario:

- **Amazon** y **Race Spending** traen sus semillas sintéticas.
- **CaixaBank** no: su `connected_state()` lleva comercios y una referencia de
  préstamo reales, y `classification-seed.js` guarda reglas promovidas del buzón.
  `caixabank.py` sustituye la semilla por una inventada **y** pasa el texto
  renderizado por `Guard` antes de guardar cada imagen. El monkeypatch solo cubre
  lo que conoces; la aserción cubre lo que no.
- **Strava** corre contra la D1 local, con 318 actividades sintéticas. El
  `ADMIN_TOKEN` se lee de `.dev.vars` en tiempo de ejecución y nunca se imprime.
  Solo se visitan las vistas de una lista blanca: los paneles de ajustes y de
  OAuth quedan fuera porque podrían reflejar secretos reales.
- **100 Cims** son datos abiertos de la FEEC.
