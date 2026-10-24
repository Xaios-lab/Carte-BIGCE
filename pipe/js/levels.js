// ---------------------------------------------------------------------------
//  LEVELS, THEMES & PARTNERS
//  Chaque niveau = une grille ASCII + un thème + des réglages (quota, vitesse de l'eau…).
//
//  Légende de la grille :
//    .  case libre (on peut y poser un tuyau)
//    #  rocher volcanique (case bloquée)         T  cocotier (case bloquée)
//    ^ v < >  robinet source : la flèche donne le sens de sortie de l'eau
//    R  réservoir d'arrivée (logo du partenaire principal)
//    o  Mana : vanne-croix dorée déjà posée, logo partenaire (bonus quand l'eau la traverse)
// ---------------------------------------------------------------------------

export const PARTNERS = {
  // Partenaire principal du jeu : son logo est à remplacer par le fichier définitif (PNG 512×512 rond)
  plomberie: { id: 'plomberie', name: 'Plomberie de Faa’a', logo: null, placeholder: { line1: 'PLOMBERIE', line2: 'DE FAA’A' }, color: '#1e6fd9' },
  charcuterie: { id: 'charcuterie', name: 'Charcuterie du Pacifique', logo: 'assets/logos/charcuterie.png', color: '#c8102e' },
  ace:      { id: 'ace',      name: 'ACE Sin Tung Hing',  logo: 'assets/logos/ace.png',      color: '#e8232a' },
  gan:      { id: 'gan',      name: 'GAN',                logo: 'assets/logos/gan.png',      color: '#f5b400' },
  taapuna:  { id: 'taapuna',  name: 'Taapuna La Boutique',logo: 'assets/logos/taapuna.png',  color: '#1b1b1b' },
  amouy:    { id: 'amouy',    name: 'Amouy',              logo: 'assets/logos/amouy.png',    color: '#f28b1e' },
  guilloux: { id: 'guilloux', name: 'Guilloux',           logo: 'assets/logos/guilloux.png', color: '#d4231f' },
};

/** Partenaire dont le logo orne le réservoir d'arrivée */
export const MAIN_PARTNER = 'plomberie';

export const THEMES = {
  lagon: {
    id: 'lagon',
    name: 'Lagon tropical',
    sky: { top: 0x0b5f9e, bottom: 0x7fe0f2 },
    fog: { color: 0x7fd6ea, density: 0.012 },
    hemi: { sky: 0xcdf4ff, ground: 0xe7d6a8, intensity: 1.35 },
    sun: { color: 0xfff6e0, intensity: 2.4 },
    sea: { deep: 0x0a6fa3, shallow: 0x3fd3e6, foam: 0xe6fcff },
    sand: { light: 0xf3e3b6, dark: 0xd9c38a, edge: 0xc9ad74, grid: 0x6fb9c4 },
    pipe: { body: 0x1e6fd9, glass: 0x6fb6ff, brass: 0xd9a441, water: 0x14c4f5, waterGlow: 0x9df3ff, preview: 0x9ad4ff },
    rock: 0x3d3f46,
    palm: { trunk: 0x9a7246, leaf: 0x2fa84f, leaf2: 0x6fd36b },
    flowers: [0xff3b6b, 0xff2fa8, 0xff8c1a, 0xffe14d],
    gold: 0xe7c25a,
  },
};

export const LEVELS = [
  {
    id: 1,
    name: 'Niveau 1',
    subtitle: 'La fontaine de Faa’a',
    prize: '10 000 F de chèques cadeaux à gagner',
    theme: 'lagon',
    mana: ['plomberie', 'amouy', 'guilloux', 'ace'],   // ordre de lecture de la grille (haut-gauche → bas-droite)
    quota: 12,          // nombre de tuyaux à remplir avant que le réservoir s'ouvre
    countdown: 15,      // secondes avant que l'eau ne jaillisse
    secPerCell: 2.6,    // durée de traversée d'un tuyau
    cardAt: [7, 18],    // la Carte BIG CE apparaît dans la file après N pièces posées
    grid: [
      'v......',
      '.......',
      '..#....',
      '.o...o.',
      '.......',
      '.o.#.o.',
      '.......',
      '......R',
    ],
  },
  {
    id: 2,
    name: 'Niveau 2',
    subtitle: 'Le lagon de Punaauia',
    prize: '10 000 F de chèques cadeaux à gagner',
    theme: 'lagon',
    mana: ['plomberie', 'gan', 'taapuna', 'charcuterie'],
    quota: 18,
    countdown: 12,
    secPerCell: 2.1,
    cardAt: [8, 20],
    grid: [
      'T......T',
      '>.......',
      '...o....',
      '.#....#.',
      '....o...',
      '.o......',
      '......o.',
      '.#......',
      'T.....RT',
    ],
  },
  {
    id: 3,
    name: 'Niveau 3',
    subtitle: 'La cascade de Papenoo',
    prize: '10 000 F de chèques cadeaux à gagner',
    theme: 'lagon',
    mana: ['plomberie', 'amouy', 'guilloux', 'gan', 'ace'],
    quota: 24,
    countdown: 10,
    secPerCell: 1.7,
    cardAt: [8, 20, 32],
    grid: [
      'T.......T',
      '.v.......',
      '...o..#..',
      '.#.......',
      '.....o...',
      '..o....#.',
      '.#.......',
      '....o....',
      '.......R.',
      'T.......T',
    ],
  },
];
