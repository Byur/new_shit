import React from 'react';
import {Img, staticFile} from 'remotion';
import {theme} from '../theme';
import {clamp01} from './primitives';

export const ARCHIVE = {
  twist: 'tacoma/collapse-twist.png',
  torsionStills: 'tacoma/torsion-stills.png',
  collapsedDeck: 'tacoma/collapsed-deck.jpg',
  collapseFar: 'tacoma/collapse-far.jpg',
  clifford: 'tacoma/howard-clifford.jpg',
} as const;

/**
 * An archival photograph, treated so the viewer always knows it is evidence and
 * not a reconstruction.
 *
 * The director's rule is that archive is evidence and diagrams are mechanism, and
 * that the two never impersonate each other. So this component always applies the
 * same marks of age: a cool sepia wash, a darkened crop, film grain, a vignette,
 * and a caption strip naming the source. It never colourises, never sharpens, and
 * never pretends to be a modern photograph.
 */
export const ArchivePlate: React.FC<{
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  caption?: string;
  /** 0..1 */
  opacity?: number;
  /** slight parallax/zoom, driven by the frame */
  zoom?: number;
  label?: string;
  dim?: number;
}> = ({src, x, y, w, h, caption, opacity = 1, zoom = 1, label, dim = 0.35}) => {
  const o = clamp01(opacity);
  if (o <= 0.01) return null;
  const zw = w * zoom;
  const zh = h * zoom;
  const zx = x - (zw - w) / 2;
  const zy = y - (zh - h) / 2;
  return (
    <div
      style={{
        position: 'absolute',
        left: zx,
        top: zy,
        width: zw,
        height: zh,
        opacity: o,
        overflow: 'hidden',
        background: '#0A0705',
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          /* a cool sepia, then darkened: the grade is the "this is 1940" signal */
          filter: `grayscale(0.72) sepia(0.42) brightness(${0.72 - dim * 0.4}) contrast(1.12)`,
        }}
      />
      {/* vignette, so the plate sits into the diagram track rather than on it */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(6,8,11,0.78) 100%)',
        }}
      />
      {/* grain: a fixed, deterministic dot field — no randomness, or the render
          would differ between the still and the encoded output */}
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{position: 'absolute', inset: 0, opacity: 0.5}}>
        {Array.from({length: 160}).map((_, i) => {
          const gx = ((i * 37) % 100) + ((i * 13) % 7) * 0.11;
          const gy = ((i * 61) % 100) + ((i * 29) % 5) * 0.13;
          const r = 0.16 + ((i * 17) % 5) * 0.05;
          return <circle key={i} cx={gx} cy={gy} r={r} fill={i % 3 === 0 ? '#C9AE92' : '#FFFFFF'} opacity={0.22} />;
        })}
      </svg>
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: 14,
            top: 12,
            fontFamily: theme.mono,
            fontSize: 17,
            letterSpacing: 2,
            color: theme.archive,
            opacity: 0.85,
          }}
        >
          {label}
        </div>
      ) : null}
      {caption ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '10px 16px',
            fontFamily: theme.font,
            fontSize: 17,
            letterSpacing: 1,
            color: theme.archive,
            background: 'linear-gradient(180deg, rgba(6,8,11,0) 0%, rgba(6,8,11,0.88) 55%)',
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
};

/**
 * The three-panel timeline the cold open uses: opening day, the wobble, the
 * collapse. The third panel is deliberately left empty for most of the beat — the
 * director asked for the gap to be the point.
 */
export const ArchiveTriptych: React.FC<{
  frame: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0..1 how much of the triptych has assembled */
  progress: number;
  /** 0..1 how far the third, empty panel has resolved */
  third: number;
}> = ({frame, x, y, w, h, progress, third}) => {
  const gap = 26;
  const cw = (w - gap * 2) / 3;
  const panels = [
    {src: ARCHIVE.twist, label: '1940.07.01', caption: '通车日'},
    {src: ARCHIVE.torsionStills, label: '1940 夏', caption: '它一直在摇'},
    {src: null, label: '1940.11.07', caption: '断裂日'},
  ];
  void frame;
  return (
    <>
      {panels.map((p, i) => {
        const local = clamp01((progress - i * 0.22) / 0.34);
        if (local <= 0.01) return null;
        const px = x + i * (cw + gap);
        if (!p.src) {
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: px,
                top: y,
                width: cw,
                height: h,
                opacity: local * (0.35 + third * 0.65),
                border: `1px solid ${theme.panelEdge}`,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{fontFamily: theme.mono, fontSize: 18, letterSpacing: 2, color: theme.archiveDim}}>{p.label}</div>
              <div style={{fontFamily: theme.font, fontSize: 24, letterSpacing: 3, color: theme.textFaint}}>{p.caption}</div>
            </div>
          );
        }
        return (
          <ArchivePlate
            key={i}
            src={p.src}
            x={px}
            y={y}
            w={cw}
            h={h}
            label={p.label}
            caption={p.caption}
            opacity={local}
            zoom={1 + (1 - local) * 0.05}
          />
        );
      })}
    </>
  );
};
