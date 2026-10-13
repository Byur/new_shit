import React from 'react';
import {enter} from './primitives';
import {LAYOUT, theme} from '../theme';

/**
 * The four decisions that produce a cup. They are shown locked from the very
 * first frame and unlock one at a time as the film earns them, so by the time
 * the producing regions are on screen the viewer is reading a filled-in chain
 * rather than a list of place names.
 */
export const CHAIN = [
  {key: 'species', label: '物种', value: '阿拉比卡 / 罗布斯塔', color: theme.arabica},
  {key: 'variety', label: '品种', value: 'Typica→Bourbon→杂交', color: theme.bred},
  {key: 'altitude', label: '海拔', value: '温度说了算', color: theme.altitude},
  {key: 'process', label: '处理法', value: '发酵决定酸与醇', color: theme.washed},
] as const;

const CHIP_W = 128;
const CHIP_GAP = 10;

export const Header: React.FC<{
  frame: number;
  unlocked: number;
  subtitle?: string;
}> = ({frame, unlocked, subtitle}) => {
  const totalW = CHAIN.length * CHIP_W + (CHAIN.length - 1) * CHIP_GAP;
  const right = LAYOUT.header.right;
  const startX = LAYOUT.width - right - totalW;

  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', fontFamily: theme.font}}>
      <div
        style={{
          position: 'absolute',
          left: LAYOUT.header.left,
          top: LAYOUT.header.top,
          opacity: enter(frame, 4, 18),
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
          <span style={{color: theme.text, fontSize: 30, fontWeight: 700, letterSpacing: 2}}>
            咖啡豆：品种、产区与风味
          </span>
          <span
            style={{
              color: theme.textFaint,
              fontSize: 17,
              border: `1px solid ${theme.panelEdge}`,
              borderRadius: 999,
              padding: '3px 11px',
              letterSpacing: 1,
            }}
          >
            数据来源 · FAO 2023 · ICO · SCA
          </span>
        </div>
        {subtitle ? (
          <div
            style={{
              color: theme.textFaint,
              fontSize: 18,
              marginTop: 7,
              letterSpacing: 1,
              height: 22,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: 'absolute',
          left: startX,
          top: LAYOUT.header.top - 4,
          display: 'flex',
          gap: CHIP_GAP,
          opacity: enter(frame, 10, 18),
        }}
      >
        {CHAIN.map((chip, i) => {
          const on = unlocked > i;
          const ramp = enter(frame, 20 + i * 6, 14);
          return (
            <div
              key={chip.key}
              style={{
                width: CHIP_W,
                boxSizing: 'border-box',
                border: `1.5px solid ${on ? chip.color : 'rgba(255,255,255,0.10)'}`,
                borderRadius: 10,
                padding: '7px 11px 8px',
                background: on ? `${chip.color}14` : 'rgba(255,255,255,0.015)',
                opacity: on ? 0.35 + 0.65 * ramp : 0.55,
              }}
            >
              <div
                style={{
                  fontSize: 19,
                  letterSpacing: 3,
                  color: on ? chip.color : theme.textFaint,
                  fontWeight: on ? 700 : 400,
                }}
              >
                {chip.label}
              </div>
              <div
                style={{
                  fontSize: 15,
                  marginTop: 4,
                  color: on ? theme.textDim : 'rgba(255,255,255,0.16)',
                  lineHeight: 1.25,
                  letterSpacing: 0.5,
                }}
              >
                {on ? chip.value : '未解锁'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
