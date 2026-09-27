// Renders assets/top-langs.svg from the GitHub API so the README does not
// depend on a third-party stats deployment. Run by .github/workflows/top-langs.yml.
import { mkdir, writeFile } from 'node:fs/promises';

const USER = process.env.GH_USER || 'pranavdhawann';
const HIDE = new Set(['HTML']);
const MAX_LANGS = 6;
const OUT = new URL('../assets/top-langs.svg', import.meta.url);

// GitHub linguist colours for the languages likely to appear; others fall back.
const COLORS = {
  Python: '#3572A5', 'Jupyter Notebook': '#DA5B0B', JavaScript: '#f1e05a',
  TypeScript: '#3178c6', CSS: '#663399', R: '#198CE7', Shell: '#89e051',
  Java: '#b07219', 'C++': '#f34b7d', C: '#555555', Go: '#00ADD8', Rust: '#dea584',
  SQL: '#e38c00', PowerShell: '#012456', Dockerfile: '#384d54', TeX: '#3D6117',
};

async function gh(path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': USER };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

const repos = (await gh(`/users/${USER}/repos?per_page=100&type=owner`))
  .filter((r) => !r.fork && !r.archived);

const totals = {};
for (const repo of repos) {
  for (const [lang, bytes] of Object.entries(await gh(`/repos/${USER}/${repo.name}/languages`))) {
    if (!HIDE.has(lang)) totals[lang] = (totals[lang] || 0) + bytes;
  }
}

const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, MAX_LANGS);
const sum = sorted.reduce((n, [, b]) => n + b, 0);
if (!sum) throw new Error('No language data returned; refusing to overwrite the card.');

const langs = sorted.map(([name, bytes]) => ({
  name, pct: (bytes / sum) * 100, color: COLORS[name] || '#858585',
}));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const W = 300, BAR_W = 250;
let x = 0;
const bar = langs.map((l) => {
  const w = (l.pct / 100) * BAR_W;
  const rect = `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="8" fill="${l.color}"/>`;
  x += w;
  return rect;
}).join('');
const legend = langs.map((l, i) => {
  const lx = (i % 2) * 150, ly = Math.floor(i / 2) * 25;
  return `<g transform="translate(${lx},${ly})"><circle cx="5" cy="6" r="5" fill="${l.color}"/>`
    + `<text x="15" y="10" class="lang">${esc(l.name)} ${l.pct.toFixed(2)}%</text></g>`;
}).join('');
const H = 115 + Math.ceil(langs.length / 2) * 25 - 25;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
<title id="t">Most used languages</title>
<style>.title{font:600 18px 'Segoe UI',Ubuntu,Sans-Serif;fill:#fff}.lang{font:400 11px 'Segoe UI',Ubuntu,Sans-Serif;fill:#9f9f9f}</style>
<rect x="0.5" y="0.5" rx="10" width="${W - 1}" height="${H - 1}" fill="#151515" stroke="#e4e2e2"/>
<text x="25" y="35" class="title">Most Used Languages</text>
<mask id="m"><rect x="0" y="0" width="${BAR_W}" height="8" rx="5" fill="#fff"/></mask>
<g mask="url(#m)" transform="translate(25,55)">${bar}</g>
<g transform="translate(25,80)">${legend}</g>
</svg>
`;

await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, svg);
console.log(langs.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(', '));
