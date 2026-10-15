import raw from './narration.timing.json';

export type LineTiming = {
  indexInScene: number;
  display: string;
  spoken: string;
  startFrame: number;
  endFrame: number;
  frames: number;
  ms: number;
};

export type SceneTiming = {
  id: string;
  title: string;
  startFrame: number;
  endFrame: number;
  lines: LineTiming[];
};

export type NarrationTiming = {
  voice: string;
  rate: number;
  fps: number;
  sampleRate: number;
  audioFile: string;
  totalFrames: number;
  durationSeconds: number;
  scenes: SceneTiming[];
};

export const narration = raw as NarrationTiming;

/**
 * One clock for the whole film. Every visual beat is expressed as an offset into
 * a narration line rather than as an absolute frame number, so shortening or
 * rewriting any line re-times the picture automatically instead of drifting out
 * of sync with the voice.
 */
export const scenes: SceneTiming[] = narration.scenes;
export const totalFrames: number = narration.totalFrames;
export const FPS: number = narration.fps;
/** `staticFile` resolves against public/, and the master is written there. */
export const AUDIO_SRC = narration.audioFile;

const index: Record<string, SceneTiming> = {};
for (const s of scenes) index[s.id] = s;

export const scene = (id: string): SceneTiming => {
  const found = index[id];
  if (!found) throw new Error(`unknown scene: ${id}`);
  return found;
};

export const sceneStart = (id: string): number => scene(id).startFrame;
export const sceneEnd = (id: string): number => scene(id).endFrame;

/**
 * The line object. Clamps rather than throws, so an act can ask for "the last
 * line" without knowing how many lines the scene has — the acts are keyed to
 * beats, and a beat that overruns should degrade rather than crash a render.
 */
export const line = (id: string, n: number): LineTiming => {
  const s = scene(id);
  return s.lines[Math.max(0, Math.min(n, s.lines.length - 1))];
};

/** Absolute frame at which line `n` of scene `id` starts, plus an offset. */
export const L = (id: string, n: number, offset = 0): number => line(id, n).startFrame + offset;

/** Absolute frame at which line `n` of scene `id` finishes being spoken. */
export const LE = (id: string, n: number, offset = 0): number => line(id, n).endFrame + offset;

/** Text of a line, for on-screen quoting and caption assertions. */
export const T = (id: string, n: number): string => line(id, n).display;

/** How many frames a line lasts — for sub-line beats that land mid-sentence. */
export const LF = (id: string, n: number): number => line(id, n).frames;

/**
 * A frame offset into a line, as an absolute frame. Reads better at call sites
 * that are expressing "halfway through this sentence" than raw arithmetic.
 */
export const mid = (id: string, n: number, fraction: number): number =>
  L(id, n) + Math.round(LF(id, n) * fraction);

/** Every line, flattened and tagged with its scene, for the caption layer. */
export const allLines: Array<LineTiming & {sceneId: string; sceneTitle: string}> = scenes.reduce(
  (acc: Array<LineTiming & {sceneId: string; sceneTitle: string}>, s) => {
    for (const l of s.lines) acc.push({...l, sceneId: s.id, sceneTitle: s.title});
    return acc;
  },
  [],
);

export const SCENE_IDS = [
  'cold-open',
  'archive',
  'theory',
  'gertie',
  'collapse',
  'storm',
  'solid',
  'two-motions',
  'stiffness',
  'wind',
  'resonance',
  'two-freedoms',
  'plate',
  'coupling',
  'work',
  'threshold',
  'fix',
  'coda',
] as const;
export type SceneId = (typeof SCENE_IDS)[number];

/** Which scene owns a given absolute frame. */
export const sceneAt = (frame: number): SceneTiming => {
  let found = scenes[0];
  for (const s of scenes) if (s.startFrame <= frame) found = s;
  return found;
};

/**
 * The film's argument, as a checklist the header can show from frame one. Each
 * entry unlocks when the film has actually established it, so a viewer can always
 * see how much of the case is still outstanding — and can tell that the
 * resonance account is a thing the film raises in order to demolish.
 */
export const CLAIMS = [
  {key: 'wind', label: '风不大', at: sceneStart('storm')},
  {key: 'push', label: '不是推力问题', at: sceneStart('solid')},
  {key: 'torsion', label: '致命的是扭转', at: sceneStart('stiffness')},
  {key: 'resonance', label: '共振解释不通', at: sceneStart('resonance') + 300},
  {key: 'selfexcited', label: '自激振荡', at: sceneStart('two-freedoms') + 240},
  {key: 'threshold', label: '临界速度', at: sceneStart('threshold')},
  {key: 'shape', label: '修法是改形状', at: sceneStart('fix') + 240},
] as const;

/** How many claims the film has earned by `frame`. */
export const earnedAt = (frame: number): number => {
  let n = 0;
  for (const c of CLAIMS) if (frame >= c.at) n++;
  return n;
};
