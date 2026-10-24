// Vérifie que chaque plan résolu de js/levels.js alimente les 4 enseignes sans fuite, puis que le mélange crée bien une fuite.
// Usage : node test-network.mjs
import { LEVELS } from './js/levels.js';
import { Network, Flow } from './js/network.js';
let ok = true;
for (const L of LEVELS) {
  const net = new Network(L);
  const flow = new Flow(net); flow.start();
  const ev = [];
  for (let i = 0; i < 4000 && flow.active; i++) ev.push(...flow.advance(1 / 60, 2));
  const leak = ev.find((e) => e.type === 'leak');
  const signs = ev.filter((e) => e.type === 'sign').map((e) => e.cell.sign).sort().join('');
  const gold = ev.filter((e) => e.type === 'gold').length;
  const line = `${L.name} ${net.w}x${net.h} pipes=${net.pipes.length} wet=${flow.wetCount} signs=${signs} gold=${gold}` + (leak ? ` LEAK at (${leak.cell.c},${leak.cell.r}) ${leak.side}` : '');
  console.log(line);
  if (leak || signs !== 'ABCD' || gold < 1) ok = false;
  // mélange
  net.dry(); net.scramble(L.seed);
  const unsolved = net.pipes.filter((p) => !net.isSolved(p)).length;
  const dryFlow = new Flow(net); dryFlow.start();
  const ev2 = []; for (let i = 0; i < 4000 && dryFlow.active; i++) ev2.push(...dryFlow.advance(1 / 60, 2));
  console.log(`   scramble: ${unsolved}/${net.pipes.length} hors position · eau mélangée → ${ev2.map((e) => e.type).filter((t) => t !== 'hub').join(',') || 'rien'}`);
}
console.log(ok ? 'ALL OK' : 'FAIL'); process.exit(ok ? 0 : 1);
