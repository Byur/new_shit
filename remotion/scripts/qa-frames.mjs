#!/usr/bin/env node
/**
 * Frame-level QA harness.
 *
 * Bundles the project once, renders a batch of stills, and measures each one:
 *   - how much of the frame carries ink (catches empty / blank frames),
 *   - whether anything lands inside the safe margin (catches clipping),
 *   - ink coverage of named regions that must be populated or must stay clear,
 *   - luminance delta against a neighbouring frame (catches flashes and
 *     all-subject-disappears scene boundaries).
 *
 * Usage:
 *   node scripts/qa-frames.mjs 120 320 900 ...
 *   node scripts/qa-frames.mjs --plan scripts/qa-plan.json
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {ensureBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {analyze, decodePng, frameDelta, regionInk} from './lib/png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..');
const ENTRY = path.join(PKG, 'src/index.ts');
const OUT_DIR = path.join(PKG, 'out/qa');

const args = process.argv.slice(2);
let frames = [];
let planPath = null;
let label = 'qa';
let deltas = true;
let compositionId = 'MarketSlangDecoded';
/* A WebGL composition cannot be captured without being told to use a GPU backend;
   the SVG compositions never needed this, so it is opt-in. */
let gl = null;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--plan') planPath = args[++i];
  else if (a === '--label') label = args[++i];
  else if (a === '--no-delta') deltas = false;
  else if (a === '--id') compositionId = args[++i];
  else if (a === '--gl') gl = args[++i];
  else if (/^\d+$/.test(a)) frames.push(Number(a));
  else if (/^\d+-\d+$/.test(a)) {
    const [from, to] = a.split('-').map(Number);
    for (let f = from; f <= to; f++) frames.push(f);
  } else if (/^\d+-\d+:\d+$/.test(a)) {
    const [range, step] = a.split(':');
    const [from, to] = range.split('-').map(Number);
    for (let f = from; f <= to; f += Number(step)) frames.push(f);
  }
}

let regions = [];
let safeBox = null;
if (planPath) {
  const plan = JSON.parse(fs.readFileSync(path.resolve(planPath), 'utf8'));
  frames = plan.frames ?? frames;
  regions = plan.regions ?? [];
  safeBox = plan.safe ?? null;
  label = plan.label ?? label;
  compositionId = plan.id ?? compositionId;
  gl = plan.gl ?? gl;
}

if (frames.length === 0) {
  console.error('no frames given');
  process.exit(1);
}

frames = [...new Set(frames)].sort((a, b) => a - b);
fs.mkdirSync(OUT_DIR, {recursive: true});

await ensureBrowser();
const serveUrl = await bundle({entryPoint: ENTRY, onProgress: () => {}});
const composition = await selectComposition({serveUrl, id: compositionId});

const rendered = [];
for (const frame of frames) {
  const out = path.join(OUT_DIR, `${label}-${String(frame).padStart(6, '0')}.png`);
  await renderStill({
    composition,
    serveUrl,
    output: out,
    frame,
    overwrite: true,
    ...(gl ? {chromiumOptions: {gl}} : {}),
    ...(gl ? {timeoutInMilliseconds: 180000} : {}),
  });
  rendered.push({frame, file: out});
}

const rows = [];
for (const item of rendered) {
  const img = decodePng(item.file);
  const a = analyze(img);
  const row = {
    frame: item.frame,
    meanLuma: Number(a.meanLuma.toFixed(2)),
    inkRatio: Number((a.inkRatio * 100).toFixed(2)),
    edgeInk: a.edgeInk,
    inkBox: a.inkBox,
    regions: {},
  };
  if (safeBox) {
    /*
     * Ink that lands outside the composition's own content grid. This is the
     * assertion that catches an element escaping its layout box, which a plain
     * edge-of-frame check misses whenever the grid margin is wider than 24px.
     */
    let n = 0;
    let bx0 = Infinity;
    let by0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        if (x >= safeBox.x0 && x <= safeBox.x1 && y >= safeBox.y0 && y <= safeBox.y1) continue;
        const i = (y * img.width + x) * img.channels;
        const l =
          0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
        if (l <= (safeBox.threshold ?? 34)) continue;
        n++;
        if (x < bx0) bx0 = x;
        if (y < by0) by0 = y;
        if (x > bx1) bx1 = x;
        if (y > by1) by1 = y;
      }
    }
    row.safeInk = n;
    row.safeBox = n > 0 ? {x0: bx0, y0: by0, x1: bx1, y1: by1} : null;
  }
  for (const r of regions) {
    row.regions[r.name] = Number(
      regionInk(img, {x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1}, r.threshold).ratio.toFixed(4),
    );
  }
  rows.push(row);
  rendered[rendered.indexOf(item)].img = img;
}

const deltaRows = [];
if (deltas) {
  for (let i = 1; i < rendered.length; i++) {
    deltaRows.push({
      from: rendered[i - 1].frame,
      to: rendered[i].frame,
      delta: Number(frameDelta(rendered[i - 1].img, rendered[i].img).toFixed(3)),
    });
  }
}

const report = {
  label,
  composition: composition.id,
  generatedAt: new Date().toISOString(),
  frames: rows,
  deltas: deltaRows,
};

const reportPath = path.join(OUT_DIR, `${label}-report.json`);
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

const pad = (s, n) => String(s).padStart(n);
console.log(`frame   meanLuma  ink%   edgeInk  safeInk  inkBox`);
for (const r of rows) {
  const box = r.inkBox ? `${r.inkBox.x0},${r.inkBox.y0} - ${r.inkBox.x1},${r.inkBox.y1}` : 'EMPTY';
  const sv =
    r.safeInk === undefined
      ? '-'
      : r.safeInk > 0
        ? `${r.safeInk}@${r.safeBox.x0},${r.safeBox.y0}-${r.safeBox.x1},${r.safeBox.y1}`
        : '0';
  console.log(
    `${pad(r.frame, 6)}  ${pad(r.meanLuma, 8)}  ${pad(r.inkRatio, 5)}  ${pad(r.edgeInk, 7)}  ${pad(sv, 24)}  ${box}`,
  );
  for (const [name, ratio] of Object.entries(r.regions)) {
    console.log(`         region ${name}: ${(ratio * 100).toFixed(2)}%`);
  }
}
if (safeBox) {
  const bad = rows.filter((r) => (r.safeInk ?? 0) > 0);
  console.log(
    `\nsafe-box violations (${bad.length}/${rows.length}): ` +
      (bad.length ? bad.map((r) => `${r.frame}:${r.safeInk}`).join(', ') : 'none'),
  );
}
if (deltas) {
  console.log('\nneighbour deltas (mean abs luma):');
  for (const d of deltaRows) console.log(`  ${pad(d.from, 6)} -> ${pad(d.to, 6)}  ${d.delta}`);
}
console.log(`\nreport: ${reportPath}`);
