import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {AUDIO_SRC, L, totalFrames, unlockedAt} from './timing';
import {highlightsAt, mapOpacityAt, markersAt, viewAt} from './camera';
import {makeMercatorProjector, MapCanvasGL} from './components/MapCanvasGL';
import {Header} from './components/Header';
import {Captions, ProgressRail} from './components/Captions';
import {Hook} from './acts/Hook';
import {Species} from './acts/Species';
import {Variety} from './acts/Variety';
import {Geography} from './acts/Geography';
import {Process} from './acts/Process';
import {Regions} from './acts/Regions';
import {Coda} from './acts/Coda';
import {theme} from './theme';

export const coffeeDurationInFramesGL = totalFrames;

/**
 * The same film with the map drawn by MapLibre instead of the baked SVG plate.
 *
 * Everything else — narration, timing, camera keyframes, markers, highlights,
 * captions, the decision-chain header — is shared verbatim with
 * `CoffeeVideo`. That is the point of the comparison: only the renderer of the
 * map changes, so any difference you see is attributable to the map technique.
 */
export const CoffeeVideoGL: React.FC = () => {
  const frame = useCurrentFrame();
  const view = viewAt(frame);

  /* the acts read geography through the engine's own projection this time */
  const glProject = makeMercatorProjector(view);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${theme.bgTop} 0%, ${theme.bgMid} 46%, ${theme.bgBottom} 100%)`,
      }}
    >
      <Audio src={staticFile(AUDIO_SRC.replace(/^\//, ''))} />

      <MapCanvasGL
        view={view}
        opacity={mapOpacityAt(frame)}
        highlights={highlightsAt(frame)}
        markers={markersAt(frame)}
      />

      <Hook frame={frame} />
      <Species frame={frame} />
      <Variety frame={frame} />
      <Geography frame={frame} project={glProject} />
      <Process frame={frame} />
      <Regions frame={frame} project={glProject} />
      <Coda frame={frame} />

      <Header frame={frame} unlocked={unlockedAt(frame)} />
      <Captions frame={frame} hidden={frame >= L('coda', 8)} />
      <ProgressRail frame={frame} total={coffeeDurationInFramesGL} />
    </AbsoluteFill>
  );
};
