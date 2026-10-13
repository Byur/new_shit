import React from 'react';
import {enter, smooth} from '../components/primitives';
import {line} from '../timing';
import {theme} from '../theme';

type Token = {t: string; jargon?: boolean};

const QUOTE_1: Token[] = [
  {t: '主力', jargon: true},
  {t: '在'},
  {t: '洗盘', jargon: true},
  {t: '，'},
  {t: '缩量回踩五日线', jargon: true},
  {t: '，属于'},
  {t: '良性调整', jargon: true},
  {t: '，别被'},
  {t: '震出去', jargon: true},
  {t: '。'},
];

const QUOTE_2: Token[] = [
  {t: '但如果'},
  {t: '放量跌破前低', jargon: true},
  {t: '，那就是'},
  {t: '出货', jargon: true},
  {t: '，赶紧'},
  {t: '核按钮', jargon: true},
  {t: '。'},
];

const termTime = (n: number, charIndex: number): number => {
  const l = line('hook', n);
  const total = l.display.length || 1;
  return l.startFrame + (charIndex / total) * l.frames;
};

const TokenRow: React.FC<{
  frame: number;
  tokens: Token[];
  lineIndex: number;
  baseOpacity: number;
  /** when true, non-jargon words fade away and only the jargon stays lit */
  isolate: number;
}> = ({frame, tokens, lineIndex, baseOpacity, isolate}) => {
  let cursor = 0;
  return (
    <div style={{display: 'block'}}>
      {tokens.map((tok, i) => {
        const charIndex = cursor;
        cursor += tok.t.length;
        const lit = enter(frame, termTime(lineIndex, charIndex), 7);
        const isJargon = Boolean(tok.jargon);
        const dimmed = isJargon ? 1 : 1 - isolate * 0.86;
        const scale = isJargon ? 1 + lit * 0.04 * (1 - isolate) : 1;
        return (
          <span
            key={`${lineIndex}-${i}`}
            style={{
              color: isJargon ? theme.predict : theme.text,
              opacity: baseOpacity * dimmed,
              textShadow: isJargon && lit > 0.4 ? `0 0 ${10 + lit * 16}px ${theme.predict}88` : 'none',
              transform: `scale(${scale})`,
              display: 'inline-block',
            }}
          >
            {tok.t}
          </span>
        );
      })}
    </div>
  );
};

/**
 * Hook: the viewer hears a fluent-sounding call, watches every piece of jargon
 * light up, then watches the connective language fall away until what is left
 * is a pile of words that carry no verifiable content.
 */
export const Hook: React.FC<{frame: number}> = ({frame}) => {
  const intro = enter(frame, line('hook', 0).startFrame, 10);
  const quoteIn = enter(frame, line('hook', 1).startFrame - 6, 16);
  const isolate = smooth(
    (frame - (line('hook', 3).startFrame - 4)) / 22,
  );
  const question = enter(frame, line('hook', 4).startFrame, 12);
  const cantJudge = enter(frame, line('hook', 5).startFrame, 12);
  const notYou = enter(frame, line('hook', 6).startFrame, 14);
  const promise = enter(frame, line('hook', 7).startFrame, 16);
  const scrim = Math.max(quoteIn * 0.55, isolate * 0.5) + notYou * 0.2;

  return (
    <div style={{position: 'absolute', inset: 0, fontFamily: theme.font}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(6,9,13,${Math.min(0.72, scrim)})`,
        }}
      />

      <div style={{position: 'absolute', left: 150, top: 210, right: 150, opacity: quoteIn}}>
        <div
          style={{
            color: theme.textFaint,
            fontSize: 26,
            letterSpacing: 4,
            marginBottom: 26,
          }}
        >
          一段股评
        </div>
        <div
          style={{
            fontSize: 58,
            lineHeight: 1.62,
            fontWeight: 500,
            letterSpacing: 1,
          }}
        >
          <TokenRow
            frame={frame}
            tokens={QUOTE_1}
            lineIndex={1}
            baseOpacity={1}
            isolate={isolate}
          />
          <TokenRow
            frame={frame}
            tokens={QUOTE_2}
            lineIndex={2}
            baseOpacity={Math.max(0, Math.min(1, (frame - line('hook', 2).startFrame + 8) / 12))}
            isolate={isolate}
          />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 640,
          opacity: question,
          transform: `translateY(${(1 - question) * 18}px)`,
        }}
      >
        <div style={{color: theme.text, fontSize: 66, fontWeight: 700, letterSpacing: 2}}>
          每个字你都认识
          <span style={{color: theme.textFaint, fontWeight: 500}}>，可它到底说了什么？</span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 758,
          opacity: cantJudge,
          transform: `translateY(${(1 - cantJudge) * 16}px)`,
        }}
      >
        <div style={{color: theme.describe, fontSize: 52, letterSpacing: 1.5}}>
          你没法判断它对不对。
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 852,
          opacity: notYou,
          transform: `translateY(${(1 - notYou) * 16}px)`,
        }}
      >
        <div style={{color: theme.textDim, fontSize: 38, letterSpacing: 1.2}}>
          这不是你水平不够，是这套语言本来的样子。
        </div>
      </div>

      {promise > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 470,
            textAlign: 'center',
            opacity: promise,
            transform: `scale(${0.94 + promise * 0.06})`,
          }}
        >
          <div
            style={{
              color: theme.text,
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: 10,
            }}
          >
            拆开<span style={{color: theme.predict}}>黑话</span>
          </div>
          <div
            style={{
              marginTop: 30,
              color: theme.textDim,
              fontSize: 36,
              letterSpacing: 2,
              opacity: enter(frame, line('hook', 8).startFrame, 14),
            }}
          >
            看完之后，你应该能翻译任何一句股评
          </div>
        </div>
      ) : null}

      {intro > 0 && promise < 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 132,
            color: theme.textFaint,
            fontSize: 24,
            letterSpacing: 6,
            opacity: intro,
          }}
        >
          先听一段股评
        </div>
      ) : null}
    </div>
  );
};
