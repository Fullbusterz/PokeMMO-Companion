/** @type {import('tailwindcss').Config} */
const colors = require('./src/theme/colors');

module.exports = {
  // Required even though we don't use dark: variants — nativewind's web
  // color-scheme runtime throws if darkMode is left at the default 'media'
  // (see react-native-css-interop/color-scheme.js). Verified by removing it
  // and hitting the crash again during this session's testing.
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: { colors },
  },
  plugins: [],
};
