# Torneos online — puesta en marcha (una sola vez, ~2 minutos)

> **Ya está hecho** (2026-09-07): proyecto `pokemmo-companion`, ref
> `ykbtfonmnnljlpkebfae`, organización NotFlix, plan Free, región West EU
> (Paris). El esquema está ejecutado, el `.env` local escrito y las dos
> variables puestas en el repositorio. Lo de abajo queda como referencia por si
> hay que rehacerlo o montar un segundo proyecto.

El formato suizo funciona sin nada de esto: si no configuras Supabase, la app
sigue emparejando rondas, llevando la clasificación y guardando todo en el
dispositivo, y la opción "Torneo online" simplemente aparece como no disponible.

Lo de abajo es lo que hace falta para que los jugadores puedan entrar por un
link, apuntarse solos y reportarte sus resultados.

## 1. Crear el proyecto

1. Entra en <https://supabase.com> y crea una cuenta (el plan gratuito sobra:
   este proyecto usa unos pocos KB y unas pocas peticiones por minuto).
2. **New project**. Región: Europa (`eu-west` o `eu-central`) para tener la
   latencia más baja desde España. Apunta la contraseña de base de datos que te
   pida, aunque la app no la usa para nada.

## 2. Crear las tablas

1. En el proyecto, menú lateral → **SQL Editor** → **New query**.
2. Pega el contenido entero de [`schema.sql`](./schema.sql) y pulsa **Run**.
3. Debe terminar con "Success. No rows returned".
4. Repite con [`betting.sql`](./betting.sql), que añade la identidad de
   espectador/participante y las apuestas con fichas. Los dos ficheros son
   idempotentes: se pueden volver a ejecutar sin romper nada.

Esto crea cinco tablas (`tournaments`, `tournament_reports`,
`tournament_signups`, `tournament_viewers`, `tournament_bets`), activa RLS en
todas y define las funciones que son el único camino de escritura: las del
organizador (protegidas por su secreto) y las del jugador/espectador
(protegidas por el suyo).

## 3. Copiar las dos claves a la app

En **Project Settings → API** verás:

- **Project URL** → va en `EXPO_PUBLIC_SUPABASE_URL`
- **Project API keys → `anon` `public`** → va en `EXPO_PUBLIC_SUPABASE_ANON_KEY`

⚠️ La otra clave que aparece ahí, `service_role`, **se salta RLS por completo**.
No la pongas nunca en la app ni en el repositorio.

### Para desarrollo local

```bash
cp .env.example .env
```

y rellena los dos valores. Reinicia `expo start` después (las variables se
inlinean al arrancar el bundler, no en caliente).

### Para la web publicada (GitHub Pages)

Las mismas dos variables, como **repository variables** (no secrets):

```bash
gh variable set EXPO_PUBLIC_SUPABASE_URL --body "https://TU-REF.supabase.co"
gh variable set EXPO_PUBLIC_SUPABASE_ANON_KEY --body "TU-ANON-KEY"
```

El workflow `deploy-web.yml` ya las lee. El siguiente push a `master` publica la
web con la función online activada; si no existen, la build sigue funcionando y
la app se queda en modo local.

## Cómo funciona la seguridad

No hay cuentas de usuario. En su lugar:

- Al publicar un torneo, tu dispositivo genera un **secreto de organizador** de
  32 caracteres. Se queda en tu móvil y **no viaja en el link** — el servidor
  solo guarda su SHA-256.
- El link lleva únicamente un **código público de 8 caracteres**.
- Con la clave anon, cualquiera que tenga el link puede: **leer** el torneo,
  **insertar** una inscripción y **insertar** un reporte de resultado. Nada más:
  no hay política de UPDATE ni de DELETE para nadie.
- El documento del torneo solo se reescribe a través de `push_tournament()`,
  que comprueba el hash del secreto antes de tocar nada.
- Quien entra por el link se registra como **viewer** con su propio secreto (el
  mismo patrón). A partir de ahí, reportar un resultado exige demostrar que
  eres uno de los dos jugadores de ESE combate, y apostar exige que el combate
  siga abierto y que no sea el tuyo.
- Por tanto, lo peor que puede hacer alguien que trastee con las peticiones de
  red es mandarte un reporte falso de su propio combate... que tú tienes que
  confirmar para que cuente. Los resultados nunca se aplican solos.

**Sobre las apuestas:** las fichas no valen nada — no son dinero, ni PokéYen,
ni convertibles en nada. Es un juego de aciertos con marcador. El reparto es
mutuo (el bote se divide entre los que acertaron) y se calcula en el cliente a
partir de filas públicas, así que no hay saldo almacenado que se pueda
corromper ni liquidación que se pueda perder.

Todo lo que llega del servidor se vuelve a validar en el cliente con el mismo
parser que usa la importación por código (`parseImportedTournament`), así que
una fila manipulada a mano se rechaza en vez de corromper la clasificación.

## Coste y límites

Plan gratuito de Supabase: 500 MB de base de datos y 5 GB de transferencia al
mes. Un torneo de 9 jugadores y 6 rondas ocupa del orden de 10 KB, y la app
consulta cada 6 segundos solo mientras alguien tiene la pantalla abierta. Un
proyecto gratuito se pausa tras una semana sin actividad; se reactiva desde el
panel en un par de clics.

## Borrar un torneo del servidor

No hay pantalla para ello (borrarlo en la app solo borra tu copia local). Desde
el **Table Editor** de Supabase puedes eliminar la fila de `tournaments`; sus
inscripciones y reportes se van con ella (`on delete cascade`).
