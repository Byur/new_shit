#!/usr/bin/env node
/**
 * Builds the authoritative narration track for a piece.
 *
 * Usage: node scripts/build-narration.mjs [--project coffee]
 *
 * For every narration line it synthesises speech with the macOS `say` voice,
 * measures the real duration, then lays every line onto an exact 30fps frame
 * grid (22050/30 = 735 samples per frame) and concatenates everything into a
 * single 16-bit mono WAV.
 *
 * Outputs:
 *   public/<project>-narration.wav      - master narration audio
 *   src/<project>/narration.timing.json - per-line / per-scene frame timings
 *
 * Because lines are snapped to whole frames, the caption layer, the animation
 * beats and the audio share one clock and cannot drift.
 */
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..');

/*
 * Which piece to build. Each video keeps its own script, its own master WAV and
 * its own timing file; the synthesis cache is shared because it is keyed by the
 * exact voice + rate + text, so a line reused across pieces is only spoken once.
 */
const projectArg = process.argv.indexOf('--project');
const PROJECT = projectArg === -1 ? 'market-slang' : process.argv[projectArg + 1];
if (!/^[a-z0-9-]+$/.test(PROJECT)) {
  throw new Error(`bad project name: ${PROJECT}`);
}

const SCRIPT_PATH = path.join(PKG, `src/${PROJECT}/narration.script.json`);
const OUT_WAV = path.join(PKG, `public/${PROJECT}-narration.wav`);
const OUT_TIMING = path.join(PKG, `src/${PROJECT}/narration.timing.json`);
const CACHE_DIR = path.join(PKG, '.cache/narration');

const SAMPLE_RATE = 22050;
const CHANNELS = 1;
const BITS = 16;
const BYTES_PER_SAMPLE = (BITS / 8) * CHANNELS;

const script = JSON.parse(fs.readFileSync(SCRIPT_PATH, 'utf8'));
const FPS = script.fps ?? 30;
const SAMPLES_PER_FRAME = SAMPLE_RATE / FPS;
if (!Number.isInteger(SAMPLES_PER_FRAME)) {
  throw new Error(`fps ${FPS} does not divide ${SAMPLE_RATE} into whole frames`);
}

/* ------------------------------------------------------------------ */
/* Numbers -> spoken Chinese                                           */
/* ------------------------------------------------------------------ */

const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

const integerToSpoken = (n) => {
  if (n < 10) return DIGITS[n];
  if (n < 20) return n === 10 ? '十' : `十${DIGITS[n % 10]}`;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return `${DIGITS[tens]}十${ones ? DIGITS[ones] : ''}`;
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    return `${DIGITS[hundreds]}百${rest ? integerToSpoken(rest) : ''}`;
  }
  if (n < 10000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const restSpoken = rest === 0 ? '' : rest < 100 ? `零${integerToSpoken(rest)}` : integerToSpoken(rest);
    return `${DIGITS[thousands]}千${restSpoken}`;
  }
  return String(n);
};

/** "6.8" -> "六点八", "1000" -> "一千". Leaves everything else untouched. */
export const toSpoken = (text) =>
  text.replace(/\d+(?:\.\d+)?/g, (match) => {
    const [whole, fraction] = match.split('.');
    const head = integerToSpoken(Number(whole));
    if (fraction === undefined) return head;
    return `${head}点${[...fraction].map((d) => DIGITS[Number(d)]).join('')}`;
  });

/* ------------------------------------------------------------------ */
/* WAV helpers                                                         */
/* ------------------------------------------------------------------ */

const readWavSamples = (buffer) => {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }
  let offset = 12;
  let format = null;
  let data = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      format = {
        audioFormat: buffer.readUInt16LE(body),
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        bits: buffer.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = buffer.subarray(body, Math.min(body + size, buffer.length));
    }
    offset = body + size + (size % 2);
  }
  if (!format || !data) throw new Error('missing fmt or data chunk');
  if (format.audioFormat !== 1 || format.bits !== 16) {
    throw new Error(`expected 16-bit PCM, got format=${format.audioFormat} bits=${format.bits}`);
  }
  if (format.sampleRate !== SAMPLE_RATE) {
    throw new Error(`expected ${SAMPLE_RATE}Hz, got ${format.sampleRate}Hz`);
  }
  if (format.channels !== CHANNELS) {
    throw new Error(`expected mono, got ${format.channels} channels`);
  }
  const samples = new Int16Array(data.length / BYTES_PER_SAMPLE);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = data.readInt16LE(i * 2);
  }
  return samples;
};

const writeWav = (target, samples) => {
  const dataBytes = samples.length * BYTES_PER_SAMPLE;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * BYTES_PER_SAMPLE, 28);
  buffer.writeUInt16LE(BYTES_PER_SAMPLE, 32);
  buffer.writeUInt16LE(BITS, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, buffer);
};

/* ------------------------------------------------------------------ */
/* Synthesis                                                           */
/* ------------------------------------------------------------------ */

const synthesise = (spoken, voice, rate) => {
  const key = crypto.createHash('sha1').update(`${voice}|${rate}|${spoken}`).digest('hex').slice(0, 16);
  const cached = path.join(CACHE_DIR, `${key}.wav`);
  if (!fs.existsSync(cached)) {
    fs.mkdirSync(CACHE_DIR, {recursive: true});
    execFileSync(
      'say',
      [
        '-v', voice,
        '-r', String(rate),
        '-o', cached,
        '--file-format=WAVE',
        `--data-format=LEI16@${SAMPLE_RATE}`,
        spoken,
      ],
      {stdio: ['ignore', 'ignore', 'inherit']},
    );
  }
  return readWavSamples(fs.readFileSync(cached));
};

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

const {voice, rate} = script;
const leadingFrames = script.leadingFrames ?? 20;
const lineGapFrames = script.lineGapFrames ?? 8;
const sceneGapFrames = script.sceneGapFrames ?? 28;
const tailFrames = script.tailFrames ?? 45;

/** silence, then the line, then a gap before whatever comes next */
const placed = [];
let cursor = leadingFrames;
const scenes = [];

for (const scene of script.scenes) {
  const sceneStart = cursor;
  const lines = [];
  scene.lines.forEach((display, indexInScene) => {
    const spoken = toSpoken(display);
    const pcm = synthesise(spoken, voice, rate);
    const rawFrames = pcm.length / SAMPLES_PER_FRAME;
    const frames = Math.max(1, Math.round(rawFrames));
    const padded = new Int16Array(frames * SAMPLES_PER_FRAME);
    padded.set(pcm.subarray(0, Math.min(pcm.length, padded.length)));
    const startFrame = cursor;
    placed.push({startFrame, samples: padded});
    lines.push({
      indexInScene,
      display,
      spoken,
      startFrame,
      endFrame: startFrame + frames,
      frames,
      ms: Math.round((pcm.length / SAMPLE_RATE) * 1000),
    });
    cursor = startFrame + frames;
    const isLast = indexInScene === scene.lines.length - 1;
    cursor += isLast ? sceneGapFrames : lineGapFrames;
  });
  scenes.push({
    id: scene.id,
    title: scene.title,
    startFrame: sceneStart,
    endFrame: cursor - sceneGapFrames,
    lines,
  });
}

const totalFrames = cursor - sceneGapFrames + tailFrames;

const master = new Int16Array(totalFrames * SAMPLES_PER_FRAME);
for (const {startFrame, samples} of placed) {
  master.set(samples, startFrame * SAMPLES_PER_FRAME);
}

writeWav(OUT_WAV, master);

const timing = {
  generatedFrom: 'narration.script.json',
  voice,
  rate,
  fps: FPS,
  sampleRate: SAMPLE_RATE,
  samplesPerFrame: SAMPLES_PER_FRAME,
  audioFile: `${PROJECT}-narration.wav`,
  totalFrames,
  durationSeconds: Number((totalFrames / FPS).toFixed(2)),
  scenes,
};

fs.writeFileSync(OUT_TIMING, `${JSON.stringify(timing, null, 2)}\n`);

const lineCount = scenes.reduce((sum, s) => sum + s.lines.length, 0);
console.log(`narration: ${lineCount} lines, ${totalFrames} frames (${timing.durationSeconds}s)`);
for (const scene of scenes) {
  console.log(
    `  ${scene.id.padEnd(11)} ${String(scene.startFrame).padStart(5)} - ${String(scene.endFrame).padStart(5)}  (${((scene.endFrame - scene.startFrame) / FPS).toFixed(1)}s)`,
  );
}
