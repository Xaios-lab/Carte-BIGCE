// ---------------------------------------------------------------------------
//  LEVELS, THEME & PARTNERS — Pipe Mana v2 (vallée tahitienne, tuyaux à pivoter)
//
//  Chaque niveau = un plan de tuyauterie dessiné en caractères de tracé, dans sa position RÉSOLUE.
//  Le jeu mélange ensuite l'orientation des tuyaux (graine fixe par niveau et par essai).
//
//  Légende :
//    T  château d'eau (source, l'eau sort vers le bas)      A B C D  enseignes (4 logos partenaires)
//    .  herbe (vide)        #  rocher
//    ─ │                     tuyaux droits
//    ┌ ┐ └ ┘                 coudes (les deux côtés ouverts : ┌ = Est+Sud, ┐ = Ouest+Sud, └ = Nord+Est, ┘ = Nord+Ouest)
//    ┬ ┴ ├ ┤                 tés (trois côtés ouverts)       ┼  croix (quatre côtés, ne pivote pas)
//  `gold` : case d'un tuyau doré « Carte BIG CE » (bonus quand l'eau le traverse).
// ---------------------------------------------------------------------------

export const PARTNERS = {
  plomberie: { id: 'plomberie', name: 'La Plomberie de Faa’a', logo: 'assets/enseignes/plomberie-faaa.jpg', color: '#1d6fd2', ratio: 1 },
  polyplast: { id: 'polyplast', name: 'Polyplast · La Plomberie de Fariipiti', short: 'Polyplast', logo: 'assets/enseignes/polyplast.jpg', color: '#0f6fc2', ratio: 836 / 530 },
  plastibois: { id: 'plastibois', name: 'PlastiBois Taravao', short: 'PlastiBois', logo: 'assets/enseignes/plastibois.png', color: '#f28b1e', ratio: 322 / 210 },
  bigce: { id: 'bigce', name: 'BIG CE', logo: 'assets/bigce.png', color: '#f2c35b', ratio: 1 },
};

export const THEME = {
  id: 'vallee',
  name: 'Vallée tahitienne',
  sky: { zenith: 0x1f6fc9, horizon: 0xcfe9f6, sun: 0xfff1d0 },
  fog: { color: 0xc9e3ee, density: 0.011 },
  hemi: { sky: 0xdff2ff, ground: 0x6a8a3e, intensity: 1.2 },
  sun: { color: 0xffe9c4, intensity: 2.6, position: [-9, 16, 6] },
  grass: { a: 0x5fa83a, b: 0x8fcf48, c: 0x3f7f2a, dry: 0xb8c45a },
  dirt: { a: 0x8a6a45, b: 0xb08f5e },
  rock: 0x5b5a5c,
  river: { deep: 0x1c6a8a, shallow: 0x58c6d8, foam: 0xeafcff },
  pipe: { body: 0x2a72d9, glass: 0x3d8ff0, steel: 0xb9c2cc, brass: 0xd4a349, water: 0x14c4f5, waterGlow: 0xa6f0ff, gold: 0xe7c25a },
  concrete: 0xbfb9ad,
  palm: { trunk: 0x8b6a45, leaf: 0x3c9b3d, leaf2: 0x7fcf62 },
  flowers: [0xff3b6b, 0xff2fa8, 0xff8c1a, 0xffe14d, 0xffffff],
};

export const LEVELS = [
  {
    id: 1,
    name: 'Niveau 1',
    subtitle: 'La vallée de Faa’a',
    prize: '10 000 F de chèques cadeaux à gagner',
    signs: { A: 'plomberie', B: 'polyplast', C: 'plastibois', D: 'bigce' },
    countdown: 22,      // secondes avant que l'eau ne jaillisse
    retryCountdown: 10, // après une fuite
    cellsPerSec: 0.5,   // vitesse de l'eau
    seed: 11,
    gold: [[3, 5]],
    grid: [
      '...T...',
      '..┌┴┐..',
      '..│.│..',
      'A─┤.├─B',
      '..│#│..',
      '..├─┤..',
      '..│.│..',
      'C─┘.└─D',
      '.......',
    ],
  },
  {
    id: 2,
    name: 'Niveau 2',
    subtitle: 'Les hauteurs de Punaauia',
    prize: '10 000 F de chèques cadeaux à gagner',
    signs: { A: 'polyplast', B: 'plomberie', C: 'bigce', D: 'plastibois' },
    countdown: 20,
    retryCountdown: 10,
    cellsPerSec: 0.55,
    seed: 23,
    gold: [[3, 4]],
    grid: [
      '...T...',
      '.┌─┤.#.',
      '.│.└─┐.',
      'A┘#..│.',
      '..┌─┬┘.',
      '..│.└─B',
      '.┌┤.#..',
      'C┘│┌─┐.',
      '..└┘.└D',
      '...─...',
    ],
  },
  {
    id: 3,
    name: 'Niveau 3',
    subtitle: 'La cascade de Papenoo',
    prize: '10 000 F de chèques cadeaux à gagner',
    signs: { A: 'plastibois', B: 'bigce', C: 'plomberie', D: 'polyplast' },
    countdown: 18,
    retryCountdown: 9,
    cellsPerSec: 0.65,
    seed: 37,
    gold: [[4, 5]],
    grid: [
      '....T....',
      '..┌─┴─┐..',
      '..│.#.│..',
      'A─┤.─.├─B',
      '..└┐.┌┘..',
      '.#.├─┤.#.',
      '..┌┘│└┐..',
      '..│.┼.│..',
      'C─┘...└─D',
      '.........',
    ],
  },
];
