// ---------------------------------------------------------------------------
//  MOTION : charte de mouvement (d'après la grammaire HyperFrames : arrivées longues en sortie
//  d'ease, départs courts et accélérés, ressorts nommés par amortissement, chevauchements).
//  GSAP est chargé en global (vendor/gsap.min.js).
// ---------------------------------------------------------------------------
export const gsap = window.gsap;
gsap.ticker.lagSmoothing(0);

export const M = {
  arrive: 'expo.out',         // une arrivée se pose sur une longue traîne
  move: 'power2.inOut',       // un déplacement de caméra ou un fondu de couleur
  leave: 'power3.in',         // une sortie accélère
  spring: 'back.out(1.4)',    // ressort « premium » (amortissement ~0.75)
  springSoft: 'back.out(1.1)',
  tArrive: 0.55, tLeave: 0.28, tMove: 0.45,
};

/** Entrée d'un panneau : léger zoom + flou qui se résorbe, sur une longue traîne */
export function panelIn(el) {
  if (!el) return;
  gsap.killTweensOf(el);
  gsap.fromTo(el, { opacity: 0, scale: 0.92, filter: 'blur(8px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: M.tArrive, ease: M.arrive, clearProps: 'filter' });
  // les enfants arrivent en cascade (40–80 ms), chevauchés avec le panneau
  const kids = el.querySelectorAll(':scope > *');
  gsap.fromTo(kids, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: M.arrive, stagger: 0.055, delay: 0.08 });
}
/** Sortie d'un panneau : une seule accélération, 40–50 % plus courte que l'entrée */
export function panelOut(el, done) {
  if (!el) { if (done) done(); return; }
  gsap.killTweensOf(el);
  gsap.to(el, { opacity: 0, scale: 0.96, filter: 'blur(6px)', duration: M.tLeave, ease: M.leave, onComplete: () => { gsap.set(el, { clearProps: 'all' }); if (done) done(); } });
}
/** Titre : mot par mot, flou → net, sans translation (0.13 s par mot, 67 ms d'écart) */
export function wordsIn(el) {
  if (!el || el.dataset.split) return;
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
  el.dataset.split = '1';
  gsap.fromTo(el.querySelectorAll('.w'), { opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.13, ease: 'power2.out', stagger: 0.067, delay: 0.15, clearProps: 'filter' });
}
/** Score qui « cogne » : 1 → 1.18 → 1, l'opacité ne rebondit jamais */
export function bump(el) {
  gsap.killTweensOf(el);
  gsap.fromTo(el, { scale: 1.18 }, { scale: 1, duration: 0.35, ease: 'power3.out' });
}
/** Ressort fermé : k(t) pour un amortissement ζ (0.7 = premium, 0.5 = joueur) */
export function spring(t, zeta = 0.7, w = 14) {
  if (t <= 0) return 0; if (t >= 1) return 1;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t));
}
