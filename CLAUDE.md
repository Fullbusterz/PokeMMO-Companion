@AGENTS.md

# PokeMMO Companion App — Contexto del Proyecto

## Qué es esto

App móvil companion para PokeMMO (no para Pokémon oficial — son cosas distintas, ver regla de oro más abajo). Proyecto personal de Ferran, en su tiempo libre, sin presión comercial. Construida con Claude Code, supervisada por Ferran.

**Por qué existe:** no hay ninguna app pulida y nativa en Play Store/App Store para PokeMMO. Lo que existe son webs (PokeMMO Hub) y herramientas sueltas de aficionados en GitHub/itch.io, ninguna en tienda oficial, ninguna bilingüe ES/EN.

**Objetivo explícito de este proyecto:** NO es un proyecto para ganar dinero. Se construye independientemente de si genera ingresos o no. Esto tiene implicaciones prácticas — ver sección "Qué NO hacer en v1".

---

## 🚨 REGLA DE ORO — LEER ANTES DE TOCAR NINGÚN DATO DE POKÉMON

**PokeMMO NO es "Pokémon oficial filtrado hasta Gen 5".** Es un juego con desarrollo propio y continuo. El equipo de PokeMMO decide sus propias mecánicas, y a veces adopta cambios de juegos oficiales posteriores y a veces no, según su propio criterio. Esto significa que **ningún dato de Pokémon (movimiento, habilidad, tier competitivo, mecánica) se da por válido solo porque "es de Gen 5 o anterior".** Hay que verificarlo específicamente contra PokeMMO.

### Jerarquía de fuentes (de más a menos fiable)

1. **Patch notes oficiales de PokeMMO** (foro oficial, sección de anuncios) — máxima autoridad
2. **PokeMMO Wiki** (pokemmo.shoutwiki.com) — documentación mantenida por la comunidad específicamente para PokeMMO
3. **Verificación directa en el juego** (Ferran comprobándolo en persona)
4. **Tier lists / consenso de la comunidad de PokeMMO** (TierMaker "PokeMMO PvP Tierlist", foro oficial — sección Competition Alley)
5. **PokéAPI** — SOLO para datos verdaderamente universales e inmutables entre juegos: sprite, familia evolutiva, tipo base, estadísticas base. **NUNCA para movimientos, habilidades, tiers competitivos o mecánicas de combate.**

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

### Fase 1 — Victoria rápida, sin dependencia del archivo de datos verificado
**Gestor de torneos/ligas para el grupo de Ferran**
- Bracket simple, participantes, registro de resultados.
- **Decisión de sincronización (confirmada con Ferran, 2026-07-02):** sin backend, sin login ni sesiones. El organizador exporta el estado del bracket como código de texto; los demás lo importan para ver el estado actualizado. Sincronización manual (el organizador re-exporta tras cada ronda).
- Esta es la única feature ya validada por el propio uso real de Ferran — máxima prioridad para tener algo usable pronto.

### Fase 2 — Prueba de concepto del pipeline de datos
- Construir el archivo de datos verificado de **Kanto únicamente** primero, como prueba de concepto de todo el proceso de verificación (regla de oro de arriba). No avanzar a las demás regiones hasta que el proceso esté validado.
- **Pokédex de consulta** (bilingüe): buscar Pokémon, ver ubicación por región/ruta, stats, movimientos válidos en PokeMMO.
- **Comparador de tipos interactivo:** tap-to-check de efectividad, incluyendo combinaciones de doble tipo.

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
    pokemon.json       // stats base, tipo, familia evolutiva (fuente: PokéAPI, válido tal cual)
    movesets.json       // movimientos válidos en PokeMMO por Pokémon (fuente: overrides manuales, campo "source" obligatorio)
    abilities.json       // habilidades válidas en PokeMMO por Pokémon (fuente: overrides manuales)
    locations.json       // ruta/región, % de captura (fuente: PokeMMO Wiki / PokeMMO Hub como referencia cruzada)
  /johto ... (misma estructura, se construye después de validar Kanto)
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
