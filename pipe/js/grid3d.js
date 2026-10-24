// ---------------------------------------------------------------------------
//  GRID 3D : le réseau de tuyaux repose sur un plan légèrement incliné (la pente de la vallée).
//  Repère local d'une case : x vers l'Est, z vers le Sud (bas de l'écran), y normal au plan.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export const SLOPE = 0.16;                 // montée (en unités) par case vers le haut de l'écran
export const TILT = Math.atan(SLOPE);      // inclinaison du plan autour de l'axe X
export const COS = Math.cos(TILT), SIN = Math.sin(TILT);
export const PIPE_Y = 0.3;                 // hauteur de l'axe des tuyaux au-dessus du plan

/** Coordonnée de pente `s` (lignes) et colonne `x` d'une case */
export function cellLocal(net, c, r) { return { x: c - (net.w - 1) / 2, s: r - (net.h - 1) / 2 }; }
/** Point monde d'un point du plan (x, s) à la hauteur y au-dessus du plan */
export function planeToWorld(x, s, y = 0) { return new THREE.Vector3(x, -s * SIN + y * COS, s * COS + y * SIN); }
export function cellToWorld(net, c, r, y = PIPE_Y) { const l = cellLocal(net, c, r); return planeToWorld(l.x, l.s, y); }
/** Hauteur du sol du plan en un point monde (x, z) — utilisée par le terrain sous le réseau */
export function groundY(z) { return -z * SLOPE; }
/** Plan des tuyaux (pour le picking) */
export function pipePlane() {
  const n = new THREE.Vector3(0, COS, SIN);
  return new THREE.Plane().setFromNormalAndCoplanarPoint(n, planeToWorld(0, 0, PIPE_Y));
}
/** Case visée par un point monde situé sur le plan des tuyaux */
export function worldToCell(net, p) {
  const s = (p.z - PIPE_Y * SIN) / COS;
  const c = Math.round(p.x + (net.w - 1) / 2), r = Math.round(s + (net.h - 1) / 2);
  return net.cellAt(c, r);
}
