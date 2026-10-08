import type { CSSProperties } from "react";

export type RectBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const assertDisjointBounds = (context: string, entries: Array<{ name: string; bounds: RectBounds }>) => {
  for (let index = 0; index < entries.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < entries.length; compareIndex += 1) {
      const first = entries[index];
      const second = entries[compareIndex];
      const overlaps =
        first.bounds.left < second.bounds.left + second.bounds.width &&
        first.bounds.left + first.bounds.width > second.bounds.left &&
        first.bounds.top < second.bounds.top + second.bounds.height &&
        first.bounds.top + first.bounds.height > second.bounds.top;
      if (overlaps) {
        throw new Error(`${context}: ${first.name} overlaps ${second.name}`);
      }
    }
  }
};

const edgeDistance = (bounds: RectBounds, unitX: number, unitY: number) => {
  const xDistance = Math.abs(unitX) < 0.0001 ? Infinity : (bounds.width / 2) / Math.abs(unitX);
  const yDistance = Math.abs(unitY) < 0.0001 ? Infinity : (bounds.height / 2) / Math.abs(unitY);
  return Math.min(xDistance, yDistance);
};

export const getConnectorGeometry = (from: RectBounds, to: RectBounds) => {
  const fromCenterX = from.left + from.width / 2;
  const fromCenterY = from.top + from.height / 2;
  const toCenterX = to.left + to.width / 2;
  const toCenterY = to.top + to.height / 2;
  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const unitX = dx / distance;
  const unitY = dy / distance;
  const fromEdge = edgeDistance(from, unitX, unitY);
  const toEdge = edgeDistance(to, unitX, unitY);

  return {
    left: fromCenterX + unitX * fromEdge,
    top: fromCenterY + unitY * fromEdge,
    width: Math.max(0, distance - fromEdge - toEdge),
    angle: Math.atan2(dy, dx),
  };
};

export const ConnectorLine: React.FC<{
  from: RectBounds;
  to: RectBounds;
  color: string;
  progress?: number;
  thickness?: number;
  style?: CSSProperties;
}> = ({ from, to, color, progress = 1, thickness = 2, style }) => {
  const geometry = getConnectorGeometry(from, to);
  return (
    <div
      style={{
        position: "absolute",
        left: geometry.left,
        top: geometry.top,
        width: geometry.width,
        height: thickness,
        background: color,
        transform: `rotate(${geometry.angle}rad) scaleX(${progress})`,
        transformOrigin: "left center",
        zIndex: 0,
        ...style,
      }}
    />
  );
};
