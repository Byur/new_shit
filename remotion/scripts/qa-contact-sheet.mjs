#!/usr/bin/env node
/**
 * Contact sheets of the sampled QA frames.
 *
 * The frame QA can prove a frame is not empty and not clipped; it cannot show a
 * human whether the film looks right. These sheets are the hand-off for that
 * judgement: one row per act, downscaled, with the frame numbers burned in as a
 * caption strip so a defect can be traced back to a frame.
 *
 * The act list and the report label are per-project, so both are arguments:
 * the frame reports are named `<label>-report.json` by `qa-frames.mjs`.
 *
 * Usage: node scripts/qa-contact-sheet.mjs --timing=src/<p>/narration.timing.json \
 *          --report=<label> --scenes=a,b,c --out=output/<dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodePng, encodePng} from './lib/png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..');
const QA = path.join(PKG, 'out/qa');

const flag = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const TIMING = path.resolve(PKG, flag('timing', 'src/market-slang/narration.timing.json'));
const LABEL = flag('report', 'coal');
const OUT = path.resolve(PKG, flag('out', 'output/contact-sheet'));
fs.mkdirSync(OUT, {recursive: true});

const SLOTS = 8; // frames per act
const THUMB_W = 460;
const THUMB_H = 259; // 16:9
const LABEL_H = 26;
const GAP = 12;

/* one representative row of frames per act, in act order */
const SCENES = flag('scenes', 'hook,rule,bridge,evap,comp,cond,ledger,coda').split(',');

const pickFrames = () => {
  const report = JSON.parse(fs.readFileSync(path.join(QA, `${LABEL}-report.json`), 'utf8'));
  const timing = JSON.parse(fs.readFileSync(TIMING, 'utf8'));
  const rows = [];
  for (const id of SCENES) {
    const s = timing.scenes.find((x) => x.id === id);
    const inScene = report.frames
      .map((f) => f.frame)
      .filter((f) => f >= s.startFrame && f <= s.endFrame);
    const step = Math.max(1, Math.floor(inScene.length / SLOTS));
    const chosen = [];
    for (let i = 0; i < SLOTS && i * step < inScene.length; i++) chosen.push(inScene[i * step]);
    rows.push({id, title: s.title, frames: chosen});
  }
  return rows;
};

const blank = (w, h) => Buffer.alloc(w * h * 3);

const drawThumb = (sheet, sw, sh, img, x0, y0, tw, th) => {
  const sx = img.width / tw;
  const sy = img.height / th;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const si = (Math.floor(y * sy) * img.width + Math.floor(x * sx)) * img.channels;
      const di = ((y0 + y) * sw + x0 + x) * 3;
      sheet[di] = img.data[si];
      sheet[di + 1] = img.data[si + 1];
      sheet[di + 2] = img.data[si + 2];
    }
  }
};

/* 3x5 pixel font is overkill; a thin frame marker is enough to find the frame
   number in the report, so the label is drawn as a solid bar with tick marks. */
const drawTicks = (sheet, sw, x0, y0, w, h, frame) => {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const di = (y * sw + x) * 3;
      sheet[di] = 0x1b;
      sheet[di + 1] = 0x22;
      sheet[di + 2] = 0x2c;
    }
  }
  const n = frame % 1000;
  for (let i = 0; i < 10; i++) {
    if ((n >> (9 - i)) & 1) {
      for (let y = y0 + 6; y < y0 + h - 6; y++) {
        for (let x = x0 + 8 + i * 10; x < x0 + 8 + i * 10 + 6; x++) {
          const di = (y * sw + x) * 3;
          sheet[di] = 0x6f;
          sheet[di + 1] = 0xd3;
          sheet[di + 2] = 0xc6;
        }
      }
    }
  }
};

const rows = pickFrames();
const sw = SLOTS * (THUMB_W + GAP) + GAP;
const rowH = THUMB_H + LABEL_H + GAP;
const sh = rows.length * rowH + GAP;
const sheet = blank(sw, sh);

rows.forEach((row, r) => {
  const y0 = GAP + r * rowH;
  row.frames.forEach((frame, c) => {
    const file = path.join(QA, `${LABEL}-${String(frame).padStart(6, '0')}.png`);
    if (!fs.existsSync(file)) return;
    const img = decodePng(file);
    const x0 = GAP + c * (THUMB_W + GAP);
    drawThumb(sheet, sw, sh, img, x0, y0, THUMB_W, THUMB_H);
    drawTicks(sheet, sw, x0, y0 + THUMB_H, THUMB_W, LABEL_H, frame);
  });
});

const out = path.join(OUT, 'contact-sheet.png');
fs.writeFileSync(out, encodePng(sw, sh, sheet));
console.log(
  `${rows.length} rows x ${SLOTS} frames -> ${out} (${sw}x${sh}), ` +
    `rows: ${rows.map((r) => `${r.id}(${r.frames.length})`).join(', ')}`,
);
