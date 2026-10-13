import React from 'react';
import {candles, TODAY} from '../chart';
import {LAYOUT, theme} from '../theme';

type Props = {
  /** Day the header should quote as "current" */
  currentDay: number;
};

export const Header: React.FC<Props> = ({currentDay}) => {
  const day = Math.max(0, Math.min(candles.length - 1, Math.round(currentDay)));
  const price = candles[day].close;
  const ref = candles[day - 1] ?? candles[day];
  const change = ((price - ref.close) / ref.close) * 100;
  const up = change >= 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: 96,
        right: 84,
        top: LAYOUT.header.top,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: theme.font,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 10,
            background: theme.predict,
            display: 'inline-block',
          }}
        />
        <span style={{color: theme.text, fontSize: 25, fontWeight: 600, letterSpacing: 1}}>
          示例走势
        </span>
        <span
          style={{
            color: theme.textFaint,
            fontSize: 19,
            letterSpacing: 2,
            border: `1px solid ${theme.panelEdge}`,
            borderRadius: 999,
            padding: '3px 14px',
          }}
        >
          模拟数据 · 非真实行情
        </span>
      </div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
        <span style={{color: theme.textFaint, fontSize: 19}}>
          {day > TODAY ? '推演' : '现价'}
        </span>
        <span
          style={{
            color: theme.text,
            fontSize: 30,
            fontFamily: theme.mono,
            fontWeight: 600,
          }}
        >
          {price.toFixed(2)}
        </span>
        <span style={{color: up ? theme.up : theme.down, fontSize: 22, fontFamily: theme.mono}}>
          {up ? '+' : ''}
          {change.toFixed(2)}%
        </span>
      </div>
    </div>
  );
};
