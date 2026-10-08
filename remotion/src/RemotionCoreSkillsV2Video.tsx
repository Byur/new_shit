import { CheckCircle, PlayCircle, VideoCamera } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CaptionBar, Panel, ProgressRail, VideoBackground } from "./design/components";
import { clampEase, enterY } from "./design/motion";
import { COLORS, TYPOGRAPHY, VIDEO } from "./design/tokens";

const durations = [300, 390, 450, 420, 420, 390, 390];

export const remotionCoreSkillsV2DurationInFrames = durations.reduce((sum, duration) => sum + duration, 0);

type Beat = {
  kicker: string;
  title: string;
  description: string;
  caption: string;
};

const beats: Beat[] = [
  {
    kicker: "00 / THE GAP",
    title: "同一句视频请求，结果为什么不同？",
    description: "差别往往不在多写几句提示，而在有没有一条可检查的创作路径。",
    caption: "模糊请求只描述终点，不能自动补出中间的方法。",
  },
  {
    kicker: "01 / LOAD METHOD",
    title: "Skill 让经验变成可加载的方法",
    description: "它先明确适用范围，再给出顺序和验收点；Agent 仍然负责判断与执行。",
    caption: "Skill 不是替你做决定，而是减少无依据的猜测。",
  },
  {
    kicker: "02 / MAKE A PATH",
    title: "把视频任务拆成可见的路径",
    description: "从教学目标开始，依次决定故事、画面、时间轴和交付检查。",
    caption: "每一步都留下可观察的中间结果，才方便判断是否继续。",
  },
  {
    kicker: "03 / SHOW THE IDEA",
    title: "视觉不是装饰，是概念的证据",
    description: "好的画面让学习者看见变化：混乱如何变成结构，步骤如何变成产物。",
    caption: "优先设计一个可见的转化，而不是堆叠更多卡片和动效。",
  },
  {
    kicker: "04 / CAPTIONS",
    title: "字幕是一条同步的教学轨道",
    description: "没有配音时，字幕承担节奏、重点和解释，但不能遮住正在发生的画面。",
    caption: "字幕要和画面同时推进，而不是视频做完后的补丁。",
  },
  {
    kicker: "05 / REVIEW",
    title: "渲染前，先抽样审查高风险画面",
    description: "密集信息场景至少看进入完成、稳定状态和离场前三个时刻。",
    caption: "检查信息层级、重叠、临时碰撞，以及字幕是否抢走注意力。",
  },
  {
    kicker: "06 / SHIP",
    title: "最终交付的是可播放、可复查的视频",
    description: "预览帮助判断，headless render 负责产出；二者结合才是完整的创作闭环。",
    caption: "先选方法，再做画面，最后用真实产物验收。",
  },
];

const sceneAt = (frame: number) => {
  let cursor = 0;
  for (let index = 0; index < durations.length; index += 1) {
    const duration = durations[index];
    if (frame < cursor + duration) return { index, localFrame: frame - cursor };
    cursor += duration;
  }
  return { index: durations.length - 1, localFrame: durations[durations.length - 1] - 1 };
};

const Header: React.FC<{ beat: Beat; frame: number; accent?: string }> = ({ beat, frame, accent = COLORS.green }) => {
  const p = clampEase(frame, 8, 34);
  return (
    <div style={{ position: "absolute", left: VIDEO.safeX, top: VIDEO.safeTop, width: 900, opacity: p, transform: `translateY(${enterY(p, 20)}px)` }}>
      <div style={{ color: accent, fontSize: TYPOGRAPHY.kicker, fontWeight: 850, letterSpacing: 1, marginBottom: 22 }}>{beat.kicker}</div>
      <div style={{ color: COLORS.text, fontSize: TYPOGRAPHY.title, lineHeight: 1.08, fontWeight: 900 }}>{beat.title}</div>
      <div style={{ color: COLORS.muted, fontSize: TYPOGRAPHY.subtitle, lineHeight: 1.48, marginTop: 26, maxWidth: 820 }}>{beat.description}</div>
    </div>
  );
};

const SceneFrame: React.FC<{ beat: Beat; frame: number; accent?: string; children: ReactNode }> = ({ beat, frame, accent, children }) => (
  <>
    <Header beat={beat} frame={frame} accent={accent} />
    {children}
    <CaptionBar text={beat.caption} />
  </>
);

const GapScene: React.FC<{ frame: number }> = ({ frame }) => {
  const left = clampEase(frame, 24, 70);
  const right = clampEase(frame, 64, 112);
  const arrow = clampEase(frame, 104, 144);
  return (
    <SceneFrame beat={beats[0]} frame={frame} accent={COLORS.coral}>
      <div style={{ position: "absolute", right: 120, top: 215, width: 850, height: 500 }}>
        <Panel accent={COLORS.coral} style={{ position: "absolute", left: 0, top: 95, width: 310, height: 270, padding: 28, opacity: left, transform: `translateY(${enterY(left, 24)}px)` }}>
          <div style={{ color: COLORS.coral, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 21 }}>PROMPT ONLY</div>
          <div style={{ color: COLORS.text, fontSize: 32, fontWeight: 850, marginTop: 34 }}>做一个好视频</div>
          <div style={{ color: COLORS.muted, fontSize: 22, lineHeight: 1.55, marginTop: 28 }}>主题？范围？<br />画面？节奏？<br />怎么判断够好？</div>
        </Panel>
        <div style={{ position: "absolute", left: 324, top: 226, width: 165, height: 4, background: COLORS.yellow, transform: `scaleX(${arrow})`, transformOrigin: "left center" }} />
        <Panel accent={COLORS.green} style={{ position: "absolute", right: 0, top: 34, width: 325, height: 392, padding: 30, opacity: right, transform: `translateY(${enterY(right, 24)}px)` }}>
          <div style={{ color: COLORS.green, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 21 }}>METHOD LOADED</div>
          {["定义学习目标", "设计可见证据", "抽样审查画面", "headless 交付"].map((item, index) => (
            <div key={item} style={{ color: index === 2 ? COLORS.yellow : COLORS.text, fontSize: 24, fontWeight: 750, marginTop: 30, opacity: clampEase(frame, 88 + index * 16, 112 + index * 16) }}>0{index + 1} / {item}</div>
          ))}
        </Panel>
      </div>
    </SceneFrame>
  );
};

const MethodScene: React.FC<{ frame: number }> = ({ frame }) => {
  const blocks = [
    ["CONTEXT", "适用范围", COLORS.cyan],
    ["METHOD", "执行顺序", COLORS.green],
    ["TOOLS", "工具入口", COLORS.yellow],
    ["QA", "验收方式", COLORS.coral],
  ] as const;
  return (
    <SceneFrame beat={beats[1]} frame={frame} accent={COLORS.purple}>
      <Panel accent={COLORS.purple} style={{ position: "absolute", right: 115, top: 205, width: 850, height: 535, padding: 30 }}>
        <div style={{ color: COLORS.purple, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 22 }}>SKILL / REUSABLE METHOD</div>
        <div style={{ color: COLORS.text, fontSize: 29, fontWeight: 850, marginTop: 20 }}>把一次判断，拆成下一次也能复用的结构</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 30 }}>
          {blocks.map(([name, label, color], index) => {
            const p = clampEase(frame, 38 + index * 16, 72 + index * 16);
            return <Panel key={name} accent={color} style={{ height: 126, padding: 22, opacity: p, transform: `translateY(${enterY(p, 16)}px)` }}><div style={{ color, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 19 }}>{name}</div><div style={{ color: COLORS.text, fontSize: 27, fontWeight: 850, marginTop: 25 }}>{label}</div></Panel>;
          })}
        </div>
      </Panel>
    </SceneFrame>
  );
};

const PathScene: React.FC<{ frame: number }> = ({ frame }) => {
  const steps = ["目标", "故事", "画面", "检查", "产出"];
  const progress = clampEase(frame, 38, 200);
  return (
    <SceneFrame beat={beats[2]} frame={frame} accent={COLORS.cyan}>
      <div style={{ position: "absolute", right: 102, top: 242, width: 900, height: 370 }}>
        <div style={{ position: "absolute", left: 80, right: 80, top: 152, height: 4, background: COLORS.faint }} />
        <div style={{ position: "absolute", left: 80, top: 152, width: 740 * progress, height: 4, background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.green}, ${COLORS.yellow}, ${COLORS.coral})` }} />
        {steps.map((step, index) => {
          const p = clampEase(frame, 34 + index * 28, 70 + index * 28);
          const color = [COLORS.cyan, COLORS.green, COLORS.yellow, COLORS.purple, COLORS.coral][index];
          return <div key={step} style={{ position: "absolute", left: 35 + index * 175, top: index % 2 === 0 ? 32 : 182, width: 140, opacity: p, transform: `translateY(${enterY(p, 18)}px)` }}><Panel accent={color} style={{ height: 92, display: "flex", alignItems: "center", justifyContent: "center", color, fontSize: 25, fontWeight: 850 }}>{step}</Panel><div style={{ color: COLORS.muted, fontSize: 18, textAlign: "center", marginTop: 14 }}>{["学完能做什么", "一句主线", "可见转化", "高风险抽样", "MP4 + 关键帧"][index]}</div></div>;
        })}
      </div>
    </SceneFrame>
  );
};

const EvidenceScene: React.FC<{ frame: number }> = ({ frame }) => {
  const noisy = clampEase(frame, 26, 86);
  const sorted = clampEase(frame, 96, 170);
  return (
    <SceneFrame beat={beats[3]} frame={frame} accent={COLORS.yellow}>
      <div style={{ position: "absolute", right: 110, top: 220, width: 870, height: 500 }}>
        <Panel accent={COLORS.coral} style={{ position: "absolute", left: 0, top: 70, width: 300, height: 280, padding: 24, opacity: noisy, transform: `rotate(-3deg) translateY(${enterY(noisy, 18)}px)` }}>
          <div style={{ color: COLORS.coral, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 20 }}>BEFORE</div>
          {["更多功能", "再加动效", "看起来高级", "快点出片"].map((text, index) => <div key={text} style={{ color: COLORS.text, fontSize: 22, fontWeight: 750, marginTop: 18, transform: `translateX(${index % 2 ? 14 : 0}px)` }}>{text}</div>)}
        </Panel>
        <div style={{ position: "absolute", left: 313, top: 204, width: 150, height: 4, background: COLORS.yellow, transform: `scaleX(${sorted})`, transformOrigin: "left" }} />
        <Panel accent={COLORS.green} style={{ position: "absolute", right: 0, top: 22, width: 350, height: 390, padding: 28, opacity: sorted, transform: `translateY(${enterY(sorted, 18)}px)` }}>
          <div style={{ color: COLORS.green, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 20 }}>AFTER / VISIBLE PROOF</div>
          {["先让问题出现", "用画面解释概念", "用变化证明理解", "保留阅读时间"].map((text, index) => <div key={text} style={{ display: "flex", gap: 14, color: COLORS.text, fontSize: 23, fontWeight: 750, marginTop: 28 }}><CheckCircle size={26} color={[COLORS.cyan, COLORS.green, COLORS.yellow, COLORS.purple][index]} weight="duotone" />{text}</div>)}
        </Panel>
      </div>
    </SceneFrame>
  );
};

const CaptionScene: React.FC<{ frame: number }> = ({ frame }) => {
  const current = Math.min(3, Math.floor(Math.max(0, frame - 42) / 38));
  const lines = ["讲清当前发生什么", "标出正在看的重点", "给变化留出阅读时间", "不要遮住主体画面"];
  return (
    <SceneFrame beat={beats[4]} frame={frame} accent={COLORS.yellow}>
      <Panel accent={COLORS.yellow} style={{ position: "absolute", right: 120, top: 215, width: 840, height: 435, padding: 28 }}>
        <div style={{ color: COLORS.yellow, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 21 }}>CAPTION TRACK / SYNCHRONIZED</div>
        <div style={{ marginTop: 30 }}>
          {lines.map((line, index) => {
            const active = index === current;
            return <div key={line} style={{ height: 67, display: "flex", alignItems: "center", padding: "0 20px", marginBottom: 14, background: active ? "rgba(67,217,255,0.16)" : COLORS.faint, borderLeft: `5px solid ${active ? COLORS.cyan : "transparent"}`, color: active ? COLORS.text : COLORS.muted, fontSize: 25, fontWeight: active ? 800 : 650, opacity: clampEase(frame, 30 + index * 16, 55 + index * 16) }}><span style={{ color: active ? COLORS.cyan : COLORS.muted, fontFamily: TYPOGRAPHY.monoFamily, marginRight: 22 }}>0{index + 1}</span>{line}</div>;
          })}
        </div>
      </Panel>
    </SceneFrame>
  );
};

const ReviewScene: React.FC<{ frame: number }> = ({ frame }) => {
  const labels = ["进入完成", "稳定状态", "离场之前"];
  return (
    <SceneFrame beat={beats[5]} frame={frame} accent={COLORS.green}>
      <div style={{ position: "absolute", right: 118, top: 230, width: 850, height: 450 }}>
        <Panel accent={COLORS.green} style={{ position: "absolute", inset: 0, padding: 30 }}>
          <div style={{ color: COLORS.green, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 21 }}>SAMPLE REVIEW / HIGH-RISK SCENE</div>
          <div style={{ display: "flex", gap: 22, marginTop: 62 }}>
            {labels.map((label, index) => {
              const p = clampEase(frame, 42 + index * 34, 82 + index * 34);
              return <div key={label} style={{ flex: 1, opacity: p, transform: `translateY(${enterY(p, 18)}px)` }}><Panel accent={[COLORS.cyan, COLORS.yellow, COLORS.coral][index]} style={{ height: 170, padding: 22 }}><div style={{ color: [COLORS.cyan, COLORS.yellow, COLORS.coral][index], fontFamily: TYPOGRAPHY.monoFamily, fontSize: 18 }}>FRAME 0{index + 1}</div><div style={{ color: COLORS.text, fontSize: 27, fontWeight: 850, marginTop: 30 }}>{label}</div><div style={{ color: COLORS.muted, fontSize: 19, marginTop: 18 }}>{["元素到齐了吗？", "层级清楚吗？", "转场会碰撞吗？"][index]}</div></Panel></div>;
            })}
          </div>
          <div style={{ color: COLORS.muted, fontSize: 22, marginTop: 42 }}>审查的目标不是多看，而是在最容易出问题的时刻看对画面。</div>
        </Panel>
      </div>
    </SceneFrame>
  );
};

const ShipScene: React.FC<{ frame: number }> = ({ frame }) => {
  const p = clampEase(frame, 34, 120);
  const render = clampEase(frame, 104, 210);
  return (
    <SceneFrame beat={beats[6]} frame={frame} accent={COLORS.cyan}>
      <div style={{ position: "absolute", right: 130, top: 230, width: 820, height: 420 }}>
        <Panel accent={COLORS.cyan} style={{ position: "absolute", left: 0, top: 45, width: 300, height: 250, padding: 28, opacity: p, transform: `translateY(${enterY(p, 18)}px)` }}>
          <PlayCircle size={38} color={COLORS.cyan} weight="duotone" />
          <div style={{ color: COLORS.text, fontSize: 30, fontWeight: 850, marginTop: 26 }}>预览与抽样</div>
          <div style={{ color: COLORS.muted, fontSize: 21, lineHeight: 1.5, marginTop: 18 }}>确认讲解、节奏<br />和关键帧可读性</div>
        </Panel>
        <div style={{ position: "absolute", left: 306, top: 167, width: 145, height: 4, background: COLORS.yellow, transform: `scaleX(${render})`, transformOrigin: "left" }} />
        <Panel accent={COLORS.green} style={{ position: "absolute", right: 0, top: 0, width: 335, height: 340, padding: 30, opacity: render, transform: `translateY(${enterY(render, 18)}px)` }}>
          <VideoCamera size={40} color={COLORS.green} weight="duotone" />
          <div style={{ color: COLORS.green, fontFamily: TYPOGRAPHY.monoFamily, fontSize: 20, marginTop: 20 }}>HEADLESS RENDER</div>
          <div style={{ color: COLORS.text, fontSize: 29, fontWeight: 850, marginTop: 24 }}>teaching-video.mp4</div>
          <div style={{ height: 7, marginTop: 38, background: COLORS.faint }}><div style={{ width: `${render * 100}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.green})` }} /></div>
        </Panel>
      </div>
    </SceneFrame>
  );
};

export const RemotionCoreSkillsV2Video: React.FC = () => {
  const frame = useCurrentFrame();
  const { index, localFrame } = sceneAt(frame);
  const scenes = [GapScene, MethodScene, PathScene, EvidenceScene, CaptionScene, ReviewScene, ShipScene];
  const Scene = scenes[index];
  return <AbsoluteFill style={{ fontFamily: "Arial, PingFang SC, Microsoft YaHei, sans-serif", overflow: "hidden" }}><VideoBackground /><Scene frame={localFrame} /><ProgressRail durationInFrames={remotionCoreSkillsV2DurationInFrames} /></AbsoluteFill>;
};
