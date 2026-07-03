// Single source of truth for the dark palette — consumed by tailwind.config.js
// (CommonJS, read by Metro at build time) and by RN components that need a
// raw hex value outside Tailwind classes (e.g. TextInput placeholderTextColor,
// which NativeWind can't style via className). Via Claude Design, 2026-07-02.
module.exports = {
  ink: {
    900: '#0B0E14', // fondo de pantalla
    800: '#131722', // superficie (tarjetas)
    700: '#1B2130', // superficie elevada (inputs, chips)
    600: '#2A3142', // bordes
    400: '#6B7488', // texto apagado / placeholder
    300: '#9AA3B5', // texto secundario
    100: '#EDEFF3', // texto principal
  },
  pokeRed: {
    400: '#F0615F', // hover
    DEFAULT: '#E4383B', // base
    600: '#C42D30', // pressed
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
