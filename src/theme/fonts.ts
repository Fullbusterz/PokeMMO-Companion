// Display serif for headings — part of the "Mapa de región" visual direction
// (2026-07-10, chosen by Ferran from 6 mockup options). Body text stays on
// the system font everywhere; this is applied narrowly (screen titles, card
// titles) via inline style, since NativeWind can't reference a loaded custom
// font through className the way it does for bundled Tailwind font tokens.
export const displayFont = {
  regular: 'PlayfairDisplay_700Bold',
  italic: 'PlayfairDisplay_700Bold_Italic',
};
