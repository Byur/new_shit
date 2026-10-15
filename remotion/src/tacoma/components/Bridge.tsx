import React from 'react';
import {theme} from '../theme';
import {FlowingStreamline, clamp01} from './primitives';

/** Which stiffening section the deck is built with. */
export type DeckSection = 'solid' | 'truss';

/**
 * The film's signature object: a cross-section of the suspended deck that can
 * rotate in place.
 *
 * It is deliberately the same object in every act that uses it — act 1, 4, 8, 9,
 * 13, 15, 17 and 18 — so that by the last act the viewer has watched one shape
 * change meaning six times without ever being handed a new diagram. The director's
 * brief calls this the continuity anchor and forbids replacing it with a fresh
 * visual each time.
 *
 * Geometry is drawn in local coordinates around (0,0) and placed by the caller, so
 * the same component serves a 120px thumbnail and a full-frame close-up.
 *
 * @param thetaDeg  twist angle. Positive = leading (left) edge up.
 * @param section   'solid' plate girder, or the 'truss' of the 1950 replacement.
 * @param span      1 = the full deck width; scales the drawing.
 */
export const DeckSection: React.FC<{
  x: number;
  y: number;
  span: number;
  thetaDeg: number;
  section?: DeckSection;
  accent?: string;
  opacity?: number;
  /** draw the suspender attachments */
  hangers?: boolean;
  /** rotate only the deck, leaving hangers vertical (as happens in reality) */
  hangersFixed?: boolean;
}> = ({
  x,
  y,
  span,
  thetaDeg,
  section = 'solid',
  accent = theme.steel,
  opacity = 1,
  hangers = true,
  hangersFixed = true,
}) => {
  /* the deck is 11.9 m wide and 2.4 m deep on a 1940 span, i.e. 1:5 — drawing that
     truthfully is what makes it read as a thin plate rather than a box */
  const w = span;
  const d = span * 0.2;
  const trussD = span * 0.62;

  const deck = (
    <>
      {section === 'solid' ? (
        <>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={1.5} fill="rgba(183,196,204,0.20)" stroke={accent} strokeWidth={2.4} />
          {/* the plate girder reads as solid: a hatched interior, no gaps */}
          {[-0.6, -0.2, 0.2, 0.6].map((t) => (
            <line key={t} x1={-w / 2} x2={w / 2} y1={t * d} y2={t * d} stroke={accent} strokeWidth={0.9} opacity={0.4} />
          ))}
        </>
      ) : (
        <>
          {/* an open truss: top and bottom chords, and daylight between them */}
          <rect x={-w / 2} y={-trussD / 2} width={w} height={5} fill={accent} opacity={0.85} />
          <rect x={-w / 2} y={trussD / 2 - 5} width={w} height={5} fill={accent} opacity={0.85} />
          {[-0.4, -0.2, 0, 0.2, 0.4].map((t) => (
            <line key={t} x1={t * w} x2={t * w} y1={-trussD / 2} y2={trussD / 2} stroke={accent} strokeWidth={2.2} opacity={0.7} />
          ))}
          {[-0.4, -0.2, 0, 0.2].map((t) => (
            <line key={`d${t}`} x1={t * w} y1={trussD / 2} x2={(t + 0.2) * w} y2={-trussD / 2} stroke={accent} strokeWidth={1.5} opacity={0.45} />
          ))}
          {/* the grating surface: slats with gaps, which is the whole point */}
          {[-0.45, -0.35, -0.25, -0.15, -0.05, 0.05, 0.15, 0.25, 0.35, 0.45].map((t) => (
            <rect key={`g${t}`} x={t * w - 2} y={-d / 2 - 5} width={4} height={5} fill={accent} opacity={0.7} />
          ))}
        </>
      )}
    </>
  );

  const halfW = w / 2;

  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      {hangers ? (
        <>
          <line x1={-halfW} x2={-halfW} y1={-150} y2={-14} stroke={theme.steelDim} strokeWidth={2} />
          <line x1={halfW} x2={halfW} y1={-150} y2={-14} stroke={theme.steelDim} strokeWidth={2} />
          <circle cx={-halfW} cy={-14} r={4} fill={theme.steelDim} />
          <circle cx={halfW} cy={-14} r={4} fill={theme.steelDim} />
          {hangersFixed ? (
            <g transform={`rotate(${thetaDeg})`}>{deck}</g>
          ) : (
            deck
          )}
        </>
      ) : (
        <g transform={`rotate(${thetaDeg})`}>{deck}</g>
      )}
    </g>
  );
};

/**
 * Airflow over a cross-section. This is the film's core physical claim made
 * visible: with a solid plate the streamlines cannot pass through, so they pile
 * up on the windward face and the pressure field stays coherent — which is what
 * turns the deck into an aerofoil. With an open truss most of the flow goes
 * straight through and no coherent torque can build.
 *
 * Both variants are drawn from the same generator with the same spacing and
 * spacing parameters; only the section shape differs, so the comparison is fair
 * (the brief demands exactly this).
 */
export const FlowField: React.FC<{
  frame: number;
  /** left edge of the flow box, in local coordinates */
  x: number;
  y: number;
  w: number;
  h: number;
  section: DeckSection;
  thetaDeg: number;
  /** 0..1 — how much the wind is feeding the structure */
  energy?: number;
  opacity?: number;
}> = ({frame, x, y, w, h, section, thetaDeg, energy = 0, opacity = 1}) => {
  const rows = 9;
  const paths: string[] = [];
  const t = (thetaDeg * Math.PI) / 180;
  /* the deck occupies a band around the vertical centre */
  const deckThickness = section === 'solid' ? h * 0.1 : h * 0.3;

  for (let i = 0; i < rows; i++) {
    const v = (i / (rows - 1)) * 2 - 1; // -1..1
    const laneY = v * (h / 2) * 0.86;
    const near = Math.abs(laneY) < deckThickness * 1.5;

    if (section === 'solid' && near) {
      /* it cannot get through: deflect over the top or under the bottom, and the
         deflection grows with the twist angle */
      const push = Math.sign(-laneY || 1) * (deckThickness * (0.9 + 1.5 * Math.abs(Math.sin(t))));
      const a = y + laneY;
      const b = y + laneY + push;
      const c = y + laneY + push * 0.55;
      paths.push(
        `M ${x} ${a} C ${x + w * 0.3} ${a}, ${x + w * 0.3} ${b}, ${x + w * 0.5} ${b} ` +
          `C ${x + w * 0.7} ${b}, ${x + w * 0.7} ${c}, ${x + w} ${c}`,
      );
    } else if (section === 'truss' && near) {
      /* it passes between the chords */
      paths.push(`M ${x} ${y + laneY} L ${x + w} ${y + laneY * 0.94}`);
    } else {
      /* free stream, very slightly displaced by the deck's presence */
      const bow = near ? Math.sin(t) * deckThickness * 0.5 : 0;
      paths.push(
        `M ${x} ${y + laneY} C ${x + w * 0.33} ${y + laneY + bow}, ${x + w * 0.66} ${
          y + laneY + bow
        }, ${x + w} ${y + laneY}`,
      );
    }
  }

  return (
    <g opacity={opacity}>
      {paths.map((d, i) => (
        <FlowingStreamline
          key={i}
          d={d}
          frame={frame}
          speed={1.1 + (i % 3) * 0.25}
          energy={energy > 0.02}
          opacity={0.34 + energy * 0.42}
          width={1.8}
        />
      ))}
      {/* the stagnation pile-up on the windward face, only for a solid deck */}
      {section === 'solid' ? (
        <ellipse
          cx={x + w * 0.26}
          cy={y}
          rx={w * 0.1}
          ry={deckThickness * 1.5}
          fill={energy > 0 ? theme.energySoft : theme.windSoft}
          opacity={clamp01(0.25 + energy * 0.75)}
        />
      ) : null}
    </g>
  );
};

/**
 * The aerodynamic torque about the deck's axis, drawn as it actually acts: as a
 * couple, not a single arrow. The sign convention matches `flutter.ts` — the
 * moment is in the direction of the twist that produced it, which is the reason
 * the air does positive work and the damping goes negative.
 */
export const TorqueArrows: React.FC<{
  x: number;
  y: number;
  radius: number;
  /** 1 = counter-clockwise couple, -1 = clockwise */
  sense: 1 | -1;
  magnitude: number;
  opacity?: number;
  color?: string;
}> = ({x, y, radius, sense, magnitude, opacity = 1, color = theme.energy}) => {
  const r = radius * clamp01(magnitude);
  const arc = (cx: number, cy: number) => {
    const a0 = sense > 0 ? -0.15 * Math.PI : 1.15 * Math.PI;
    const a1 = sense > 0 ? 0.7 * Math.PI : -0.7 * Math.PI;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 ${sense > 0 ? 1 : 0} ${x1} ${y1}`;
  };
  return (
    <g opacity={opacity}>
      <path d={arc(x - radius * 0.55, y)} fill="none" stroke={color} strokeWidth={2.6} markerEnd="url(#tacoma-torque-head)" />
      <path d={arc(x + radius * 0.55, y)} fill="none" stroke={color} strokeWidth={2.6} markerEnd="url(#tacoma-torque-head)" />
    </g>
  );
};

/**
 * A marker definition the acts mount once. Kept in its own component so an act
 * cannot forget it but also cannot declare it twice.
 */
export const TorqueDefs: React.FC = () => (
  <defs>
    <marker id="tacoma-torque-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill={theme.energy} />
    </marker>
    <marker id="tacoma-lift-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill={theme.steel} />
    </marker>
  </defs>
);

/**
 * The full bridge in side elevation: two towers, two main cables, hangers and the
 * deck. Used when the film needs to say *what resists what*, so the towers and
 * cables are drawn thin and restrained and the deck is comparatively heavy — the
 * viewer's attention has to stay on the deck.
 */
export const BridgeElevation: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  /** vertical deck displacement, in units of h */
  heave?: number;
  /** twist, visualised as a slight rotation of the deck band */
  thetaDeg?: number;
  /** 0..1 — how much the main cable is being stretched/loaded */
  cableLoad?: number;
  /** highlight only the stiffening girder */
  focusGirder?: boolean;
  /** deck depth to draw, as a fraction of h */
  deckDepth?: number;
  opacity?: number;
  accent?: string;
}> = ({
  x,
  y,
  w,
  h,
  heave = 0,
  thetaDeg = 0,
  cableLoad = 0,
  focusGirder = false,
  deckDepth = 0.022,
  opacity = 1,
  accent = theme.steel,
}) => {
  const towerW = w * 0.012;
  const towerTop = y;
  const deckY = y + h * 0.66 + heave * h;
  const leftTower = x + w * 0.24;
  const rightTower = x + w * 0.76;
  const span = rightTower - leftTower;

  /* the main cable sags between the towers; the sag is what gives the deck its
     vertical stiffness, so it is the thing the film points at */
  const cableY = (px: number) => {
    const u = (px - leftTower) / span;
    if (u < 0 || u > 1) return towerTop + h * 0.06;
    const sag = h * (0.5 - 0.22 * cableLoad);
    return towerTop + h * 0.06 + sag * (1 - (2 * u - 1) ** 2);
  };

  const cablePath = (() => {
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const px = x + (w * i) / 40;
      const py = cableY(px);
      pts.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`);
    }
    return pts.join(' ');
  })();

  const hangers: React.ReactNode[] = [];
  for (let i = 1; i < 24; i++) {
    const px = leftTower + (span * i) / 24;
    hangers.push(
      <line key={i} x1={px} x2={px} y1={cableY(px)} y2={deckY - h * deckDepth} stroke={theme.steelGhost} strokeWidth={1.1} />,
    );
  }

  return (
    <g opacity={opacity}>
      {/* towers */}
      <rect x={leftTower - towerW / 2} y={towerTop} width={towerW} height={deckY - towerTop} fill={theme.steelDim} />
      <rect x={rightTower - towerW / 2} y={towerTop} width={towerW} height={deckY - towerTop} fill={theme.steelDim} />
      {/* main cable */}
      <path d={cablePath} fill="none" stroke={accent} strokeWidth={3} opacity={focusGirder ? 0.4 : 1} />
      {hangers}
      {/* deck */}
      <g transform={`rotate(${thetaDeg * 0.35} ${x + w / 2} ${deckY})`}>
        <rect
          x={x}
          y={deckY - h * deckDepth}
          width={w}
          height={h * deckDepth * 2}
          fill={focusGirder ? 'rgba(255,106,42,0.22)' : 'rgba(183,196,204,0.22)'}
          stroke={focusGirder ? theme.energy : accent}
          strokeWidth={focusGirder ? 3 : 2}
        />
      </g>
    </g>
  );
};
