import timing from './narration.timing.json';

export type NarrationLine = {
  indexInScene: number;
  display: string;
  spoken: string;
  startFrame: number;
  endFrame: number;
  frames: number;
  ms: number;
};

export type NarrationScene = {
  id: string;
  title: string;
  startFrame: number;
  endFrame: number;
  lines: NarrationLine[];
};

export type NarrationTiming = {
  voice: string;
  rate: number;
  fps: number;
  sampleRate: number;
  audioFile: string;
  totalFrames: number;
  durationSeconds: number;
  scenes: NarrationScene[];
};

export const narration = timing as NarrationTiming;

export const FPS = narration.fps;
export const TOTAL_FRAMES = narration.totalFrames;
export const AUDIO_FILE = narration.audioFile;

const index: Record<string, NarrationScene> = {};
for (const s of narration.scenes) {
  index[s.id] = s;
}

export const scene = (id: string): NarrationScene => {
  const found = index[id];
  if (!found) throw new Error(`unknown narration scene: ${id}`);
  return found;
};

export const sceneStart = (id: string): number => scene(id).startFrame;
export const sceneEnd = (id: string): number => scene(id).endFrame;

export const line = (id: string, n: number): NarrationLine => {
  const s = scene(id);
  return s.lines[Math.max(0, Math.min(n, s.lines.length - 1))];
};

/** Absolute frame at which line `n` of scene `id` starts. */
export const at = (id: string, n: number, offset = 0): number => line(id, n).startFrame + offset;

/** Absolute frame at which line `n` of scene `id` finishes being spoken. */
export const atEnd = (id: string, n: number, offset = 0): number => line(id, n).endFrame + offset;

/** Every line of a scene, flattened, for caption rendering. */
export const allLines: Array<NarrationLine & {sceneId: string}> = narration.scenes.reduce(
  (acc: Array<NarrationLine & {sceneId: string}>, s) => {
    for (const l of s.lines) acc.push({...l, sceneId: s.id});
    return acc;
  },
  [],
);
