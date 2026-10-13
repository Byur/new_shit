import React from 'react';
import {View} from '../camera';
import {EVENTS, TODAY} from '../chart';
import {makeProjector} from '../components/ChartCanvas';
import {Tag} from '../components/primitives';
import {enter, track} from '../components/primitives';
import {line, sceneStart} from '../timing';
import {LAYOUT, PLOT_H, PLOT_W, theme} from '../theme';

const L = (n: number) => line('duallabel', n).startFrame;

/**
 * The pivot of the whole piece. The identical stretch of chart that the viewer
 * has already lived through gets labelled twice, and the two labels are shown
 * to be the same description fused to opposite forecasts.
 */
export const DualLabel: React.FC<{frame: number; view: View}> = ({frame, view}) => {
  const p = makeProjector(view);

  const boxIn = enter(frame, L(3), 16);
  const converge = enter(frame, L(10), 20);
  const intentIn = enter(frame, L(12), 14);
  const anatomy = enter(frame, L(15), 16);
  const tuck = enter(frame, L(17), 22);

  const cueDay = track(frame, [
    [L(0), 40],
    [L(2), 86],
    [L(14), 86],
    [L(14) + 30, 170],
    [L(17), 170],
  ]);

  const sharedX = p.x(86);
  const sharedY = p.y(10.45);

  const washX = p.x(78) + (sharedX - p.x(78)) * converge;
  const washY = p.y(11.6) + (sharedY - p.y(11.6)) * converge;
  const shipX = p.x(94) + (sharedX - p.x(94)) * converge;
  const shipY = p.y(9.3) + (sharedY - p.y(9.3)) * converge;

  const boxX0 = p.x(EVENTS.peakDay - 2);
  const boxX1 = p.x(EVENTS.lowDay + 2);
  const boxY0 = p.y(12.75);
  const boxY1 = p.y(7.85);

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: theme.font}}>
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
      >
        <defs>
          <clipPath id="dlPlotClip">
            <rect
              x={LAYOUT.plot.left}
              y={LAYOUT.plot.top}
              width={PLOT_W}
              height={PLOT_H}
            />
          </clipPath>
        </defs>

        {/* the stretch under discussion */}
        <g clipPath="url(#dlPlotClip)">
          {boxIn > 0.01 ? (
            <g opacity={boxIn * (1 - enter(frame, L(14), 16))}>
              <rect
                x={boxX0}
                y={boxY0}
                width={boxX1 - boxX0}
                height={boxY1 - boxY0}
                fill={theme.predict}
                opacity={0.07 + converge * 0.07 + Math.sin(frame / 7) * 0.015 * converge}
                rx={8}
              />
              <rect
                x={boxX0}
                y={boxY0}
                width={boxX1 - boxX0}
                height={boxY1 - boxY0}
                fill="none"
                stroke={theme.predict}
                strokeWidth={2}
                strokeDasharray="10 8"
                opacity={0.6}
                rx={8}
              />
              <text
                x={boxX0 + 6}
                y={boxY0 - 14}
                fill={theme.predict}
                fontFamily={theme.font}
                fontSize={26}
                opacity={boxIn}
              >
                这段下跌
              </text>
            </g>
          ) : null}

          {/* three months of hindsight: the future bars settle */}
          <g opacity={enter(frame, L(14), 24)}>
            <line
              x1={p.x(TODAY)}
              x2={p.x(TODAY)}
              y1={p.y(12.4)}
              y2={p.y(7.6)}
              stroke={theme.predict}
              strokeWidth={2.5}
              strokeDasharray="7 7"
            />
            <text
              x={p.x(TODAY) + 10}
              y={p.y(12.15)}
              fill={theme.predict}
              fontFamily={theme.font}
              fontSize={24}
            >
              今天
            </text>
          </g>
        </g>
      </svg>

      {/* ---- two names for one stretch ---------------------------------- */}
      <Tag
        frame={frame}
        appear={L(4)}
        box={{
          left: 150 + converge * 300,
          top: 208 + converge * 60,
          width: 336,
        }}
        anchor={{x: washX, y: washY}}
        color={theme.predict}
        label="洗盘"
        sub="主力故意砸盘震仓，后面还有更大的上涨"
        side="right"
        emphasis={frame >= L(5) && frame < L(7) ? 0.8 : converge * 0.5}
        exitAt={L(15) + 6}
      />

      <Tag
        frame={frame}
        appear={L(7)}
        box={{
          left: 1112 - converge * 250,
          top: 588 - converge * 130,
          width: 372,
        }}
        anchor={{x: shipX, y: shipY}}
        color={theme.describe}
        label="出货"
        sub="主力在派发筹码，后面还要跌"
        side="left"
        emphasis={frame >= L(8) && frame < L(10) ? 0.8 : converge * 0.5}
        exitAt={L(15) + 6}
      />

      {/* ---- the two words are the same picture -------------------------- */}
      {frame >= L(10) && frame < L(15) ? (
        <div
          style={{
            position: 'absolute',
            left: Math.max(LAYOUT.plot.left + 4, Math.min(sharedX, LAYOUT.plot.right - 864)),
            top: sharedY - 226,
            width: 860,
            textAlign: 'center',
            opacity: enter(frame, L(10), 14) * (1 - enter(frame, L(14), 12)),
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'stretch',
              border: `2px solid ${theme.predict}`,
              borderRadius: 14,
              overflow: 'hidden',
              background: 'rgba(9,12,17,0.92)',
            }}
          >
            <div style={{padding: '14px 26px', background: `${theme.predict}1f`}}>
              <div style={{color: theme.predict, fontSize: 36, fontWeight: 800}}>洗盘</div>
              <div style={{color: theme.textDim, fontSize: 20, marginTop: 4}}>后面会涨</div>
            </div>
            <div
              style={{
                width: 2,
                background: theme.predict,
                opacity: 0.5,
              }}
            />
            <div style={{padding: '14px 26px', background: `${theme.describe}1f`}}>
              <div style={{color: theme.describe, fontSize: 36, fontWeight: 800}}>出货</div>
              <div style={{color: theme.textDim, fontSize: 20, marginTop: 4}}>后面会跌</div>
            </div>
          </div>
          <div
            style={{
              marginTop: 16,
              color: theme.text,
              fontSize: 32,
              letterSpacing: 1.5,
              opacity: enter(frame, L(11), 12),
            }}
          >
            同样的跌幅 · 同样的成交量 · 同样的 K 线
          </div>
        </div>
      ) : null}

      {/* ---- the unverifiable bit ---------------------------------------- */}
      {frame >= L(12) && frame < L(15) ? (
        <div
          style={{
            position: 'absolute',
            left: Math.max(LAYOUT.plot.left + 4, Math.min(sharedX - 300, LAYOUT.plot.right - 604)),
            top: sharedY + 118,
            width: 600,
            textAlign: 'center',
            opacity: intentIn * (1 - enter(frame, L(14), 12)),
          }}
        >
          <div
            style={{
              display: 'inline-block',
              border: `2px dashed ${theme.textDim}`,
              borderRadius: 10,
              padding: '12px 24px',
              color: theme.text,
              fontSize: 30,
              background: 'rgba(9,12,17,0.86)',
            }}
          >
            唯一的区别：主力想干什么？
          </div>
          <div style={{marginTop: 12, color: theme.textFaint, fontSize: 25, letterSpacing: 1}}>
            这件事，你没办法当场验证
          </div>
        </div>
      ) : null}

      {/* ---- what is left once hindsight arrives -------------------------- */}
      {frame >= L(14) && frame < L(15) ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 210,
            textAlign: 'center',
            opacity: enter(frame, L(14), 14),
          }}
        >
          <div style={{fontSize: 40, color: theme.text, letterSpacing: 2}}>
            三个月以后回头看，才知道是哪个 —— 但那时已经晚了
          </div>
        </div>
      ) : null}

      {/* ---- anatomy of one word ----------------------------------------- */}
      {anatomy > 0.01 ? (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `rgba(6,9,13,${anatomy * 0.72})`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 250,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              opacity: anatomy,
            }}
          >
            <div style={{color: theme.textFaint, fontSize: 28, letterSpacing: 6, marginBottom: 30}}>
              一个词里面装着两样东西
            </div>

            <div style={{position: 'relative', width: 1080, height: 260}}>
              {/* the forecast, which slides underneath */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 132,
                  transform: `translateY(${-tuck * 132}px)`,
                  zIndex: tuck > 0.5 ? 1 : 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 22,
                  padding: '22px 30px',
                  borderRadius: 14,
                  border: `2px solid ${theme.predict}`,
                  background: 'rgba(30,23,10,0.96)',
                }}
              >
                <span
                  style={{
                    color: theme.predict,
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: 2,
                    minWidth: 96,
                  }}
                >
                  预测
                </span>
                <span style={{color: theme.text, fontSize: 34}}>后面还有更大的上涨</span>
                <span style={{marginLeft: 'auto', color: theme.predict, fontSize: 24}}>
                  无法验证
                </span>
              </div>

              {/* the description, which stays on top */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 22,
                  padding: '22px 30px',
                  borderRadius: 14,
                  border: `2px solid ${theme.describe}`,
                  background: 'rgba(15,19,25,0.97)',
                }}
              >
                <span
                  style={{
                    color: theme.describe,
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: 2,
                    minWidth: 96,
                  }}
                >
                  描述
                </span>
                <span style={{color: theme.text, fontSize: 34}}>价格从 12 跌到 8</span>
                <span style={{marginLeft: 'auto', color: theme.describe, fontSize: 24}}>
                  可观察
                </span>
              </div>
            </div>

            <div
              style={{
                marginTop: 34,
                fontSize: 62,
                fontWeight: 800,
                letterSpacing: 4,
                color: theme.text,
                opacity: tuck,
              }}
            >
              它是一个预测，
              <span style={{color: theme.predict}}>被伪装成了描述</span>
            </div>
          </div>
        </>
      ) : null}

      {/* ---- act label ---------------------------------------------------- */}
      {frame < L(3) ? (
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 128,
            color: theme.textFaint,
            fontSize: 24,
            letterSpacing: 6,
            opacity: enter(frame, sceneStart('duallabel'), 12),
          }}
        >
          第三件 · 同一根 K 线，两种黑话
        </div>
      ) : null}

      {frame < L(3) ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 214,
            textAlign: 'center',
            opacity: enter(frame, L(0), 14) * (1 - enter(frame, L(3), 14)),
          }}
        >
          <div style={{fontSize: 44, color: theme.textDim, letterSpacing: 2}}>
            回到开头那句话
          </div>
        </div>
      ) : null}

      {frame >= L(2) && frame < L(4) ? (
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 200,
            opacity: enter(frame, L(2), 12) * (1 - enter(frame, L(4), 12)),
          }}
        >
          <div style={{fontSize: 42, color: theme.text, letterSpacing: 2}}>
            它从 <span style={{color: theme.mono}}>12</span> 块跌到{' '}
            <span style={{color: theme.mono}}>8</span> 块
          </div>
        </div>
      ) : null}

      {frame >= L(3) && frame < L(4) ? (
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 274,
            opacity: enter(frame, L(3), 12) * (1 - enter(frame, L(4), 12)),
          }}
        >
          <div style={{fontSize: 34, color: theme.textDim, letterSpacing: 1.5}}>
            同样这段下跌，股评可以给你两个词
          </div>
        </div>
      ) : null}

      {/* the cue marker that carries the eye along the leg */}
      {frame >= L(14) ? (
        <div
          style={{
            position: 'absolute',
            left: Math.min(p.x(cueDay) + 12, LAYOUT.plot.right - 70),
            top: p.y(7.9),
            color: theme.textFaint,
            fontSize: 22,
            fontFamily: theme.mono,
            opacity: enter(frame, L(14), 16) * (1 - enter(frame, L(15), 10)) * 0.9,
          }}
        >
          事后
        </div>
      ) : null}
    </div>
  );
};
