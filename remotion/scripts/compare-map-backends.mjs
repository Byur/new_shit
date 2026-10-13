#!/usr/bin/env node
/**
 * Map backend comparison.
 *
 * Renders the same frames through both map backends — the baked SVG plate
 * (`CoffeeExplained`) and the MapLibre tile map (`CoffeeExplainedGL`) — crops
 * each to the map rectangle, and stacks them into one image per frame so the
 * difference is visible without flipping between files.
 *
 * The crop is the LAYOUT.map rectangle, so the composites are directly
 * comparable: same geography, same camera, same frame, different renderer.
 *
 * Usage:
 *   node scripts/compare-map-backends.mjs 900 6300 7300
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {ensureBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {decodePng, encodePng, toRgb} from './lib/png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..');
const ENTRY = path.join(PKG, 'src/index.ts');
const TMP = path.join(PKG, 'out/qa');
const OUT_DIR = path.join(PKG, 'output/coffee-explained/map-backend');

/* must match src/coffee/theme.ts LAYOUT.map */
const MAP = {left: 150, top: 140, width: 1686, height: 506};
const GAP = 10;

const SVG_ID = 'CoffeeExplained';
const GL_ID = 'CoffeeExplainedGL';

const frames = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
if (frames.length === 0) {
  console.error('usage: node scripts/compare-map-backends.mjs <frame> [frame ...]');
  process.exit(1);
}

const crop = (img, rect) => {
  const rgb = toRgb(img);
  const out = Buffer.alloc(rect.width * rect.height * 3);
  for (let y = 0; y < rect.height; y++) {
    const src = ((rect.top + y) * img.width + rect.left) * 3;
    out.set(rgb.subarray(src, src + rect.width * 3), y * rect.width * 3);
  }
  return out;
};

const main = async () => {
  fs.mkdirSync(TMP, {recursive: true});
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await ensureBrowser();

  console.log('bundling once...');
  const serveUrl = await bundle({entryPoint: ENTRY});

  const comps = {};
  for (const id of [SVG_ID, GL_ID]) {
    comps[id] = await selectComposition({serveUrl, id});
    console.log(`  ${id}: ${comps[id].durationInFrames} frames`);
  }

  for (const frame of frames) {
    const files = {};
    for (const id of [SVG_ID, GL_ID]) {
      const out = path.join(TMP, `cmp-${id}-${frame}.png`);
      await renderStill({
        serveUrl,
        composition: comps[id],
        output: out,
        frame,
        chromiumOptions: {gl: 'angle'},
        timeoutInMilliseconds: 120000,
      });
      files[id] = out;
    }

    const a = crop(decodePng(files[SVG_ID]), MAP);
    const b = crop(decodePng(files[GL_ID]), MAP);

    const W = MAP.width;
    const H = MAP.height * 2 + GAP;
    const rgb = Buffer.alloc(W * H * 3);
    /* divider so the two halves are unmistakable */
    for (let i = 0; i < W * GAP; i++) {
      rgb[(MAP.height * W + i) * 3] = 240;
      rgb[(MAP.height * W + i) * 3 + 1] = 90;
      rgb[(MAP.height * W + i) * 3 + 2] = 60;
    }
    rgb.set(a, 0);
    rgb.set(b, (MAP.height + GAP) * W * 3);

    const out = path.join(OUT_DIR, `map-${frame}.png`);
    fs.writeFileSync(out, encodePng(W, H, rgb));
    console.log(`  frame ${frame} -> ${path.relative(PKG, out)}  (top=SVG, bottom=MapLibre)`);
  }

  for (const frame of frames) {
    for (const id of [SVG_ID, GL_ID]) {
      fs.rmSync(path.join(TMP, `cmp-${id}-${frame}.png`), {force: true});
    }
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
