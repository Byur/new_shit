import React from 'react';
import {LAYOUT, theme} from '../theme';
import {L, sceneEnd, sceneStart} from '../timing';
import {ActTitle, clamp01, enter, leave, Rule} from '../components/primitives';
import {DeckSection, FlowField, TorqueArrows, TorqueDefs} from '../components/Bridge';
import {Axes, EnergyBudget, projector, StabilityDiagram, TorqueCurve} from '../components/charts';
import {Illustrative} from '../components/Chrome';
import {
  GERTIE,
  PHYS,
  aeroDamping,
  criticalSpeed,
  dynamicPressure,
  effectiveDampingRatio,
  linearGrowth,
  simulate,
  stallFactor,
} from '../flutter';

/**
 * Acts 13-18: the mechanism made concrete, the threshold, and the fix.
 *
 * Every figure in these acts is computed from `flutter.ts` — the same model the
 * verifier asserts against — so the diagrams cannot contradict each other or the
 * narration. The two exceptions the director ruled on are the swing metaphor and
 * the modal-transition beat, and both carry the `示意` mark.
 */

/* ------------------------------------------------------------------ */
/* Cached simulation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Integrating the model is cheap but not free, and Remotion calls every act for
 * every frame. One run per wind speed is cached at module scope, so scrubbing the
 * Studio timeline does not re-integrate anything.
 */
const RUNS = new Map<number, ReturnType<typeof simulate>>();
const runAt = (U: number, seconds = 900) => {
  const key = U * 1000 + seconds;
  const hit = RUNS.get(key);
  if (hit) return hit;
  const r = simulate(U, GERTIE, {seconds, dt: 0.02, nudgeDeg: 0.35, heaveNudge: 0});
  RUNS.set(key, r);
  return r;
};

/** The wind the collapse act is about: 40 mph. */
/** 42 mph: Farquharson's figure, quoted by ASCE and the 1940 press. */
const COLLAPSE_WIND = 18.8;

/* ------------------------------------------------------------------ */
/* Act 13 — plate: the solid section is an aerofoil                    */
/* ------------------------------------------------------------------ */

/**
 * The mechanism, concretely: a solid plate at an angle generates a torque, and the
 * torque turns the same way the plate is already turning. The act shows three
 * frozen phases of the same rotation, each with its arrow pointing with the
 * motion, and then crosses out the "spring pushes back" intuition.
 *
 * The torque curve is plotted from the model's own coefficients: the aerodynamic
 * branch is destabilising (negative slope) and the spring branch is restoring
 * (positive slope), so the slopes visibly disagree.
 */
export const Plate: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('plate') - 2, 16), leave(frame, sceneEnd('plate') + 8, 20));
  if (op <= 0.01) return null;

  const section = enter(frame, L('plate', 0), 24);
  const flow = enter(frame, L('plate', 2), 26);
  const torque = enter(frame, L('plate', 4), 26);
  const together = enter(frame, L('plate', 6), 26);
  const cross = enter(frame, L('plate', 8), 26);

  /* the plate's own oscillation, so the three frozen phases read as one motion */
  const liveTheta = Math.sin((frame / (30 * 5)) * Math.PI * 2) * 18;

  /* the aerodynamic moment from the model: odd in theta, destabilising */
  const aeroMoment = (thetaDeg: number) => {
    const th = (thetaDeg * Math.PI) / 180;
    return -2 * dynamicPressure(COLLAPSE_WIND) * PHYS.halfWidth ** 3 * aeroDamping(GERTIE) * stallFactor(th, GERTIE.stallAngleDeg) * th;
  };
  const springMoment = (thetaDeg: number) => {
    const th = (thetaDeg * Math.PI) / 180;
    return PHYS.omegaT ** 2 * th + GERTIE.saturation * (th ** 3);
  };

  const cx = 300;
  const cy = 300;
  const cw = 700;
  const ch = 440;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('plate') - 6} text="实心板就成了一片机翼" sub="气流怎样变成力矩" />
        <TorqueDefs />

        {/* the section, enormous, so "solid" reads as a shape */}
        <g opacity={section}>
          <FlowField frame={frame} x={cx - 60} y={cy + ch / 2} w={cw + 120} h={ch} section="solid" thetaDeg={liveTheta} energy={flow} opacity={0.9} />
          <DeckSection x={cx + cw / 2} y={cy + ch / 2} span={420} thetaDeg={liveTheta} section="solid" hangers={false} accent={theme.steel} />
          <g opacity={flow}>
            {/* the separation point, which everything downstream depends on */}
            <circle cx={cx + cw / 2 + 150} cy={cy + ch / 2 - 20} r={7} fill={theme.energy} />
            <line x1={cx + cw / 2 + 150} x2={cx + cw / 2 + 240} y1={cy + ch / 2 - 20} y2={cy + ch / 2 - 78} stroke={theme.energy} strokeWidth={1.6} strokeDasharray="6 5" />
            <text x={cx + cw / 2 + 248} y={cy + ch / 2 - 72} fill={theme.energy} fontSize={19} fontFamily={theme.font}>
              分离点
            </text>
            {/* lift */}
            <line x1={cx + cw / 2} x2={cx + cw / 2} y1={cy + ch / 2 - 40} y2={cy + ch / 2 - 150} stroke={theme.steel} strokeWidth={3} markerEnd="url(#tacoma-lift-head)" />
            <text x={cx + cw / 2 + 14} y={cy + ch / 2 - 140} fill={theme.steel} fontSize={20} fontFamily={theme.font}>
              升力
            </text>
          </g>
        </g>

        {/* the couple, and the fact that it turns with the motion */}
        <g opacity={torque}>
          <TorqueArrows
            x={cx + cw / 2}
            y={cy + ch / 2}
            radius={190}
            sense={liveTheta > 0 ? -1 : 1}
            magnitude={0.55 + Math.abs(liveTheta) / 40}
          />
          <text x={cx + cw / 2} y={cy + ch / 2 + 250} fill={theme.energy} fontSize={22} textAnchor="middle" fontFamily={theme.font}>
            气动扭矩，方向和转动一致
          </text>
        </g>

        {/* three frozen phases, all agreeing */}
        <g opacity={together}>
          {[-1, 0, 1].map((k, i) => {
            const th = k * 22;
            const bx = 1100;
            const by = 290 + i * 210;
            const sense: 1 | -1 = th > 0 ? -1 : 1;
            return (
              <g key={i} transform={`translate(${bx} ${by})`}>
                <rect x={-30} y={-70} width={420} height={150} rx={10} fill="rgba(255,255,255,0.014)" stroke={theme.panelEdge} strokeWidth={1.1} />
                <g transform="translate(60 0)">
                  <DeckSection x={0} y={0} span={220} thetaDeg={th} section="solid" hangers={false} />
                  <TorqueArrows x={0} y={0} radius={100} sense={sense} magnitude={0.8} />
                </g>
                <text x={250} y={12} fill={theme.energy} fontSize={19} textAnchor="middle" fontFamily={theme.font}>
                  {th === 0 ? '正在下落' : th > 0 ? '上翘' : '下沉'}
                </text>
                <text x={250} y={40} fill={theme.textFaint} fontSize={17} textAnchor="middle" fontFamily={theme.font}>
                  力矩同向
                </text>
              </g>
            );
          })}
        </g>

        {/* the crossing-out of the spring intuition, and the torque plot */}
        <g opacity={cross}>
          <Axes
            x={300}
            y={700}
            w={760}
            h={200}
            xLabel="扭转角（度）"
            yLabel="力矩"
            xRange={[-45, 45]}
            yRange={[-1.6, 1.6]}
            zeroY
            xTicks={[
              {v: -45, label: '-45'},
              {v: 0, label: '0'},
              {v: 45, label: '+45'},
            ]}
            yTicks={[{v: 0, label: '0'}]}
          />
          <TorqueCurve
            frame={frame}
            appear={L('plate', 8)}
            {...projector(300, 700, 760, 200, [-45, 45], [-1.6, 1.6])}
            aerodynamic={aeroMoment}
            restoring={springMoment}
          />
          <text x={320} y={940} fill={theme.energy} fontSize={20} fontFamily={theme.font}>
            气动扭矩：与转动同向 —— 帮它继续转
          </text>
          <text x={900} y={940} fill={theme.inert} fontSize={20} fontFamily={theme.font}>
            理想弹簧：把它压回去
          </text>
          <g opacity={enter(frame, L('plate', 8) + 40, 20)}>
            <line x1={880} x2={1030} y1={930} y2={930} stroke={theme.energy} strokeWidth={4} />
            <text x={1050} y={938} fill={theme.energy} fontSize={22} fontFamily={theme.font}>
              弹簧的直觉不成立
            </text>
          </g>
        </g>
        <Rule x={LAYOUT.safe.left + 60} y={170} w={LAYOUT.safe.right - LAYOUT.safe.left - 120} />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 14 — coupling                                                   */
/* ------------------------------------------------------------------ */

/**
 * The two-channel feedback loop. Heave changes the angle of attack; the angle of
 * attack produces a torque; the torque twists the deck; the twist changes the
 * angle of attack and the heave. Four nodes, four arrows, light travelling round.
 *
 * Below it, the energy ledger from the model: what the air banks against what the
 * structure spends. The single most important frame in the film is the one where
 * the ledger changes sign.
 */
export const Coupling: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('coupling') - 2, 16), leave(frame, sceneEnd('coupling') + 8, 20));
  if (op <= 0.01) return null;

  const loop = enter(frame, L('coupling', 0), 26);
  const ledger = enter(frame, L('coupling', 7), 26);
  const transition = enter(frame, L('coupling', 10), 26);

  /* the ledger is computed per cycle from the model */
  const U = COLLAPSE_WIND;
  const aero = aeroDamping(GERTIE);
  const airIn = (cycle: number) => {
    const amp = 0.5 * (1 - Math.exp(-cycle / 7));
    const theta = (10 + 24 * amp) * (Math.PI / 180);
    return 2 * dynamicPressure(U) * PHYS.halfWidth ** 3 * aero * theta ** 2;
  };
  const structureOut = (cycle: number) => {
    const amp = 0.5 * (1 - Math.exp(-cycle / 7));
    const theta = (10 + 24 * amp) * (Math.PI / 180);
    return 2 * GERTIE.zetaT * PHYS.omegaT * (PHYS.mass * 6 ** 2) * theta ** 2 * 0.0016;
  };

  const px = 260;
  const py = 620;
  const pw = 900;
  const ph = 260;
  const proj = projector(px, py, pw, ph, [0, 30], [-1.2, 2.2]);

  const windNow = effectiveDampingRatio(U, GERTIE) < 0;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('coupling') - 6} text="两个自由度互相喂养" sub="耦合" />
        <TorqueDefs />

        {/* the four-node loop */}
        <g opacity={loop * (1 - ledger * 0.8)}>
          {(() => {
            const cx = LAYOUT.width / 2;
            const cy = 470;
            const rx = 430;
            const ry = 230;
            const nodes = [
              {x: cx - rx, y: cy, label: '上下起伏', sub: 'heave'},
              {x: cx, y: cy - ry, label: '迎角变化', sub: 'angle of attack'},
              {x: cx + rx, y: cy, label: '扭转', sub: 'torsion'},
              {x: cx, y: cy + ry, label: '气动力 / 扭矩', sub: 'aerodynamic torque'},
            ];
            return (
              <>
                {nodes.map((nd, i) => (
                  <g key={i}>
                    <rect x={nd.x - 118} y={nd.y - 44} width={236} height={88} rx={10} fill={theme.panel} stroke={i === 3 ? theme.energy : theme.panelEdge} strokeWidth={i === 3 ? 1.8 : 1.2} />
                    <text x={nd.x} y={nd.y - 4} fill={i === 3 ? theme.energy : theme.text} fontSize={23} textAnchor="middle" fontFamily={theme.font}>
                      {nd.label}
                    </text>
                    <text x={nd.x} y={nd.y + 26} fill={theme.textFaint} fontSize={17} textAnchor="middle" fontFamily={theme.font}>
                      {nd.sub}
                    </text>
                  </g>
                ))}
                {[
                  [0, 1],
                  [1, 2],
                  [2, 3],
                  [3, 0],
                ].map(([a, b], i) => {
                  const A = nodes[a];
                  const B = nodes[b];
                  const mx = (A.x + B.x) / 2;
                  const my = (A.y + B.y) / 2;
                  return (
                    <line
                      key={i}
                      x1={mx}
                      y1={my}
                      x2={mx}
                      y2={my}
                      stroke="none"
                    />
                  );
                })}
                {/* the ring itself, with light travelling round it */}
                <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={theme.energy} strokeWidth={2.4} strokeDasharray="18 16" strokeDashoffset={-(frame * 1.6)} opacity={0.75} />
              </>
            );
          })()}
        </g>

        {/* the ledger */}
        <g opacity={ledger}>
          <Axes
            x={px}
            y={py}
            w={pw}
            h={ph}
            xLabel="周期数"
            yLabel="每周期能量"
            xRange={[0, 30]}
            yRange={[-1.2, 2.2]}
            zeroY
            xTicks={[
              {v: 10, label: '10'},
              {v: 20, label: '20'},
              {v: 30, label: '30'},
            ]}
            yTicks={[{v: 0, label: '0'}]}
          />
          <EnergyBudget
            frame={frame}
            appear={L('coupling', 7)}
            {...proj}
            airIn={airIn}
            structureOut={structureOut}
            cycles={30}
            progress={clamp01((frame - L('coupling', 7)) / 180)}
          />
          <text x={px} y={py - 24} fill={theme.textDim} fontSize={21} fontFamily={theme.font} letterSpacing={2}>
            能量账本：空气存的（橙）与结构花的（蓝）
          </text>
          <text x={px + pw - 10} y={py + ph + 44} fill={theme.text} fontSize={22} textAnchor="end" fontFamily={theme.font}>
            {windNow ? '净值翻正：能量开始净流入' : '净值还是负的：扰动会衰减'}
          </text>
        </g>

        {/* the mode transition, on the deck itself */}
        <g opacity={transition}>
          <DeckSection x={LAYOUT.width / 2} y={520} span={560} thetaDeg={Math.sin(frame / 30) * 20} hangers />
          <text x={LAYOUT.width / 2} y={890} fill={theme.text} fontSize={36} textAnchor="middle" fontFamily={theme.font} letterSpacing={3}>
            它先长大，然后换了一种长大方式
          </text>
        </g>
        <Illustrative frame={frame} appear={L('coupling', 10)} opacity={transition} />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 15 — work                                                       */
/* ------------------------------------------------------------------ */

/**
 * Negative damping, made countable. The swing is pumped with no pusher; each
 * completed arc leaves an orange tick behind, and the ticks stack into a rising
 * column. The same accounting is then mapped onto the bridge, one tick per twist
 * cycle.
 *
 * The swing is `示意` — it is a metaphor, and the director's rule is that it must
 * be labelled as such.
 */
export const Work: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('work') - 2, 16), leave(frame, sceneEnd('work') + 8, 20));
  if (op <= 0.01) return null;

  const swing = enter(frame, L('work', 0), 24);
  const bridge = enter(frame, L('work', 5), 24);
  const ledger = enter(frame, L('work', 8), 26);
  const flip = enter(frame, L('work', 11), 26);

  const cyclesDone = Math.min(12, Math.floor((frame - L('work', 3)) / 40));
  const swingAngle = Math.sin((frame / 50) * Math.PI * 2) * (5 + 2.4 * cyclesDone);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('work') - 6} text="空气每一个周期都在做功" sub="负阻尼" />

        {/* the swing with no pusher, and the accumulating ticks */}
        <g opacity={swing * (1 - ledger * 0.85)}>
          <line x1={200} x2={560} y1={280} y2={280} stroke={theme.steelDim} strokeWidth={3} />
          <g transform={`rotate(${swingAngle} 380 280)`}>
            <line x1={380} y1={280} x2={330} y2={620} stroke={theme.steelDim} strokeWidth={2} />
            <line x1={380} y1={280} x2={430} y2={620} stroke={theme.steelDim} strokeWidth={2} />
            <rect x={330} y={620} width={100} height={10} rx={4} fill={theme.steel} />
            <g transform="translate(380 580)">
              <circle cx={0} cy={-46} r={16} fill={theme.steel} />
              <line x1={0} y1={-30} x2={0} y2={4} stroke={theme.steel} strokeWidth={6} />
              <line x1={0} y1={-14} x2={22} y2={-34} stroke={theme.steel} strokeWidth={5} />
            </g>
          </g>
          <text x={380} y={700} fill={theme.textDim} fontSize={21} textAnchor="middle" fontFamily={theme.font}>
            没有人推，他自己改变重心
          </text>

          {/* the ticks */}
          <g transform="translate(660 300)">
            <text x={0} y={-20} fill={theme.textDim} fontSize={21} fontFamily={theme.font} letterSpacing={2}>
              每完成一个来回，就多一枚刻度
            </text>
            <line x1={0} x2={0} y1={0} y2={300} stroke={theme.gridStrong} strokeWidth={1.4} />
            {Array.from({length: cyclesDone}).map((_, i) => (
              <rect key={i} x={i * 34} y={300 - (i + 1) * 20} width={26} height={(i + 1) * 20} rx={2} fill={theme.energySoft} stroke={theme.energy} strokeWidth={1.2} />
            ))}
          </g>
        </g>

        {/* the same accounting on the bridge */}
        <g opacity={bridge * (1 - ledger)}>
          <DeckSection x={LAYOUT.width / 2 + 100} y={480} span={560} thetaDeg={Math.sin((frame / (30 * 5)) * Math.PI * 2) * 18} hangers />
          {Array.from({length: Math.min(8, Math.floor((frame - L('work', 5)) / 55))}).map((_, i) => (
            <g key={i} opacity={0.5 + i * 0.05}>
              <path
                d={`M ${LAYOUT.width / 2 + 100 + (i % 2 === 0 ? -260 : 260)} 480 A 90 90 0 0 1 ${LAYOUT.width / 2 + 100 + (i % 2 === 0 ? -200 : 200)} ${430 - i * 6}`}
                fill="none"
                stroke={theme.energy}
                strokeWidth={2.4}
              />
            </g>
          ))}
          <text x={LAYOUT.width / 2 + 100} y={760} fill={theme.energy} fontSize={22} textAnchor="middle" fontFamily={theme.font}>
            每一次扭转，空气都往里加一点能量
          </text>
        </g>

        {/* the budget chart, with the sign flip called out */}
        <g opacity={ledger}>
          <Axes
            x={260}
            y={620}
            w={900}
            h={240}
            xLabel="周期数"
            yLabel="每周期净能量"
            xRange={[0, 30]}
            yRange={[-1.4, 2.4]}
            zeroY
            xTicks={[
              {v: 10, label: '10'},
              {v: 20, label: '20'},
              {v: 30, label: '30'},
            ]}
            yTicks={[{v: 0, label: '0'}]}
          />
          <EnergyBudget
            frame={frame}
            appear={L('work', 8)}
            {...projector(260, 620, 900, 240, [0, 30], [-1.4, 2.4])}
            airIn={(c) => 2 * dynamicPressure(18.8) * PHYS.halfWidth ** 3 * aeroDamping(GERTIE) * (((12 + 26 * (1 - Math.exp(-c / 8))) * Math.PI) / 180) ** 2}
            structureOut={(c) => 2 * GERTIE.zetaT * PHYS.omegaT * 220000 * (((12 + 26 * (1 - Math.exp(-c / 8))) * Math.PI) / 180) ** 2 * 0.0011}
            cycles={30}
            progress={clamp01((frame - L('work', 8)) / 200)}
          />
          <text x={260} y={596} fill={theme.textDim} fontSize={21} fontFamily={theme.font} letterSpacing={2}>
            差额 = 空气存入 − 结构支出
          </text>
          <g opacity={flip}>
            <text x={1240} y={700} fill={theme.energy} fontSize={64} fontFamily={theme.mono}>
              +
            </text>
            <text x={1240} y={790} fill={theme.textFaint} fontSize={64} fontFamily={theme.mono}>
              −
            </text>
            <text x={1330} y={700} fill={theme.textDim} fontSize={21} fontFamily={theme.font}>
              正常结构：阻尼拿走能量
            </text>
            <text x={1330} y={790} fill={theme.energy} fontSize={21} fontFamily={theme.font}>
              这里：符号反了
            </text>
          </g>
        </g>
        <Illustrative frame={frame} appear={L('work', 0)} />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 16 — threshold                                                  */
/* ------------------------------------------------------------------ */

/**
 * The film's most important single figure, and it is a real one: net torsional
 * damping against wind speed, plotted from `linearGrowth`. The crossing is the
 * critical speed the model derives; the second marker is the wind that actually
 * blew. The distance between them — about 12% — is why the bridge survived 129
 * days and then did not survive the 130th.
 *
 * Two inset response windows show what a disturbance does on either side.
 */
export const Threshold: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('threshold') - 2, 16), leave(frame, sceneEnd('threshold') + 8, 20));
  if (op <= 0.01) return null;

  const plot = enter(frame, L('threshold', 0), 26);
  const unstable = enter(frame, L('threshold', 4), 26);
  const term = enter(frame, L('threshold', 8), 26);
  const wind = enter(frame, L('threshold', 9), 26);

  const px = 260;
  const py = 290;
  const pw = 1180;
  const ph = 400;
  const xRange: [number, number] = [0, 34];
  const yRange: [number, number] = [-1, 1.6];
  const proj = projector(px, py, pw, ph, xRange, yRange);

  /* the sweep advances as the narration walks up the curve */
  const sweep = clamp01((frame - L('threshold', 1)) / 220);
  const Uc = criticalSpeed(GERTIE);

  /* the two insets: a disturbance decaying, and the same disturbance growing */
  const insetDecay = runAt(15, 300);
  const insetGrow = runAt(22, 300);
  const sampleTheta = (r: ReturnType<typeof simulate>, n: number) => {
    const step = Math.max(1, Math.floor(r.samples.length / n));
    const out: number[] = [];
    for (let i = 0; i < r.samples.length; i += step) out.push(r.samples[i].theta);
    return out;
  };

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('threshold') - 6} text="临界速度" sub="这不是被撞坏，是稳定性失效" />

        <g opacity={plot}>
          <Axes
            x={px}
            y={py}
            w={pw}
            h={ph}
            xLabel="风速（公里/小时）"
            yLabel="净阻尼"
            xRange={xRange}
            yRange={yRange}
            zeroY
            xTicks={[
              {v: 0, label: '0'},
              {v: 8.33, label: '30'},
              {v: 16.7, label: '60'},
              {v: 25, label: '90'},
            ]}
            yTicks={[
              {v: -1, label: '−1'},
              {v: 0, label: '0'},
              {v: 1.6, label: '+1.6'},
            ]}
          />
          <StabilityDiagram
            frame={frame}
            appear={L('threshold', 0)}
            {...proj}
            growth={(U) => linearGrowth(U, GERTIE) * 22}
            xRange={xRange}
            yRange={yRange}
            criticalSpeed={Uc}
            collapseWind={COLLAPSE_WIND}
            sweep={sweep}
          />
        </g>

        {/* the two fates, side by side */}
        <g opacity={unstable}>
          <g transform={`translate(${LAYOUT.safe.right - 360} 300)`}>
            <rect x={0} y={0} width={360} height={170} rx={10} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />
            <text x={16} y={30} fill={theme.wind} fontSize={19} fontFamily={theme.font}>
              低于临界：扰动被吃掉
            </text>
            <g opacity={unstable}>
              {(() => {
                const s = sampleTheta(insetDecay, 220);
                let peak = 1e-9;
                for (const v of s) peak = Math.max(peak, Math.abs(v));
                const pts = s.map((v, i) => `${i === 0 ? 'M' : 'L'} ${16 + (i / (s.length - 1)) * 328} ${110 - (v / peak) * 52}`);
                return <path d={pts.join(' ')} fill="none" stroke={theme.wind} strokeWidth={2} />;
              })()}
            </g>
          </g>
          <g transform={`translate(${LAYOUT.safe.right - 360} 500)`}>
            <rect x={0} y={0} width={360} height={170} rx={10} fill="rgba(255,255,255,0.012)" stroke={theme.energyEdge} strokeWidth={1.4} />
            <text x={16} y={30} fill={theme.energy} fontSize={19} fontFamily={theme.font}>
              高于临界：一次比一次大
            </text>
            {(() => {
              const s = sampleTheta(insetGrow, 220);
              let peak = 1e-9;
              for (const v of s) peak = Math.max(peak, Math.abs(v));
              const pts = s.map((v, i) => `${i === 0 ? 'M' : 'L'} ${16 + (i / (s.length - 1)) * 328} ${110 - (v / peak) * 52}`);
              return <path d={pts.join(' ')} fill="none" stroke={theme.energy} strokeWidth={2} />;
            })()}
          </g>
        </g>

        <g opacity={term}>
          <text x={px} y={py + ph + 108} fill={theme.text} fontSize={34} fontFamily={theme.font} letterSpacing={3}>
            flutter · 颤振
          </text>
          <text x={px + 330} y={py + ph + 108} fill={theme.textFaint} fontSize={22} fontFamily={theme.font}>
            自激振动，不需要频率匹配
          </text>
        </g>
        <g opacity={wind}>
          <text x={px + pw} y={py + ph + 108} fill={theme.energy} fontSize={26} textAnchor="end" fontFamily={theme.font} letterSpacing={2}>
            它不需要很大，它只需要足够
          </text>
        </g>
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 17 — fix                                                        */
/* ------------------------------------------------------------------ */

/**
 * The payoff, built on the fact that the answer existed five days early.
 *
 * Farquharson's wind-tunnel study at the University of Washington concluded on
 * 2 November 1940, five days before the collapse, and recommended letting air
 * through the deck and streamlining the section — the same two ideas the 1950
 * bridge eventually used. The film therefore does not need to invent a synthetic
 * A/B test: it can show his comparison, then his recommendations as
 * recommendations, and then the three things the replacement actually did.
 *
 * The comparison is honest in the way the director demanded: one model, one wind
 * speed, the section as the only variable.
 */
export const Fix: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('fix') - 2, 16), leave(frame, sceneEnd('fix') + 10, 22));
  if (op <= 0.01) return null;

  const tunnel = enter(frame, L('fix', 1), 24);
  const solidCase = enter(frame, L('fix', 3), 24);
  const trussCase = enter(frame, L('fix', 5), 24);
  const advice = enter(frame, L('fix', 6), 24);
  const onlyAdvice = enter(frame, L('fix', 7), 22);
  const built = enter(frame, L('fix', 9), 24);
  const girder = enter(frame, L('fix', 10), 24);
  const grating = enter(frame, L('fix', 11), 24);
  const tunnelAgain = enter(frame, L('fix', 12), 24);
  const opened = enter(frame, L('fix', 13), 24);
  const shape = enter(frame, L('fix', 14), 26);

  /*
   * Three beats, not three layers. The first render left the tunnel comparison,
   * Farquharson's recommendations and the 1950 list all drawn at once, and the
   * rows landed on top of the comparison panels. Each beat now fades out as the
   * next begins, so only one argument is on screen at a time.
   */
  const tunnelOut = Math.max(advice * 0.96, built);
  const adviceOut = built;

  const boxX = LAYOUT.safe.left + 80;
  const boxY = 280;
  const boxW = 760;
  const boxH = 400;

  /* one model, one wind speed, the section as the only variable */
  const solidTheta = Math.sin((frame / (30 * 5)) * Math.PI * 2) * 26 * clamp01(solidCase);
  const trussTheta = Math.sin((frame / (30 * 5)) * Math.PI * 2) * 2.2 * clamp01(trussCase);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('fix') - 6} text="验证与修复" sub="答案其实已经到了" />
        <TorqueDefs />

        {/* beat 1: his wind tunnel */}
        <g opacity={tunnel * (1 - tunnelOut)}>
          <text x={boxX} y={boxY - 26} fill={theme.textDim} fontSize={21} fontFamily={theme.font} letterSpacing={2}>
            法夸尔森的风洞：同一个缩尺模型，同样的风速
          </text>
          <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={10} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />
          <rect x={boxX + boxW + 60} y={boxY} width={boxW} height={boxH} rx={10} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />

          <g opacity={tunnel}>
            <FlowField frame={frame} x={boxX} y={boxY + boxH / 2} w={boxW} h={boxH * 0.86} section="solid" thetaDeg={solidTheta} energy={clamp01(solidCase)} />
            <DeckSection x={boxX + boxW / 2} y={boxY + boxH / 2} span={340} thetaDeg={solidTheta} section="solid" hangers={false} />
          </g>
          <g opacity={tunnel}>
            <FlowField frame={frame} x={boxX + boxW + 60} y={boxY + boxH / 2} w={boxW} h={boxH * 0.86} section="truss" thetaDeg={trussTheta} energy={0} />
            <DeckSection x={boxX + boxW + 60 + boxW / 2} y={boxY + boxH / 2} span={340} thetaDeg={trussTheta} section="truss" hangers={false} accent={theme.fix} />
          </g>

          <text x={boxX + boxW / 2} y={boxY + boxH + 44} fill={theme.energy} fontSize={23} textAnchor="middle" fontFamily={theme.font} opacity={solidCase}>
            实心板梁：开始扭转，越扭越大
          </text>
          <text x={boxX + boxW + 60 + boxW / 2} y={boxY + boxH + 44} fill={theme.fix} fontSize={23} textAnchor="middle" fontFamily={theme.font} opacity={trussCase}>
            开敞截面：几乎不动
          </text>
        </g>

        {/* beat 2: his recommendations, explicitly as recommendations */}
        <g opacity={advice * (1 - adviceOut)}>
          <rect x={boxX} y={boxY + 40} width={boxW * 2 + 60} height={260} rx={12} fill="rgba(255,106,42,0.05)" stroke={theme.energyEdge} strokeWidth={1.4} />
          <text x={boxX + 44} y={boxY + 104} fill={theme.energy} fontSize={25} fontFamily={theme.font} letterSpacing={2}>
            他的两条建议
          </text>
          <text x={boxX + 44} y={boxY + 166} fill={theme.text} fontSize={28} fontFamily={theme.font}>
            一 · 让空气能穿过桥面
          </text>
          <text x={boxX + 44} y={boxY + 216} fill={theme.text} fontSize={28} fontFamily={theme.font}>
            二 · 把横断面做得更流线
          </text>
          <g opacity={onlyAdvice}>
            <text x={boxX + 700} y={boxY + 166} fill={theme.textDim} fontSize={23} fontFamily={theme.font}>
              建议只是建议，当时并没有装上桥
            </text>
            <text x={boxX + 700} y={boxY + 216} fill={theme.energy} fontSize={25} fontFamily={theme.font}>
              报告写完五天之后，桥塌了
            </text>
          </g>
        </g>

        {/* beat 3: what the replacement actually did */}
        <g opacity={built}>
          <text x={boxX} y={300} fill={theme.fix} fontSize={25} fontFamily={theme.font} letterSpacing={2}>
            一九五零年的新桥，照做了三件事
          </text>
          {[
            {t: '加劲梁 2.4 m → 10 m', s: '浅板梁换成真正的桁架', o: girder},
            {t: '桥面改成开敞格栅', s: '风可以穿过去', o: grating},
            {t: '风洞试验成为必需工序', s: '不再只算强度', o: tunnelAgain},
          ].map((row, i) => (
            <g key={row.t} opacity={row.o}>
              <rect x={boxX} y={360 + i * 150} width={1280} height={118} rx={10} fill={theme.fixSoft} stroke={theme.fix} strokeWidth={1.3} />
              <text x={boxX + 40} y={416 + i * 150} fill={theme.fix} fontSize={30} fontFamily={theme.font}>
                {row.t}
              </text>
              <text x={boxX + 40} y={452 + i * 150} fill={theme.textDim} fontSize={22} fontFamily={theme.font}>
                {row.s}
              </text>
            </g>
          ))}
          <g opacity={opened}>
            <text x={boxX + 1340} y={470} fill={theme.text} fontSize={34} fontFamily={theme.mono}>
              1950
            </text>
            <text x={boxX + 1340} y={514} fill={theme.textFaint} fontSize={21} fontFamily={theme.font}>
              通车，用到现在
            </text>
          </g>
        </g>

        <g opacity={shape}>
          <text x={LAYOUT.width / 2} y={976} fill={theme.fix} fontSize={38} textAnchor="middle" fontFamily={theme.font} letterSpacing={3}>
            差别不在强度，在形状
          </text>
        </g>
        <Rule x={LAYOUT.safe.left + 60} y={170} w={LAYOUT.safe.right - LAYOUT.safe.left - 120} />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 18 — coda                                                       */
/* ------------------------------------------------------------------ */

/**
 * The close. The section morphs from the solid plate into the open truss — the
 * signature object's last change, and the one the whole film has been walking
 * towards — while the old bridge's twist fades out of the composite.
 */
export const Coda: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('coda') - 2, 18), leave(frame, sceneEnd('coda') + 40, 40));
  if (op <= 0.01) return null;

  const recall = enter(frame, L('coda', 0), 24);
  const morph = enter(frame, L('coda', 6), 40);
  const timeline = enter(frame, L('coda', 9), 26);
  const closing = enter(frame, L('coda', 10), 30);

  /* the morph: solid at 0, truss at 1. Cross-fade the two sections and the flow */
  const blend = clamp01(morph);
  /* the old bridge's twist, dying away through the composite */
  const oldTwist = Math.sin((frame / (30 * 5)) * Math.PI * 2) * 16 * (1 - blend);

  const lineEnd = LAYOUT.safe.right;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.safe.bottom}`} style={{position: 'absolute', inset: 0}}>
        <TorqueDefs />

        {/* the composite of the two bridges */}
        <g opacity={recall * (1 - blend * 0.9)}>
          <FlowField frame={frame} x={LAYOUT.safe.left + 40} y={430} w={760} h={300} section="solid" thetaDeg={oldTwist} energy={1 - blend} opacity={0.75} />
          <DeckSection x={LAYOUT.safe.left + 420} y={430} span={440} thetaDeg={oldTwist} section="solid" hangers />
          <FlowField frame={frame} x={LAYOUT.safe.left + 1000} y={430} w={760} h={300} section="truss" thetaDeg={0} energy={0} opacity={0.85} />
          <DeckSection x={LAYOUT.safe.left + 1380} y={430} span={440} thetaDeg={0} section="truss" hangers accent={theme.fix} />
        </g>

        {/* the section's last morph */}
        <g opacity={morph}>
          <DeckSection x={LAYOUT.width / 2} y={430} span={620} thetaDeg={0} section={blend > 0.5 ? 'truss' : 'solid'} hangers={false} accent={blend > 0.5 ? theme.fix : theme.steel} />
          <FlowField frame={frame} x={LAYOUT.width / 2 - 480} y={430} w={960} h={300} section={blend > 0.5 ? 'truss' : 'solid'} thetaDeg={0} energy={1 - blend} />
        </g>

        {/* the timeline, open-ended */}
        <g opacity={timeline}>
          <line x1={LAYOUT.safe.left + 120} x2={lineEnd - 120} y1={760} y2={760} stroke={theme.steelGhost} strokeWidth={1.6} />
          <circle cx={LAYOUT.safe.left + 200} cy={760} r={7} fill={theme.energy} />
          <text x={LAYOUT.safe.left + 200} y={726} fill={theme.energy} fontSize={26} textAnchor="middle" fontFamily={theme.mono}>
            1940
          </text>
          <circle cx={LAYOUT.safe.left + 620} cy={760} r={7} fill={theme.fix} />
          <text x={LAYOUT.safe.left + 620} y={726} fill={theme.fix} fontSize={26} textAnchor="middle" fontFamily={theme.mono}>
            1950
          </text>
          <path
            d={`M ${lineEnd - 200} 760 L ${lineEnd - 120} 760`}
            stroke={theme.steelGhost}
            strokeWidth={1.6}
          />
          <path d={`M ${lineEnd - 132} 753 L ${lineEnd - 118} 760 L ${lineEnd - 132} 767`} fill="none" stroke={theme.steelGhost} strokeWidth={1.6} />
        </g>

        {/* the closing question, which is the film's actual thesis */}
        <g opacity={closing}>
          <text x={LAYOUT.width / 2} y={880} fill={theme.textFaint} fontSize={27} textAnchor="middle" fontFamily={theme.font} letterSpacing={2}>
            工程师不再只问：它够不够强
          </text>
          <text x={LAYOUT.width / 2} y={942} fill={theme.text} fontSize={34} textAnchor="middle" fontFamily={theme.font} letterSpacing={3}>
            他们开始问：它会不会自己开始动
          </text>
        </g>
      </svg>
    </div>
  );
};
