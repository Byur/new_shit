import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {Coda} from './acts/Coda';
import {DualLabel} from './acts/DualLabel';
import {Hook} from './acts/Hook';
import {Leek} from './acts/Leek';
import {Pairs} from './acts/Pairs';
import {Pressure} from './acts/Pressure';
import {Trade} from './acts/Trade';
import {cameraAt, futureRevealAt} from './camera';
import {chipDistribution, TODAY} from './chart';
import {Captions} from './components/Captions';
import {ChartCanvas} from './components/ChartCanvas';
import {ChipPanel} from './components/ChipPanel';
import {Header} from './components/Header';
import {AUDIO_FILE, narration, sceneStart} from './timing';

const ACT_ORDER: string[] = ['hook', 'trade', 'pressure', 'duallabel', 'pairs', 'leek', 'coda'];

const activeAct = (frame: number): string => {
  let id: string = ACT_ORDER[0];
  for (const candidate of ACT_ORDER) {
    if (sceneStart(candidate) <= frame) id = candidate;
  }
  return id;
};

/** How long the outgoing act keeps fading after the next one has begun. */
const HANDOFF = 18;

const renderAct = (id: string, frame: number, view: ReturnType<typeof cameraAt>['view']) => {
  switch (id) {
    case 'hook':
      return <Hook frame={frame} />;
    case 'trade':
      return <Trade frame={frame} view={view} />;
    case 'pressure':
      return <Pressure frame={frame} view={view} />;
    case 'duallabel':
      return <DualLabel frame={frame} view={view} />;
    case 'pairs':
      return <Pairs frame={frame} view={view} />;
    case 'leek':
      return <Leek frame={frame} view={view} />;
    case 'coda':
      return <Coda frame={frame} view={view} />;
    default:
      return null;
  }
};

export const MarketSlangVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = cameraAt(frame);
  const futureReveal = futureRevealAt(frame);

  const centerDay = (cam.view.d0 + cam.view.d1) / 2;
  const asOfDay = Math.max(0, Math.min(TODAY, Math.round(centerDay)));
  const dist = chipDistribution(asOfDay);

  const currentDay = Math.max(0, Math.min(TODAY, Math.round(centerDay)));
  const act = activeAct(frame);

  /*
   * Scene handoff. The chart shell is shared for the whole video, and on top of
   * that the outgoing act keeps fading for a short beat after the next one
   * starts, so a boundary never blanks the overlay in a single frame.
   */
  const actIndex = ACT_ORDER.indexOf(act);
  const boundary = sceneStart(act);
  const outgoing = actIndex > 0 ? ACT_ORDER[actIndex - 1] : null;
  const outgoingOpacity = outgoing
    ? Math.max(0, 1 - (frame - boundary) / HANDOFF)
    : 0;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, #0E131A 0%, #0A0D12 45%, #070A0E 100%)`,
      }}
    >
      <ChartCanvas
        view={cam.view}
        futureReveal={futureReveal}
        opacity={1 - cam.dim * 0.76}
      />

      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{position: 'absolute', inset: 0}}
      >
        <ChipPanel
          view={cam.view}
          dist={dist}
          progress={1}
          opacity={cam.chips * (1 - cam.dim * 0.7)}
          emphasis={cam.chips > 0.5 ? [9.6, 10.4] : undefined}
        />
      </svg>

      <Header currentDay={currentDay} />

      {outgoing && outgoingOpacity > 0.01 ? (
        <AbsoluteFill style={{opacity: outgoingOpacity}}>
          {renderAct(outgoing, frame, cam.view)}
        </AbsoluteFill>
      ) : null}

      {renderAct(act, frame, cam.view)}

      <Captions frame={frame} />

      <Audio src={staticFile(AUDIO_FILE)} />
    </AbsoluteFill>
  );
};

export const marketSlangDurationInFrames = narration.totalFrames;
