import React from 'react';
import {LAYOUT, theme} from '../theme';
import {L, LE, sceneEnd, sceneStart} from '../timing';
import {ActTitle, clamp01, enter, leave, Readout, Rule, ThresholdLine} from '../components/primitives';
import {BridgeElevation, DeckSection, FlowField, TorqueDefs} from '../components/Bridge';
import {Axes, projector, SpectrumBand} from '../components/charts';
import {Illustrative} from '../components/Chrome';

/**
 * Acts 6-12: the two wrong answers, and the mechanism that replaces them.
 *
 * This is the film's intellectual centre. The director's structural demand is that
 * the resonance account is built up as *credible* and then demolished with real
 * evidence, not waved away — so the swing metaphor is drawn sincerely, the
 * broadband spectrum is the thing that kills it, and the dissipation of the idea
 * is a visible event on screen.
 */

/* ------------------------------------------------------------------ */
/* Act 6 — storm: the first wrong answer                               */
/* ------------------------------------------------------------------ */

/**
 * The "it was a hurricane" hypothesis, executed quickly. The evidence is a pair
 * of stacked panels sharing one time cursor: the top shows a wind record that is
 * nearly flat, the bottom an amplitude record that climbs. The slopes disagree,
 * and that disagreement is the entire argument.
 *
 * Both panels are marked `示意` because they idealise the 1940 records rather than
 * reproduce digitised measurements.
 */
export const Storm: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('storm') - 2, 16), leave(frame, sceneEnd('storm') + 8, 20));
  if (op <= 0.01) return null;

  const hurricane = enter(frame, L('storm', 0), 20) * (1 - enter(frame, L('storm', 2), 22));
  const panels = enter(frame, L('storm', 2), 26);
  const cursor = clamp01((frame - L('storm', 5)) / Math.max(1, LE('storm', 7) - L('storm', 5)));

  const px = 300;
  const pw = 1220;
  const topY = 250;
  const topH = 190;
  const botY = 520;
  const botH = 230;

  /* the cursor sweeps left to right as the narration builds the case */
  const cx = px + pw * cursor;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('storm') - 6} text="第一个误解" sub="是不是风太大了" />
        <TorqueDefs />

        {/* the hurricane imagery, briefly and abstractly */}
        <g opacity={hurricane}>
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M ${300 + i * 340} 900 C ${380 + i * 340} 800, ${220 + i * 340} 760, ${300 + i * 340} 660 C ${380 + i * 340} 560, ${220 + i * 340} 520, ${300 + i * 340} 440`}
              fill="none"
              stroke={theme.textGhost}
              strokeWidth={2.4}
            />
          ))}
          <text x={LAYOUT.width / 2} y={980} fill={theme.textGhost} fontSize={30} textAnchor="middle" fontFamily={theme.font} letterSpacing={4}>
            飓风？极端天气？
          </text>
        </g>

        <g opacity={panels}>
          {/* top: the wind record. Deliberately left uncoloured: the wind was not the drama */}
          <text x={px} y={topY - 22} fill={theme.textDim} fontSize={21} fontFamily={theme.font} letterSpacing={2}>
            当天的风速记录
          </text>
          <rect x={px} y={topY} width={pw} height={topH} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />
          <path
            d={(() => {
              const pts: string[] = [];
              for (let i = 0; i <= 120; i++) {
                const u = i / 120;
                const v = 0.52 + Math.sin(u * 9) * 0.05 + Math.sin(u * 31) * 0.03;
                pts.push(`${i === 0 ? 'M' : 'L'} ${px + u * pw} ${topY + topH - v * topH}`);
              }
              return pts.join(' ');
            })()}
            fill="none"
            stroke={theme.wind}
            strokeWidth={2.6}
          />
          <ThresholdLine x1={px} x2={px + pw} y={topY + topH * 0.24} label="极端天气的量级" color={theme.textGhost} labelAbove={false} />
          <text x={px + pw - 12} y={topY + 34} fill={theme.wind} fontSize={23} textAnchor="end" fontFamily={theme.mono}>
            64 km/h
          </text>
          <text x={px + 14} y={topY + 34} fill={theme.textFaint} fontSize={19} fontFamily={theme.font}>
            风几乎没变
          </text>

          {/* bottom: the amplitude record, which climbs anyway */}
          <text x={px} y={botY - 22} fill={theme.textDim} fontSize={21} fontFamily={theme.font} letterSpacing={2}>
            桥的振幅记录
          </text>
          <rect x={px} y={botY} width={pw} height={botH} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />
          {(() => {
            const pts: string[] = [];
            for (let i = 0; i <= 90; i++) {
              const u = i / 90;
              const a = (0.06 + u * u * 0.94) * Math.abs(Math.sin(u * u * 26));
              pts.push(`${i === 0 ? 'M' : 'L'} ${px + u * pw} ${botY + botH - a * botH * 0.9}`);
            }
            return <path d={pts.join(' ')} fill="none" stroke={theme.energy} strokeWidth={2.4} />;
          })()}
          <text x={px + 14} y={botY + 34} fill={theme.energy} fontSize={19} fontFamily={theme.font}>
            振幅自己在涨
          </text>

          {/* one cursor through both panels: the two records are the same morning */}
          <line x1={cx} x2={cx} y1={topY} y2={botY + botH} stroke={theme.text} strokeWidth={1.6} opacity={0.7} />
          <circle cx={cx} cy={topY} r={4} fill={theme.text} opacity={0.8} />
          <circle cx={cx} cy={botY + botH} r={4} fill={theme.text} opacity={0.8} />
        </g>
        <Illustrative frame={frame} appear={L('storm', 2)} />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 7 — solid: the second wrong answer                              */
/* ------------------------------------------------------------------ */

/**
 * "It wasn't strong enough" is replaced by "strength was the wrong question".
 *
 * Three reinforcement attempts are tried and dismissed in turn — thicker deck,
 * heavier towers, thicker cables — because none of them touches the thing that
 * actually failed. The act ends on the structural comparison the whole film hangs
 * on: air passes through a truss and cannot pass through a solid plate.
 */
export const Solid: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('solid') - 2, 16), leave(frame, sceneEnd('solid') + 8, 20));
  if (op <= 0.01) return null;

  const attempts = enter(frame, L('solid', 1), 22);
  const compare = enter(frame, L('solid', 5), 26);
  const respond = enter(frame, L('solid', 7), 24);
  const fuel = enter(frame, L('solid', 8), 26);

  const fail1 = enter(frame, L('solid', 2), 20);
  const fail2 = enter(frame, L('solid', 3), 20);
  const fail3 = enter(frame, L('solid', 4), 20);

  const gaugeX = LAYOUT.safe.left + 90;
  const gaugeW = 540;
  const flowY = 300;
  const flowH = 380;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('solid') - 6} text="第二个误解" sub="不是被推倒的" />
        <TorqueDefs />

        {/* the three failed reinforcements */}
        <g opacity={attempts * (1 - compare)}>
          {[
            {label: '桥面加厚', ok: fail1},
            {label: '桥塔加粗', ok: fail2},
            {label: '主缆加粗', ok: fail3},
          ].map((a, i) => (
            <g key={a.label} opacity={1 - 0.45 * (a.ok > 0.5 ? 1 : 0)}>
              <rect x={gaugeX} y={250 + i * 108} width={gaugeW} height={82} rx={8} fill={theme.panel} stroke={theme.panelEdge} strokeWidth={1.2} />
              <text x={gaugeX + 24} y={300 + i * 108} fill={theme.textDim} fontSize={22} fontFamily={theme.font}>
                {a.label}
              </text>
              <text x={gaugeX + gaugeW - 24} y={300 + i * 108} fill={theme.energy} fontSize={26} textAnchor="end" fontFamily={theme.font}>
                {a.ok > 0.5 ? '✕ 没用' : '…'}
              </text>
            </g>
          ))}
          <text x={gaugeX} y={600} fill={theme.textDim} fontSize={21} fontFamily={theme.font}>
            塔没倒，主缆没断。是桥面自己动到了散架。
          </text>
        </g>

        {/* the comparison the film is built on, both halves driven by one generator */}
        <g opacity={compare}>
          <text x={gaugeX} y={flowY - 22} fill={theme.textDim} fontSize={21} fontFamily={theme.font} letterSpacing={2}>
            开敞桁架：风穿过去
          </text>
          <rect x={gaugeX} y={flowY} width={620} height={flowH} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />
          <FlowField frame={frame} x={gaugeX} y={flowY + flowH / 2} w={620} h={flowH * 0.9} section="truss" thetaDeg={0} energy={0} />
          <g transform={`translate(${gaugeX + 310} ${flowY + flowH / 2})`}>
            <DeckSection x={0} y={0} span={420} thetaDeg={0} section="truss" hangers={false} />
          </g>

          <text x={gaugeX + 720} y={flowY - 22} fill={theme.energy} fontSize={21} fontFamily={theme.font} letterSpacing={2}>
            实心板梁：风绕不过去
          </text>
          <rect x={gaugeX + 720} y={flowY} width={620} height={flowH} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />
          <FlowField frame={frame} x={gaugeX + 720} y={flowY + flowH / 2} w={620} h={flowH * 0.9} section="solid" thetaDeg={11} energy={fuel} />
          <g transform={`translate(${gaugeX + 1030} ${flowY + flowH / 2})`}>
            <DeckSection x={0} y={0} span={420} thetaDeg={0} section="solid" hangers={false} />
          </g>
        </g>

        <g opacity={respond * (1 - compare)}>
          <Readout x={gaugeX + 700} y={280} label="风推它" value="它不躲" color={theme.text} size={34} />
          <Readout x={gaugeX + 700} y={420} label="而是" value="开始回应" color={theme.energy} size={34} />
        </g>
        <g opacity={fuel}>
          <text x={LAYOUT.width / 2} y={860} fill={theme.energy} fontSize={30} textAnchor="middle" fontFamily={theme.font} letterSpacing={2}>
            一旦开始回应，风就不再是外力，而是燃料
          </text>
        </g>
        <Rule x={LAYOUT.safe.left + 60} y={170} w={LAYOUT.safe.right - LAYOUT.safe.left - 120} />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 8 — two-motions                                                 */
/* ------------------------------------------------------------------ */

/**
 * Heave and torsion as two separate degrees of freedom, then the subtraction that
 * makes the film's point: take away the visible one and the quiet one remains.
 *
 * The director was explicit that the "it started as heaving and became twisting"
 * beat is 1940 historical record, not model output — the model itself has heave
 * constant throughout. Those beats are therefore marked `示意` and drawn as an
 * instruction, not as an integration.
 */
export const TwoMotions: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('two-motions') - 2, 16), leave(frame, sceneEnd('two-motions') + 8, 20));
  if (op <= 0.01) return null;

  const terms = enter(frame, L('two-motions', 2), 24);
  const wave = enter(frame, L('two-motions', 4), 26) * (1 - enter(frame, L('two-motions', 5), 26));
  const twist = enter(frame, L('two-motions', 5), 26) * (1 - enter(frame, L('two-motions', 6), 26));
  const both = enter(frame, L('two-motions', 6), 26) * (1 - enter(frame, L('two-motions', 8), 26));
  const subtract = enter(frame, L('two-motions', 8), 30);

  /* the operating mode drives both the animation and which labels are lit */
  const mode = subtract > 0.5 ? 'twist' : both > 0.5 ? 'both' : twist > 0.5 ? 'twist' : 'wave';
  const heaveWeight = mode === 'wave' ? 1 : mode === 'both' ? 1 : 0;
  const twistWeight = mode === 'twist' ? 1 : mode === 'both' ? 0.22 : 0;

  const t = frame / (30 * 5);
  const heaveY = Math.sin(t * Math.PI * 2) * 34 * heaveWeight;
  const theta = Math.sin(t * Math.PI * 2 + 0.9) * 19 * twistWeight;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('two-motions') - 6} text="两种运动，两本账" sub="heave 与 torsion" />

        <DeckSection x={LAYOUT.width / 2} y={470 + heaveY} span={700} thetaDeg={theta} hangers />

        {/* the heave arrow */}
        <g opacity={wave * (1 - subtract)} transform={`translate(${LAYOUT.width / 2 - 470} ${470 + heaveY})`}>
          <line x1={0} x2={0} y1={-70} y2={70} stroke={theme.wind} strokeWidth={3} />
          <path d="M -12 -58 L 0 -74 L 12 -58" fill="none" stroke={theme.wind} strokeWidth={3} />
          <path d="M -12 58 L 0 74 L 12 58" fill="none" stroke={theme.wind} strokeWidth={3} />
          <text x={-26} y={6} fill={theme.text} fontSize={34} textAnchor="end" fontFamily={theme.font}>
            heave
          </text>
          <text x={-26} y={44} fill={theme.textDim} fontSize={22} textAnchor="end" fontFamily={theme.font}>
            上下起伏
          </text>
        </g>

        {/* the torsion arc */}
        <g opacity={twist + subtract} transform={`translate(${LAYOUT.width / 2 + 470} ${470})`}>
          <path d="M -60 -60 A 84 84 0 0 1 60 -60" fill="none" stroke={theme.energy} strokeWidth={3} />
          <path d="M -60 60 A 84 84 0 0 0 60 60" fill="none" stroke={theme.energy} strokeWidth={3} />
          <text x={0} y={-96} fill={theme.energy} fontSize={34} textAnchor="middle" fontFamily={theme.font}>
            torsion
          </text>
          <text x={0} y={-58} fill={theme.textDim} fontSize={22} textAnchor="middle" fontFamily={theme.font}>
            扭转
          </text>
        </g>

        <g opacity={terms * (1 - subtract)}>
          <text x={LAYOUT.width / 2 - 470} y={760} fill={theme.textFaint} fontSize={24} textAnchor="middle" fontFamily={theme.font}>
            一边翘起，另一边沉下才是扭转
          </text>
        </g>

        {/* the subtraction: take the visible motion away */}
        <g opacity={subtract}>
          <text x={LAYOUT.width / 2} y={760} fill={theme.text} fontSize={36} textAnchor="middle" fontFamily={theme.font} letterSpacing={3}>
            把上下运动减掉，只剩下扭转
          </text>
          <text x={LAYOUT.width / 2} y={812} fill={theme.energy} fontSize={26} textAnchor="middle" fontFamily={theme.font} letterSpacing={2}>
            扭转是安静的，可它才是那把刀
          </text>
        </g>
        <Illustrative frame={frame} appear={L('two-motions', 4)} />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 9 — stiffness                                                   */
/* ------------------------------------------------------------------ */

/**
 * Why torsion is the vulnerable mode: the cables carry heave through their own
 * geometry but contribute almost nothing to twist, so torsional stiffness and
 * torsional damping are both tiny. The strongest image in the act is a cable that
 * does not move while the deck twists beneath it.
 *
 * The decay curve at the end is `示意`: it illustrates low damping, it is not an
 * integration, and the director asked that it never share axes with model output.
 */
export const Stiffness: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('stiffness') - 2, 16), leave(frame, sceneEnd('stiffness') + 8, 20));
  if (op <= 0.01) return null;

  const heave = enter(frame, L('stiffness', 1), 24) * (1 - enter(frame, L('stiffness', 4), 24));
  const cableStill = enter(frame, L('stiffness', 4), 26);
  const girder = enter(frame, L('stiffness', 6), 26);
  const balance = enter(frame, L('stiffness', 9), 26);
  const decay = enter(frame, L('stiffness', 10), 26);

  const heaveLoad = clamp01(Math.abs(Math.sin(frame / 90)) * 1.4);
  const theta = cableStill * Math.sin((frame / (30 * 5)) * Math.PI * 2) * 16;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('stiffness') - 6} text="缆索管不住扭转" sub="刚度从哪里来" />

        <g opacity={1 - decay * 0.85}>
          <BridgeElevation
            x={LAYOUT.safe.left + 160}
            y={230}
            w={1160}
            h={420}
            heave={heave * Math.sin((frame / 90) * Math.PI * 2) * 0.045}
            thetaDeg={theta * 0.6}
            cableLoad={heave * heaveLoad}
            focusGirder={girder > 0.5}
          />
        </g>

        {/* what resists what */}
        <g opacity={heave * (1 - balance)}>
          <text x={LAYOUT.safe.left + 160} y={712} fill={theme.wind} fontSize={24} fontFamily={theme.font} letterSpacing={2}>
            抗起伏 ← 主缆被拉长，就把桥面拉回来
          </text>
          <text x={LAYOUT.safe.left + 160} y={754} fill={theme.textFaint} fontSize={20} fontFamily={theme.font}>
            刚度来自缆索的几何形状
          </text>
        </g>

        <g opacity={cableStill * (1 - decay * 0.85)}>
          <text x={LAYOUT.safe.right - 120} y={712} fill={theme.energy} fontSize={24} textAnchor="end" fontFamily={theme.font} letterSpacing={2}>
            扭转时，主缆几乎不动
          </text>
          <text x={LAYOUT.safe.right - 120} y={754} fill={theme.textFaint} fontSize={20} textAnchor="end" fontFamily={theme.font}>
            抗扭刚度只来自桥面那根很浅的加劲梁
          </text>
        </g>

        {/* the stiffness balance: heave heavy, torsion light */}
        <g opacity={balance * (1 - decay)}>
          <g transform={`translate(${LAYOUT.width / 2} 620) rotate(${Math.sin(frame / 60) * 3 - 14})`}>
            <line x1={-320} x2={320} y1={0} y2={0} stroke={theme.steel} strokeWidth={5} />
            <line x1={0} x2={0} y1={0} y2={150} stroke={theme.steelDim} strokeWidth={4} />
            <rect x={-160} y={8} width={320} height={12} rx={4} fill={theme.wind} opacity={0.5} />
            <rect x={-260} y={-56} width={200} height={56} rx={6} fill={theme.windSoft} stroke={theme.wind} strokeWidth={1.6} />
            <text x={-160} y={-18} fill={theme.wind} fontSize={22} textAnchor="middle" fontFamily={theme.font}>
              抗起伏
            </text>
            <rect x={60} y={-26} width={200} height={26} rx={6} fill={theme.energySoft} stroke={theme.energy} strokeWidth={1.6} />
            <text x={160} y={-4} fill={theme.energy} fontSize={22} textAnchor="middle" fontFamily={theme.font}>
              抗扭
            </text>
          </g>
          <text x={LAYOUT.width / 2} y={860} fill={theme.textDim} fontSize={23} textAnchor="middle" fontFamily={theme.font}>
            同样地，扭转时的能量损失也极小
          </text>
        </g>

        {/* illustrative decay: low damping, so it rings for a long time */}
        <g opacity={decay}>
          <rect x={LAYOUT.safe.left + 260} y={280} width={1400} height={340} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />
          <text x={LAYOUT.safe.left + 290} y={322} fill={theme.textDim} fontSize={21} fontFamily={theme.font} letterSpacing={2}>
            阻尼极小时，扰动会持续很久
          </text>
          {(() => {
            const pts: string[] = [];
            for (let i = 0; i <= 300; i++) {
              const u = i / 300;
              const a = Math.exp(-u * 0.55) * Math.sin(u * Math.PI * 22) * 130;
              pts.push(`${i === 0 ? 'M' : 'L'} ${LAYOUT.safe.left + 300 + u * 1320} ${450 - a}`);
            }
            return <path d={pts.join(' ')} fill="none" stroke={theme.energy} strokeWidth={2.4} />;
          })()}
          <line x1={LAYOUT.safe.left + 300} x2={LAYOUT.safe.left + 1620} y1={450} y2={450} stroke={theme.gridStrong} strokeWidth={1.2} />
          <text x={LAYOUT.safe.left + 300} y={600} fill={theme.textFaint} fontSize={20} fontFamily={theme.font}>
            所以扭转一旦被激发，就不容易停下来
          </text>
        </g>
        <Illustrative frame={frame} appear={L('stiffness', 10)} opacity={decay} />
        <Rule x={LAYOUT.safe.left + 60} y={170} w={LAYOUT.safe.right - LAYOUT.safe.left - 120} />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 10 — wind                                                       */
/* ------------------------------------------------------------------ */

/**
 * The opponent, characterised: wind is broadband, so it has no rhythm to match.
 * The whole act is preparation for the demolition in act 11, and its output — a
 * broad, flat spectrum — is the piece of evidence that act reuses.
 */
export const Wind: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('wind') - 2, 16), leave(frame, sceneEnd('wind') + 8, 20));
  if (op <= 0.01) return null;

  const even = enter(frame, L('wind', 1), 22) * (1 - enter(frame, L('wind', 2), 24));
  const broken = enter(frame, L('wind', 2), 24);
  const noPeriod = enter(frame, L('wind', 4), 26);
  const key = enter(frame, L('wind', 5), 24);
  const rhythm = enter(frame, L('wind', 6), 26);

  const px = 260;
  const py = 300;
  const pw = 900;
  const ph = 260;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('wind') - 6} text="风是什么样的" sub="它在统计上是什么形状" />

        {/* uniform arrows, which shatter */}
        <g opacity={even}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i}>
              <line x1={px} x2={px + 260} y1={220 + i * 34} y2={220 + i * 34} stroke={theme.wind} strokeWidth={2} />
              <path d={`M ${px + 250} ${214 + i * 34} L ${px + 268} ${220 + i * 34} L ${px + 250} ${226 + i * 34}`} fill="none" stroke={theme.wind} strokeWidth={2} />
            </g>
          ))}
          <text x={px + 300} y={252} fill={theme.textDim} fontSize={21} fontFamily={theme.font}>
            看上去像一股稳定的气流
          </text>
        </g>
        <g opacity={broken * (1 - noPeriod)}>
          {Array.from({length: 90}).map((_, i) => {
            const gx = px + ((i * 137) % 1180);
            const gy = 200 + ((i * 271) % 220);
            const a = (((i * 53) % 100) / 100) * Math.PI * 1.6 - 0.8;
            const len = 26 + ((i * 29) % 40);
            return (
              <line
                key={i}
                x1={gx}
                y1={gy}
                x2={gx + Math.cos(a) * len}
                y2={gy + Math.sin(a) * len}
                stroke={theme.wind}
                strokeWidth={1.6}
                opacity={0.55}
              />
            );
          })}
          <text x={px + 300} y={460} fill={theme.textDim} fontSize={21} fontFamily={theme.font}>
            其实混着各种尺度的湍流：大阵风、中等涡旋、很碎的脉动
          </text>
        </g>

        {/* the time series: many periods superimposed, so none dominates */}
        <g opacity={noPeriod * (1 - rhythm * 0.85)}>
          <rect x={px} y={py + 200} width={pw} height={ph} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />
          {(() => {
            const pts: string[] = [];
            for (let i = 0; i <= 400; i++) {
              const u = i / 400;
              const v =
                Math.sin(u * Math.PI * 7) * 0.34 +
                Math.sin(u * Math.PI * 23 + 1.1) * 0.27 +
                Math.sin(u * Math.PI * 61 + 2.3) * 0.2 +
                Math.sin(u * Math.PI * 137 + 0.4) * 0.14;
              pts.push(`${i === 0 ? 'M' : 'L'} ${px + u * pw} ${py + 200 + ph / 2 - v * ph * 0.42}`);
            }
            return <path d={pts.join(' ')} fill="none" stroke={theme.wind} strokeWidth={2} opacity={0.9} />;
          })()}
          <text x={px} y={py + 190} fill={theme.textDim} fontSize={21} fontFamily={theme.font} letterSpacing={2}>
            风速时程：很多周期叠在一起
          </text>
        </g>

        {/* the spectrum, reused by act 11 */}
        <g opacity={key}>
          <Axes
            x={px + 640}
            y={py + 200}
            w={560}
            h={ph}
            xLabel="频率"
            yLabel="能量"
            xRange={[0, 1]}
            yRange={[0, 1]}
            xTicks={[
              {v: 0.2, label: '低'},
              {v: 1, label: '高'},
            ]}
            yTicks={[]}
          />
          <SpectrumBand
            frame={frame}
            appear={L('wind', 5)}
            sx={projector(px + 640, py + 200, 560, ph, [0, 1], [0, 1]).sx}
            sy={projector(px + 640, py + 200, 560, ph, [0, 1], [0, 1]).sy}
            fMax={1}
            energy={() => 0.62}
            markerHz={null}
          />
          <text x={px + 640} y={py + 190} fill={theme.textDim} fontSize={21} fontFamily={theme.font} letterSpacing={2}>
            它的频谱：宽而平，没有尖峰
          </text>
        </g>

        <g opacity={rhythm}>
          <text x={LAYOUT.width / 2} y={880} fill={theme.text} fontSize={36} textAnchor="middle" fontFamily={theme.font} letterSpacing={3}>
            一个力要有节奏地推你，它自己得先有节奏
          </text>
        </g>
        <Illustrative frame={frame} appear={L('wind', 2)} />
        <Rule x={LAYOUT.safe.left + 60} y={170} w={LAYOUT.safe.right - LAYOUT.safe.left - 120} />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 11 — resonance, and its demolition                              */
/* ------------------------------------------------------------------ */

/**
 * The film's structural hinge.
 *
 * The swing is drawn first and drawn *well* — the director requires that the
 * resonance account be believable, even attractive, before it is broken. Then the
 * periodic push is replaced by the noise record from act 10, and the resonance
 * peak loses its meaning. Finally the natural-frequency marker slides the length
 * of the broadband spectrum and finds a response everywhere it stops, which is the
 * specific image the brief demands.
 *
 * The swing and the sliding marker are both `示意`: the marker argument is a
 * teaching device, and the natural frequency is quoted as a literature value in the
 * film rather than as a measurement.
 */
export const Resonance: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('resonance') - 2, 16), leave(frame, sceneEnd('resonance') + 8, 20));
  if (op <= 0.01) return null;

  const swing = enter(frame, L('resonance', 2), 24);
  const believable = enter(frame, L('resonance', 3), 24);
  const stop = enter(frame, L('resonance', 4), 22);
  const noRhythm = enter(frame, L('resonance', 5), 22);
  const slide = enter(frame, L('resonance', 7), 28);
  const everywhere = enter(frame, L('resonance', 9), 26);
  const conclusion = enter(frame, L('resonance', 10), 26);

  /* swing pendulum angle; once `stop` lands, the push is removed and it decays */
  const pushed = slide > 0.02 ? 0 : 1 - stop;
  const swingAngle = Math.sin((frame / 58) * Math.PI * 2) * (6 + 16 * believable) * (0.35 + 0.65 * pushed);

  /* the natural-frequency marker sweeps back and forth across the spectrum */
  const sweepT = clamp01((frame - L('resonance', 7)) / Math.max(1, LE('resonance', 9) - L('resonance', 7)));
  const markerHz = slide > 0.02 ? 0.14 + 0.72 * (0.5 - 0.5 * Math.cos(sweepT * Math.PI * 3.2)) : null;

  const specX = 1000;
  const specY = 360;
  const specW = 660;
  const specH = 240;
  const proj = projector(specX, specY, specW, specH, [0, 1], [0, 1]);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('resonance') - 6} text="最流行的错答案" sub="共振" />

        {/* the swing, drawn sincerely because it has to be believed first */}
        <g opacity={swing * (1 - conclusion * 0.85)}>
          <line x1={330} x2={790} y1={270} y2={270} stroke={theme.steelDim} strokeWidth={4} />
          <g transform={`rotate(${swingAngle} 560 270)`}>
            <line x1={560} y1={270} x2={500} y2={640} stroke={theme.steelDim} strokeWidth={2.4} />
            <line x1={560} y1={270} x2={620} y2={640} stroke={theme.steelDim} strokeWidth={2.4} />
            <rect x={500} y={640} width={120} height={12} rx={4} fill={theme.steel} />
            <g transform="translate(560 600)">
              <circle cx={0} cy={-46} r={17} fill={theme.steel} />
              <line x1={0} y1={-30} x2={0} y2={8} stroke={theme.steel} strokeWidth={7} />
              <line x1={0} y1={-18} x2={26} y2={-38} stroke={theme.steel} strokeWidth={6} />
              <line x1={0} y1={8} x2={-16} y2={40} stroke={theme.steel} strokeWidth={6} />
              <line x1={0} y1={8} x2={16} y2={40} stroke={theme.steel} strokeWidth={6} />
            </g>
          </g>
          {/* the hand that pushes, which is removed later */}
          <g opacity={pushed}>
            <circle cx={790 - Math.max(0, swingAngle) * 1.2} cy={520} r={15} fill={theme.wind} />
            <text x={820} y={528} fill={theme.wind} fontSize={19} fontFamily={theme.font}>
              按节拍推
            </text>
          </g>
          <text x={560} y={700} fill={theme.textDim} fontSize={22} textAnchor="middle" fontFamily={theme.font}>
            像推秋千，每次都在对的时间推一下
          </text>
        </g>

        {/* the response peak, which is convincing and then meaningless */}
        <g opacity={believable * (1 - noRhythm * 0.9)}>
          <rect x={specX} y={250} width={specW} height={200} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />
          {(() => {
            const pts: string[] = [];
            for (let i = 0; i <= 160; i++) {
              const u = i / 160;
              const v = Math.exp(-((u - 0.5) ** 2) / 0.008);
              pts.push(`${i === 0 ? 'M' : 'L'} ${specX + u * specW} ${450 - v * 150}`);
            }
            return <path d={pts.join(' ')} fill="none" stroke={theme.steel} strokeWidth={2.6} />;
          })()}
          <text x={specX} y={236} fill={theme.textDim} fontSize={20} fontFamily={theme.font} letterSpacing={2}>
            响应：一个漂亮的尖峰，看起来完全说得通
          </text>
        </g>

        {/* the same response, now driven by noise: the peak loses its meaning */}
        <g opacity={noRhythm * (1 - slide * 0.85)}>
          <rect x={specX} y={250} width={specW} height={200} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />
          {(() => {
            const pts: string[] = [];
            for (let i = 0; i <= 240; i++) {
              const u = i / 240;
              const v = Math.exp(-((u - 0.5) ** 2) / 0.008) * (0.5 + 0.5 * Math.sin(u * 90 + frame / 3));
              pts.push(`${i === 0 ? 'M' : 'L'} ${specX + u * specW} ${450 - v * 150}`);
            }
            return <path d={pts.join(' ')} fill="none" stroke={theme.inert} strokeWidth={2.4} />;
          })()}
          <text x={specX} y={236} fill={theme.textFaint} fontSize={20} fontFamily={theme.font} letterSpacing={2}>
            风没有节奏，尖峰就开始抖动，失去意义
          </text>
        </g>

        {/* the sliding natural frequency: the specific image the brief demands */}
        <g opacity={slide}>
          <Axes
            x={specX}
            y={specY}
            w={specW}
            h={specH}
            xLabel="频率"
            yLabel="能量"
            xRange={[0, 1]}
            yRange={[0, 1]}
            xTicks={[
              {v: 0.1, label: '低'},
              {v: 0.5, label: '中'},
              {v: 0.9, label: '高'},
            ]}
            yTicks={[]}
          />
          <SpectrumBand
            frame={frame}
            appear={L('resonance', 7)}
            sx={proj.sx}
            sy={proj.sy}
            fMax={1}
            energy={() => 0.6}
            markerHz={markerHz}
          />
          <text x={specX} y={specY - 24} fill={theme.textDim} fontSize={20} fontFamily={theme.font} letterSpacing={2}>
            把桥的自然频率在整条频带上来回移动
          </text>
          <g opacity={everywhere}>
            <text x={specX} y={specY + specH + 48} fill={theme.energy} fontSize={23} fontFamily={theme.font}>
              不管停在哪里，上面都有风的成分 —— 频率根本不需要匹配
            </text>
          </g>
        </g>

        <g opacity={conclusion}>
          <text x={LAYOUT.width / 2} y={880} fill={theme.energy} fontSize={40} textAnchor="middle" fontFamily={theme.font} letterSpacing={3}>
            风不是来跟桥合拍的，风是来给桥供能的
          </text>
        </g>
        <Illustrative frame={frame} appear={L('resonance', 2)} />
        <Rule x={LAYOUT.safe.left + 60} y={170} w={LAYOUT.safe.right - LAYOUT.safe.left - 120} />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 12 — two-freedoms                                               */
/* ------------------------------------------------------------------ */

/**
 * The second fatal objection to resonance, and the introduction of self-excitation:
 * nobody is pushing. The wind record is flat while the twist climbs, and the act
 * ends on the causal loop that becomes the film's recurring signature for
 * self-excited motion.
 */
export const TwoFreedoms: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('two-freedoms') - 2, 16), leave(frame, sceneEnd('two-freedoms') + 8, 20));
  if (op <= 0.01) return null;

  const stop = enter(frame, L('two-freedoms', 1), 22);
  const noHand = enter(frame, L('two-freedoms', 3), 24);
  const loop = enter(frame, L('two-freedoms', 6), 28);
  const icon = enter(frame, L('two-freedoms', 8), 26);

  const winding = frame / 12;
  const dashOffset = -winding * 22;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('two-freedoms') - 6} text="没有人按节拍推它" sub="自激振荡" />

        {/* the swing, with the hand removed: it stops because nothing drives it */}
        <g opacity={stop * (1 - loop)}>
          <line x1={260} x2={620} y1={280} y2={280} stroke={theme.steelDim} strokeWidth={3} />
          <g transform={`rotate(${Math.sin((frame / 58) * Math.PI * 2) * 14 * (1 - noHand)} 440 280)`}>
            <line x1={440} y1={280} x2={390} y2={600} stroke={theme.steelDim} strokeWidth={2} />
            <line x1={440} y1={280} x2={490} y2={600} stroke={theme.steelDim} strokeWidth={2} />
            <rect x={390} y={600} width={100} height={10} rx={4} fill={theme.steel} />
          </g>
          <text x={440} y={670} fill={theme.textDim} fontSize={21} textAnchor="middle" fontFamily={theme.font}>
            没有人在推，秋千一定会停
          </text>
        </g>

        {/* the load-bearing comparison: flat wind, climbing twist */}
        <g opacity={noHand * (1 - loop)}>
          <g transform="translate(700 240)">
            <rect x={0} y={0} width={480} height={130} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />
            <path d={`M 0 74 L 480 70`} fill="none" stroke={theme.wind} strokeWidth={2.6} />
            <text x={14} y={34} fill={theme.wind} fontSize={20} fontFamily={theme.font}>
              风速：几乎不变
            </text>
          </g>
          <g transform="translate(700 420)">
            <rect x={0} y={0} width={480} height={130} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />
            {(() => {
              const pts: string[] = [];
              for (let i = 0; i <= 100; i++) {
                const u = i / 100;
                const a = u * u * Math.abs(Math.sin(u * u * 30)) * 60;
                pts.push(`${i === 0 ? 'M' : 'L'} ${u * 480} ${65 - a}`);
              }
              return <path d={pts.join(' ')} fill="none" stroke={theme.energy} strokeWidth={2.4} />;
            })()}
            <text x={14} y={124} fill={theme.energy} fontSize={20} fontFamily={theme.font}>
              扭转：越来越大
            </text>
          </g>
        </g>

        {/* the causal loop, the film's signature */}
        <g opacity={loop}>
          <DeckSection x={LAYOUT.width / 2} y={520} span={520} thetaDeg={Math.sin(frame / 30) * 16} hangers />
          <circle cx={LAYOUT.width / 2} cy={520} r={230} fill="none" stroke={theme.energy} strokeWidth={2.4} strokeDasharray="16 14" strokeDashoffset={dashOffset} opacity={0.85} />
          <circle cx={LAYOUT.width / 2} cy={290} r={7} fill={theme.energy} />
          <circle cx={LAYOUT.width / 2 + 230} cy={520} r={7} fill={theme.energy} />
          <circle cx={LAYOUT.width / 2} cy={750} r={7} fill={theme.energy} />
          <circle cx={LAYOUT.width / 2 - 230} cy={520} r={7} fill={theme.energy} />
          <text x={LAYOUT.width / 2} y={252} fill={theme.energy} fontSize={21} textAnchor="middle" fontFamily={theme.font}>
            转动 → 改变迎角
          </text>
          <text x={LAYOUT.width / 2 + 250} y={528} fill={theme.energy} fontSize={21} fontFamily={theme.font}>
            气动力
          </text>
          <text x={LAYOUT.width / 2} y={800} fill={theme.energy} fontSize={21} textAnchor="middle" fontFamily={theme.font}>
            更大的力矩 → 继续转
          </text>
        </g>

        <g opacity={icon}>
          <text x={LAYOUT.width / 2} y={900} fill={theme.text} fontSize={40} textAnchor="middle" fontFamily={theme.font} letterSpacing={3}>
            这种运动有个名字：自激振荡
          </text>
          <text x={LAYOUT.width / 2} y={952} fill={theme.textFaint} fontSize={24} textAnchor="middle" fontFamily={theme.font} letterSpacing={2}>
            self-excited oscillation
          </text>
        </g>
        <Illustrative frame={frame} appear={L('two-freedoms', 2)} />
        <Rule x={LAYOUT.safe.left + 60} y={170} w={LAYOUT.safe.right - LAYOUT.safe.left - 120} />
      </svg>
    </div>
  );
};
