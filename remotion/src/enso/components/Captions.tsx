import React from 'react';
import {allLines} from '../timing';
import {LAYOUT, theme} from '../theme';

/**
 * Fixed caption width: wide enough for the longest line in the script (46 CJK
 * characters at 34 px plus letter-spacing ≈ 1592 px of text), inside the frame's
 * safe box once the 40 px side paddings are counted.
 */
const CAPTION_W = 1700;

/**
 * Burned-in captions. Each caption is exactly one narration line, and the line
 * durations come from the synthesised audio, so the text on screen and the
 * voice cannot drift apart.
 *
 * Two decisions here were driven by measurement, not taste:
 *
 * 1. Cues are REPLACED, not cross-faded. An earlier version faded the outgoing
 *    line out while fading the incoming line in, which mounts two different
 *    sentences in the same centred box for the 7-frame gap. Measuring the
 *    caption band across one of those gaps showed ink *rising above both stable
 *    states* (15085 px mid-blend vs 13338 px for the outgoing line and 7076 px
 *    for the incoming one): the two texts superimpose, so the caption briefly
 *    reads as mud at every one of the 199 cue changes. Measuring the incoming
 *    alpha instead would have missed it, because both lines stay above the ink
 *    threshold. A hard replacement has no doubled state and no ink spike.
 *
 * 2. The box has a FIXED width. With a box that hugs its text, the container's
 *    left and right edges move at every cue change. Reserving the widest line's
 *    width keeps the caption's position, height and wrapping stable across
 *    adjacent cues, which is what makes 200 rapid cues readable.
 *
 * Every line in the script is short enough to fit on one row inside the fixed
 * box, so the caption height never changes either.
 */
export const Captions: React.FC<{frame: number; opacity?: number}> = ({frame, opacity = 1}) => {
  let active = 0;
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].startFrame <= frame) active = i;
  }
  const cur = allLines[active];
  if (!cur || opacity <= 0.01) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 1080 - LAYOUT.caption.bottom,
        display: 'flex',
        justifyContent: 'center',
        opacity,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: CAPTION_W,
          boxSizing: 'border-box',
          padding: '12px 40px 13px',
          borderRadius: 14,
          background: 'rgba(5,8,13,0.88)',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
          fontFamily: theme.font,
          fontSize: 34,
          lineHeight: 1.42,
          letterSpacing: 0.6,
          color: theme.text,
          textAlign: 'center',
        }}
      >
        {cur.display}
      </div>
    </div>
  );
};
