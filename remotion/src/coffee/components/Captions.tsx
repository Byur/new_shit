import React from 'react';
import {scenes} from '../timing';
import {clamp01, smooth} from './primitives';
import {LAYOUT, theme} from '../theme';

const FADE = 9;

/**
 * The caption band. It is deliberately narrow and single-line: the map above it
 * is carrying the argument, so the caption is a transcription the eye can drop
 * into rather than a second thing to read.
 */
export const Captions: React.FC<{frame: number; hidden?: boolean}> = ({frame, hidden}) => {
  let current: {text: string; start: number; end: number; scene: string} | null = null;
  for (const s of scenes) {
    for (const l of s.lines) {
      if (frame >= l.startFrame - FADE && frame <= l.endFrame + FADE) {
        current = {text: l.display, start: l.startFrame, end: l.endFrame, scene: s.id};
        break;
      }
    }
    if (current) break;
  }

  const opacity = hidden || !current
    ? 0
    : Math.min(
        smooth((frame - (current.start - FADE)) / FADE),
        smooth(((current.end + FADE) - frame) / FADE),
      );

  const active = scenes.find((s) => current && s.id === current.scene);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: LAYOUT.caption.left - 34,
        height: 140,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        pointerEvents: 'none',
        fontFamily: theme.font,
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          opacity,
          background: 'linear-gradient(90deg, rgba(12,8,5,0) 0%, rgba(12,8,5,0.92) 14%, rgba(12,8,5,0.92) 86%, rgba(12,8,5,0) 100%)',
          padding: '20px 60px 22px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            color: theme.textFaint,
            fontSize: 19,
            letterSpacing: 4,
            textAlign: 'center',
            marginBottom: 12,
            opacity: 0.9,
          }}
        >
          {active ? active.title : ''}
        </div>
        <div
          style={{
            color: theme.text,
            fontSize: 38,
            lineHeight: 1.32,
            textAlign: 'center',
            letterSpacing: 1,
            textShadow: '0 2px 20px rgba(0,0,0,0.85)',
            fontWeight: 500,
          }}
        >
          {current ? current.text : ''}
        </div>
      </div>
    </div>
  );
};

/** A left-edge progress rail: where in the argument we are. */
export const ProgressRail: React.FC<{frame: number; total: number}> = ({frame, total}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 6,
        height: LAYOUT.height,
        background: 'rgba(255,255,255,0.05)',
      }}
    >
      <div
        style={{
          width: '100%',
          height: `${clamp01(frame / total) * 100}%`,
          background: `linear-gradient(180deg, ${theme.arabica}, ${theme.robusta})`,
          opacity: 0.7,
        }}
      />
    </div>
  );
};
