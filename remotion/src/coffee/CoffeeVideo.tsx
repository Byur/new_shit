import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {AUDIO_SRC, L, totalFrames, unlockedAt} from './timing';
import {highlightsAt, mapOpacityAt, markersAt, viewAt} from './camera';
import {MapCanvas, project} from './components/MapCanvas';
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

export const coffeeDurationInFrames = totalFrames;

/**
 * The map is never unmounted. Every act draws into the same continuous canvas,
 * so a scene boundary cannot produce a blank frame — the layer underneath simply
 * changes emphasis. That is also why the camera, the highlights and the markers
 * are all pure functions of the frame rather than per-scene state.
 */
export const CoffeeVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const view = viewAt(frame);
  /* the acts read geography through the same closed-form projection the SVG map
     draws with, so an annotation can never disagree with the coastline */
  const svgProject = (lon: number, lat: number) => project(view, lon, lat);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${theme.bgTop} 0%, ${theme.bgMid} 46%, ${theme.bgBottom} 100%)`,
      }}
    >
      <Audio src={staticFile(AUDIO_SRC.replace(/^\//, ''))} />

      <MapCanvas
        view={view}
        opacity={mapOpacityAt(frame)}
        highlights={highlightsAt(frame)}
        markers={markersAt(frame)}
      />

      <Hook frame={frame} />
      <Species frame={frame} />
      <Variety frame={frame} />
      <Geography frame={frame} project={svgProject} />
      <Process frame={frame} />
      <Regions frame={frame} project={svgProject} />
      <Coda frame={frame} />

      <Header frame={frame} unlocked={unlockedAt(frame)} />
      <Captions frame={frame} hidden={frame >= L('coda', 8)} />
      <ProgressRail frame={frame} total={coffeeDurationInFrames} />
    </AbsoluteFill>
  );
};
