import React from 'react';
import {LAYOUT, theme} from '../theme';
import {LE, L, sceneEnd, sceneStart} from '../timing';
import {ActTitle, clamp01, enter, leave, Readout, Rule, Streamline} from '../components/primitives';
import {DeckSection} from '../components/Bridge';
import {ArchivePlate, ARCHIVE, ArchiveTriptych} from '../components/Archive';

/**
 * Acts 1-5: the hook, the historical frame, the theory that made everyone
 * confident, the months of harmless wobbling, and the collapse itself.
 *
 * Every act is mounted for the whole film and gates itself on opacity, which is
 * the project's established substitute for `<Sequence>`. That keeps one
 * continuous canvas, so a scene boundary can never produce a blank frame — the
 * shared wind layer simply keeps flowing across the cut.
 */

/* ------------------------------------------------------------------ */
/* Act 1 — cold-open                                                   */
/* ------------------------------------------------------------------ */

/**
 * The hook. A single thin section line breathes in the dark, then stops dead at
 * line 3 — the film's first still moment, used to signal danger. The number 129
 * arrives without a colour, because the brief forbids decorating the wind.
 */
export const ColdOpen: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('cold-open') - 2, 16), leave(frame, sceneEnd('cold-open') + 8, 20));
  if (op <= 0.01) return null;

  /* the breathing stops on line 3 and never resumes: the deck is drawn from a
     frozen phase after that point */
  const breathStart = L('cold-open', 0);
  const freeze = L('cold-open', 3);
  const breathing = frame < freeze;
  const amp = 26;
  const phase = (frame - breathStart) / 46;
  const y = breathing ? Math.sin(phase * Math.PI * 2) * amp : Math.sin(((freeze - breathStart) / 46) * Math.PI * 2) * amp;
  const theta = breathing ? Math.sin(phase * Math.PI * 2 + 0.5) * 1.6 : Math.sin(((freeze - breathStart) / 46) * Math.PI * 2 + 0.5) * 1.6;

  const toArchive = enter(frame, L('cold-open', 4) - 6, 26);
  const dayCount = enter(frame, L('cold-open', 3) + 30, 30);
  const dates = enter(frame, L('cold-open', 4) + 10, 26);
  const triptych = enter(frame, L('cold-open', 5), 30);
  const wind = enter(frame, L('cold-open', 6), 30);
  const question = enter(frame, L('cold-open', 7), 26);

  /* the wind that kills it enters exactly on the last line */
  const flowO = wind * (1 - question * 0.55);

  const deckOpacity = (1 - toArchive) * 1 + question * 0.9;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      {/* the archive plate the section hands over to */}
      <ArchivePlate
        src={ARCHIVE.twist}
        x={LAYOUT.safe.left + 300}
        y={140}
        w={LAYOUT.width - LAYOUT.safe.left * 2 - 600}
        h={620}
        opacity={toArchive * (1 - triptych)}
        zoom={1.02 + toArchive * 0.03}
        label="1940.11.07"
        caption="Barney Elliott 拍摄的彩色 16mm 胶片，公共领域"
      />

      <ArchiveTriptych
        frame={frame}
        x={LAYOUT.safe.left + 180}
        y={170}
        w={LAYOUT.width - LAYOUT.safe.left * 2 - 360}
        h={540}
        progress={triptych}
        third={enter(frame, L('cold-open', 6) + 10, 24)}
      />

      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        {/* the section, floating in the middle of an otherwise empty frame */}
        <g opacity={deckOpacity}>
          <DeckSection x={LAYOUT.width / 2} y={LAYOUT.height / 2 - 40} span={620} thetaDeg={theta} hangers={false} />
          <g opacity={0.5}>
            <line x1={LAYOUT.width / 2 - 420} x2={LAYOUT.width / 2 - 320} y1={LAYOUT.height / 2 - 40 + y} y2={LAYOUT.height / 2 - 40 + y} stroke={theme.steelGhost} strokeWidth={1} strokeDasharray="4 8" />
            <line x1={LAYOUT.width / 2 + 320} x2={LAYOUT.width / 2 + 420} y1={LAYOUT.height / 2 - 40 + y} y2={LAYOUT.height / 2 - 40 + y} stroke={theme.steelGhost} strokeWidth={1} strokeDasharray="4 8" />
          </g>
        </g>

        {/* 129 days, uncoloured */}
        <g opacity={dayCount * (1 - triptych)}>
          <text x={LAYOUT.width / 2} y={880} fill={theme.text} fontSize={92} fontFamily={theme.mono} textAnchor="middle" letterSpacing={4}>
            129
          </text>
          <text x={LAYOUT.width / 2} y={920} fill={theme.textFaint} fontSize={21} textAnchor="middle" letterSpacing={6}>
            天
          </text>
          <g opacity={dates}>
            <text x={LAYOUT.width / 2} y={968} fill={theme.textDim} fontSize={22} fontFamily={theme.mono} textAnchor="middle" letterSpacing={3}>
              1940.07.01 — 1940.11.07
            </text>
          </g>
        </g>
      </svg>

      {/* the wind, entering late and staying for the rest of the film */}
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0, opacity: flowO}}>
        {[0, 1, 2, 3, 4].map((i) => {
          const ly = 250 + i * 140;
          return (
            <Streamline
              key={i}
              d={`M ${-40 - i * 30} ${ly} C ${300} ${ly - 12}, ${700} ${ly + 14}, ${LAYOUT.width + 60} ${ly - 6}`}
              opacity={0.32}
              width={1.8}
            />
          );
        })}
      </svg>

      {/* the closing question, pressed over everything */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 300,
          textAlign: 'center',
          opacity: question,
          fontFamily: theme.font,
        }}
      >
        <div style={{fontSize: 66, fontWeight: 600, color: theme.text, letterSpacing: 3, textShadow: '0 6px 40px rgba(0,0,0,0.9)'}}>
          为什么它会自己把自己撕开？
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 2 — archive                                                     */
/* ------------------------------------------------------------------ */

/**
 * Sorted by main span, longest first, because this chart's entire job is to show
 * that Tacoma was the third-longest span in the world when it opened. The first
 * version listed them unsorted and put Tacoma sixth, which contradicted the
 * narration and the act's own subtitle.
 */
const SPANS: Array<{name: string; span: number; year: number; tacoma?: boolean}> = [
  {name: '金门大桥', span: 1280, year: 1937},
  {name: '乔治·华盛顿大桥', span: 1067, year: 1931},
  {name: '塔科马海峡大桥', span: 853, year: 1940, tacoma: true},
  {name: '大使桥', span: 564, year: 1929},
  {name: '布鲁克林大桥', span: 486, year: 1883},
  {name: '曼哈顿大桥', span: 448, year: 1909},
];

/**
 * The pride act. Its job is to make the viewer accept the bridge as an
 * achievement before the film is allowed to explain it — the director's rule is
 * that without this the story degenerates into "the engineers were careless".
 *
 * The ranking bars are ordered by span so Tacoma visibly lands third, which is
 * the one number in this act that carries meaning: it is what "world-class" meant
 * in 1940.
 */
export const Archive: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('archive') - 2, 16), leave(frame, sceneEnd('archive') + 8, 20));
  if (op <= 0.01) return null;

  const photos = enter(frame, L('archive', 0), 26);
  const rank = enter(frame, L('archive', 2), 30);
  const grid = enter(frame, L('archive', 3) - 10, 30);
  const safety = enter(frame, L('archive', 5), 26);
  const turn = enter(frame, L('archive', 6), 26);

  /*
   * The photographs and the ranking are two beats, not two layers. Once the
   * ranking starts, the plates step back so bars are never read over a
   * photograph — the first render had them overlapping and both were illegible.
   */
  const photoOpacity = photos * (1 - Math.max(rank * 0.92, grid));

  const barX = 360;
  const barMaxW = 880;
  const maxSpan = 1280;
  const barTop = 300;
  const barGap = 74;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <ArchivePlate
        src={ARCHIVE.collapseFar}
        x={LAYOUT.safe.left + 40}
        y={210}
        w={620}
        h={400}
        opacity={photoOpacity}
        zoom={1.03 + rank * 0.03}
        label="WASHINGTON STATE"
        caption="塔科马海峡，普吉特湾"
      />
      <ArchivePlate
        src={ARCHIVE.torsionStills}
        x={LAYOUT.safe.left + 700}
        y={250}
        w={520}
        h={330}
        opacity={photoOpacity * 0.85}
        zoom={1.02}
      />

      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('archive') - 6} text="它曾经是骄傲" sub="通车时的世界第三长悬索桥" />

        {/* the drawing grid belongs to the plate it sits on, and leaves with it */}
        <g opacity={grid * (1 - turn) * photoOpacity}>
          <rect x={LAYOUT.safe.left + 40} y={210} width={620} height={400} fill="rgba(201,174,146,0.06)" stroke={theme.archiveDim} strokeWidth={1.2} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1={LAYOUT.safe.left + 40} x2={LAYOUT.safe.left + 660} y1={210 + i * 67} y2={210 + i * 67} stroke={theme.archiveDim} strokeWidth={0.7} opacity={0.5} />
          ))}
          <text x={LAYOUT.safe.left + 62} y={240} fill={theme.archive} fontSize={18} fontFamily={theme.mono} letterSpacing={2}>
            挠度理论 · DEFLECTION
          </text>
        </g>

        {/* span ranking. Tacoma is the only bar that carries colour, because this
            beat exists to establish that it was a world-class structure. */}
        <g opacity={rank}>
          <text x={barX} y={barTop - 40} fill={theme.textDim} fontSize={21} fontFamily={theme.font} letterSpacing={2}>
            主跨长度（米）· 当时的世界排名
          </text>
          {SPANS.map((s, i) => {
            const local = clamp01((rank - i * 0.13) / 0.5);
            if (local <= 0.01) return null;
            const y = barTop + i * barGap;
            const w = (s.span / maxSpan) * barMaxW * local;
            const isT = Boolean(s.tacoma);
            return (
              <g key={s.name} opacity={local}>
                <text x={barX - 18} y={y + 26} fill={isT ? theme.energy : theme.textFaint} fontSize={22} textAnchor="end" fontFamily={theme.font}>
                  {s.name}
                </text>
                <rect x={barX} y={y} width={barMaxW} height={30} rx={3} fill="rgba(255,255,255,0.022)" />
                <rect
                  x={barX}
                  y={y}
                  width={w}
                  height={30}
                  rx={3}
                  fill={isT ? theme.energySoft : 'rgba(255,255,255,0.055)'}
                  stroke={isT ? theme.energy : theme.panelEdge}
                  strokeWidth={isT ? 2 : 1}
                />
                <text x={barX + w + 16} y={y + 24} fill={isT ? theme.energy : theme.textFaint} fontSize={22} fontFamily={theme.mono}>
                  {s.span}
                </text>
                <text x={barX + barMaxW + 26} y={y + 24} fill={theme.textGhost} fontSize={19} fontFamily={theme.mono}>
                  {s.year}
                </text>
              </g>
            );
          })}
        </g>

        <g opacity={safety * (1 - turn)}>
          <Readout x={barX - 18} y={barTop + SPANS.length * barGap + 24} label="设计结论" value="强度足够" color={theme.fix} size={36} anchor="end" />
        </g>
        <g opacity={turn}>
          <Readout x={barX - 18} y={barTop + SPANS.length * barGap + 24} label="但是" value="这不是无知的错误" color={theme.text} size={32} anchor="end" />
          <text x={barX} y={barTop + SPANS.length * barGap + 82} fill={theme.textDim} fontSize={21} fontFamily={theme.font}>
            用的是当时最先进的计算方法
          </text>
        </g>
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 3 — theory                                                      */
/* ------------------------------------------------------------------ */

const sag = (u: number) => Math.sin(Math.PI * clamp01(u)) ** 1.4;

/**
 * The act that moves the blame off the engineers and onto the question they
 * asked. Three deflection curves are drawn — self-weight, traffic, combined —
 * and the frame deliberately leaves one corner empty, which is the visual debt
 * that act 7 will come back to collect.
 */
export const Theory: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('theory') - 2, 16), leave(frame, sceneEnd('theory') + 8, 20));
  if (op <= 0.01) return null;

  const c1 = enter(frame, L('theory', 2), 26);
  const c2 = enter(frame, L('theory', 3), 26);
  const c3 = enter(frame, L('theory', 4), 26);
  const strength = enter(frame, L('theory', 5), 24);
  const wrong = enter(frame, L('theory', 6), 26);

  const x0 = 300;
  const x1 = 1500;
  const baseY = 700;
  const spanW = x1 - x0;
  const curve = (scale: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 80; i++) {
      const u = i / 80;
      pts.push(`${i === 0 ? 'M' : 'L'} ${x0 + u * spanW} ${baseY - sag(u) * 150 * scale}`);
    }
    return pts.join(' ');
  };

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('theory') - 6} text="他们算对了" sub="但问的是不是对的问题" />

        {/* two registers: hand-drawn rule of thumb on the left, calculation right */}
        <g opacity={enter(frame, L('theory', 0), 22) * (1 - c3 * 0.6)}>
          <rect x={LAYOUT.safe.left + 60} y={230} width={520} height={200} fill="none" stroke={theme.archiveDim} strokeWidth={1.2} strokeDasharray="6 6" />
          <text x={LAYOUT.safe.left + 84} y={272} fill={theme.archive} fontSize={21} fontFamily={theme.font} letterSpacing={2}>
            十九世纪：靠经验
          </text>
          <text x={LAYOUT.safe.left + 84} y={330} fill={theme.textFaint} fontSize={19} fontFamily={theme.font}>
            桥塌过好几次
          </text>
          <text x={LAYOUT.safe.left + 84} y={386} fill={theme.textFaint} fontSize={19} fontFamily={theme.font}>
            才开始认真算
          </text>
        </g>

        {/* the deflection curves */}
        <g>
          <line x1={x0} x2={x1} y1={baseY} y2={baseY} stroke={theme.steelGhost} strokeWidth={1.4} />
          <path d={curve(0.6)} fill="none" stroke={theme.steel} strokeWidth={2.6} opacity={c1 * (1 - c2 * 0.4)} />
          <path d={curve(0.28)} fill="none" stroke={theme.wind} strokeWidth={2.6} opacity={c2 * (1 - c3 * 0.35)} />
          <path d={curve(0.82)} fill="none" stroke={theme.energy} strokeWidth={3} opacity={c3} />
          <g opacity={c1}>
            <text x={x0} y={baseY + 40} fill={theme.textFaint} fontSize={19} fontFamily={theme.font}>
              自重下垂
            </text>
          </g>
          <g opacity={c2}>
            <text x={x0 + 220} y={baseY + 40} fill={theme.wind} fontSize={19} fontFamily={theme.font}>
              车辆荷载
            </text>
          </g>
          <g opacity={c3}>
            <text x={x0 + 440} y={baseY + 40} fill={theme.energy} fontSize={19} fontFamily={theme.font}>
              挠度理论能算的：静态荷载下的变形
            </text>
          </g>
        </g>

        {/* the empty corner the film will return to */}
        <g opacity={c3 * 0.9}>
          <rect x={1480} y={250} width={330} height={250} fill="none" stroke={theme.textGhost} strokeWidth={1.4} strokeDasharray="8 8" />
          <text x={1645} y={390} fill={theme.textGhost} fontSize={22} textAnchor="middle" fontFamily={theme.font}>
            这里空着
          </text>
        </g>

        <g opacity={strength * (1 - wrong)}>
          <Readout x={300} y={190} label="按当时的标准" value="强度 ✓" color={theme.fix} size={36} />
        </g>
        <g opacity={wrong}>
          <Readout x={300} y={190} label="他们问的问题" value="问题不完整" color={theme.energy} size={36} />
          <text x={300} y={300} fill={theme.textDim} fontSize={21} fontFamily={theme.font}>
            真正的问题不是"够不够强"
          </text>
        </g>
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 4 — gertie                                                      */
/* ------------------------------------------------------------------ */

/**
 * The wobble. The director asked for this act to be allowed to be slightly funny
 * — the nickname, the drivers feeling seasick — because the contrast is what
 * makes the collapse frightening. Amplitudes are shown as an envelope with no
 * numbers: the model cannot support a metre figure, so the film does not quote
 * one.
 */
export const Gertie: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('gertie') - 2, 16), leave(frame, sceneEnd('gertie') + 8, 20));
  if (op <= 0.01) return null;

  const photo = enter(frame, L('gertie', 0), 24);
  const nickname = enter(frame, L('gertie', 5), 24);
  const cables = enter(frame, L('gertie', 6), 22);
  const snap = enter(frame, L('gertie', 8), 8);
  const dampers = enter(frame, L('gertie', 9), 22);
  const envelope = enter(frame, L('gertie', 11), 26);

  /* the heave envelope, drawn schematically: growing, with the two failures marked */
  const envX = 260;
  const envY = 250;
  const envW = 1400;
  const envH = 210;

  const phase = (frame % 100) / 100;
  const liveAmp = 34 + 30 * clamp01(envelope);
  const live = Math.sin(phase * Math.PI * 2) * liveAmp * (1 - envelope);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <ArchivePlate
        src={ARCHIVE.torsionStills}
        x={LAYOUT.safe.left + 60}
        y={190}
        w={780}
        h={400}
        opacity={photo * (1 - envelope * 0.7) * (1 - cables * 0.55)}
        zoom={1.02}
        label="GALLOPING GERTIE"
        caption="桥面在普通风里整段起伏"
      />

      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('gertie') - 6} text="一座会跳舞的桥" sub="通车后它一直在摇" />

        {/* the cross-section, heaving, with the tie-down cable beneath it */}
        <g opacity={photo * (1 - envelope * 0.75)}>
          <DeckSection x={LAYOUT.width / 2 + 320} y={430 + live} span={420} thetaDeg={0} hangers={cables > 0.5} />
          {cables ? (
            <>
              <line
                x1={LAYOUT.width / 2 + 320}
                x2={LAYOUT.width / 2 + 320}
                y1={452 + live}
                y2={700}
                stroke={snap > 0.5 ? theme.energy : theme.steelDim}
                strokeWidth={2.4}
                strokeDasharray={snap > 0.5 ? '14 10' : undefined}
                opacity={snap > 0.5 ? 0.55 : 1}
              />
              <rect x={LAYOUT.width / 2 + 250} y={700} width={140} height={26} fill={theme.steelGhost} />
              <text x={LAYOUT.width / 2 + 320} y={758} fill={snap > 0.5 ? theme.energy : theme.textFaint} fontSize={19} textAnchor="middle" fontFamily={theme.font}>
                {snap > 0.5 ? '系紧索绷断' : '系紧索 → 岸上混凝土块'}
              </text>
            </>
          ) : null}
        </g>

        {/* the dampers, which failed because their seals were destroyed */}
        <g opacity={dampers * (1 - envelope * 0.75)}>
          <rect x={LAYOUT.safe.right - 420} y={430} width={330} height={120} rx={8} fill={theme.panel} stroke={theme.panelEdge} strokeWidth={1.2} />
          <text x={LAYOUT.safe.right - 400} y={470} fill={theme.textDim} fontSize={20} fontFamily={theme.font}>
            液压减振器
          </text>
          <rect
            x={LAYOUT.safe.right - 400}
            y={498}
            width={60 + Math.abs(Math.sin(frame / 18)) * 60}
            height={26}
            rx={4}
            fill={theme.steelDim}
          />
          <line x1={LAYOUT.safe.right - 250} x2={LAYOUT.safe.right - 250} y1={490} y2={534} stroke={theme.energy} strokeWidth={2} />
          <text x={LAYOUT.safe.right - 400} y={558} fill={theme.energy} fontSize={18} fontFamily={theme.font}>
            喷砂时密封件损坏，失效
          </text>
        </g>

        {/* the nickname */}
        <g opacity={nickname * (1 - envelope)}>
          <text x={LAYOUT.safe.left + 80} y={690} fill={theme.text} fontSize={54} fontWeight={600} fontFamily={theme.font} letterSpacing={4}>
            跳舞的格蒂
          </text>
          <text x={LAYOUT.safe.left + 84} y={736} fill={theme.textDim} fontSize={23} fontFamily={theme.font} letterSpacing={2}>
            Galloping Gertie · 像马一样小跑
          </text>
        </g>

        {/* the envelope, which becomes the film's recurring curve */}
        <g opacity={envelope}>
          <text x={envX} y={envY - 20} fill={theme.textDim} fontSize={21} fontFamily={theme.font} letterSpacing={2}>
            几个月的上下起伏
          </text>
          <rect x={envX} y={envY} width={envW} height={envH} fill="rgba(255,255,255,0.012)" stroke={theme.panelEdge} strokeWidth={1.2} />
          {(() => {
            const pts: string[] = [];
            for (let i = 0; i <= 200; i++) {
              const u = i / 200;
              const a = Math.sin(u * Math.PI * 6) * (10 + 46 * u * u);
              pts.push(`${i === 0 ? 'M' : 'L'} ${envX + u * envW} ${envY + envH / 2 - a}`);
            }
            return <path d={pts.join(' ')} fill="none" stroke={theme.wind} strokeWidth={2.2} />;
          })()}
          <line x1={envX + envW * 0.42} x2={envX + envW * 0.42} y1={envY} y2={envY + envH} stroke={theme.textGhost} strokeWidth={1.2} />
          <line x1={envX + envW * 0.74} x2={envX + envW * 0.74} y1={envY} y2={envY + envH} stroke={theme.textGhost} strokeWidth={1.2} />
          <text x={envX + envW * 0.42 + 8} y={envY + 26} fill={theme.textFaint} fontSize={17} fontFamily={theme.font}>
            系紧索断开
          </text>
          <text x={envX + envW * 0.74 + 8} y={envY + 26} fill={theme.textFaint} fontSize={17} fontFamily={theme.font}>
            减振器失效
          </text>
          <text x={envX} y={envY + envH + 40} fill={theme.textDim} fontSize={20} fontFamily={theme.font}>
            两种补救都没用，而且它变得越来越容易摇
          </text>
        </g>

        <Rule x={LAYOUT.safe.left + 60} y={170} w={LAYOUT.safe.right - LAYOUT.safe.left - 120} />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Act 5 — collapse                                                    */
/* ------------------------------------------------------------------ */

/**
 * The collapse. This is the film's emotional peak and the point where the motion
 * changes character, so the act has to *show* the change from heaving to twisting
 * rather than announce it: the section starts translating and then begins to
 * rotate, with a live angle gauge tracking it.
 *
 * The wind gauge is the load-bearing visual: the needle sits in the middle of the
 * dial, nowhere near any danger zone, which is the whole "the wind was not
 * strong" argument expressed as an instrument reading.
 */
export const Collapse: React.FC<{frame: number}> = ({frame}) => {
  const op = Math.min(enter(frame, sceneStart('collapse') - 2, 16), leave(frame, sceneEnd('collapse') + 10, 22));
  if (op <= 0.01) return null;

  const gauge = enter(frame, L('collapse', 0), 24);
  const twisting = enter(frame, L('collapse', 2), 26);
  const vehicles = enter(frame, L('collapse', 4), 22);
  const filmed = enter(frame, L('collapse', 7), 22);
  const tear1 = enter(frame, L('collapse', 8), 22);
  const tear2 = enter(frame, L('collapse', 9), 22);
  const done = enter(frame, L('collapse', 10), 26);

  /* the twist ramps up over the middle of the act and holds */
  const twistStart = L('collapse', 3);
  const twistEnd = LE('collapse', 5);
  const twistProgress = clamp01((frame - twistStart) / Math.max(1, twistEnd - twistStart));
  /* an oscillation whose amplitude is the twist progress; period about 5 s, which
     is the model's torsional period, so the gauge reads truthfully */
  const theta = twisting * Math.sin(((frame - twistStart) / (30 * 5)) * Math.PI * 2) * (8 + 34 * twistProgress);

  const heave = twisting * (1 - twistProgress) * Math.sin((frame / 60) * Math.PI * 2) * 22;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, pointerEvents: 'none'}}>
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        <ActTitle frame={frame} appear={sceneStart('collapse') - 6} text="那一天" sub="一九四零年十一月七日，上午" />

        {/* the section: translation first, then rotation */}
        <DeckSection
          x={LAYOUT.width / 2 - 120}
          y={530 + heave}
          span={560}
          thetaDeg={theta}
          hangers
          opacity={1 - done * 0.15}
        />

        {/* The twist gauge. The dial is a real range: the needle tracks the actual
            twist and the ±45 marks are the range limit, not a claimed measurement —
            the recorded peak is a secondhand figure, so the film shows a scale
            rather than reading a number off it. */}
        <g opacity={twisting * (1 - done * 0.4)} transform={`translate(${LAYOUT.safe.right - 360} ${430})`}>
          {(() => {
            const R = 150;
            /* angle convention: 0 is straight up, positive clockwise */
            const pt = (deg: number, r: number) => {
              const a = (deg / 90) * (Math.PI / 2);
              return {x: Math.sin(a) * r, y: -Math.cos(a) * r};
            };
            return (
              <>
                <path d={`M ${pt(-90, R).x} ${pt(-90, R).y} A ${R} ${R} 0 0 1 ${pt(90, R).x} ${pt(90, R).y}`} fill="none" stroke={theme.panelEdge} strokeWidth={2} />
                {[-45, -22.5, 0, 22.5, 45].map((d) => {
                  const isLimit = Math.abs(d) === 45;
                  const p1 = pt(d, R);
                  const p2 = pt(d, R - 14);
                  const p3 = pt(d, R + 24);
                  return (
                    <g key={d}>
                      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={isLimit ? theme.energy : theme.textFaint} strokeWidth={isLimit ? 2.4 : 1.4} />
                      {d !== 0 ? (
                        <text
                          x={p3.x}
                          y={p3.y + 6}
                          fill={isLimit ? theme.energy : theme.textFaint}
                          fontSize={17}
                          textAnchor="middle"
                          fontFamily={theme.mono}
                        >
                          {d > 0 ? `+${d}` : d}°
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                <g transform={`rotate(${Math.max(-88, Math.min(88, (theta / 45) * 90))})`}>
                  <line x1={0} y1={0} x2={0} y2={-128} stroke={theme.text} strokeWidth={3} />
                </g>
                <circle cx={0} cy={0} r={7} fill={theme.text} />
                <text x={0} y={64} fill={theme.textFaint} fontSize={19} textAnchor="middle" fontFamily={theme.font} letterSpacing={2}>
                  扭转量程 ±45°
                </text>
              </>
            );
          })()}
        </g>

        {/* the wind gauge: the needle is nowhere near the far end */}
        <g opacity={gauge * (1 - done * 0.5)} transform={`translate(${LAYOUT.safe.left + 250} ${430})`}>
          <path d="M -150 0 A 150 150 0 0 1 150 0" fill="none" stroke={theme.panelEdge} strokeWidth={2} />
          <path
            d={(() => {
              const a0 = Math.PI / 2 - (0.72 * Math.PI) / 2;
              const a1 = Math.PI / 2;
              return `M ${Math.cos(a0) * 150} ${-Math.sin(a0) * 150} A 150 150 0 0 0 ${Math.cos(a1) * 150} ${-Math.sin(a1) * 150}`;
            })()}
            fill="none"
            stroke={theme.textGhost}
            strokeWidth={10}
            opacity={0.5}
          />
          <text x={-104} y={-96} fill={theme.textGhost} fontSize={16} fontFamily={theme.font}>
            极端天气
          </text>
          {/* 18 m/s of a 0-45 m/s dial sits at about 40% */}
          <g transform={`rotate(${-90 + 180 * 0.4})`}>
            <line x1={0} y1={0} x2={0} y2={-128} stroke={theme.text} strokeWidth={3.4} />
          </g>
          <circle cx={0} cy={0} r={7} fill={theme.text} />
          <text x={0} y={44} fill={theme.text} fontSize={34} textAnchor="middle" fontFamily={theme.mono}>
            64 km/h
          </text>
          <text x={0} y={76} fill={theme.textFaint} fontSize={19} textAnchor="middle" fontFamily={theme.font} letterSpacing={2}>
            当天风速 · 指针离极端天气很远
          </text>
        </g>

        {/* the vehicles sliding, briefly */}
        <g opacity={vehicles * (1 - tear1)}>
          <rect x={LAYOUT.safe.left + 120} y={640} width={700} height={120} rx={6} fill="rgba(255,255,255,0.02)" stroke={theme.panelEdge} strokeWidth={1.2} />
          <text x={LAYOUT.safe.left + 150} y={686} fill={theme.textDim} fontSize={21} fontFamily={theme.font}>
            汽车在桥面上侧滑，轮胎离开地面
          </text>
          <g transform={`rotate(${-6} ${LAYOUT.safe.left + 150} ${LAYOUT.safe.left + 380})`}>
            <rect x={LAYOUT.safe.left + 200} y={700} width={90} height={30} rx={5} fill={theme.steelDim} />
            <rect x={LAYOUT.safe.left + 420} y={712} width={90} height={26} rx={5} fill={theme.steelGhost} />
          </g>
        </g>

        {/* the archive evidence, held under 60% of the frame as the brief requires */}
        <foreignObject x={LAYOUT.safe.left + 60} y={196} width={0} height={0} />
      </svg>

      <ArchivePlate
        src={ARCHIVE.twist}
        x={LAYOUT.safe.left + 40}
        y={620}
        w={520}
        h={340}
        opacity={filmed * (1 - tear2)}
        zoom={1.02}
        label="16mm · 1940.11.07"
        caption="全过程被岸边的人拍了下来"
      />

      {/* the deck tears apart in stages, never in a single frame */}
      <svg width={LAYOUT.width} height={LAYOUT.height} viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`} style={{position: 'absolute', inset: 0}}>
        {[0, 1, 2].map((i) => {
          const segStart = L('collapse', 8) + i * 30;
          const a = enter(frame, segStart, 16);
          if (a <= 0.01) return null;
          const y = 690 + i * 62;
          const x = 700 + i * 90;
          return (
            <g opacity={a} key={i} transform={`translate(${x} ${y}) rotate(${18 + i * 16})`}>
              <rect x={-110} y={-12} width={220} height={24} rx={3} fill="rgba(183,196,204,0.14)" stroke={theme.energy} strokeWidth={1.8} />
            </g>
          );
        })}
        <g opacity={tear1 * (1 - done)}>
          <text x={LAYOUT.safe.right - 120} y={980} fill={theme.energy} fontSize={24} textAnchor="end" fontFamily={theme.font} letterSpacing={2}>
            中跨被撕开
          </text>
        </g>
        <g opacity={done}>
          <text x={LAYOUT.width / 2} y={900} fill={theme.text} fontSize={44} textAnchor="middle" fontFamily={theme.font} letterSpacing={4}>
            它撑了将近半个小时
          </text>
        </g>
      </svg>
    </div>
  );
};
