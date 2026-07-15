import moveNames from '../../data/reference/move-names.json';
import moveNamesEs from '../../data/reference/move-names-es.json';

// The farm-guide text (seviichamp.blogspot.com) writes items as squished
// lowercase slugs ("tinymushroom", "tm-rockslide") — this maps the common
// ones back to their real display names. Anything missing falls back to a
// best-effort humanizer instead of failing silently on an unknown item.
const ITEM_NAMES: Record<string, string> = {
  // Heals / potions
  potion: 'Potion', superpotion: 'Super Potion', hyperpotion: 'Hyper Potion', maxpotion: 'Max Potion',
  fullrestore: 'Full Restore', revive: 'Revive', maxrevive: 'Max Revive', ether: 'Ether', maxether: 'Max Ether',
  elixir: 'Elixir', maxelixir: 'Max Elixir', antidote: 'Antidote', parlyzheal: 'Paralyze Heal',
  awakening: 'Awakening', burnheal: 'Burn Heal', iceheal: 'Ice Heal', fullheal: 'Full Heal',
  repel: 'Repel', maxrepel: 'Max Repel', superrepel: 'Super Repel',
  'fresh water': 'Fresh Water', freshwater: 'Fresh Water', 'soda pop': 'Soda Pop', sodapop: 'Soda Pop', lemonade: 'Lemonade',
  // Poke Balls
  pokeball: 'Poké Ball', greatball: 'Great Ball', ultraball: 'Ultra Ball', masterball: 'Master Ball',
  nestball: 'Nest Ball', netball: 'Net Ball', safariball: 'Safari Ball',
  // Vitamins / EV
  hpup: 'HP Up', protein: 'Protein', iron: 'Iron', carbos: 'Carbos', calcium: 'Calcium', zinc: 'Zinc',
  ppup: 'PP Up', ppmax: 'PP Max', rarecandy: 'Rare Candy',
  // Berries
  oranberry: 'Oran Berry', sitrusberry: 'Sitrus Berry', cheriberry: 'Cheri Berry', chestoberry: 'Chesto Berry',
  pechaberry: 'Pecha Berry', rawstberry: 'Rawst Berry', aspearberry: 'Aspear Berry', leppaberry: 'Leppa Berry',
  persimberry: 'Persim Berry', lumberry: 'Lum Berry', nanabberry: 'Nanab Berry', wepearberry: 'Wepear Berry',
  pinapberry: 'Pinap Berry', razzberry: 'Razz Berry', iapapaberry: 'Iapapa Berry', apicotberry: 'Apicot Berry',
  blukberry: 'Bluk Berry',
  // Evolution stones
  moonstone: 'Moon Stone', leafstone: 'Leaf Stone', waterstone: 'Water Stone', thunderstone: 'Thunder Stone',
  firestone: 'Fire Stone', sunstone: 'Sun Stone',
  // Held / battle items
  silkscarf: 'Silk Scarf', hardstone: 'Hard Stone', twistedspoon: 'Twisted Spoon', sharpbeak: 'Sharp Beak',
  dragonscale: 'Dragon Scale', quickclaw: 'Quick Claw', leftovers: 'Leftovers', machobrace: 'Macho Brace',
  everstone: 'Everstone', amuletcoin: 'Amulet Coin', cleansetag: 'Cleanse Tag', soothebell: 'Soothe Bell',
  silverpowder: 'Silver Powder', seaincense: 'Sea Incense', laxincense: 'Lax Incense', wiseglasses: 'Wise Glasses',
  blackbelt: 'Black Belt', luckypunch: 'Lucky Punch', metalcoat: 'Metal Coat', nevermeltice: 'Never-Melt Ice',
  protector: 'Protector', magmarizer: 'Magmarizer', electirizer: 'Electirizer', "king'srock": "King's Rock",
  oldamber: 'Old Amber', domefossil: 'Dome Fossil', helixfossil: 'Helix Fossil', 'up-grade': 'Up-Grade',
  tinymushroom: 'Tiny Mushroom', bigmushroom: 'Big Mushroom',
  // Key items
  townmap: 'Town Map', runningshoes: 'Running Shoes', bicycle: 'Bicycle', bikevoucher: 'Bike Voucher',
  vsseeker: 'VS Seeker', oldrod: 'Old Rod', goodrod: 'Good Rod', superrod: 'Super Rod', coincase: 'Coin Case',
  powderjar: 'Powder Jar', itemfinder: 'Itemfinder', pokeflute: 'Poké Flute', silphscope: 'Silph Scope',
  liftkey: 'Lift Key', cardkey: 'Card Key', secretkey: 'Secret Key', 'tri-pass': 'Tri-Pass',
  rainbowpass: 'Rainbow Pass', "oak'sparcel": "Oak's Parcel", tea: 'Tea', goldteeth: 'Gold Teeth',
  exp: 'Exp. Share', 'exp share': 'Exp. Share', escaperope: 'Escape Rope', dubiousdisc: 'Dubious Disc',
  meteorite: 'Meteorite',
  // Misc
  nugget: 'Nugget', stardust: 'Stardust', starpiece: 'Star Piece', pearl: 'Pearl', bigpearl: 'Big Pearl',
  heartscale: 'Heart Scale', magnet: 'Magnet', xaccuracy: 'X Accuracy', xspecial: 'X Special',
  land: 'Land', magikarp: 'Magikarp', eevee: 'Eevee', lapras: 'Lapras', hitmonlee: 'Hitmonlee',
  togepi: 'Togepi', 'togepi egg': 'Togepi Egg',
  // Johto-specific (from the Gen 2 known-item scan)
  'hp up': 'HP Up', 'pp up': 'PP Up', 'pp max': 'PP Max',
  pokegear: 'Pokégear', pokégear: 'Pokégear',
  'apricorn box': 'Apricorn Box', 'fashion case': 'Fashion Case', 'squirt bottle': 'Squirt Bottle',
  'mystery egg': 'Mystery Egg', 'vs. recorder': 'Vs. Recorder', 'radio card': 'Radio Card',
  'blue card': 'Blue Card', 'coin case': 'Coin Case', 'card key': 'Card Key', 'fast ball': 'Fast Ball',
  'lure ball': 'Lure Ball', 'lure balls': 'Lure Balls', 'moomoo milk': 'Moomoo Milk',
  'dawn stone': 'Dawn Stone', 'dusk stone': 'Dusk Stone', 'shiny stone': 'Shiny Stone',
  // Held items (plates, bands, orbs, etc. — Hoenn/Sinnoh/Teselia guides)
  brightpowder: 'Bright Powder', destinyknot: 'Destiny Knot', expertbelt: 'Expert Belt',
  focusband: 'Focus Band', gripclaw: 'Grip Claw', laggingtail: 'Lagging Tail', lifeorb: 'Life Orb',
  lightclay: 'Light Clay', muscleband: 'Muscle Band', poisonbarb: 'Poison Barb', razorclaw: 'Razor Claw',
  razorfang: 'Razor Fang', reapercloth: 'Reaper Cloth', ringtarget: 'Ring Target', rockyhelmet: 'Rocky Helmet',
  scopelens: 'Scope Lens', shellbell: 'Shell Bell', softsand: 'Soft Sand', spelltag: 'Spell Tag',
  stickybarb: 'Sticky Barb', blackglasses: 'Black Glasses', dragonfang: 'Dragon Fang', mysticwater: 'Mystic Water',
  miracleseed: 'Miracle Seed', mentalherb: 'Mental Herb', whiteherb: 'White Herb', healpowder: 'Heal Powder',
  energypowder: 'Energy Powder', energyroot: 'Energy Root', revivalherb: 'Revival Herb',
  // Arceus plates
  dracoplate: 'Draco Plate', dreadplate: 'Dread Plate', earthplate: 'Earth Plate', fistplate: 'Fist Plate',
  flameplate: 'Flame Plate', icicleplate: 'Icicle Plate', insectplate: 'Insect Plate', ironplate: 'Iron Plate',
  meadowplate: 'Meadow Plate', mindplate: 'Mind Plate', skyplate: 'Sky Plate', splashplate: 'Splash Plate',
  spookyplate: 'Spooky Plate', stoneplate: 'Stone Plate', toxicplate: 'Toxic Plate', zapplate: 'Zap Plate',
  // Legendary orbs / DPPt story items
  adamantorb: 'Adamant Orb', lustrousorb: 'Lustrous Orb', griseousorb: 'Griseous Orb', magmaemblem: 'Magma Emblem',
  oldgateau: 'Old Gateau', lunarwing: 'Lunar Wing', pearlstring: 'Pearl String', galactickey: 'Galactic Key',
  // Fossils
  clawfossil: 'Claw Fossil', coverfossil: 'Cover Fossil', rootfossil: 'Root Fossil',
  // Key items
  acrobike: 'Acro Bike', 'mach bike': 'Mach Bike', machbike: 'Mach Bike', basementkey: 'Basement Key',
  devongoods: 'Devon Goods', devonscope: 'Devon Scope', dowsingmachine: 'Dowsing Machine',
  fashioncase: 'Fashion Case', frontierpass: 'Frontier Pass', 'go-goggles': 'Go-Goggles', 'c-gear': 'C-Gear',
  guardspec: 'Guard Spec.', harbormail: 'Harbor Mail', palpad: 'Pal Pad', pokeblockcase: 'PokéBlock Case',
  pokedex: 'Pokédex', 'national pokedex': 'National Pokédex', pokenav: 'Pokénav', poketch: 'Poketch',
  propcase: 'Prop Case', secretpotion: 'Secret Potion', sootsack: 'Soot Sack', storagekey: 'Storage Key',
  suitekey: 'Suite Key', workskey: "Works Key", deepseatooth: 'Deep Sea Tooth', direhit: 'Dire Hit',
  glitterpowder: 'Glitter Powder', dragonskull: 'Dragon Skull', effortribbon: 'Effort Ribbon',
  bignugget: 'Big Nugget', bigroot: 'Big Root', oldcharm: 'Old Charm', parcel: "Parcel",
  // Battle items / shards / poffins
  coupon1: 'Coupon 1', coupon2: 'Coupon 2', coupon3: 'Coupon 3', redshard: 'Red Shard', blueshard: 'Blue Shard',
  greenshard: 'Green Shard', yellowshard: 'Yellow Shard', mildpoffin: 'Mild Poffin', ragecandybar: 'Rage Candy Bar',
  xattack: 'X Attack', xdefend: 'X Defend', xspeed: 'X Speed', xsp: 'X Sp. Atk',
  // Dolls / mail / misc
  pokedoll: 'Poké Doll', wailmerdoll: 'Wailmer Doll', lotaddoll: 'Lotad Doll', wailmerpail: 'Wailmer Pail',
  whiteflute: 'White Flute', shoalsalt: 'Shoal Salt', shoalshell: 'Shoal Shell',
};

// Spanish display names, official (Nintendo localization, same source used for
// move-names-es.json/ability-names-es.json — PokéAPI's item_names.csv,
// language_id=7 for es-ES) — cross-referenced item by item, 2026-07-11 (Ferran
// asked for the item chips to match the translated guide text, see
// data/guides/*.json stepsEs). Same keys as ITEM_NAMES above, only the display
// value changes — lookups everywhere else stay keyed by the English slug.
const ITEM_NAMES_ES: Record<string, string> = {
  // Heals / potions
  potion: 'Poción', superpotion: 'Superpoción', hyperpotion: 'Hiperpoción', maxpotion: 'Poción Máxima',
  fullrestore: 'Restaurar Todo', revive: 'Revivir', maxrevive: 'Revivir Máximo', ether: 'Éter', maxether: 'Éter Máximo',
  elixir: 'Elixir', maxelixir: 'Elixir Máximo', antidote: 'Antídoto', parlyzheal: 'Antiparalizador',
  awakening: 'Despertar', burnheal: 'Antiquemar', iceheal: 'Antihielo', fullheal: 'Cura Total',
  repel: 'Repelente', maxrepel: 'Repelente Máximo', superrepel: 'Superrepelente',
  'fresh water': 'Agua Fresca', freshwater: 'Agua Fresca', 'soda pop': 'Refresco', sodapop: 'Refresco', lemonade: 'Limonada',
  // Poke Balls
  pokeball: 'Poké Ball', greatball: 'Super Ball', ultraball: 'Ultra Ball', masterball: 'Master Ball',
  nestball: 'Nido Ball', netball: 'Malla Ball', safariball: 'Safari Ball',
  // Vitamins / EV
  hpup: 'Más PS', protein: 'Proteína', iron: 'Hierro', carbos: 'Carburante', calcium: 'Calcio', zinc: 'Zinc',
  ppup: 'Más PP', ppmax: 'PP Máximos', rarecandy: 'Caramelo Raro',
  // Berries
  oranberry: 'Baya Aranja', sitrusberry: 'Baya Zidra', cheriberry: 'Baya Zreza', chestoberry: 'Baya Atania',
  pechaberry: 'Baya Meloc', rawstberry: 'Baya Safre', aspearberry: 'Baya Perasi', leppaberry: 'Baya Zanama',
  persimberry: 'Baya Caquic', lumberry: 'Baya Ziuela', nanabberry: 'Baya Latano', wepearberry: 'Baya Peragu',
  pinapberry: 'Baya Pinia', razzberry: 'Baya Frambu', iapapaberry: 'Baya Pabaya', apicotberry: 'Baya Aricoc',
  blukberry: 'Baya Oram',
  // Evolution stones
  moonstone: 'Piedra Lunar', leafstone: 'Piedra Hoja', waterstone: 'Piedra Agua', thunderstone: 'Piedra Trueno',
  firestone: 'Piedra Fuego', sunstone: 'Piedra Solar',
  // Held / battle items
  silkscarf: 'Pañuelo de Seda', hardstone: 'Piedra Dura', twistedspoon: 'Cuchara Torcida', sharpbeak: 'Pico Afilado',
  dragonscale: 'Escama Dragón', quickclaw: 'Garra Rápida', leftovers: 'Restos', machobrace: 'Brazal Firme',
  everstone: 'Piedra Eterna', amuletcoin: 'Moneda Amuleto', cleansetag: 'Amuleto', soothebell: 'Cascabel Alivio',
  silverpowder: 'Polvo Plata', seaincense: 'Incienso Marino', laxincense: 'Incienso Suave', wiseglasses: 'Gafas Especiales',
  blackbelt: 'Cinturón Negro', luckypunch: 'Puño Suerte', metalcoat: 'Revestimiento Metálico', nevermeltice: 'Hielo Perpetuo',
  protector: 'Protector', magmarizer: 'Magmatizador', electirizer: 'Electrizador', "king'srock": 'Roca del Rey',
  oldamber: 'Ámbar Viejo', domefossil: 'Fósil Domo', helixfossil: 'Fósil Hélix', 'up-grade': 'Mejora',
  tinymushroom: 'Miniseta', bigmushroom: 'Seta Grande',
  // Key items
  townmap: 'Mapa', runningshoes: 'Zapatillas Deportivas', bicycle: 'Bici', bikevoucher: 'Bono Bici',
  vsseeker: 'Buscapelea', oldrod: 'Caña Vieja', goodrod: 'Caña Buena', superrod: 'Supercaña', coincase: 'Monedero',
  powderjar: 'Bote Polvos', itemfinder: 'Zahorí', pokeflute: 'Poké Flauta', silphscope: 'Visor Silph',
  liftkey: 'Llave Ascensor', cardkey: 'Llave Magnética', secretkey: 'Llave Secreta', 'tri-pass': 'Tri-Ticket',
  rainbowpass: 'Iris-Ticket', "oak'sparcel": 'Correo-Oak', tea: 'Té', goldteeth: 'Dentadura de Oro',
  exp: 'Repartir Exp', 'exp share': 'Repartir Exp', escaperope: 'Cuerda Huida', dubiousdisc: 'Disco Extraño',
  meteorite: 'Meteorito',
  // Misc
  nugget: 'Pepita', stardust: 'Polvo Estelar', starpiece: 'Trozo Estrella', pearl: 'Perla', bigpearl: 'Perla Grande',
  heartscale: 'Escama Corazón', magnet: 'Imán', xaccuracy: 'Precisión X', xspecial: 'Especial X',
  land: 'Land', magikarp: 'Magikarp', eevee: 'Eevee', lapras: 'Lapras', hitmonlee: 'Hitmonlee',
  togepi: 'Togepi', 'togepi egg': 'Huevo de Togepi',
  // Johto-specific (from the Gen 2 known-item scan)
  'hp up': 'Más PS', 'pp up': 'Más PP', 'pp max': 'PP Máximos',
  pokegear: 'Pokégear', pokégear: 'Pokégear',
  'apricorn box': 'Caja Bonguri', 'fashion case': 'Caja Corazón', 'squirt bottle': 'Regadera',
  'mystery egg': 'Huevo Misterioso', 'vs. recorder': 'Cámara Lucha', 'radio card': 'Tarjeta Radio',
  'blue card': 'Tarjeta Azul', 'coin case': 'Monedero', 'card key': 'Llave Magnética', 'fast ball': 'Rapid Ball',
  'lure ball': 'Cebo Ball', 'lure balls': 'Cebo Ball', 'moomoo milk': 'Leche Mu-mu',
  'dawn stone': 'Piedra Alba', 'dusk stone': 'Piedra Noche', 'shiny stone': 'Piedra Día',
  // Held items (plates, bands, orbs, etc. — Hoenn/Sinnoh/Teselia guides)
  brightpowder: 'Polvo Brillo', destinyknot: 'Lazo Destino', expertbelt: 'Cinta Experto',
  focusband: 'Cinta Aguante', gripclaw: 'Garra Garfio', laggingtail: 'Cola Plúmbea', lifeorb: 'Vidasfera',
  lightclay: 'Refleluz', muscleband: 'Cinta Fuerte', poisonbarb: 'Flecha Venenosa', razorclaw: 'Garra Afilada',
  razorfang: 'Colmillo Agudo', reapercloth: 'Tela Terrible', ringtarget: 'Blanco', rockyhelmet: 'Casco Dentado',
  scopelens: 'Periscopio', shellbell: 'Cascabel Concha', softsand: 'Arena Fina', spelltag: 'Hechizo',
  stickybarb: 'Toxiestrella', blackglasses: 'Gafas de Sol', dragonfang: 'Colmillo de Dragón', mysticwater: 'Agua Mística',
  miracleseed: 'Semilla Milagro', mentalherb: 'Hierba Mental', whiteherb: 'Hierba Blanca', healpowder: 'Polvo Curación',
  energypowder: 'Polvo Energía', energyroot: 'Raíz Energía', revivalherb: 'Hierba Revivir',
  // Arceus plates
  dracoplate: 'Tabla Draco', dreadplate: 'Tabla Oscura', earthplate: 'Tabla Terrax', fistplate: 'Tabla Fuerte',
  flameplate: 'Tabla Llama', icicleplate: 'Tabla Helada', insectplate: 'Tabla Bicho', ironplate: 'Tabla Acero',
  meadowplate: 'Tabla Pradal', mindplate: 'Tabla Mental', skyplate: 'Tabla Cielo', splashplate: 'Tabla Linfa',
  spookyplate: 'Tabla Terror', stoneplate: 'Tabla Pétrea', toxicplate: 'Tabla Tóxica', zapplate: 'Tabla Trueno',
  // Legendary orbs / DPPt story items
  adamantorb: 'Diamansfera', lustrousorb: 'Lustresfera', griseousorb: 'Griseosfera', magmaemblem: 'Signo Magma',
  oldgateau: 'Barrita Plus', lunarwing: 'Pluma Lunar', pearlstring: 'Sarta Perlas', galactickey: 'Llave Galaxia',
  // Fossils
  clawfossil: 'Fósil Garra', coverfossil: 'Fósil Tapa', rootfossil: 'Fósil Raíz',
  // Key items
  acrobike: 'Bici Acrobática', 'mach bike': 'Bici de Carreras', machbike: 'Bici de Carreras', basementkey: 'Llave del Sótano',
  devongoods: 'Piezas Devon', devonscope: 'Detector Devon', dowsingmachine: 'Zahorí',
  fashioncase: 'Caja Corazón', frontierpass: 'Pase Frontera', 'go-goggles': 'Gafas Aislantes', 'c-gear': 'C-Gear',
  guardspec: 'Protección X', harbormail: 'Carta Puerto', palpad: 'Bloc amigos', pokeblockcase: 'Tubo Pokécubos',
  pokedex: 'Pokédex', 'national pokedex': 'Pokédex Nacional', pokenav: 'Pokénav', poketch: 'Poketch',
  propcase: 'Neceser', secretpotion: 'Poción Secreta', sootsack: 'Saco Hollín', storagekey: 'Llave Almacén',
  suitekey: 'Llave Suite', workskey: 'Llave Central', deepseatooth: 'Diente Marino', direhit: 'Crítico X',
  glitterpowder: 'Polvo Brillante', dragonskull: 'Cráneo Dragón', effortribbon: 'Cinta Esfuerzo',
  bignugget: 'Maxipepita', bigroot: 'Raíz Grande', oldcharm: 'Talismán', parcel: 'Paquete',
  // Battle items / shards / poffins
  coupon1: 'Cupón 1', coupon2: 'Cupón 2', coupon3: 'Cupón 3', redshard: 'Parte Roja', blueshard: 'Parte Azul',
  greenshard: 'Parte Verde', yellowshard: 'Parte Amarilla', mildpoffin: 'Pokopó Suave', ragecandybar: 'Caramelo Furia',
  xattack: 'Ataque X', xdefend: 'Defensa X', xspeed: 'Velocidad X', xsp: 'At. Especial X',
  // Dolls / mail / misc
  pokedoll: 'Poké Muñeco', wailmerdoll: 'Peluche Wailmer', lotaddoll: 'Peluche Lotad', wailmerpail: 'Wailmegadera',
  whiteflute: 'Flauta Blanca', shoalsalt: 'Sal Cardumen', shoalshell: 'Concha Cardumen',
};

const MOVE_NAME_INDEX: Record<string, string> = {};
for (const name of moveNames as string[]) {
  MOVE_NAME_INDEX[name.toLowerCase().replace(/[^a-z0-9]/g, '')] = name;
}
const MOVE_NAMES_ES = moveNamesEs as Record<string, string>;

function humanizeFallback(raw: string): string {
  return raw
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Turns a guide item slug ("tm-rockslide", "tinymushroom") into a display name. */
export function prettifyItemName(raw: string, locale: 'es' | 'en' = 'en'): string {
  const lower = raw.toLowerCase().trim();
  const names = locale === 'es' ? ITEM_NAMES_ES : ITEM_NAMES;
  // Spanish game abbreviations: MT = Máquina Técnica, MO = Máquina Oculta.
  const tmLabel = locale === 'es' ? 'MT' : 'TM';
  const hmLabel = locale === 'es' ? 'MO' : 'HM';

  const tmMatch = lower.match(/^tm-(.+)/);
  if (tmMatch) {
    const move = MOVE_NAME_INDEX[tmMatch[1].replace(/[^a-z0-9]/g, '')];
    if (!move) return `${tmLabel} — ${humanizeFallback(tmMatch[1])}`;
    return `${tmLabel} — ${locale === 'es' ? (MOVE_NAMES_ES[move] ?? move) : move}`;
  }
  const hmMatch = lower.match(/^hm0?(\d)-(.+)/);
  if (hmMatch) {
    const move = MOVE_NAME_INDEX[hmMatch[2].replace(/[^a-z0-9]/g, '')];
    if (!move) return `${hmLabel}${hmMatch[1]} — ${humanizeFallback(hmMatch[2])}`;
    return `${hmLabel}${hmMatch[1]} — ${locale === 'es' ? (MOVE_NAMES_ES[move] ?? move) : move}`;
  }
  // "hm-cut" (Teselia's known-item scan doesn't tag the HM number, only the move)
  const bareHmMove = lower.match(/^hm-(.+)/);
  if (bareHmMove) {
    const move = MOVE_NAME_INDEX[bareHmMove[1].replace(/[^a-z0-9]/g, '')];
    if (!move) return `${hmLabel} — ${humanizeFallback(bareHmMove[1])}`;
    return `${hmLabel} — ${locale === 'es' ? (MOVE_NAMES_ES[move] ?? move) : move}`;
  }

  if (names[lower]) return names[lower];

  // Bare "tm27"/"hm5" (no move name attached, e.g. Johto's known-item scan)
  const bareTmHm = lower.match(/^(tm|hm)0?(\d+)$/);
  if (bareTmHm) return `${bareTmHm[1] === 'tm' ? tmLabel : hmLabel}${bareTmHm[2]}`;

  // Common squished suffixes ("oranberry" -> "oran berry")
  const suffixMatch = lower.match(/^(.+?)(berry|stone|ball)$/);
  if (suffixMatch) return humanizeFallback(`${suffixMatch[1]} ${suffixMatch[2]}`);

  return humanizeFallback(lower);
}

/**
 * Search key for finding an item's mention inside guide prose — distinct from
 * `prettifyItemName`'s nicer display format for TM/HM items specifically.
 * The walkthrough text (both the original English and the Spanish
 * translation) writes these as "TM-MoveName"/"MT-NombreMovimiento" (a plain
 * hyphen, no spaces around it), never with the em dash prettifyItemName uses
 * for on-screen display ("TM — Move Name") — searching for the pretty form
 * would never match the actual prose. Everything else reuses prettifyItemName
 * as-is since there's no such formatting split for regular items.
 */
export function getItemSearchName(raw: string, locale: 'es' | 'en'): string {
  const lower = raw.toLowerCase().trim();
  const tmLabel = locale === 'es' ? 'MT' : 'TM';
  const hmLabel = locale === 'es' ? 'MO' : 'HM';

  const tmMatch = lower.match(/^tm-(.+)/);
  if (tmMatch) {
    const move = MOVE_NAME_INDEX[tmMatch[1].replace(/[^a-z0-9]/g, '')];
    const moveName = move ? (locale === 'es' ? (MOVE_NAMES_ES[move] ?? move) : move) : humanizeFallback(tmMatch[1]);
    return `${tmLabel}-${moveName}`;
  }
  const hmMatch = lower.match(/^hm0?(\d)-(.+)/);
  if (hmMatch) {
    const move = MOVE_NAME_INDEX[hmMatch[2].replace(/[^a-z0-9]/g, '')];
    const moveName = move ? (locale === 'es' ? (MOVE_NAMES_ES[move] ?? move) : move) : humanizeFallback(hmMatch[2]);
    return `${hmLabel}${hmMatch[1]}-${moveName}`;
  }
  const bareHmMove = lower.match(/^hm-(.+)/);
  if (bareHmMove) {
    const move = MOVE_NAME_INDEX[bareHmMove[1].replace(/[^a-z0-9]/g, '')];
    const moveName = move ? (locale === 'es' ? (MOVE_NAMES_ES[move] ?? move) : move) : humanizeFallback(bareHmMove[1]);
    return `${hmLabel}-${moveName}`;
  }

  return prettifyItemName(raw, locale);
}
