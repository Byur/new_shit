#!/usr/bin/env node
/**
 * Encoded-output acceptance for a rendered Remotion piece.
 *
 * A successful render is not evidence that the deliverable is the one the
 * timeline describes. This decodes the actual file and asserts the three things
 * that a render can silently get wrong:
 *
 *   1. the container really holds the frame count, size, rate and codecs claimed;
 *   2. the audio track is a real narration track, not silence and not clipped;
 *   3. every scene gap in `narration.timing.json` shows up as an actual silent
 *      stretch in the file, at the right second — i.e. the picture and the voice
 *      are using the same clock.
 *
 * Usage:
 *   node scripts/verify-encoded.mjs <video.mp4> \
 *     --timing=src/<project>/narration.timing.json --out=<dir>/encoded-output.json
 *
 * Both paths are required in practice: the defaults below are only a fallback,
 * and the `--timing` flag must be written with `=` (the parser reads
 * `--flag=value`, so `--timing value` is silently ignored and the run then
 * compares the video against the wrong timeline).
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..');

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const video = path.resolve(PKG, positional[0] ?? 'out/render.mp4');
const timingPath = path.resolve(PKG, flag('timing', 'src/market-slang/narration.timing.json'));
const outPath = path.resolve(PKG, flag('out', 'out/encoded-output.json'));

const ffprobe = (args) =>
  execFileSync('npx', ['remotion', 'ffprobe', '-v', 'error', ...args, video], {
    cwd: PKG,
    encoding: 'utf8',
  }).trim();

const probe = JSON.parse(
  ffprobe(['-show_format', '-show_streams', '-of', 'json', '-count_frames', '-select_streams', 'v:0']),
);
const fmt = JSON.parse(ffprobe(['-show_format', '-show_streams', '-of', 'json']));

const v = probe.streams[0];
const a = fmt.streams.find((s) => s.codec_type === 'audio');

const timing = JSON.parse(fs.readFileSync(timingPath, 'utf8'));

/* ---- decode the audio to raw mono PCM and measure it -------------------- */
const pcmPath = path.join(PKG, '.cache/verify-encoded.wav');
fs.mkdirSync(path.dirname(pcmPath), {recursive: true});
/* Remotion's bundled ffmpeg has no raw-PCM muxer, so the audio comes back as a
   mono 16 kHz WAV and the data chunk is read directly. */
execFileSync(
  'npx',
  ['remotion', 'ffmpeg', '-y', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', pcmPath],
  {cwd: PKG, stdio: ['ignore', 'ignore', 'inherit']},
);
const wav = fs.readFileSync(pcmPath);
if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
  throw new Error('decoded audio is not a RIFF/WAVE file');
}
let off = 12;
let dataOff = -1;
let dataLen = 0;
while (off + 8 <= wav.length) {
  const id = wav.toString('ascii', off, off + 4);
  const size = wav.readUInt32LE(off + 4);
  if (id === 'data') {
    dataOff = off + 8;
    dataLen = size;
    break;
  }
  off += 8 + size + (size % 2);
}
if (dataOff < 0) throw new Error('no data chunk in decoded audio');
const count = Math.floor(Math.min(dataLen, wav.length - dataOff) / 2);
const samples = new Int16Array(count);
for (let i = 0; i < count; i++) samples[i] = wav.readInt16LE(dataOff + i * 2);

let peak = 0;
let sumSq = 0;
for (let i = 0; i < samples.length; i++) {
  const s = samples[i] / 32768;
  const m = Math.abs(s);
  if (m > peak) peak = m;
  sumSq += s * s;
}
const rms = Math.sqrt(sumSq / samples.length);

const db = (x) => (x <= 0 ? -Infinity : 20 * Math.log10(x));

/* silence map: 100 ms buckets, "voiced" if any |sample| clears the floor */
const RATE = 16000;
const BUCKET = RATE / 10;
const FLOOR = 0.0018; /* about -55 dBFS */
const voiced = [];
for (let b = 0; b * BUCKET < samples.length; b++) {
  let hit = false;
  const end = Math.min(samples.length, (b + 1) * BUCKET);
  for (let i = b * BUCKET; i < end; i++) {
    if (Math.abs(samples[i] / 32768) > FLOOR) {
      hit = true;
      break;
    }
  }
  voiced.push(hit);
}

/* runs of >= 0.5 s of silence */
const gaps = [];
let runStart = null;
for (let b = 0; b <= voiced.length; b++) {
  const silent = b < voiced.length ? !voiced[b] : false;
  if (silent && runStart === null) runStart = b;
  if (!silent && runStart !== null) {
    const dur = (b - runStart) / 10;
    if (dur >= 0.5) gaps.push({from: +(runStart / 10).toFixed(1), to: +(b / 10).toFixed(1), dur: +dur.toFixed(1)});
    runStart = null;
  }
}

/* the scene gaps the timeline claims: between each scene's end and the next
   scene's first line, plus the leading and trailing silence */
const expected = [];
for (let i = 0; i < timing.scenes.length - 1; i++) {
  const end = timing.scenes[i].endFrame;
  const next = timing.scenes[i + 1].lines[0].startFrame;
  expected.push({
    between: `${timing.scenes[i].id} -> ${timing.scenes[i + 1].id}`,
    from: +(end / timing.fps).toFixed(1),
    to: +(next / timing.fps).toFixed(1),
    dur: +((next - end) / timing.fps).toFixed(1),
  });
}

/* each declared gap must contain a detected silence of at least 0.5 s whose
   start is inside the declared window */
const matched = expected.map((e) => {
  const hit = gaps.find((g) => g.from >= e.from - 0.2 && g.from <= e.to + 0.2 && g.dur >= 0.5);
  return {...e, detected: hit ?? null, ok: Boolean(hit)};
});

const report = {
  file: path.relative(PKG, video),
  bytes: fs.statSync(video).size,
  container: {
    format: fmt.format.format_name,
    durationSeconds: Number(fmt.format.duration),
    bitRate: Number(fmt.format.bit_rate),
  },
  video: {
    codec: v.codec_name,
    profile: v.profile,
    width: v.width,
    height: v.height,
    frameRate: v.r_frame_rate,
    frames: Number(v.nb_read_frames),
    pixelFormat: v.pix_fmt,
  },
  audio: {
    codec: a.codec_name,
    sampleRate: Number(a.sample_rate),
    channels: a.channels,
    bitRate: Number(a.bit_rate),
    peakDbfs: Number(db(peak).toFixed(1)),
    rmsDbfs: Number(db(rms).toFixed(1)),
    voicedBuckets: voiced.filter(Boolean).length,
    totalBuckets: voiced.length,
    voicedRatio: Number((voiced.filter(Boolean).length / voiced.length).toFixed(3)),
    silenceRuns: gaps,
  },
  timing: {
    fps: timing.fps,
    totalFrames: timing.totalFrames,
    durationSeconds: timing.durationSeconds,
    scenes: timing.scenes.length,
    lines: timing.scenes.reduce((n, s) => n + s.lines.length, 0),
  },
  sceneGapAlignment: matched,
};

fs.mkdirSync(path.dirname(outPath), {recursive: true});
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

const pad = (s, n) => String(s).padStart(n);
console.log(`file        ${report.file}  ${report.bytes} B`);
console.log(`container   ${report.container.format}  ${report.container.durationSeconds}s`);
console.log(
  `video       ${report.video.codec}/${report.video.profile}  ${report.video.width}x${report.video.height}  ` +
    `${report.video.frameRate} fps  ${report.video.frames} frames`,
);
console.log(
  `audio       ${report.audio.codec}  ${report.audio.sampleRate} Hz  ${report.audio.channels} ch  ` +
    `${report.audio.bitRate} bps`,
);
console.log(
  `levels      peak ${report.audio.peakDbfs} dBFS  rms ${report.audio.rmsDbfs} dBFS  ` +
    `voiced ${(report.audio.voicedRatio * 100).toFixed(1)}%`,
);
console.log('\nscene gaps (declared -> detected):');
for (const m of matched) {
  console.log(
    `  ${m.between.padEnd(24)} ${pad(m.from, 7)}-${pad(m.to, 7)}s  ` +
      `${m.detected ? `detected ${m.detected.from}-${m.detected.to}s (${m.detected.dur}s)` : 'NOT DETECTED'}  ` +
      `${m.ok ? 'ok' : 'FAIL'}`,
  );
}

const failures = [];
if (report.video.frames !== timing.totalFrames) failures.push('frame count');
if (report.video.width !== 1920 || report.video.height !== 1080) failures.push('resolution');
if (report.audio.peakDbfs > -1) failures.push('clipping');
if (report.audio.rmsDbfs < -35) failures.push('audio too quiet');
if (report.audio.voicedRatio < 0.5) failures.push('audio mostly silent');
if (matched.some((m) => !m.ok)) failures.push('scene gap alignment');

console.log(
  failures.length
    ? `\nFAIL: ${failures.join(', ')}`
    : '\nPASS: frame count, resolution, levels and scene-gap alignment all agree with the timeline',
);
console.log(`report: ${path.relative(PKG, outPath)}`);
process.exit(failures.length ? 1 : 0);
