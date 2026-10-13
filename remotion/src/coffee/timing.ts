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

/**
 * One clock for the whole film. Every visual beat is expressed as an offset
 * into a narration line rather than as an absolute frame number, so shortening
 * or rewriting any line re-times the picture automatically instead of drifting
 * out of sync with the voice.
 */
export const scenes = raw.scenes as SceneTiming[];
export const totalFrames: number = raw.totalFrames;
export const FPS: number = raw.fps;
export const AUDIO_SRC = `/${raw.audioFile}`;

export const scene = (id: string): SceneTiming => {
  const found = scenes.find((s) => s.id === id);
  if (!found) throw new Error(`unknown scene: ${id}`);
  return found;
};

/** Absolute frame at which a line's speech begins. */
export const L = (id: string, index: number): number => {
  const s = scene(id);
  const l = s.lines[index];
  if (!l) throw new Error(`unknown line: ${id}[${index}]`);
  return l.startFrame;
};

/** Absolute frame at which a line's speech ends. */
export const LE = (id: string, index: number): number => {
  const s = scene(id);
  const l = s.lines[index];
  if (!l) throw new Error(`unknown line: ${id}[${index}]`);
  return l.endFrame;
};

/** Text of a line, for caption assertions and on-screen quoting. */
export const T = (id: string, index: number): string => scene(id).lines[index].display;

/** Frame within a scene's window: 0 at the scene's first frame. */
export const local = (id: string, index: number): number => L(id, index) - scene(id).startFrame;

export const SCENE_IDS = ['hook', 'species', 'variety', 'geography', 'process', 'regions', 'coda'] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export const sceneStart = (id: string) => scene(id).startFrame;
export const sceneEnd = (id: string) => scene(id).endFrame;

/**
 * How many links of the decision chain the film has earned by `frame`. The
 * header shows the whole chain from the first frame, locked, so the viewer can
 * see how much of the argument is still outstanding.
 */
export const unlockedAt = (frame: number): number => {
  const gates = [sceneStart('species'), sceneStart('variety'), sceneStart('geography'), sceneStart('process')];
  let n = 0;
  for (const g of gates) if (frame >= g) n++;
  return n;
};
