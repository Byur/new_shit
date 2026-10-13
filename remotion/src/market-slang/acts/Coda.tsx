import React from 'react';
import {View} from '../camera';
import {enter} from '../components/primitives';
import {line, sceneStart} from '../timing';
import {theme} from '../theme';

const L = (n: number) => line('coda', n).startFrame;

type Token = {t: string; jargon?: boolean; group?: number; owner?: string};

const QUOTE: Token[] = [
  {t: '主力', jargon: true, group: 1, owner: '喊话的人'},
  {t: '在'},
  {t: '洗盘', jargon: true, group: 3, owner: '想让你拿着的人'},
  {t: '，'},
  {t: '缩量回踩五日线', jargon: true, group: 2, owner: '给你信心的人'},
  {t: '，属于良性调整，'},
  {t: '别被震出去', jargon: true, group: 2, owner: '让你别卖的人'},
  {t: '。但如果'},
  {t: '放量跌破前低', jargon: true, group: 2, owner: '给你压力的人'},
  {t: '，那就是'},
  {t: '出货', jargon: true, group: 3, owner: '想让你接盘的人'},
  {t: '，赶紧'},
  {t: '核按钮', jargon: true, group: 2, owner: '让你割肉的人'},
  {t: '。'},
];

const QUESTIONS: Array<{
  n: number;
  q: string;
  a: string;
  color: string;
}> = [
  {
    n: 1,
    q: '谁在说？',
    a: '他是手里拿着筹码的人，还是想让你接筹码的人',
    color: theme.predict,
  },
  {
    n: 2,
    q: '他希望我做什么？',
    a: '这个词后面跟着的动作，是买入、持有，还是离场',
    color: theme.describe,
  },
  {
    n: 3,
    q: '如果他说错了，会怎么样？',
    a: '洗盘错了没人负责，而你会亏钱',
    color: theme.up,
  },
];

/**
 * Coda. The opening quote comes back and is translated in front of the viewer
 * with the three questions, then each piece of jargon is shown to be carrying
 * somebody else's position rather than a fact about the market.
 */
export const Coda: React.FC<{frame: number; view: View}> = ({frame}) => {
  const quoteIn = enter(frame, L(0), 16);
  const moved = enter(frame, L(1) + 8, 18);
  const final = enter(frame, L(11), 18);
  const positions = enter(frame, L(9), 18);
  const responsibility = enter(frame, L(7), 16);

  const quoteTop = 150 + moved * 0;
  const quoteScale = 1 - moved * 0.16;
  const quoteLeft = 210 + moved * 90;

  const groupActive = (g: number): boolean => {
    if (g === 1) return frame >= L(2) && frame < L(9);
    if (g === 2) return frame >= L(4) && frame < L(9);
    if (g === 3) return frame >= L(6) && frame < L(9);
    return false;
  };

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: theme.font}}>
      {/* ---- the quote returns ------------------------------------------ */}
      <div
        style={{
          position: 'absolute',
          left: quoteLeft,
          right: 210,
          top: quoteTop,
          transform: `scale(${quoteScale})`,
          transformOrigin: 'left top',
          opacity: quoteIn * (1 - positions * 0.9),
          background: 'rgba(9,12,17,0.82)',
          border: `1px solid ${theme.panelEdge}`,
          borderLeft: `5px solid ${theme.textFaint}`,
          borderRadius: 14,
          padding: '26px 34px',
        }}
      >
        <div style={{color: theme.textFaint, fontSize: 22, letterSpacing: 5, marginBottom: 16}}>
          开头那段股评
        </div>
        <div style={{fontSize: 42, lineHeight: 1.62, letterSpacing: 0.5}}>
          {QUOTE.map((tok, i) => {
            const active = Boolean(tok.jargon) && groupActive(tok.group ?? 0);
            return (
              <span
                key={i}
                style={{
                  color: active ? theme.predict : tok.jargon ? theme.textDim : theme.text,
                  background: active ? `${theme.predict}1f` : 'transparent',
                  boxShadow: active ? `inset 0 -3px 0 ${theme.predict}` : 'none',
                  borderRadius: 4,
                  padding: active ? '2px 3px' : '2px 0',
                }}
              >
                {tok.t}
              </span>
            );
          })}
        </div>
      </div>

      {/* ---- the three questions ----------------------------------------- */}
      {moved > 0.01 && frame < L(9) ? (
        <div style={{position: 'absolute', left: 300, top: 452, width: 1340}}>
          {QUESTIONS.map((item, i) => {
            const appearAt = [L(2), L(4), L(6)][i];
            const o = enter(frame, appearAt, 14);
            return (
              <div
                key={item.n}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                  marginBottom: 26,
                  opacity: o,
                  transform: `translateX(${(1 - o) * 22}px)`,
                }}
              >
                <span
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    border: `2px solid ${item.color}`,
                    color: item.color,
                    fontSize: 27,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {item.n}
                </span>
                <span style={{color: theme.text, fontSize: 40, letterSpacing: 1, width: 470}}>
                  {item.q}
                </span>
                <span style={{color: item.color, fontSize: 28, letterSpacing: 0.5}}>{item.a}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ---- responsibility ---------------------------------------------- */}
      {responsibility > 0.01 && positions < 0.6 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 466,
            textAlign: 'center',
            opacity: responsibility * (1 - positions),
          }}
        >
          <div style={{fontSize: 42, color: theme.textDim, letterSpacing: 2}}>
            洗盘和出货最大的区别，不是对错
          </div>
          <div style={{marginTop: 26, display: 'flex', justifyContent: 'center', gap: 40}}>
            <div
              style={{
                border: `2px solid ${theme.describe}`,
                borderRadius: 12,
                padding: '18px 30px',
                color: theme.describe,
                fontSize: 30,
              }}
            >
              洗盘错了 · <span style={{color: theme.text}}>没有人为你负责</span>
            </div>
            <div
              style={{
                border: `2px solid ${theme.up}`,
                borderRadius: 12,
                padding: '18px 30px',
                color: theme.up,
                fontSize: 30,
              }}
            >
              你信了 · <span style={{color: theme.text}}>亏的是你的钱</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---- each term is somebody's position ----------------------------- */}
      {positions > 0.01 ? (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `rgba(6,9,13,${positions * 0.82})`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 236,
              textAlign: 'center',
              opacity: positions,
            }}
          >
            <div style={{color: theme.textFaint, fontSize: 27, letterSpacing: 7, marginBottom: 34}}>
              黑话是一份压缩文件
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center'}}>
              {[
                {t: '洗盘', o: '想让你拿着的人'},
                {t: '缩量回踩五日线', o: '给你信心的人'},
                {t: '核按钮', o: '让你割肉的人'},
                {t: '出货', o: '想让你接盘的人'},
              ].map((row, i) => {
                const o = enter(frame, L(9) + i * 9, 12);
                return (
                  <div
                    key={row.t}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 22,
                      opacity: o,
                      transform: `translateY(${(1 - o) * 16}px)`,
                    }}
                  >
                    <span
                      style={{
                        minWidth: 380,
                        textAlign: 'right',
                        color: theme.predict,
                        fontSize: 36,
                        fontWeight: 700,
                        letterSpacing: 1,
                      }}
                    >
                      {row.t}
                    </span>
                    <span style={{color: theme.textGhost, fontSize: 30}}>→</span>
                    <span style={{color: theme.text, fontSize: 30, letterSpacing: 1}}>{row.o}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      {/* ---- closing ------------------------------------------------------ */}
      {final > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `rgba(6,9,13,${final * 0.84})`,
          }}
        />
      ) : null}
      {final > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 366,
            textAlign: 'center',
            opacity: final,
          }}
        >
          <div style={{fontSize: 44, color: theme.textDim, letterSpacing: 2}}>
            黑话不是让你显得专业的东西
          </div>
          <div style={{marginTop: 18, fontSize: 44, color: theme.textDim, letterSpacing: 2}}>
            它是一份压缩文件，里面装着<span style={{color: theme.predict}}>别人的立场</span>
          </div>
          <div
            style={{
              marginTop: 62,
              fontSize: 34,
              color: theme.text,
              letterSpacing: 3,
              opacity: enter(frame, L(11) + 24, 14),
            }}
          >
            听懂它，不是为了跟着说
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 64,
              fontWeight: 800,
              color: theme.text,
              letterSpacing: 4,
              opacity: enter(frame, L(12), 18),
            }}
          >
            是为了知道，屏幕对面那个人，
            <span style={{color: theme.predict}}>到底站在哪一边</span>
          </div>
        </div>
      ) : null}

      {frame < L(1) ? (
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 128,
            color: theme.textFaint,
            fontSize: 24,
            letterSpacing: 6,
            opacity: enter(frame, sceneStart('coda'), 12) * (1 - moved),
          }}
        >
          回到开头那句话
        </div>
      ) : null}
    </div>
  );
};
