import React from 'react';
import {AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {theme} from './theme';
import {chapterIndexAt, CHAPTERS, forecastZoneAt, stateAt, stripWindowAt} from './state';
import {decorAt} from './mapDecor';
import {AUDIO_FILE, sceneEnd, sceneStart, TOTAL_FRAMES} from './timing';
import {OniStrip, type EventPin} from './components/OniStrip';
import {Section} from './components/Section';
import {WorldMap} from './components/WorldMap';
import {Header} from './components/Header';
import {Captions} from './components/Captions';
import {Coda, Live, Split} from './acts/present';
import {Coal, Grain, Palm} from './acts/history';
import {Hook, Machine, Teleconnect} from './acts/mechanism';

/**
 * El Nino / La Nina: the machine that moves the rain.
 *
 * The architecture is two layers, and the split is the point.
 *
 *   The INSTRUMENT never unmounts: the ONI strip along the bottom, the
 *   equatorial cross-section, and the Pacific-centred world map. All three are
 *   driven by `stateAt(frame)`, which reads the cursor's position in the real
 *   1950-2026 record. They cannot disagree with each other because they do not
 *   hold any state of their own.
 *
 *   The ACTS come and go on top: nine chapters of argument, each with an
 *   opacity envelope. They never own the film's sense of where in time we are.
 *
 * The consequence is that the mechanism chapter can say "the warm pool moved
 * east" and the viewer can see the cursor standing at the month the record
 * actually stands at, rather than at a month chosen to make a drawing work.
 */

const HANDOFF = 18;

type ActDef = {id: string; C: React.FC<{frame: number}>};

const ACTS: ActDef[] = [
  {id: 'hook', C: Hook},
  {id: 'machine', C: Machine},
  {id: 'teleconnect', C: Teleconnect},
  {id: 'grain', C: Grain},
  {id: 'palm', C: Palm},
  {id: 'coal', C: Coal},
  {id: 'split', C: Split},
  {id: 'live', C: Live},
  {id: 'coda', C: Coda},
];

/** Pins accumulate as the film passes each event, turning the strip into an index. */
const PIN_PLAN: Array<{year: number; label: string; color: string; side: 'above' | 'below'; atFrame: number}> = [
  {year: 2026.6, label: '2026', color: theme.warm, side: 'above', atFrame: 0},
  {year: 1997.9, label: '1997–98', color: theme.warm, side: 'above', atFrame: 0},
  {year: 2011.0, label: '2010–11', color: theme.cold, side: 'below', atFrame: 0},
  {year: 1973.0, label: '1972–73', color: theme.warm, side: 'above', atFrame: 0},
  {year: 2024.0, label: '2023–24', color: theme.warm, side: 'below', atFrame: 0},
];

export const EnsoVideo: React.FC = () => {
  /* Remotion does not pass `frame` as a prop; the current frame comes from here. */
  const f = useCurrentFrame();
  const s = stateAt(f);

  const chapterIndex = chapterIndexAt(f);
  const chapter = CHAPTERS[chapterIndex];
  const decor = decorAt(chapter.id, f);

  const window = stripWindowAt(f);
  const forecastZone = forecastZoneAt(f);

  const pins: EventPin[] = PIN_PLAN.filter((p) => f >= p.atFrame).map((p) => ({
    year: p.year,
    label: p.label,
    color: p.color,
    side: p.side,
  }));

  /* the section sits in the stage; the map replaces it in the dossier acts */
  const sectionOpacity = s.section * (1 - s.map * 0.9);

  return (
    <AbsoluteFill style={{background: theme.bgBottom, fontFamily: theme.font}}>
      <Audio src={staticFile(AUDIO_FILE)} />

      {/* ---------------- persistent instrument ---------------- */}

      {sectionOpacity > 0.01 ? (
        <div style={{position: 'absolute', inset: 0, opacity: sectionOpacity}}>
          <Section
            frame={f}
            oni={s.oni}
            windReveal={s.wind}
            thermoReveal={s.thermo}
            upwellReveal={s.upwell}
            rainReveal={s.rain}
            walkerReveal={s.walker}
            ticksReveal={s.ticks}
            fetchReveal={s.fetch}
            dim={s.dim}
          />
        </div>
      ) : null}

      {s.map > 0.01 ? (
        <WorldMap
          opacity={s.map}
          baseReveal={1}
          equatorReveal={decor.equator ?? 1}
          spanReveal={decor.span ?? 0}
          anomalies={decor.anomalies}
          markers={decor.markers}
          highlight={decor.highlight}
          showContinentLabels={decor.continentLabels ?? false}
          dim={decor.dim ?? 0}
        />
      ) : null}

      <OniStrip
        cursor={s.cursor > 0.5 ? s.month : null}
        drawn={s.drawn}
        pins={pins}
        window={window}
        forecastZone={forecastZone}
        caption={chapter.id === 'hook' ? '1950 – 2026 · 厄尔尼诺与拉尼娜的全部记录' : undefined}
      />

      {/* ---------------- acts ---------------- */}

      {ACTS.map((act, i) => {
        const start = sceneStart(act.id);
        const end = sceneEnd(act.id);
        // The first act owns the title beat, which happens before its narration
        // starts; the last act owns the closing hold. Neither may be culled at
        // the ends of the film, or the film opens and closes on an empty stage.
        const cullFrom = i === 0 ? 0 : start - HANDOFF;
        const cullTo = i === ACTS.length - 1 ? TOTAL_FRAMES : end + HANDOFF;
        if (f < cullFrom || f > cullTo) return null;

        const inA = i === 0 ? 1 : interpolate(f, [start - HANDOFF, start], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const outA =
          i === ACTS.length - 1
            ? 1
            : interpolate(f, [end, end + HANDOFF], [1, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
        const a = Math.min(inA, outA);
        if (a <= 0.005) return null;

        return (
          <div key={act.id} style={{position: 'absolute', inset: 0, opacity: a}}>
            <act.C frame={f} />
          </div>
        );
      })}

      {/* ---------------- chrome ---------------- */}

      <Header
        frame={f}
        chapter={chapter.title}
        chapterIndex={chapterIndex}
        chapterCount={CHAPTERS.length}
        source={chapter.source}
        oni={s.cursor > 0.5 ? s.oni : null}
      />

      <Captions frame={f} />

      {/* the film's own disclaimer, present for the whole run */}
      <div
        style={{
          position: 'absolute',
          right: 96,
          bottom: 24,
          color: 'rgba(150,168,188,0.5)',
          fontSize: 14,
          letterSpacing: 0.6,
          fontFamily: theme.font,
          opacity: interpolate(f, [0, 30], [0, 1], {extrapolateRight: 'clamp'}),
        }}
      >
        所有屏幕数字均可在随片文档中追溯到来源 · 历史价格曲线为示意路径，非逐日报价
      </div>
    </AbsoluteFill>
  );
};

export const ENSO_TOTAL_FRAMES = TOTAL_FRAMES;
