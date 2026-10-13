import { Game } from './game.js';

const canvas = document.getElementById('gl');
const game = new Game(canvas);
window.__game = game; // debug / tests
game.load().catch((err) => {
  console.error(err);
  const m = document.getElementById('msg');
  m.className = 'msg on';
  m.textContent = 'Erreur de chargement : ' + err.message;
});
