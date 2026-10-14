// Génère la page des partenaires sponsors : sponsors/index.html (logos dans sponsors/logos/)
// et sponsors/sponsors-standalone.html (tout embarqué). Usage : node build-sponsors.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(root, 'sponsors');
const logos = JSON.parse(fs.readFileSync(path.join(dir, 'logos.json'), 'utf8'));
const dataUri = (p, mime) => `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
const bigce = dataUri(path.join(root, 'assets', 'bigce.png'), 'image/png');
const GAME_URL = 'https://www.guide2026.big-ce.com/PacMana/';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const page = (src) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#07232a">
  <title>Partenaires sponsors · Pac-Mana BIG CE</title>
  <meta name="description" content="Les partenaires sponsors du Pac-Mana BIG CE et de la Carte BIG CE 2026.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Piedra&family=Nunito:wght@600;800&display=swap" rel="stylesheet">
  <link rel="icon" href="${bigce}">
  <style>
    :root { --bg: #07232a; --bg2: #0d3b2e; --cream: #ffe6a3; --gold: #f2c35b; --gold-2: #ffdf8a; --teal: #7af5d8; --sat: env(safe-area-inset-top, 0px); --sab: env(safe-area-inset-bottom, 0px); color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body { margin: 0; }
    body { min-height: 100%; font-family: 'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif; color: #fff;
      background: radial-gradient(1200px 600px at 50% -200px, #1a6a4a 0%, var(--bg2) 40%, var(--bg) 100%) fixed; padding: calc(18px + var(--sat)) 16px calc(28px + var(--sab)); }
    .wrap { max-width: 1180px; margin: 0 auto; }
    header { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px 0 22px; }
    header img { width: 92px; height: 92px; filter: drop-shadow(0 8px 18px rgba(0, 0, 0, .6)); animation: float 4s ease-in-out infinite; }
    .brand { font-size: 12px; letter-spacing: .3em; text-transform: uppercase; color: var(--teal); font-weight: 800; }
    h1 { font-family: 'Piedra', Impact, 'Arial Black', sans-serif; font-size: clamp(34px, 8vw, 64px); margin: 0; line-height: 1.05; color: var(--cream); text-shadow: 0 0 28px rgba(255, 210, 90, .7), 0 4px 0 #3a2300, 0 10px 30px rgba(0, 0, 0, .7); letter-spacing: .04em; text-wrap: balance; }
    .sub { margin: 0; max-width: 60ch; font-size: 15px; line-height: 1.5; color: rgba(255, 255, 255, .8); }
    .count { display: inline-block; margin-top: 4px; padding: 6px 16px; border-radius: 999px; font-family: 'Piedra', Impact, sans-serif; letter-spacing: .06em; color: #2a1a00; background: linear-gradient(180deg, #ffe08a, #e9a93a); box-shadow: 0 0 18px rgba(255, 210, 90, .45); }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    @media (min-width: 600px) { .grid { grid-template-columns: repeat(3, 1fr); gap: 16px; } }
    @media (min-width: 900px) { .grid { grid-template-columns: repeat(4, 1fr); } }
    @media (min-width: 1180px) { .grid { grid-template-columns: repeat(5, 1fr); gap: 18px; } }
    .card { position: relative; aspect-ratio: 2 / 1; border-radius: 16px; background: #fff; overflow: hidden;
      border: 3px solid var(--gold); box-shadow: 0 10px 24px rgba(0, 0, 0, .45), inset 0 0 0 1px rgba(255, 255, 255, .6);
      animation: pop .6s cubic-bezier(.2, 1.4, .4, 1) both; transition: transform .2s, box-shadow .2s; }
    .card:hover, .card:focus-within { transform: translateY(-4px) scale(1.03); box-shadow: 0 18px 34px rgba(0, 0, 0, .55), 0 0 22px rgba(255, 220, 120, .45); }
    .card img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
    ${logos.map((_, i) => `.card:nth-child(${i + 1}) { animation-delay: ${(i * 0.03).toFixed(2)}s; }`).join('\n    ')}
    footer { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 14px; padding: 30px 0 10px; }
    .btn { display: inline-block; border-radius: 999px; padding: 14px 36px; font-family: 'Piedra', Impact, sans-serif; font-size: 22px; letter-spacing: .08em; color: #2a1a00; text-decoration: none; background: linear-gradient(180deg, #ffe08a, #e9a93a); box-shadow: 0 6px 0 #8d5a12, 0 12px 26px rgba(0, 0, 0, .5); transition: transform .08s, box-shadow .08s; }
    .btn:active { transform: translateY(4px); box-shadow: 0 2px 0 #8d5a12, 0 6px 14px rgba(0, 0, 0, .5); }
    .note { width: 100%; text-align: center; font-size: 12px; color: rgba(255, 255, 255, .55); margin: 6px 0 0; }
    @keyframes float { 50% { transform: translateY(-6px) rotate(3deg); } }
    @keyframes pop { 0% { opacity: 0; transform: scale(.85) translateY(10px); } 100% { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .card, header img { animation: none; } }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <img src="${bigce}" alt="BIG CE">
      <div class="brand">Pac-Mana · BIG CE</div>
      <h1>Nos partenaires sponsors</h1>
      <p class="sub">Merci aux partenaires qui soutiennent le Pac-Mana et la Carte BIG CE 2026. Grâce à eux, 10 000 F de chèques cadeaux sont à gagner !</p>
      <span class="count">${logos.length} partenaires</span>
    </header>
    <main class="grid" aria-label="Logos des partenaires">
      ${logos.map((l) => `<figure class="card" tabindex="0"><img src="${src(l)}" alt="${esc(l.name)}" loading="lazy" width="300" height="150"></figure>`).join('\n      ')}
    </main>
    <footer>
      <a class="btn" id="back" href="${GAME_URL}">← Retour au jeu</a>
      <p class="note">BIG CE · Carte partenaires 2026</p>
    </footer>
  </div>
  <script>
    // Dans la lightbox du jeu : on demande au jeu de fermer la fenêtre (la partie reprend où elle en était).
    // Ouverte seule : on retourne à l'adresse du jeu.
    document.getElementById('back').addEventListener('click', (e) => {
      if (window.parent && window.parent !== window) {
        e.preventDefault();
        window.parent.postMessage({ type: 'pacmana:close' }, '*');
        document.getElementById('back').textContent = '✕ Fermer';
      }
    });
    if (window.parent && window.parent !== window) document.getElementById('back').textContent = '✕ Fermer la fenêtre';
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(dir, 'index.html'), page((l) => 'logos/' + l.file));
fs.writeFileSync(path.join(dir, 'sponsors-standalone.html'), page((l) => dataUri(path.join(dir, 'logos', l.file), 'image/webp')));
for (const f of ['index.html', 'sponsors-standalone.html']) console.log('OK', f, (fs.statSync(path.join(dir, f)).size / 1e3).toFixed(0), 'Ko');
