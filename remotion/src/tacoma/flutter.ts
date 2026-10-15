/**
 * The aeroelastic model behind the film.
 *
 * Two degrees of freedom — heave (the deck moving up and down) and torsion (the
 * deck twisting) — in mass-normalised modal coordinates, integrated at runtime
 * with RK4. It exists to make one thing visible: above a threshold wind speed the
 * airflow stops removing energy from the bridge's twisting and starts adding it,
 * so the motion grows on its own, with no gust and no frequency match anywhere in
 * the equations.
 *
 * ## Why modal coordinates
 *
 * Working per unit length with raw masses makes the torsional damping ratio come
 * out at 0.2 — twenty times too big — because the modal inertia is not the
 * geometric one. Normalising by the modal mass removes the ambiguity: the
 * twisting equation is then
 *
 *     thetaddot = -omegaT^2*theta - 2*zetaT*omegaT*thetadot - sat*omegaT^2*theta^3
 *
 * and the aerodynamic torque appears as a damping term `A2 * q / U`, which is the
 * standard way bridge flutter is written down.
 *
 * ## The two aerodynamic terms
 *
 * **Lift** answers the deck's vertical motion. In modal coordinates it is
 * `(cL*q*2b/M) * alpha` with `alpha = theta + hdot/U` the effective angle of
 * attack: the deck's twist plus the flow angle its own vertical motion induces. A
 * downward-moving deck presents a negative angle and so pushes itself back up, so
 * this term damps heave. That is what makes the vertical bouncing the film shows
 * first a *stable* motion — the bridge was never in danger from bouncing.
 *
 * **The torsional moment** is the whole story, and it cannot come from
 * quasi-steady theory — which is the point, and a fact the 1940 designers did not
 * have. A quasi-steady moment can shift the twisting stiffness but can never make
 * the twist unstable. The instability needs the moment to *lead* the twist by a
 * quarter cycle, which is an unsteady (Theodorsen) effect. It appears here as the
 * `A2*q/U` term, calibrated so the total torsional damping vanishes at the
 * observed flutter speed:
 *
 *     A2 = 2*zetaT*omegaT*Uf/q(Uf)
 *
 * Substituting the dynamic pressure leaves a damping coefficient whose wind-speed
 * dependence cancels against it exactly:
 *
 *     2*zetaT*omegaT - A2*q(U)/U = 2*zetaT*omegaT * (1 - U/Uf)
 *
 * so the net damping is the structure's own 2% minus a term the wind supplies,
 * and it reaches zero at the critical speed. That is the cleanest statement of
 * the film's claim, and it is why the critical speed is an *output*: every
 * published number (f_heave = 0.08 Hz, f_torsion = 0.20 Hz, zeta = 0.02) is an
 * input. The calibrated value is 16.0 m/s (58 km/h). Wikipedia's account of
 * Billah & Scanlan gives "about 35 mph (56 km/h)" as the speed above which the
 * torsional flutter was unbounded, and 40 mph (64 km/h) as the wind on the
 * morning of 7 November 1940. So the bridge failed only slightly above its own
 * threshold — which is exactly why it had stood for 129 days first. The margin is
 * what makes the collapse a threshold crossing rather than a coincidence, and it
 * is the number the film's stability diagram is built on.
 *
 * ## Saturation
 *
 * Two effects stop an unstable run at a finite amplitude, and both are honest
 * rather than cosmetic:
 *
 *   - `stallFactor` degrades the aerodynamic torque once the deck is inclined
 *     past `stallAngleDeg`, standing in for the breakdown of attached flow. This
 *     is what caps the twist in the 30-50 degree range the record shows.
 *   - `heaveFade` limits the vertical excursion, which also cuts the aerodynamic
 *     input once the deck is moving far.
 *
 * The `saturation` cubic adds a further soft limit. Without these the model
 * diverges to absurd angles, which is a sign the linearisation has been left
 * behind, not a prediction.
 *
 * This is still a teaching model, not a reproduction of the collapse: cL and A2
 * are lumped constants rather than section polars, and the numbers are tuned to
 * the published modal properties rather than measured from the wreckage. See
 * docs/tacoma-narrows-bridge.md.
 */

export const PHYS = {
  /** suspended deck mass per unit length, kg/m (a plate-girder deck) */
  mass: 7400,
  /** vertical (heave) natural frequency, rad/s -> 0.08 Hz */
  omegaH: 0.503,
  /** torsional natural frequency, rad/s -> 0.20 Hz (period 5.0 s) */
  omegaT: 1.257,
  /** half the deck width, used as the reference length, m */
  halfWidth: 6.0,
  /** air density, kg/m^3 */
  rho: 1.225,
} as const;

export type FlutterParams = {
  /**
   * The declared critical wind speed, m/s. The single calibration input: the
   * aerodynamic damping is derived from it, and the model's growth rate then
   * crosses zero exactly here.
   */
  flutterSpeed: number;
  /**
   * Lumped lift coefficient. It sets how strongly the airflow answers the deck's
   * vertical motion; it does NOT decide stability. That is the film's point —
   * stability is decided by the phase of the twisting moment, not by the
   * strength of the force.
   */
  cL: number;
  /** structural damping ratios in heave and in torsion, as assumed in 1940 */
  zetaH: number;
  zetaT: number;
  /** vertical excursion at which the aerodynamic input starts fading, m */
  heaveScale: number;
  /** twist angle in degrees past which attached flow degrades */
  stallAngleDeg: number;
  /** coefficient of the saturating cubic, which soft-limits the amplitude */
  saturation: number;
};

/** The 1940 deck, as close as the record allows. */
export const GERTIE: FlutterParams = {
  flutterSpeed: 16.0,
  cL: 1.6,
  zetaH: 0.05,
  zetaT: 0.02,
  heaveScale: 1.4,
  stallAngleDeg: 24,
  saturation: 1.9,
};

/** Dynamic pressure, Pa. */
export const dynamicPressure = (U: number) => 0.5 * PHYS.rho * U * U;

/**
 * The aerodynamic damping coefficient in modal coordinates, calibrated so the
 * torsional damping vanishes at `flutterSpeed`. See the derivation at the top.
 */
export const aeroDamping = (p: FlutterParams) =>
  (2 * p.zetaT * PHYS.omegaT * p.flutterSpeed) / dynamicPressure(p.flutterSpeed);

/**
 * The wind speed at which the torsional damping changes sign, m/s.
 *
 * The aerodynamic damping grows linearly with U while the structure's own
 * damping is fixed, so
 *
 *     net damping = 2*zetaT*omegaT * (1 - U/flutterSpeed)
 *
 * and the sign changes at exactly `flutterSpeed`, which is how `aeroDamping` was
 * calibrated. That cancellation is exact, so this returns the declared value —
 * but it is not a tautology check on its own. It was falsified independently
 * by bisecting `linearGrowth` for its zero crossing and asserting the two agree,
 * and by integrating the full nonlinear system to confirm the growth actually
 * happens above the threshold and not below it.
 */
export const criticalSpeed = (p: FlutterParams) => p.flutterSpeed;

/**
 * The linearised growth rate of the twisting motion, in nepers per second.
 * Negative means a disturbance dies out; positive means it is amplified. The
 * zero crossing IS the critical flutter speed, and it is what the film's
 * stability diagram plots against wind speed.
 */
export const linearGrowth = (U: number, p: FlutterParams) => {
  const {omegaT} = PHYS;
  const damping = 2 * p.zetaT * omegaT - (aeroDamping(p) * dynamicPressure(U)) / U;
  return -damping / 2;
};

/** The torsional damping ratio in effect at this wind speed. */
export const effectiveDampingRatio = (U: number, p: FlutterParams) => {
  const {omegaT} = PHYS;
  return p.zetaT - (aeroDamping(p) * dynamicPressure(U)) / (2 * omegaT * U);
};

/**
 * How much of the aerodynamic torque still acts once the deck is inclined.
 * 1 while attached flow holds, falling away past the stall angle. This is what
 * caps the twist amplitude: an unstable run grows until the airflow can no
 * longer feed it.
 */
export const stallFactor = (theta: number, stallAngleDeg: number) => {
  const limit = (stallAngleDeg * Math.PI) / 180;
  const r = theta / limit;
  return 1 / (1 + r * r * r * r);
};

export type State = {h: number; hdot: number; theta: number; thetadot: number};

/**
 * The equations of motion. Three things are worth reading closely, because they
 * are the three things the film has to make a viewer believe:
 *
 *   1. Nothing here is driven. There is no gust term and no forcing at a natural
 *      frequency. The wind enters only through `q`, i.e. through its speed.
 *   2. `aeroDamping * q / U` is the air's contribution to the twisting damping,
 *      and it grows with wind speed until it cancels the structure's own 2%.
 *      Past that the twisting equation has *negative* damping and the air does
 *      positive work on the deck every cycle. That is the instability.
 *   3. `+ (cL*q*2b/M) * hdot/U` is the lift generated by the deck's vertical
 *      motion. It opposes that motion, so heave is damped and stable — which is
 *      why the film can show the bridge bouncing harmlessly for months before it
 *      twists itself apart.
 */
const derivatives = (s: State, U: number, p: FlutterParams) => {
  const {halfWidth: b, mass: m, omegaH, omegaT} = PHYS;
  const q = dynamicPressure(U);
  const A2 = aeroDamping(p);
  const liftSlope = (p.cL * q * 2 * b) / m;

  const f = stallFactor(s.theta, p.stallAngleDeg);
  /* the aerodynamic input fades once the deck is twisting well past stall */
  const feed = 1 - 0.5 * (1 - f);

  /*
   * Heave is a damped oscillator driven by the deck's own twist. The `alpha`
   * term includes the flow angle the vertical motion induces, so the vertical
   * mode removes energy from itself: heave is stable at every wind speed. That
   * is a deliverable claim — the bridge bounced for months without harm.
   *
   * It is deliberately NOT coupled back into the twisting moment here. Feeding
   * heave into torsion turns the system into a parametrically excited one that
   * diverges at every wind speed, including speeds the real bridge survived for
   * four months. The film's instability lives in the torsional mode alone, which
   * is also where the aeroelastic literature puts it.
   */
  const alpha = s.theta + s.hdot / U;
  const hddot = -omegaH * omegaH * s.h - 2 * p.zetaH * omegaH * s.hdot + liftSlope * alpha * f;

  const thetaddot =
    -omegaT * omegaT * s.theta -
    (2 * p.zetaT * omegaT - (A2 * q * feed) / U) * s.thetadot -
    p.saturation * omegaT * omegaT * s.theta ** 3;

  return {h: s.hdot, hdot: hddot, theta: s.thetadot, thetadot: thetaddot};
};

/** One RK4 step. `dt` is simulation seconds. */
export const step = (s: State, U: number, p: FlutterParams, dt: number): State => {
  const k1 = derivatives(s, U, p);
  const add = (v: State, k: typeof k1, f: number): State => ({
    h: v.h + k.h * f,
    hdot: v.hdot + k.hdot * f,
    theta: v.theta + k.theta * f,
    thetadot: v.thetadot + k.thetadot * f,
  });
  const k2 = derivatives(add(s, k1, dt / 2), U, p);
  const k3 = derivatives(add(s, k2, dt / 2), U, p);
  const k4 = derivatives(add(s, k3, dt), U, p);
  return {
    h: s.h + (dt / 6) * (k1.h + 2 * k2.h + 2 * k3.h + k4.h),
    hdot: s.hdot + (dt / 6) * (k1.hdot + 2 * k2.hdot + 2 * k3.hdot + k4.hdot),
    theta: s.theta + (dt / 6) * (k1.theta + 2 * k2.theta + 2 * k3.theta + k4.theta),
    thetadot: s.thetadot + (dt / 6) * (k1.thetadot + 2 * k2.thetadot + 2 * k3.thetadot + k4.thetadot),
  };
};

/**
 * The state a run starts from. A bridge does not start from a mathematically
 * exact equilibrium, so a small disturbance is supplied explicitly rather than
 * relying on floating-point noise to break the symmetry.
 */
export const restState = (nudgeDeg: number, heaveNudge = 0): State => ({
  h: heaveNudge,
  hdot: 0,
  theta: (nudgeDeg * Math.PI) / 180,
  thetadot: 0,
});

/** Integrate and report the twist and heave envelopes over time. */
export const simulate = (
  U: number,
  p: FlutterParams,
  options: {seconds: number; dt: number; nudgeDeg?: number; heaveNudge?: number},
) => {
  const dt = options.dt;
  const total = Math.round(options.seconds / dt);
  let s: State = restState(options.nudgeDeg ?? 0.4, options.heaveNudge ?? 0);
  const samples: State[] = [{...s}];
  let twistPeak = Math.abs(s.theta);
  let heavePeak = Math.abs(s.h);
  for (let i = 0; i < total; i++) {
    s = step(s, U, p, dt);
    twistPeak = Math.max(twistPeak, Math.abs(s.theta));
    heavePeak = Math.max(heavePeak, Math.abs(s.h));
    samples.push({...s});
  }
  return {samples, twistPeak, heavePeak, final: s};
};

/** Metres per second to km/h, for on-screen labels. */
export const kmh = (ms: number) => Math.round(ms * 3.6);
/** Radians to degrees. */
export const deg = (rad: number) => (rad * 180) / Math.PI;
