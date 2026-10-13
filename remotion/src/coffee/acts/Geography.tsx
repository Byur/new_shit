import React from 'react';
import {L, sceneEnd, sceneStart} from '../timing';
import {enter, leave} from '../components/primitives';
import {LAYOUT, theme} from '../theme';
import {MapView, project} from '../components/MapCanvas';
import {AltitudeStrip, ActTitle} from '../components/panels';
import {byKey} from '../data';

const CASES = [
  {key: 'ethiopia', label: '埃塞俄比亚  8°N', note: '赤道附近，要高得多'},
  {key: 'brazil', label: '巴西  18°S', note: '纬度更高，低一些就够'},
  {key: 'vietnam', label: '越南  12°N', note: '600 m 只够种罗布斯塔'},
];

const CHAIN = [
  {t: '成熟更慢', s: '低温拉长果实发育期'},
  {t: '糖分更足', s: '蔗糖在豆内积累更多'},
  {t: '密度更高', s: '豆体更紧实，含水更稳'},
  {t: '酸质更亮', s: '烘焙时绿原酸降解更充分'},
];

/**
 * Act three. The coffee belt is the picture; the mechanism is that altitude is
 * a stand-in for latitude, because the plant only cares about temperature and
 * temperature falls about 6.5 degrees per kilometre. That single number explains
 * why Ethiopia needs 2000 m where Brazil needs 1100 m.
 */
export const Geography: React.FC<{frame: number; view: MapView}> = ({frame, view}) => {
  const op = Math.min(enter(frame, sceneStart('geography') - 4, 18), leave(frame, sceneEnd('geography') + 6, 20));
  if (op <= 0.01) return null;

  const beltLabels = enter(frame, L('geography', 1) - 4, 20) * leave(frame, L('geography', 7) + 4, 20);
  const chain = enter(frame, L('geography', 12) - 20, 20);
  const frost = enter(frame, L('geography', 13) - 10, 20);

  const rows = CASES.filter((c, i) => frame >= L('geography', 8 + i) - 20).map((c) => {
    const o = byKey(c.key);
    return {label: c.label, low: o.altLow, high: o.altHigh, color: theme.altitude, note: c.note};
  });

  const tropicN = project(view, -112, 23.5);
  const tropicS = project(view, -112, -23.5);
  const equator = project(view, -112, 0);
  const beltC = project(view, 74, 0);
  const frostLine = project(view, -48, -23.5);
  const frostPt = project(view, -45, -19);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, fontFamily: theme.font, pointerEvents: 'none'}}>
      <svg
        width={LAYOUT.width}
        height={LAYOUT.height}
        viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
        style={{position: 'absolute', inset: 0}}
      >
        <ActTitle frame={frame} appear={sceneStart('geography') - 10} text="第三行 · 海拔" sub="为什么海拔可以替代纬度" />

        {/* the belt itself, named */}
        <g opacity={beltLabels}>
          <text x={tropicN.x} y={tropicN.y - 14} fill={theme.arabica} fontSize={23} letterSpacing={1}>
            北回归线 23.5°N
          </text>
          <text x={tropicS.x} y={tropicS.y + 34} fill={theme.arabica} fontSize={23} letterSpacing={1}>
            南回归线 23.5°S
          </text>
          <text x={equator.x} y={equator.y - 10} fill={theme.textFaint} fontSize={20} letterSpacing={3}>
            赤道
          </text>
          <text x={beltC.x} y={beltC.y - 74} fill={theme.arabica} fontSize={27} letterSpacing={4} textAnchor="middle">
            咖啡带
          </text>
          <text x={beltC.x} y={beltC.y - 42} fill={theme.textDim} fontSize={20} textAnchor="middle">
            咖啡的全部商业产区都在这条带子里
          </text>
          <text x={beltC.x} y={beltC.y + 62} fill={theme.textFaint} fontSize={21} textAnchor="middle">
            怕霜 · 需要旱季与雨季交替才能开花
          </text>
        </g>

        {/* frost, which is what actually caps the altitude */}
        <g opacity={frost}>
          <line
            x1={LAYOUT.map.left + 20}
            x2={LAYOUT.map.right - 20}
            y1={frostLine.y}
            y2={frostLine.y}
            stroke="#8FB3E0"
            strokeWidth={2}
            strokeDasharray="12 9"
            opacity={0.75}
          />
          <text x={LAYOUT.map.left + 30} y={frostLine.y - 14} fill="#8FB3E0" fontSize={22} letterSpacing={1}>
            霜冻线 · 越线就没有收成
          </text>
          <rect x={frostPt.x - 200} y={frostPt.y + 28} width={540} height={104} rx={12} fill="rgba(13,9,5,0.94)" stroke="#8FB3E0" strokeWidth={1.6} />
          <text x={frostPt.x - 176} y={frostPt.y + 72} fill="#8FB3E0" fontSize={26} fontWeight={700}>
            1994 · 2021 巴西霜冻
          </text>
          <text x={frostPt.x - 176} y={frostPt.y + 108} fill={theme.textDim} fontSize={21}>
            两次都让国际咖啡价格大幅跳涨，1994 年那次一年翻倍。
          </text>
        </g>

        {/* why anybody pays more for altitude */}
        <g opacity={chain}>
          <rect x={150} y={262} width={686} height={196} rx={12} fill="rgba(13,9,5,0.9)" stroke={theme.altitude} strokeWidth={1.3} strokeOpacity={0.6} />
          <text x={182} y={302} fill={theme.altitude} fontSize={23} letterSpacing={2}>
            高海拔为什么更好喝
          </text>
          {CHAIN.map((c, i) => (
            <g key={c.t} opacity={enter(frame, L('geography', 12) - 16 + i * 9, 16)}>
              <rect x={182 + i * 164} y={328} width={148} height={104} rx={9} fill="rgba(127,178,168,0.10)" stroke={theme.altitude} strokeWidth={1.1} strokeOpacity={0.5} />
              <text x={196 + i * 164} y={368} fill={theme.text} fontSize={22} fontWeight={600}>
                {c.t}
              </text>
              <text x={196 + i * 164} y={398} fill={theme.textDim} fontSize={15}>
                {c.s.slice(0, 9)}
              </text>
              {i < 3 ? (
                <text x={182 + i * 164 + 152} y={388} fill={theme.altitude} fontSize={26}>
                  →
                </text>
              ) : null}
            </g>
          ))}
          <text x={182} y={450} fill={theme.textFaint} fontSize={17}>
            温度低 → 果实发育变慢 → 糖分与密度上升 → 杯中的酸更明亮、更干净
          </text>
        </g>

        {rows.length > 0 ? (
          <AltitudeStrip
            frame={frame}
            appear={L('geography', 8) - 22}
            fade={sceneEnd('geography') + 4}
            x={150}
            y={646}
            width={1686}
            rowH={44}
            title="同样是阿拉比卡，产地海拔可以差上一千米"
            axisNote="海拔每升高 1000 m，气温约下降 6.5 °C"
            rows={rows}
          />
        ) : null}
      </svg>
    </div>
  );
};
