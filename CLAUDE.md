@AGENTS.md

# PokeMMO Companion App — Contexto del Proyecto

## Qué es esto

App móvil companion para PokeMMO (no para Pokémon oficial — son cosas distintas, ver regla de oro más abajo). Proyecto personal de Ferran, en su tiempo libre, sin presión comercial. Construida con Claude Code, supervisada por Ferran.

**Por qué existe:** no hay ninguna app pulida y nativa en Play Store/App Store para PokeMMO. Lo que existe son webs (PokeMMO Hub) y herramientas sueltas de aficionados en GitHub/itch.io, ninguna en tienda oficial, ninguna bilingüe ES/EN.

**Objetivo explícito de este proyecto:** NO es un proyecto para ganar dinero. Se construye independientemente de si genera ingresos o no. Esto tiene implicaciones prácticas — ver sección "Qué NO hacer en v1".

---

## 📍 ESTADO ACTUAL (2026-07-04) — leer esto primero

Repo en GitHub: [github.com/Fullbusterz/PokeMMO-Companion](https://github.com/Fullbusterz/PokeMMO-Companion), remoto `origin`, rama `master`. Todo el trabajo hasta la fecha está commiteado y pusheado.

### Qué está hecho y funcionando

**Fase 1 (gestor de torneos) — completa, con extras más allá del scope original:**
- Bracket de eliminación simple, con byes manejados correctamente (probado a fondo — hubo un bug real de "doble bye" al principio, quedó arreglado y verificado con simulación).
- **Doble eliminación** (`src/lib/doubleElimBracket.ts`, separado de `bracket.ts`): bracket de ganadores + perdedores + gran final única (sin "bracket reset"). **Restringida a participantes potencia de 2 (4/8/16/32)** — un bye no genera perdedor, así que se validó eso en vez de generalizar la lógica. Verificada con 40+ simulaciones antes de tocar la UI.
- Export/import por código de texto (base64, sin backend), con validación de integridad referencial completa en `parseImportedTournament` (rechaza datos corruptos sin crashear).
- Editar nombre, deshacer último resultado (`history` cronológico, reversible sin corromper rondas posteriores), posiciones de sorteo, compartir el bracket como imagen (`react-native-view-shot` + `expo-sharing`).
- **Pendiente de diseño (2026-07-04, ver "Ideas pendientes de desarrollar" más abajo):** extender de "solo brackets de torneo" a también soportar **liguillas** (formato liga/round-robin, con duración y filtros) — no implementado todavía, solo documentado el diseño.

**Fase 2 (en progreso) — Pokédex multi-región:**
- **Kanto (151), Johto (100), Hoenn (135) y Sinnoh (107) hechos — 493 Pokémon en total.** Solo Teselia pendiente para completar las 5 regiones.
- `data/<region>/pokemon.json` por región: stats base **verificadas contra la tabla histórica "Generation II-V" de Bulbapedia** (o cruzadas contra las listas de subidas de stats de Gen 6/7/8 si esa tabla no es accesible — le pasó a Sinnoh, ver nota de memoria del proyecto), NUNCA contra el endpoint por defecto de PokéAPI ni contra páginas de "stats de generación X" sin verificar que reflejen el juego de esa época y no el actual. **Lección crítica aprendida el 2026-07-04:** PokéAPI (y muchas páginas de stats "por generación") devuelven las stats y el tipo del juego más reciente, no de Gen 1-5 — encontramos y corregimos 22 Pokémon con stats post-Gen6 y 15 Pokémon con tipo Hada indebido en las 4 regiones hechas. Ver regla de oro más abajo, ahora corregida para reflejar esto. **Vigilar también:** el campo `evolvesFrom` de PokéAPI a veces usa el slug interno en vez del nombre real cuando el nombre tiene un carácter especial (pasó con Nidoran♀/♂ y con Mime Jr.) — revisar cualquier especie nueva con símbolos raros en el nombre.
- `src/lib/pokedex.ts` combina todas las regiones en `ALL_POKEMON` — necesario porque muchas cadenas evolutivas cruzan la frontera de región (Crobat/Johto evoluciona de Golbat/Kanto, Pikachu/Kanto de Pichu/Johto, etc.).
- `data/type-chart.json`: tabla de efectividad de tipos **de Gen 5 específicamente** (17 tipos, SIN Hada, Acero resiste Fantasma/Siniestro — cambiado en Gen 6+). Verificada programáticamente.
- Pantallas: lista+buscador, detalle (stats con barras animadas, familia evolutiva con navegación), comparador de tipos interactivo.
- `movesets.json`/`abilities.json`/`locations.json`/`pokemmo_tiers.json` siguen siendo stubs vacíos por región — la regla de oro de abajo aplica en cuanto se rellenen. **Ver "Ideas pendientes" abajo — hay una fuente candidata muy buena para `locations.json` (guías de farmeo de seviichamp.blogspot.com).**

**Fases 3-5:** sin empezar.

**Pulido visual y animaciones (2026-07-03/04):** `react-native-reanimated` + `expo-haptics` + `expo-linear-gradient` + `@expo/vector-icons` para feedback táctil, entradas escalonadas, degradados y iconos. **Gotcha importante para cualquier animación futura:** en el preview web de este proyecto (`expo start --web`), las actualizaciones de Reanimated tras el montaje inicial no llegan al DOM (ver `src/lib/animation.ts` y su `isNative`/`nativeOnly()`) — nativo no está afectado, pero cualquier `useSharedValue` cuyo valor final importe para que la UI se vea bien necesita el patrón de fallback documentado ahí. Además, NativeWind no reconoce `className` en componentes `Animated.*` sin registrarlos explícitamente vía `cssInterop` (ver `src/lib/animatedNativewind.ts`).

### Decisiones de diseño importantes (no deshacer sin motivo)

- **Tema oscuro completo** ("UI oscura tipo consola de torneo"), construido vía una sesión de Claude Design + implementación manual — paleta en `src/theme/colors.js` (`ink`/`pokeRed`/`type`/`status`), compartida entre `tailwind.config.js` y componentes RN que necesitan hex crudo (`placeholderTextColor`).
- **Sobre usar Claude Design:** no hace falta para trabajo incremental sobre el design system ya existente — es más lento (no se puede leer el DOM del lienzo, hay que reconstruir valores a mano vía zoom sobre capturas) y tiene límites de cuota de sesión propios. Aporta valor real como "segunda opinión" visual o pasada creativa con ojos frescos, no como paso obligatorio. Usarlo solo si Ferran lo pide explícitamente o para pantallas genuinamente nuevas sin ningún precedente visual.
- **Componentes compartidos:** `Button`, `Badge`(`StatusBadge`), `Card`, `DeleteText`, `VsDivider`, `TypeBadge`, `PressScale` en `src/components/`. Reutilizarlos en vez de duplicar estilos inline.

### Pendiente / sin verificar

- **Nunca se ha probado en un dispositivo/simulador nativo real** — todo el testing ha sido vía `expo start --web`. Cosas concretas sin verificar en iOS/Android: los modificadores de opacidad de Tailwind contra colores custom (`bg-pokeRed/10` etc.), el patrón `group-active` de nativewind, y las animaciones de Reanimated (que en teoría funcionan bien en nativo pero nunca se han visto correr ahí).
- **Icono de la app:** sigue siendo el placeholder genérico de Expo, no hay identidad visual real. Necesita trabajo de diseño real, no algo para improvisar.
- Para arrancar la Fase 3 hace falta el dataset completo de 5 regiones (van 4 de 5: Kanto/Johto/Hoenn/Sinnoh) — ver "Estructura de datos" más abajo.

### 💡 Ideas pendientes de desarrollar (2026-07-04, aún sin implementar)

**1. Ligas/liguillas, no solo brackets de torneo.** Ferran quiere que el gestor de torneos soporte también un formato de **liga (round-robin)** — todos contra todos, no eliminación — además de brackets, con:
   - **Formatos distintos** (liga simple todos-contra-todos, quizá liga + playoffs después — a definir).
   - **Duración**: las ligas suelen jugarse a lo largo de varias semanas/meses en vez de resolverse en una sesión, a diferencia de un bracket. Encaja con el modelo actual de sync manual (el organizador re-exporta periódicamente) — probablemente cada partido puede llevar una fecha/jornada opcional, sin necesidad de programar nada (nada de notificaciones, eso sigue prohibido).
   - **Algún filtro adicional** — sin especificar todavía, hay que aclarar con Ferran qué filtro quiere exactamente (¿filtrar la lista de torneos por formato/estado? ¿filtrar participantes?) antes de diseñar la UI.
   - Diseño técnico sugerido (a validar cuando se aborde): nuevo valor `'league'` en `TournamentFormat`, algoritmo de emparejamiento round-robin (método del círculo) en un archivo nuevo `src/lib/leagueFormat.ts` (mismo patrón que `bracket.ts`/`doubleElimBracket.ts`), cálculo de clasificación (victorias/derrotas/puntos, ordenado), y una pantalla de tabla de clasificación en vez de árbol de bracket. Aplicar el mismo rigor de testing por simulación que se usó para los brackets antes de tocar la UI.

**2. Importar guías de farmeo de seviichamp.blogspot.com como fuente de datos.** Ferran ha jugado siguiendo estas guías y quiere convertir su contenido en datos estructurados de la app (probablemente para `locations.json` por región). Índice completo de guías: [seviichamp.blogspot.com/p/guide-index...](https://seviichamp.blogspot.com/p/guide-index-pokemmo-indice-de-guias-de.html).
   - **Guías de farmeo por región (las 5 regiones del proyecto, en inglés)** — item por ruta, walkthrough paso a paso:
     - [Kanto](https://seviichamp.blogspot.com/2022/12/pokemmo-farm-guide-walkthrough-kanto.html) (la que Ferran usó originalmente)
     - [Johto](https://seviichamp.blogspot.com/2022/12/pokemmo-farm-guide-walkthrough-johto.html)
     - [Hoenn](https://seviichamp.blogspot.com/2022/12/pokemmo-farm-guide-walkthrough-hoenn.html)
     - [Sinnoh](https://seviichamp.blogspot.com/2022/12/pokemmo-farm-guide-walkthrough-sinnoh.html)
     - [Unova](https://seviichamp.blogspot.com/2022/12/pokemmo-farm-guide-walkthrough-unova.html)
   - También relevante: ["Item Dex & Where to Find Every Item"](https://seviichamp.blogspot.com/2020/05/pokemmo-farm-guide-how-and-where-to.html) (todas las regiones), y para fases futuras: guías de **EV Training**, **IVs**, **Damage Calculator**, **Smeargle's Sketch Guide** (referencia directa para la Fase 3 de crianza y la Fase 5 de calculadora de daño).
   - **Cómo se puede hacer (confirmado factible, sin abrir el navegador para Ferran):** se puede leer el contenido de cada página vía fetch directo, sin redirigir a Ferran a ningún sitio. **Importante — la forma correcta de "traerlo", no copiar-pegar la guía tal cual:**
     - El contenido de la guía de Kanto está en formato narrativo/paso a paso ("ve al oeste, coge una poción escondida..."), no en tabla estructurada — hay que **parsear y extraer los hechos** (qué objeto, en qué ruta/región) a JSON estructurado tipo `locations.json`, no copiar el texto de la guía tal cual.
     - **Atribución/origen:** la guía de Kanto ya cita su fuente original como un post de "MightyBoxer" en el foro oficial de PokeMMO — el blog de seviichamp es en sí una recopilación con atribución. Al transformar esto a datos de la app, mantener esa cadena de atribución en el campo `source` (p. ej. `"Guía de farmeo seviichamp.blogspot.com, basada en post de MightyBoxer (foro PokeMMO) — extraído 2026-XX-XX"`), igual que ya se hace con PokeMMO Wiki.
     - **Alcance/esfuerzo:** cada guía de región cubre muchas rutas con varios objetos cada una — es un trabajo de extracción de datos region por region, del mismo orden de magnitud que construir la Pokédex de cada región. Abordarlo con el mismo enfoque de "una región cada vez, verificar antes de seguir" que se usó para la Pokédex.

---

## 🚨 REGLA DE ORO — LEER ANTES DE TOCAR NINGÚN DATO DE POKÉMON

**PokeMMO NO es "Pokémon oficial filtrado hasta Gen 5".** Es un juego con desarrollo propio y continuo. El equipo de PokeMMO decide sus propias mecánicas, y a veces adopta cambios de juegos oficiales posteriores y a veces no, según su propio criterio. Esto significa que **ningún dato de Pokémon (movimiento, habilidad, tier competitivo, mecánica) se da por válido solo porque "es de Gen 5 o anterior".** Hay que verificarlo específicamente contra PokeMMO.

### Jerarquía de fuentes (de más a menos fiable)

1. **Patch notes oficiales de PokeMMO** (foro oficial, sección de anuncios) — máxima autoridad
2. **PokeMMO Wiki** (pokemmo.shoutwiki.com) — documentación mantenida por la comunidad específicamente para PokeMMO
3. **Verificación directa en el juego** (Ferran comprobándolo en persona)
4. **Tier lists / consenso de la comunidad de PokeMMO** (TierMaker "PokeMMO PvP Tierlist", foro oficial — sección Competition Alley)
5. **PokéAPI** — SOLO para sprite y familia evolutiva, que sí son realmente inmutables entre juegos. **NUNCA para movimientos, habilidades, tiers competitivos o mecánicas de combate.**

### ⚠️ Corrección crítica (2026-07-04): ni el tipo ni las stats base son "universales" en PokéAPI

Se asumió originalmente (ver Fase 2 inicial) que tipo y stats base eran datos "inmutables entre generaciones" y por tanto seguros de tomar de PokéAPI tal cual. **Es falso.** PokéAPI devuelve por defecto los datos del juego más reciente, no de Gen 1-5:

- **Tipo:** 22 Pokémon fueron retconados al tipo Hada en la Generación 6 (Hada ni existe en PokeMMO/Gen 5). De los 386 ya construidos, 13 caen en este caso (Clefairy, Clefable, Jigglypuff, Wigglytuff, Mr. Mime, Cleffa, Igglybuff, Togepi, Togetic, Marill, Azumarill, Snubbull, Granbull en Kanto/Johto; Ralts, Kirlia, Gardevoir, Azurill, Mawile en Hoenn).
- **Stats base:** varios Pokémon recibieron subidas de stats permanentes en Gen 6, 7 u 8 (ej. Pikachu, Raichu, Butterfree, Alakazam, Golem... 20 casos solo en Kanto) que PokeMMO (mecánicas Gen 1-5) no tiene.

**Regla corregida:** para tipo y stats base de cualquier Pokémon, contrastar SIEMPRE contra la tabla histórica de Bulbapedia **"List of Pokémon by base stats (Generation II-V)"** (cubre de Gen 2 a Gen 5 sin cambios internos — es una única tabla estable) antes de dar el dato por bueno. No basta con verificar una muestra al azar — hay que comparar la región completa campo por campo, porque comprobar solo unos pocos Pokémon "conocidos de memoria" puede no detectar el problema (esos mismos recuerdos suelen reflejar también el juego actual).

### Reglas duras

- **Smogon NO es fuente para el tier list.** Smogon tiene su propio tier list de Gen 5 (BW) basado en el meta de los juegos oficiales / Pokémon Showdown — esto puede diferir del tier list real dentro de PokeMMO, que tiene su propia liga clasificatoria y su propia comunidad. La fuente del tier list de la app es PokeMMO Wiki + tier lists de comunidad de PokeMMO, nunca Smogon directamente.
- **Todo dato de movimiento/habilidad necesita una capa de overrides manual** sobre PokéAPI, verificada contra las fuentes de arriba. PokéAPI documenta el juego más reciente por defecto — eso está mal para PokeMMO casi siempre.
- **Si un dato no está verificado, no se publica como si lo estuviera.** Mejor un campo vacío o "sin confirmar" en la UI que un dato incorrecto silencioso.
- **Cada entrada del archivo de datos lleva un campo `source`** indicando de dónde salió la información (para poder auditar después).

### Alcance del juego (confirmado)

5 regiones, basadas en estas ROMs específicas:
- Kanto (Pokémon Rojo Fuego)
- Johto (Pokémon SoulSilver)
- Hoenn (Pokémon Esmeralda)
- Sinnoh (Pokémon Diamante/Perla)
- Teselia/Unova (Pokémon Blanco/Negro)

**Ningún Pokémon de Kalos en adelante existe en PokeMMO.** Cero excepciones.

---

## Qué NO hacer en v1

- ❌ Sin anuncios, sin SDK de ads, sin ningún tipo de monetización. Esto puede añadirse en el futuro, pero no es un objetivo de v1 y no debe implementarse por iniciativa propia.
- ❌ Sin backend, sin servidor, sin base de datos remota. Todo vive en el dispositivo.
- ❌ Sin notificaciones push que "vigilen" al usuario (ej. nada de "llevas X horas sin cazar, ¿sigues ahí?"). La app no le habla al usuario salvo que él la mire.
- ❌ Sin usar sprites/assets oficiales de Nintendo si se puede evitar — preferir sprites fan-made/estilizados para minimizar superficie de IP. (Contexto legal completo abajo.)
- ❌ Sin scraping de datos en vivo del GTL — no hay API oficial, es frágil, y PokeMMO Hub ya cubre esa necesidad. No es nuestro terreno.

---

## Contexto legal (resumen, ya investigado a fondo)

- Nintendo/The Pokémon Company tiene historial documentado de tumbar proyectos de fans (Pokemon Essentials, Relic Castle, Pokenet — el propio precedente de un MMO de Pokémon hecho por fans). Riesgo real, no hipotético.
- El propio PokeMMO prohíbe promocionar servicios/negocios no relacionados en su foro oficial y chat del juego — pero SÍ existe una sección "Client Customization" en el foro donde ya conviven herramientas de fans (ej. 3's PokeMMO Tool).
- **Estrategia de distribución recomendada:** perfil bajo. Compartir primero en Client Customization / Discords de la comunidad antes que en tiendas oficiales. Sin monetización visible (ver arriba), que es precisamente la señal que ha atraído takedowns en el pasado.

---

## Stack técnico

- **React Native + Expo (Expo Router)** — mismo patrón que DoDay (`C:\ProyectoClaude\DoDay`): expo ~54, expo-router ~6, nativewind, TypeScript, zustand para estado.
- **i18n bilingüe ES/EN desde el día uno** — `i18n-js` (mismo patrón que MTGAICommander_Verdict).
- **Almacenamiento:** local únicamente. JSON estático empaquetado en la app para los datos del juego (no cambian salvo actualización de la app). Para datos de usuario (progreso, tracker de shinies, torneos) usar AsyncStorage, evaluando expo-sqlite si la complejidad de consultas lo justifica más adelante.
- **Sin dependencias de servidor.** Cero coste de infraestructura, cero mantenimiento de backend.

---

## Features, en orden de construcción (optimizado por dependencia, no por atractivo)

### Fase 1 — ✅ COMPLETA para brackets (ver "Estado actual" arriba); ligas pendientes
**Gestor de torneos/ligas para el grupo de Ferran**
- Bracket simple, participantes, registro de resultados, más doble eliminación, deshacer, renombrar, posiciones y compartir como imagen (no estaban en el scope original, se añadieron después).
- **Decisión de sincronización (confirmada con Ferran, 2026-07-02):** sin backend, sin login ni sesiones. El organizador exporta el estado del bracket como código de texto; los demás lo importan para ver el estado actualizado. Sincronización manual (el organizador re-exporta tras cada ronda).
- **Pendiente (2026-07-04):** formato de liga/round-robin además de brackets — ver "Ideas pendientes de desarrollar" en Estado Actual arriba para el diseño propuesto.

### Fase 2 — 🟡 EN PROGRESO (4 de 5 regiones, comparador de tipos hecho, resto pendiente)
- **Kanto, Johto, Hoenn y Sinnoh hechos (493 Pokémon)**, verificados contra la tabla histórica de Bulbapedia (no PokéAPI por defecto — ver corrección crítica de la regla de oro arriba). Solo Teselia pendiente, mismo método a repetir.
- **Pokédex de consulta** (bilingüe): buscar Pokémon, ver ubicación por región/ruta, stats, movimientos válidos en PokeMMO. **Hecho excepto ubicación/movimientos (esperan a que se rellenen los stubs `locations.json`/`movesets.json` — ver idea de las guías de seviichamp.blogspot.com para `locations.json`).**
- **Comparador de tipos interactivo:** tap-to-check de efectividad, incluyendo combinaciones de doble tipo. **Hecho para tipo simple; combinaciones de doble tipo pendientes.**

### Fase 3 — Requieren el dataset completo (5 regiones) y lógica más compleja
- **Calculadora de crianza:** IVs, naturalezas, árbol visual multi-generación (qué padres necesito para llegar al resultado final).
- **Tier list competitiva con filtros:** combinación de tier (Uber/OU/UU/etc., fuente = PokeMMO Wiki + tier lists de comunidad PokeMMO, NUNCA Smogon) + tipo + rol de combate (atacante físico/especial, tanque, soporte...). Los roles no vienen etiquetados en ninguna fuente estructurada — normalizar a mano a partir de los sets de Smogon como referencia de partida, pero el tier en sí sigue las fuentes de PokeMMO.

### Fase 4 — Plataforma-específico / trabajo nativo
- **Tracker de shinies/encuentros con widget pasivo** en pantalla de inicio (sin notificaciones, el usuario mira el widget si quiere).
- **Exportar equipos a formato Showdown** (texto plano, útil para el propio Ferran y su grupo de torneos desde el primer día).

### Fase 5 — Más esfuerzo, dejar para el final
- **Calculadora de daño:** requiere reproducir con precisión la fórmula de daño de Gen 5, limitada a habilidades/objetos/movimientos que realmente existen en PokeMMO (regla de oro aplica con más fuerza aquí que en ningún otro sitio — un error aquí es un error de cálculo de combate, no solo un dato mal etiquetado).

---

## Estructura de datos propuesta (punto de partida, ajustar según se construya)

```
/data
  /kanto
    pokemon.json       // stats base + tipo (fuente: tabla Gen II-V de Bulbapedia, NUNCA PokéAPI por defecto), familia evolutiva/sprite (fuente: PokéAPI, sí válido tal cual)
    movesets.json       // movimientos válidos en PokeMMO por Pokémon (fuente: overrides manuales, campo "source" obligatorio)
    abilities.json       // habilidades válidas en PokeMMO por Pokémon (fuente: overrides manuales)
    locations.json       // ruta/región, % de captura (fuente candidata: guías de farmeo seviichamp.blogspot.com con atribución a su fuente original, o PokeMMO Wiki / PokeMMO Hub como referencia cruzada)
  /johto, /hoenn ... (misma estructura — hechas; /sinnoh, /teselia pendientes con el mismo método)
  /tiers
    pokemmo_tiers.json   // fuente: PokeMMO Wiki + tier lists de comunidad, NUNCA Smogon
```

Cada entrada de `movesets.json` y `abilities.json` debe incluir:
```json
{
  "pokemon": "charizard",
  "value": "...",
  "source": "PokeMMO Wiki — verificado 2026-XX-XX",
  "verified": true
}
```
