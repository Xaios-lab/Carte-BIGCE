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
    background: 0x07232a,
    fog: { color: 0x07232a, density: 0.02 },
    hemi: { sky: 0xc8fff2, ground: 0x24502c, intensity: 1.45 },
    sun:  { color: 0xfff4d6, intensity: 2.3 },
    wall: { color: 0x8da27e, moss: 0x7ed348, glow: 0x5dffd9, glowIntensity: 1.0 },
    floor: { path: 0x4a5c80, stone: 0x1b2230, carve: 0xffd27a, pathEdge: 0x6d82ad },
    dot: 0xffcf4d,
    ground: 0x174a20,
    torch: { color: 0xffa040, intensity: 14, distance: 11 },
    firefly: 0xe2ff9a,
    pacman: { body: 0xffd23a, flower: 0xfff7e8 },
    leaves: { a: 0x4fc04a, b: 0x2a8a4c, c: 0x8fe070 },
    flowers: [0xff3b6b, 0xff2fa8, 0xff8c1a, 0xffe14d],
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
    speeds: { pacman: 7.6, pacmanEating: 7.2, ghost: 5.9, frightened: 3.8, tunnel: 3.4, eyes: 15 },
    frightenedTime: 10,         // secondes d'invincibilité (Mana)
    scatterChase: [10, 18, 9, 18, 7, 18, 5, Infinity],
    ghostRelease: { pinky: 8, inky: 45, clyde: 90 }, // nb de pointillés mangés avant sortie
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
