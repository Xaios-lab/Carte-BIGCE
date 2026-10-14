// Construit pacman-standalone.html : un seul fichier HTML5 avec tout embarqué
// (Three.js, code du jeu, logos, carte, illustration, musique) — s'ouvre en double-clic dans Chrome.
// Usage : node build-standalone.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const MIME = { '.png': 'image/png', '.webp': 'image/webp', '.m4a': 'audio/mp4', '.jpg': 'image/jpeg' };
const dataUri = (p) => `data:${MIME[path.extname(p)]};base64,${fs.readFileSync(path.join(root, p)).toString('base64')}`;

// --- assets -> data URIs
const assets = [];
const walk = (d) => fs.readdirSync(path.join(root, d)).forEach((f) => { const p = d + '/' + f; fs.statSync(path.join(root, p)).isDirectory() ? walk(p) : assets.push(p); });
walk('assets');
walk('sponsors/logos');
// gros fichiers déplacés en fin de document (le jeu démarre avant de les avoir reçus)
const DEFERRED = ['assets/audio/poursuite-foret.m4a', 'assets/splash.webp'];
const inlineAssets = (s, prefix = '') => assets.filter((a) => !DEFERRED.includes(a) && !a.startsWith('sponsors/logos/')).reduce((acc, a) => acc.split(prefix + a).join(dataUri(a)), s);

// --- Three.js : module ES -> objet THREE
let three = read('vendor/three.module.min.js');
const m = three.match(/export\{([^}]*)\};?\s*$/);
if (!m) throw new Error('export Three.js introuvable');
const pairs = m[1].split(',').map((e) => { const [a, b] = e.trim().split(/\s+as\s+/); return `${b || a}:${a}`; });
three = three.slice(0, m.index) + `return {${pairs.join(',')}};`;

// --- modules du jeu -> IIFE
const order = ['levels', 'maze', 'textures', 'world', 'actors', 'camera', 'input', 'audio', 'ui', 'game'];
const modName = (file) => '__mod_' + path.basename(file, '.js');
const convert = (name) => {
  let src = read(`js/${name}.js`);
  const exportsList = [];
  src = src.replace(/^import \* as (\w+) from '([^']+)';/gm, (_, alias, from) => from === 'three' ? (alias === 'THREE' ? '' : `const ${alias} = THREE;`) : `const ${alias} = ${modName(from)};`);
  src = src.replace(/^import \{([^}]+)\} from '([^']+)';/gm, (_, names, from) => `const {${names}} = ${modName(from)};`);
  src = src.replace(/^export (class|function|const|let) (\w+)/gm, (_, kind, id) => { exportsList.push(id); return `${kind} ${id}`; });
  return `const ${modName(name)} = (() => {\n${src}\nreturn { ${exportsList.join(', ')} };\n})();`;
};
let js = `const THREE = (() => {\n${three}\n})();\n` + order.map(convert).join('\n');
js += `\n(() => {\n${read('js/main.js').replace(/^import \{([^}]+)\} from '([^']+)';/gm, (_, n, f) => `const {${n}} = ${modName(f)};`)}\n})();`;
js = js.split('assets/audio/poursuite-foret.m4a').join('#music-data');
js = inlineAssets(js);

// --- CSS + HTML
const css = inlineAssets(read('css/style.css'), '../');
let html = read('index.html');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
html = html.replace(/<link rel="stylesheet" href="css\/style.css">/, `<style>\n${css}\n</style>`);
const sponsorsData = Object.fromEntries(assets.filter((a) => a.startsWith('sponsors/logos/')).map((a) => [path.basename(a), dataUri(a)]));
const tail = `<style>.screen .splash { background-image: url(${dataUri('assets/splash.webp')}); }</style>\n<script type="text/plain" id="sponsors-data">${JSON.stringify(sponsorsData)}</script>\n<script type="text/plain" id="music-data">${dataUri('assets/audio/poursuite-foret.m4a')}</script>`;
html = html.replace(/<script type="module" src="js\/main.js"><\/script>/, () => `<script>\n${js}\n</script>\n${tail}`);
html = inlineAssets(html);
html = html.replace('<title>Pac-Mana · BIG CE</title>', '<title>Pac-Mana · BIG CE (version autonome)</title>');
let out = path.join(root, 'pacman-standalone.html');
const artIdx = process.argv.indexOf('--artifact');
if (artIdx > 0) {
  // fragment pour un hébergement qui fournit déjà <html><head><body>
  out = process.argv[artIdx + 1];
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta[^>]*>\s*/g, '').replace(/<script[\s\S]*?<\/script>\s*/g, '');
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
  html = head.replace('<style>', '<style>\n:root { color-scheme: dark; }') + body;
}
fs.writeFileSync(out, html);
console.log('OK', out, (fs.statSync(out).size / 1e6).toFixed(2), 'Mo');
