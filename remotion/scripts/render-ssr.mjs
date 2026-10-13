#!/usr/bin/env node
/**
 * Render a composition through Remotion's SSR APIs instead of the CLI.
 *
 * The three documented steps — bundle, selectComposition, renderMedia — with the
 * project's remotion.config.ts settings re-applied by hand, because the Node APIs
 * do not read that file:
 *
 *   Config.setRspack(true)              -> bundle({rspack: true})
 *   Config.overrideBundlerConfig(...)   -> bundle({bundlerOverride: enableTailwind})
 *   Config.setVideoImageFormat("jpeg")  -> renderMedia({imageFormat: 'jpeg'})
 *   Config.setOverwriteOutput(true)     -> renderMedia({overwrite: true})
 *
 * WebGL compositions additionally need chromiumOptions.gl and a raised
 * delayRender timeout, which the CLI takes as --gl and --timeout.
 *
 * Usage:
 *   node scripts/render-ssr.mjs CoffeeExplainedGL out/video.mp4 \
 *     --gl=angle --concurrency=1 --timeout=180000
 */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {enableTailwind} from '@remotion/tailwind-v4';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..');

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const compositionId = positional[0] ?? 'CoffeeExplainedGL';
const outputLocation = path.resolve(
  PKG,
  positional[1] ?? 'out/ssr.mp4',
);

const concurrency = Number(flag('concurrency', '1'));
const gl = flag('gl', null);
const timeout = Number(flag('timeout', '180000'));
const crf = Number(flag('crf', '17'));
const frames = flag('frames', null);

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;
const clock = () => Date.now();

console.log(`composition  ${compositionId}`);
console.log(`output       ${path.relative(PKG, outputLocation)}`);
console.log(
  `options      concurrency=${concurrency}${gl ? ` gl=${gl}` : ''} timeout=${timeout}ms crf=${crf}`,
);
console.log();

/* --- 1. bundle --------------------------------------------------------- */
let t = clock();
const serveUrl = await bundle({
  entryPoint: path.join(PKG, 'src/index.ts'),
  rspack: true,
  bundlerOverride: enableTailwind,
  onProgress: (p) => {
    if (p % 25 === 0) {
      process.stdout.write(`\rbundling ${p}%   `);
    }
  },
});
const bundleMs = clock() - t;
process.stdout.write('\r');
console.log(`bundle       ${secs(bundleMs)}  -> ${serveUrl}`);

/* --- 2. select the composition ----------------------------------------- */
t = clock();
const composition = await selectComposition({
  serveUrl,
  id: compositionId,
});
console.log(
  `composition  ${composition.width}x${composition.height} @ ${composition.fps}fps, ${composition.durationInFrames} frames  (${secs(clock() - t)})`,
);

/* --- 3. render --------------------------------------------------------- */
t = clock();
let lastLine = '';
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation,
  crf,
  pixelFormat: 'yuv420p',
  audioCodec: 'aac',
  audioBitrate: '192k',
  imageFormat: 'jpeg',
  overwrite: true,
  concurrency,
  timeoutInMilliseconds: timeout,
  ...(gl ? {chromiumOptions: {gl}} : {}),
  ...(frames ? {frameRange: frames.split('-').map(Number)} : {}),
  logLevel: 'info',
  onProgress: ({renderedFrames, encodedFrames, stitchStage}) => {
    const line = `${stitchStage.padEnd(9)} rendered ${renderedFrames}/${composition.durationInFrames}  encoded ${encodedFrames}`;
    if (line !== lastLine) {
      lastLine = line;
      process.stdout.write(`\r${line}   `);
    }
  },
});
const renderMs = clock() - t;
process.stdout.write('\r');
console.log(`render       ${secs(renderMs)}`);

console.log();
console.log(
  `total        ${secs(bundleMs + renderMs)}  (bundle ${secs(bundleMs)} + render ${secs(renderMs)})`,
);
console.log(`done         ${path.relative(PKG, outputLocation)}`);
