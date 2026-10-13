import React from 'react';
import {allLines} from '../timing';
import {LAYOUT, theme} from '../theme';

/**
 * Burned-in captions. Each caption is exactly one narration line, and the line
 * durations come from the synthesised audio, so the text on screen and the
 * voice can never drift apart. Adjacent lines cross-fade during the short gap
 * between them rather than cutting.
 */
export const Captions: React.FC<{frame: number}> = ({frame}) => {
  let active = 0;
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].startFrame <= frame) active = i;
  }
  const cur = allLines[active];
  const next = allLines[active + 1];
  const blendStart = next ? next.startFrame - 7 : Number.POSITIVE_INFINITY;
  const blend = next
    ? Math.max(0, Math.min(1, (frame - blendStart) / 7))
    : 0;

  const render = (entry: typeof cur | undefined, opacity: number) => {
    if (!entry || opacity <= 0.01) return null;
    return (
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: LAYOUT.height - LAYOUT.caption.bottom,
          display: 'flex',
          justifyContent: 'center',
          opacity,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            maxWidth: 1460,
            padding: '16px 40px',
            borderRadius: 14,
            background: 'rgba(7,10,14,0.86)',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            fontFamily: theme.font,
            fontSize: 41,
            lineHeight: 1.4,
            letterSpacing: 0.6,
            color: theme.text,
            textAlign: 'center',
          }}
        >
          {entry.display}
        </div>
      </div>
    );
  };

  return (
    <>
      {render(cur, 1 - blend)}
      {render(next, blend)}
    </>
  );
};
