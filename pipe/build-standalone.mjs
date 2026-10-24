// Construit pipemana-standalone.html : un seul fichier HTML5 avec tout embarqué
// (Three.js, GSAP, code du jeu, logos, carte) — s'ouvre en double-clic dans Chrome / Safari / Firefox.
// Usage : node build-standalone.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const MIME = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const dataUri = (p) => `data:${MIME[path.extname(p)]};base64,${fs.readFileSync(path.join(root, p)).toString('base64')}`;

// --- assets -> data URIs
const assets = [];
const walk = (d) => fs.readdirSync(path.join(root, d)).forEach((f) => { const p = d + '/' + f; fs.statSync(path.join(root, p)).isDirectory() ? walk(p) : assets.push(p); });
walk('assets');
const inlineAssets = (s, prefix = '') => assets.reduce((acc, a) => acc.split(prefix + a).join(dataUri(a)), s);

// --- Three.js : module ES -> objet THREE
let three = read('vendor/three.module.min.js');
const m = three.match(/export\{([^}]*)\};?\s*$/);
if (!m) throw new Error('export Three.js introuvable');
const pairs = m[1].split(',').map((e) => { const [a, b] = e.trim().split(/\s+as\s+/); return `${b || a}:${a}`; });
three = three.slice(0, m.index) + `return {${pairs.join(',')}};`;

// --- modules du jeu -> IIFE (dans l'ordre des dépendances)
const order = ['levels', 'network', 'grid3d', 'textures', 'motion', 'camera', 'terrain', 'world', 'input', 'audio', 'ui', 'game'];
const modName = (file) => '__mod_' + path.basename(file, '.js');
const convert = (name) => {
  let src = read(`js/${name}.js`);
  const exportsList = [];
  src = src.replace(/^import \* as (\w+) from '([^']+)';/gm, (_, alias, from) => from === 'three' ? (alias === 'THREE' ? '' : `const ${alias} = THREE;`) : `const ${alias} = ${modName(from)};`);
  src = src.replace(/^import \{([^}]+)\} from '([^']+)';/gm, (_, names, from) => `const {${names}} = ${modName(from)};`);
  src = src.replace(/^export (async function|class|function|const|let) (\w+)/gm, (_, kind, id) => { exportsList.push(id); return `${kind} ${id}`; });
  return `const ${modName(name)} = (() => {\n${src}\nreturn { ${exportsList.join(', ')} };\n})();`;
};
let js = `const THREE = (() => {\n${three}\n})();\n` + order.map(convert).join('\n');
js += `\n(() => {\n${read('js/main.js').replace(/^import \{([^}]+)\} from '([^']+)';/gm, (_, n, f) => `const {${n}} = ${modName(f)};`)}\n})();`;
js = inlineAssets(js);

// --- CSS + HTML
const css = inlineAssets(read('css/style.css'), '../');
let html = read('index.html');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
html = html.replace(/<script src="vendor\/gsap.min.js"><\/script>\s*/, () => `<script>\n${read('vendor/gsap.min.js')}\n</script>\n`);
html = html.replace(/<link rel="stylesheet" href="css\/style.css">/, `<style>\n${css}\n</style>`);
html = html.replace(/<script type="module" src="js\/main.js"><\/script>/, () => `<script>\n${js}\n</script>`);
html = inlineAssets(html);
html = html.replace('<title>Pipe Mana · BIG CE</title>', '<title>Pipe Mana · BIG CE (version autonome)</title>');
const out = path.join(root, 'pipemana-standalone.html');
fs.writeFileSync(out, html);
console.log(`OK → ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} Mo)`);
