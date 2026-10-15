import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {AUDIO_SRC, CLAIMS, earnedAt, L, sceneAt, totalFrames} from './timing';
import {theme} from './theme';
import {Captions, DiagramGrid, Header, ProgressRail} from './components/Chrome';
import {ColdOpen, Archive, Theory, Gertie, Collapse} from './acts/Opening';
import {Storm, Solid, TwoMotions, Stiffness, Wind, Resonance, TwoFreedoms} from './acts/Mechanism';
import {Plate, Coupling, Work, Threshold, Fix, Coda} from './acts/Payoff';

export const tacomaDurationInFrames = totalFrames;

/**
 * 《风中的桥》 — why a bridge that looked solid twisted itself apart in the wind.
 *
 * Every act is mounted for the whole film and gates itself with an opacity ramp,
 * which is this project's substitute for `<Sequence>`. The reason is continuity:
 * the wind layer, the diagram grid and the caption band live outside the acts and
 * never unmount, so a scene boundary cannot produce a blank frame. The acts are
 * pure functions of the absolute frame, which also means scrubbing the Studio
 * timeline and rendering the final file take exactly the same code path.
 *
 * The grading between the archive track and the diagram track is done inside the
 * acts; the background only carries the diagram track.
 */
export const TacomaVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const current = sceneAt(frame);

  /* the grid is up while the film is analysing and down while it is narrating:
     the analytical windows are declared once, in `gridAt` below */
  const gridOpacity = gridAt(frame);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${theme.bgTop} 0%, ${theme.bgMid} 48%, ${theme.bgBottom} 100%)`,
      }}
    >
      <Audio src={staticFile(AUDIO_SRC)} />

      <DiagramGrid opacity={gridOpacity} />

      {/*
        Act order is source order, and it is also the film's argument order.
        Nothing here is conditionally mounted; each act returns null when its own
        window is closed.
      */}
      <ColdOpen frame={frame} />
      <Archive frame={frame} />
      <Theory frame={frame} />
      <Gertie frame={frame} />
      <Collapse frame={frame} />

      <Storm frame={frame} />
      <Solid frame={frame} />
      <TwoMotions frame={frame} />
      <Stiffness frame={frame} />
      <Wind frame={frame} />
      <Resonance frame={frame} />
      <TwoFreedoms frame={frame} />

      <Plate frame={frame} />
      <Coupling frame={frame} />
      <Work frame={frame} />
      <Threshold frame={frame} />
      <Fix frame={frame} />
      <Coda frame={frame} />

      <Header frame={frame} claims={CLAIMS} earned={earnedAt(frame)} running={current.title} />
      <Captions frame={frame} />
      <ProgressRail frame={frame} total={tacomaDurationInFrames} />
    </AbsoluteFill>
  );
};

/**
 * The engineering-drawing grid fades in for the analytical acts and out for the
 * archival ones. Kept as one small function rather than per-act state so the
 * register change is a property of the film, not of any single scene.
 */
function gridAt(frame: number): number {
  const ramp = (from: number, to: number) => {
    if (frame < from - 20 || frame > to + 20) return 0;
    const inT = Math.min(1, Math.max(0, (frame - (from - 20)) / 20));
    const outT = Math.min(1, Math.max(0, (to + 20 - frame) / 20));
    return Math.min(inT, outT);
  };
  const on = [
    [L('theory', 2), L('theory', 6)],
    [L('solid', 5), L('solid', 8)],
    [L('stiffness', 0), L('stiffness', 10)],
    [L('wind', 4), L('wind', 6)],
    [L('resonance', 7), L('resonance', 10)],
    [L('plate', 5), L('plate', 9)],
    [L('coupling', 0), L('coupling', 10)],
    [L('work', 8), L('work', 11)],
    [L('threshold', 0), L('threshold', 10)],
    [L('fix', 0), L('fix', 14)],
  ] as Array<[number, number]>;
  let best = 0;
  for (const [from, to] of on) best = Math.max(best, ramp(from, to));
  return best * 0.5;
}
