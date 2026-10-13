// ---------------------------------------------------------------------------
//  LEVELS & THEMES
//  Chaque niveau = un labyrinthe ASCII + un thème (couleurs, décor, partenaires).
//  Pour un Pac-Man Halloween / Noël / Jeux du Pacifique : dupliquer un niveau,
//  changer `theme` (couleurs, décor) et `mana` (logos) — le moteur fait le reste.
//
//  Légende du labyrinthe :
//    #  mur          .  pointillé (flèche tatouage)      o  Mana (logo partenaire)
//    =  porte de la maison des fantômes                  G  intérieur de la maison
//    P  départ de Pac-Man                                T  tunnel (sortie latérale)
//    B  point d'apparition du bonus                      (espace) couloir vide
// ---------------------------------------------------------------------------

export const PARTNERS = {
  agritech: { id: 'agritech', name: 'Agritech',           logo: 'assets/logos/agritech.png', color: '#7cc43a' },
  ace:      { id: 'ace',      name: 'ACE Sin Tung Hing',  logo: 'assets/logos/ace.png',      color: '#e8232a' },
  gan:      { id: 'gan',      name: 'GAN',                logo: 'assets/logos/gan.png',      color: '#f5b400' },
  taapuna:  { id: 'taapuna',  name: 'Taapuna La Boutique',logo: 'assets/logos/taapuna.png',  color: '#1b1b1b' },
};

export const THEMES = {
  jungle: {
    id: 'jungle',
    name: 'Jungle polynésienne',
    background: 0x061a1c,
    fog: { color: 0x061a1c, density: 0.028 },
    hemi: { sky: 0x9fe6da, ground: 0x1c3a24, intensity: 1.15 },
    sun:  { color: 0xfff1d0, intensity: 1.9 },
    wall: { color: 0x6e7c6a, moss: 0x6aa044, glow: 0x7af5d8, glowIntensity: 1.0 },
    floor: { path: 0x3d4858, stone: 0x1a2028, carve: 0xe8d7b0, pathEdge: 0x55647a },
    dot: 0xffe6a3,
    ground: 0x0b2a14,
    torch: { color: 0xffa040, intensity: 9, distance: 9 },
    firefly: 0xd4ff9a,
    pacman: { body: 0xffd43b, flower: 0xfff7e8 },
    leaves: { a: 0x3f9a3a, b: 0x1f6b3c, c: 0x7cc96a },
  },
};

export const LEVELS = [
  {
    id: 1,
    name: 'Niveau 1',
    subtitle: 'La jungle de Taapuna',
    theme: 'jungle',
    // Les 4 Manas (coins) utilisent les logos dans cet ordre : haut-gauche, haut-droit, bas-gauche, bas-droit
    mana: ['agritech', 'ace', 'gan', 'taapuna'],
    speeds: { pacman: 7.4, pacmanEating: 6.9, ghost: 6.9, frightened: 4.4, tunnel: 3.9, eyes: 15 },
    frightenedTime: 7,          // secondes d'invincibilité (Mana)
    scatterChase: [7, 20, 7, 20, 5, 20, 5, Infinity],
    ghostRelease: { pinky: 0, inky: 24, clyde: 56 }, // nb de pointillés mangés avant sortie
    bonus: { at: [60, 150], duration: 10, score: 500, label: 'Carte BIG CE' },
    maze: [
      '#####################',
      '#.........#.........#',
      '#o###.###.#.###.###o#',
      '#...................#',
      '#.###.#.#####.#.###.#',
      '#.....#...#...#.....#',
      '#####.###.#.###.#####',
      '#####.#.......#.#####',
      '#####.#.##=##.#.#####',
      'T   ....#GGG#....   T',
      '#####.#.#####.#.#####',
      '#####.#...B...#.#####',
      '#####.#.#####.#.#####',
      '#.........#.........#',
      '#.###.###.#.###.###.#',
      '#o..#.....P.....#..o#',
      '###.#.#.#####.#.#.###',
      '#.....#...#...#.....#',
      '#.#######.#.#######.#',
      '#...................#',
      '#####################',
    ],
  },
];
