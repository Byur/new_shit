import { Easing, interpolate, spring } from "remotion";

export const clampEase = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const softSpring = (frame: number, fps: number, delay = 0) =>
  spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 120,
      stiffness: 90,
      mass: 0.8,
    },
  });

export const enterY = (progress: number, distance = 28) =>
  interpolate(progress, [0, 1], [distance, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const drawDash = (progress: number) => ({
  strokeDasharray: 1,
  strokeDashoffset: 1 - progress,
  pathLength: 1,
});

export const revealWidth = (progress: number) => ({
  transform: `scaleX(${progress})`,
  transformOrigin: "left center",
});
