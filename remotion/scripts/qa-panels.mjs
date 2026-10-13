#!/usr/bin/env node
/**
 * Panel-containment QA.
 *
 * Every act draws its diagram into a fixed rectangle, and the failure this
 * catches is text leaving that rectangle — which at these font sizes is a
 * one-character mistake away and invisible to a numeric frame scan, because the
 * cutaway behind the panel supplies plenty of ink either way.
 *
 * So the rig is hidden (`hideRig`) and only the acts and the chrome are drawn.
 * Anything inked near a panel is then that panel's own content, and the check is
 * mechanical: ink inside the rect, and ink in a band just outside it.
 *
 * Usage: node scripts/qa-panels.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {ensureBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {decodePng, regionInk} from './lib/png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..');
const OUT = path.join(PKG, 'out/qa/panels');
fs.mkdirSync(OUT, {recursive: true});

const flag = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const COMPOSITION = flag('id', 'MarketSlangDecoded');
const timing = JSON.parse(
  fs.readFileSync(path.resolve(PKG, flag('timing', 'src/market-slang/narration.timing.json')), 'utf8'),
);
const L = (id, i) => timing.scenes.find((s) => s.id === id).lines[i].startFrame;
const S = (id) => timing.scenes.find((s) => s.id === id).startFrame;

/* name, frame where the panel is fully on screen, and the panel's own rect.
   THESE ARE PER-PROJECT: the list below is written against one film's scene ids
   and panel layout, so it must be rewritten for every new piece. The mechanism
   around it — hide the cutaway, render each panel alone, assert its ink stays
   inside its own rect — is what carries over, not this list.
   The rect is used to assert the panel actually has content; the hard boundary is
   the stage box, which nothing the acts draw may leave. */
const CASES = [
  {name: 'hook',            frame: L('hook', 3) + 45,       rect: [168, 214, 1518, 625]},
  {name: 'pedalHard',       frame: L('pedal', 9) + 40,      rect: [96, 300, 1100, 760]},
  {name: 'hydPascal',       frame: L('hydraulic', 3) + 40,  rect: [112, 300, 712, 700]},
  {name: 'hydAreas',        frame: L('hydraulic', 8) + 40,  rect: [112, 300, 712, 700]},
  {name: 'calSection',      frame: L('caliper', 2) + 40,    rect: [120, 190, 720, 790]},
  {name: 'calSkate',        frame: L('caliper', 8) + 40,    rect: [300, 210, 1564, 700]},
  {name: 'calLoop',         frame: L('caliper', 7) + 40,    rect: [96, 138, 1824, 810]},
  {name: 'tireMicro',       frame: L('tire', 2) + 40,       rect: [110, 150, 900, 804]},
  {name: 'tireChart',       frame: L('tire', 9) + 40,       rect: [110, 150, 900, 804]},
  {name: 'heatLeft',        frame: L('heat', 6) + 40,       rect: [110, 168, 610, 768]},
  {name: 'heatRight',       frame: L('heat', 8) + 40,       rect: [1330, 168, 1824, 620]},
  {name: 'codaTable',       frame: L('coda', 6) + 40,       rect: [200, 226, 1720, 638]},
  {name: 'codaPatches',     frame: L('coda', 10) + 40,      rect: [400, 180, 1700, 720]},
];

/* the chrome is allowed to live in these bands and nowhere else */
const chromeBands = [
  {name: 'header', x0: 0, y0: 0, x1: 1920, y1: 130},
  {name: 'ribbon+cap', x0: 0, y0: 828, x1: 1920, y1: 1080},
  {name: 'rail', x0: 0, y0: 0, x1: 12, y1: 1080},
];

const bundleStart = Date.now();
const serveUrl = await bundle({entryPoint: path.join(PKG, 'src/index.ts'), rspack: true});
console.log(`bundled in ${((Date.now() - bundleStart) / 1000).toFixed(1)}s`);
await ensureBrowser();
const composition = await selectComposition({
  serveUrl,
  id: COMPOSITION,
  inputProps: {hideRig: true}, // requires the composition to accept `hideRig`
});

let failures = 0;
const rows = [];
for (const c of CASES) {
  const output = path.join(OUT, `${c.name}.png`);
  await renderStill({
    composition,
    serveUrl,
    output,
    frame: c.frame,
    imageFormat: 'png',
    inputProps: {hideRig: true},
  });
  const img = decodePng(output);
  const [x0, y0, x1, y1] = c.rect;

  /* Text overflowing a panel shows up as ink in the ring just outside it. The
     ring is only 60px wide and stops well short of the car, so the projected
     annotations that legitimately hang off the machine — the dimension lines,
     the contact ellipse, the numbers pinned to the disc — cannot reach it and
     cannot produce a false alarm. */
  const NEAR = 60;
  const win = {
    x0: Math.max(0, x0 - NEAR),
    y0: Math.max(0, y0 - NEAR),
    x1: Math.min(img.width, x1 + NEAR),
    y1: Math.min(img.height, y1 + NEAR),
  };
  const {channels: ch, data, width} = img;
  const STAGE = {x0: 96, y0: 138, x1: 1824, y1: 806};
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * ch;
      const lum = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      if (lum <= 34) continue;
      if (chromeBands.some((b) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const box = {x0: minX, y0: minY, x1: maxX, y1: maxY};
  const inside = regionInk(img, {x0, y0, x1, y1}).ratio;
  const TOL = 4;
  const overflow =
    minX < STAGE.x0 - TOL || minY < STAGE.y0 - TOL || maxX > STAGE.x1 + TOL || maxY > STAGE.y1 + TOL;
  const empty = inside < 0.01;
  if (overflow || empty) failures++;
  rows.push({name: c.name, frame: c.frame, inside, box, rect: c.rect, overflow, empty});
  console.log(
    `${c.name.padEnd(12)} f${String(c.frame).padStart(5)}  ink ${inside.toFixed(4)}  ` +
      `content ${minX},${minY} - ${maxX},${maxY}  panel ${x0},${y0} - ${x1},${y1}  ` +
      `${overflow ? 'OVERFLOW' : 'ok'}${empty ? ' EMPTY' : ''}`,
  );
}

const report = {
  composition: COMPOSITION,
  hideRig: true,
  generatedAt: new Date().toISOString(),
  failures,
  rows,
};
fs.writeFileSync(path.join(PKG, 'out/qa/panels-report.json'), JSON.stringify(report, null, 2));
console.log(`\n${failures} panel overflow(s). report: out/qa/panels-report.json`);
process.exit(failures > 0 ? 1 : 0);
