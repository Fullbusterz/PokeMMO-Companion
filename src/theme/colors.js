// Single source of truth for the dark palette — consumed by tailwind.config.js
// (CommonJS, read by Metro at build time) and by RN components that need a
// raw hex value outside Tailwind classes (e.g. TextInput placeholderTextColor,
// which NativeWind can't style via className). Original dark theme via Claude
// Design, 2026-07-02. Repalette to "Mapa de región" (night-map navy + aged-gold
// linework) on 2026-07-10 — chosen by Ferran from 6 mockup directions, keeps
// the same key names so no call site needed touching, only the hex values.
module.exports = {
  ink: {
    900: '#0B1A1F', // fondo de pantalla — navy noche de mapa
    800: '#122530', // superficie (tarjetas)
    700: '#1B3540', // superficie elevada (inputs, chips)
    600: '#2A4A55', // bordes neutros (no dorados — el dorado es un acento, ver `gold`)
    400: '#6B8894', // texto apagado / placeholder
    300: '#9FB4BC', // texto secundario
    100: '#E7D9B8', // texto principal — pergamino cálido
  },
  pokeRed: {
    400: '#F0615F', // hover
    DEFAULT: '#E4383B', // base — también el color de la "chincheta" del mapa
    600: '#C42D30', // pressed
  },
  gold: {
    400: '#DFC08A', // hover / trazo claro
    DEFAULT: '#C9A46B', // línea de mapa / borde de tarjeta
    600: '#A6813F', // pressed / trazo oscuro
  },
  // Los 6 primeros vienen de la sesión de Claude Design (torneos); el resto
  // sigue la paleta estándar de tipo Pokémon reconocible por los jugadores,
  // ajustada para legibilidad sobre fondo oscuro. 17 tipos, sin Hada (ver
  // data/type-chart.json).
  type: {
    normal: '#8B95A3',
    fire: '#F0803C',
    water: '#4B9BE8',
    electric: '#F2C438',
    grass: '#55C464',
    ice: '#6CD5E8',
    fighting: '#D3604A',
    poison: '#B060B0',
    ground: '#DDBB66',
    flying: '#A890F0',
    psychic: '#B892F8',
    bug: '#A8C020',
    rock: '#C4AC5C',
    ghost: '#8571AC',
    dragon: '#8258F8',
    dark: '#8A7568',
    steel: '#C0C0D8',
  },
  status: {
    setup: '#6B7488',
    progress: '#22C55E',
    finished: '#3B82F6',
  },
};
