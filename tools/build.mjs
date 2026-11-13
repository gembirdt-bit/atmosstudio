// Pravi minifikovanu verziju sajta u folderu dist/ (za GitHub Pages).
// Izvorni fajlovi u repozitorijumu ostaju čitljivi; menja se samo ono što se objavljuje.
// Pokretanje: npm i --no-save esbuild && node tools/build.mjs
import { transform } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';

const OUT = 'dist';
const COPY = ['manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable.png', 'privatnost.html', 'uslovi.html'];
const opts = loader => ({ loader, minify: true, target: loader === 'js' ? 'es2020' : 'chrome90', charset: 'utf8', legalComments: 'none' });

async function minJs(code) { return (await transform(code, opts('js'))).code.trim(); }
async function minCss(code) { return (await transform(code, opts('css'))).code.trim(); }

async function replaceAsync(str, re, fn) {
  const parts = []; let last = 0;
  for (const m of str.matchAll(re)) { parts.push(str.slice(last, m.index), await fn(...m)); last = m.index + m[0].length; }
  parts.push(str.slice(last));
  return parts.join('');
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const src = await readFile('index.html', 'utf8');
// Delimo HTML na <script> blokove i ostatak, pa se svaki deo obrađuje posebno
// (skripte sadrže tekst kao '<style>…</style>' koji ne sme da se dira).
const parts = src.split(/(<script>[\s\S]*?<\/script>)/g);
for (let i = 0; i < parts.length; i++) {
  if (i % 2) {
    // svaka skripta ide u zasebnu funkciju, pa esbuild može da skrati i sva interna imena
    const js = parts[i].slice(8, -9);
    parts[i] = '<script>' + await minJs('(function(){' + js + '\n})();') + '</script>';
  } else {
    let h = await replaceAsync(parts[i], /<style>([\s\S]*?)<\/style>/g, async (_, css) => '<style>' + await minCss(css) + '</style>');
    // HTML: bez komentara i uvlačenja (osim u <textarea>/<pre>)
    h = h.split(/(<(?:textarea|pre)\b[^>]*>[\s\S]*?<\/(?:textarea|pre)>)/g)
      .map((seg, j) => j % 2 ? seg : seg.replace(/<!--(?!\[)[\s\S]*?-->/g, '').replace(/^[ \t]+/gm, '').replace(/\n{2,}/g, '\n'))
      .join('');
    parts[i] = h;
  }
}
const html = parts.join('');
await writeFile(`${OUT}/index.html`, html);

await writeFile(`${OUT}/sw.js`, await minJs(await readFile('sw.js', 'utf8')));
for (const f of COPY) await copyFile(f, `${OUT}/${f}`);
await writeFile(`${OUT}/.nojekyll`, '');

const before = (await readFile('index.html')).length, after = Buffer.byteLength(html);
console.log(`index.html: ${before} → ${after} bajtova`);
