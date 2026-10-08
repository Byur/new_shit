import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CSSProperties, ReactNode } from "react";

const COLORS = {
  bg: "#080d17",
  panel: "#111a2a",
  panel2: "#162238",
  text: "#f6f8fb",
  muted: "#9aa9bf",
  cyan: "#43d9ff",
  green: "#6df1b1",
  yellow: "#ffd166",
  coral: "#ff806d",
  purple: "#ae8bff",
};

const DURATION = 8100;

type Scene = {
  from: number;
  to: number;
  kicker: string;
  title: string;
  description: string;
  kind: "hook" | "name" | "map" | "create" | "captions" | "studio" | "render" | "helpers" | "compare" | "close";
};

type Cue = {
  from: number;
  to: number;
  text: string;
};

const scenes: Scene[] = [
  { from: 0, to: 600, kicker: "00 / THE QUESTION", title: "同一句请求，为什么结果差这么多？", description: "从一句模糊的需求，到一个可以预览、可以渲染的 Remotion 视频，中间发生了什么？", kind: "hook" },
  { from: 600, to: 1440, kicker: "01 / NAME THE TOOL", title: "Skill = 可复用的工作方法", description: "它把经验、约束和工具顺序，放到 agent 的任务旁边。", kind: "name" },
  { from: 1440, to: 2250, kicker: "02 / THE MAP", title: "先打开总入口，再选择工作台", description: "拿不准从哪里开始，就从 remotion-best-practices 开始。", kind: "map" },
  { from: 2250, to: 3300, kicker: "03 / BUILD", title: "create 搭骨架，markup 编排画面", description: "先决定 composition 的骨架，再把 React、布局和动效写进时间轴。", kind: "create" },
  { from: 3300, to: 4260, kicker: "04 / TELL THE STORY", title: "captions 是第二条叙事轨", description: "没有配音时，字幕不是装饰，而是教学内容本身。", kind: "captions" },
  { from: 4260, to: 5160, kicker: "05 / OBSERVE", title: "studio 把代码变成可观察的画面", description: "逐帧检查布局、节奏，以及字幕有没有挡住主体。", kind: "studio" },
  { from: 5160, to: 6000, kicker: "06 / SHIP", title: "render 才是交付", description: "预览通过，不等于视频已经交付；render 将 composition 输出成 MP4 或 still。", kind: "render" },
  { from: 6000, to: 6900, kicker: "07 / SUPPORT", title: "docs 查证，upgrade 维护", description: "它们不替代主流程，却能降低版本和 API 不确定性。", kind: "helpers" },
  { from: 6900, to: 7500, kicker: "08 / BEFORE → AFTER", title: "从临场猜测，到可检查的流水线", description: "Skill 的价值，是让一次成功变成下一次可以复用的默认动作。", kind: "compare" },
  { from: 7500, to: 8100, kicker: "09 / TAKEAWAY", title: "先选 Skill，再做视频", description: "记住选择逻辑：先找入口，再按任务打开工作台，最后用预览和渲染验收。", kind: "close" },
];

const cues: Cue[] = [
  { from: 0, to: 180, text: "请帮我做一个 Remotion 视频。" },
  { from: 180, to: 390, text: "同一句请求，为什么结果差这么多？" },
  { from: 390, to: 600, text: "差别不只在模型，而在有没有一套可靠的工作方法。" },
  { from: 600, to: 840, text: "Skill 是给 coding agent 的可复用工作方法。" },
  { from: 840, to: 1080, text: "它把经验、约束和工具顺序，放到任务旁边。" },
  { from: 1080, to: 1260, text: "它不是 Remotion 的 runtime API，也不只是更长的 prompt。" },
  { from: 1260, to: 1440, text: "它告诉 agent：什么时候用、先做什么、怎样验收。" },
  { from: 1440, to: 1680, text: "不确定从哪里开始？先打开 remotion-best-practices。" },
  { from: 1680, to: 1950, text: "它是总入口，再把任务分流给专门 Skill。" },
  { from: 1950, to: 2250, text: "核心主线：create、markup、captions、studio、render。" },
  { from: 2250, to: 2520, text: "create 负责搭骨架：项目、composition、尺寸、帧率和时长。" },
  { from: 2520, to: 2790, text: "markup 负责编排：React、布局、动效、媒体、字体和 timing。" },
  { from: 2790, to: 3060, text: "空白 composition，开始变成有结构的画面。" },
  { from: 3060, to: 3300, text: "先搭骨架，再让每个元素在正确的时间出现。" },
  { from: 3300, to: 3540, text: "本期不用配音，所以字幕就是第二条叙事轨。" },
  { from: 3540, to: 3780, text: "它也需要时间、层级和节奏，而不是最后贴上去的一行字。" },
  { from: 3780, to: 4020, text: "captions 让画面和文字一起推进，让学习者知道现在发生了什么。" },
  { from: 4020, to: 4260, text: "无配音，不等于无讲解；只是讲解搬到了时间轴上。" },
  { from: 4260, to: 4500, text: "studio 让 agent 和人一起看见每一帧。" },
  { from: 4500, to: 4740, text: "检查标题是否溢出，动画是否太快，字幕是否挡住主体。" },
  { from: 4740, to: 4980, text: "命令跑过了，只能说明代码执行了；看见画面，才能判断体验。" },
  { from: 4980, to: 5160, text: "预览是观察，不是交付。" },
  { from: 5160, to: 5400, text: "render 把 composition 输出成视频或 still。" },
  { from: 5400, to: 5640, text: "预览通过，不等于交付完成。" },
  { from: 5640, to: 5880, text: "出片前，仍然要确认尺寸、帧率和最终文件。" },
  { from: 5880, to: 6000, text: "从代码，到可以交付的 MP4。" },
  { from: 6000, to: 6240, text: "API 不确定时，用 docs 查证当前资料。" },
  { from: 6240, to: 6480, text: "版本变化时，用 upgrade 维护 Remotion 和相关 Skills。" },
  { from: 6480, to: 6720, text: "它们是辅助台，不会取代创作和验收主线。" },
  { from: 6720, to: 6900, text: "查证和维护，让工作流更可持续。" },
  { from: 6900, to: 7140, text: "没有 Skill：猜测、试错、返工。" },
  { from: 7140, to: 7380, text: "有了 Skill：识别、加载、预览、渲染。" },
  { from: 7380, to: 7500, text: "差别不是多了几个命令，而是多了一条可检查的路径。" },
  { from: 7500, to: 7740, text: "记住选择逻辑：先找入口，再按任务打开工作台。" },
  { from: 7740, to: 7980, text: "最后用预览和渲染验收。" },
  { from: 7980, to: 8100, text: "先选 Skill，再做视频。" },
];

const easeIn = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

const currentScene = (frame: number) => scenes.find((scene) => frame >= scene.from && frame < scene.to) ?? scenes[0];
const currentCue = (frame: number) => cues.find((cue) => frame >= cue.from && frame < cue.to);

const Panel: React.FC<{ children: ReactNode; style?: CSSProperties; accent?: string }> = ({ children, style, accent }) => (
  <div
    style={{
      border: `1px solid ${accent ? `${accent}99` : "rgba(246,248,251,0.14)"}`,
      background: "rgba(15, 24, 40, 0.88)",
      borderRadius: 8,
      boxShadow: accent ? `0 0 38px ${accent}22` : "0 18px 60px rgba(0,0,0,0.2)",
      ...style,
    }}
  >
    {children}
  </div>
);

const Grid: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 15% 20%, rgba(67,217,255,0.16), transparent 28%), radial-gradient(circle at 82% 76%, rgba(174,139,255,0.14), transparent 32%), #080d17",
      }}
    >
      <AbsoluteFill
        style={{
          opacity: 0.18,
          backgroundImage: "linear-gradient(rgba(246,248,251,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(246,248,251,0.08) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />
    </AbsoluteFill>
  );
};

const TitleBlock: React.FC<{ scene: Scene; opacity: number }> = ({ scene, opacity }) => (
  <div style={{ position: "absolute", left: 88, top: 72, width: 820, opacity, transform: `translateY(${(1 - opacity) * 20}px)` }}>
    <div style={{ color: COLORS.green, fontSize: 28, fontWeight: 800, letterSpacing: 1, marginBottom: 22 }}>{scene.kicker}</div>
    <div style={{ color: COLORS.text, fontSize: 70, lineHeight: 1.08, fontWeight: 900 }}>{scene.title}</div>
    <div style={{ color: COLORS.muted, fontSize: 31, lineHeight: 1.46, marginTop: 28, maxWidth: 760 }}>{scene.description}</div>
  </div>
);

const CaptionBar: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = currentCue(frame);
  return (
    <div style={{ position: "absolute", left: 154, right: 154, bottom: 64, minHeight: 106, display: "flex", justifyContent: "center", alignItems: "center", padding: "18px 40px", background: "rgba(3,8,20,0.9)", border: "1px solid rgba(246,248,251,0.14)", borderRadius: 8 }}>
      <div style={{ color: "#fff", fontSize: 34, lineHeight: 1.38, textAlign: "center", fontWeight: 700 }}>{cue?.text}</div>
    </div>
  );
};

const Rail: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 88, right: 88, bottom: 31, height: 3, background: "rgba(246,248,251,0.15)" }}>
      <div style={{ width: `${(frame / DURATION) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.green}, ${COLORS.yellow})` }} />
    </div>
  );
};

const HookVisual: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <div style={{ position: "absolute", right: 104, top: 190, width: 820, height: 620, opacity: progress }}>
      <Panel style={{ position: "absolute", left: 0, top: 80, width: 340, height: 340, padding: 28, transform: `rotate(-${2 + progress * 2}deg)` }} accent={COLORS.coral}>
        <div style={{ color: COLORS.coral, fontSize: 24, fontWeight: 800 }}>PROMPT ONLY</div>
        <div style={{ color: COLORS.text, fontSize: 30, lineHeight: 1.3, marginTop: 34 }}>“做一个视频”</div>
        <div style={{ color: COLORS.muted, fontSize: 21, lineHeight: 1.5, marginTop: 34 }}>不知道从哪里开始<br />每次都重新猜</div>
        <div style={{ position: "absolute", right: 26, bottom: 24, color: COLORS.coral, fontSize: 28 }}>↺</div>
      </Panel>
      <div style={{ position: "absolute", left: 350, top: 228, width: 116, height: 4, background: COLORS.yellow, transform: `translateX(${progress * 30}px)` }} />
      <Panel style={{ position: "absolute", right: 0, top: 20, width: 380, height: 470, padding: 30, transform: `translateY(${(1 - progress) * 26}px)` }} accent={COLORS.green}>
        <div style={{ color: COLORS.green, fontSize: 24, fontWeight: 800 }}>SKILL LOADED</div>
        <div style={{ color: COLORS.text, fontSize: 32, marginTop: 32, fontWeight: 800 }}>可预览<br />可检查<br />可渲染</div>
        <div style={{ marginTop: 38, display: "flex", flexDirection: "column", gap: 14 }}>
          {["context", "sequence", "verify"].map((item, index) => <div key={item} style={{ color: [COLORS.cyan, COLORS.yellow, COLORS.green][index], fontSize: 24, fontFamily: "Menlo, monospace" }}>✓ {item}</div>)}
        </div>
      </Panel>
    </div>
  );
};

const NameVisual: React.FC<{ progress: number }> = ({ progress }) => {
  const flip = interpolate(progress, [0.15, 0.6], [0, 180], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", right: 160, top: 188, width: 720, height: 630, opacity: progress, perspective: 1200 }}>
      <Panel style={{ position: "absolute", left: 80, top: 50, width: 330, height: 470, padding: 32, transform: `rotateY(${flip}deg)`, transformStyle: "preserve-3d", backfaceVisibility: "hidden" }} accent={COLORS.cyan}>
        <div style={{ color: COLORS.cyan, fontSize: 23, fontFamily: "Menlo, monospace" }}>prompt.txt</div>
        <div style={{ color: COLORS.text, fontSize: 30, lineHeight: 1.35, marginTop: 44 }}>“帮我做得好一点”</div>
        <div style={{ color: COLORS.muted, fontSize: 22, lineHeight: 1.5, marginTop: 44 }}>愿望<br />没有流程<br />没有验收</div>
      </Panel>
      <Panel style={{ position: "absolute", left: 80, top: 50, width: 330, height: 470, padding: 32, transform: `rotateY(${flip + 180}deg)`, transformStyle: "preserve-3d", backfaceVisibility: "hidden" }} accent={COLORS.green}>
        <div style={{ color: COLORS.green, fontSize: 23, fontFamily: "Menlo, monospace" }}>SKILL.md</div>
        <div style={{ color: COLORS.text, fontSize: 27, lineHeight: 1.45, marginTop: 38 }}>when to use</div>
        <div style={{ color: COLORS.cyan, fontSize: 22, fontFamily: "Menlo, monospace", marginTop: 16 }}>steps → verify</div>
        <div style={{ color: COLORS.muted, fontSize: 22, lineHeight: 1.5, marginTop: 38 }}>经验<br />约束<br />工具顺序</div>
      </Panel>
      <div style={{ position: "absolute", right: 25, top: 120, color: COLORS.yellow, fontSize: 52, fontWeight: 900 }}>≠</div>
      <div style={{ position: "absolute", right: 0, top: 236, color: COLORS.green, fontSize: 29, fontWeight: 800 }}>可复用的工作方法</div>
    </div>
  );
};

const MapVisual: React.FC<{ progress: number }> = ({ progress }) => {
  const skills = ["create", "markup", "captions", "studio", "render", "docs"];
  return (
    <div style={{ position: "absolute", right: 120, top: 185, width: 860, height: 650, opacity: progress }}>
      <div style={{ position: "absolute", left: 292, top: 174, width: 250, height: 250, borderRadius: "50%", background: "rgba(67,217,255,0.18)", border: `2px solid ${COLORS.cyan}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 ${30 + progress * 32}px rgba(67,217,255,0.24)` }}>
        <div style={{ color: COLORS.text, fontSize: 30, fontWeight: 850, textAlign: "center" }}>best<br />practices</div>
      </div>
      {skills.map((skill, index) => {
        const angle = (Math.PI * 2 * index) / skills.length - Math.PI / 2;
        const radiusX = 350;
        const radiusY = 240;
        const x = 420 + Math.cos(angle) * radiusX;
        const y = 300 + Math.sin(angle) * radiusY;
        const local = easeIn(progress, index * 0.08, 0.38 + index * 0.07);
        const color = [COLORS.cyan, COLORS.green, COLORS.yellow, COLORS.purple, COLORS.coral, COLORS.muted][index];
        return <div key={skill}>
          <div style={{ position: "absolute", left: 416, top: 294, width: radiusX - 90, height: 2, background: `${color}66`, transformOrigin: "left center", transform: `rotate(${angle}rad) scaleX(${local})` }} />
          <Panel style={{ position: "absolute", left: x - 105, top: y - 31, width: 210, height: 62, display: "flex", alignItems: "center", justifyContent: "center", color, fontSize: 23, fontFamily: "Menlo, monospace", opacity: local, transform: `translateY(${(1 - local) * 22}px)` }} accent={color}>{`/remotion-${skill}`}</Panel>
        </div>;
      })}
    </div>
  );
};

const CreateVisual: React.FC<{ progress: number }> = ({ progress }) => {
  const frame = useCurrentFrame();
  const blocks = ["Composition", "Title", "Timeline", "Motion"];
  return (
    <div style={{ position: "absolute", right: 105, top: 182, width: 870, height: 650, opacity: progress }}>
      <Panel style={{ position: "absolute", left: 0, top: 65, width: 340, height: 486, padding: 28 }} accent={COLORS.cyan}>
        <div style={{ color: COLORS.cyan, fontSize: 23, fontFamily: "Menlo, monospace" }}>create</div>
        <div style={{ color: COLORS.muted, fontSize: 22, lineHeight: 1.6, marginTop: 34 }}>width: 1920<br />height: 1080<br />fps: 30<br />duration: 35s</div>
        <div style={{ color: COLORS.green, fontSize: 23, fontFamily: "Menlo, monospace", marginTop: 34 }}>✓ scaffold ready</div>
      </Panel>
      <div style={{ position: "absolute", left: 380, top: 280, width: 90, height: 4, background: COLORS.yellow, transform: `scaleX(${progress})`, transformOrigin: "left" }} />
      <Panel style={{ position: "absolute", right: 0, top: 10, width: 430, height: 580, padding: 28 }} accent={COLORS.green}>
        <div style={{ color: COLORS.green, fontSize: 23, fontFamily: "Menlo, monospace" }}>markup</div>
        <div style={{ position: "relative", height: 390, marginTop: 28, border: "1px solid rgba(246,248,251,0.14)", background: "#0a111e" }}>
          {blocks.map((block, index) => {
            const local = easeIn(progress, index * 0.12, 0.42 + index * 0.1);
            return <div key={block} style={{ position: "absolute", left: 32 + (index % 2) * 172, top: 42 + Math.floor(index / 2) * 158, width: 142, height: 104, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: [COLORS.text, COLORS.cyan, COLORS.yellow, COLORS.purple][index], border: `1px solid ${[COLORS.text, COLORS.cyan, COLORS.yellow, COLORS.purple][index]}99`, opacity: local, transform: `translateY(${(1 - local) * 18}px) scale(${0.86 + local * 0.14})` }}>{block}</div>;
          })}
          <div style={{ position: "absolute", left: 45, right: 45, bottom: 26, height: 6, background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.green}, ${COLORS.yellow})`, transform: `scaleX(${interpolate(progress, [0.1, 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`, transformOrigin: "left" }} />
        </div>
        <div style={{ color: COLORS.muted, fontSize: 22, marginTop: 24 }}>React + timing = a living composition</div>
      </Panel>
      <div style={{ position: "absolute", left: 410, top: 625, color: COLORS.yellow, fontSize: 27, fontFamily: "Menlo, monospace" }}>0 → {Math.min(100, Math.round(progress * 100))}% built</div>
      <div style={{ position: "absolute", right: 4, top: 610, color: COLORS.cyan, fontSize: 18, fontFamily: "Menlo, monospace" }}>frame {String(Math.round(frame)).padStart(4, "0")}</div>
    </div>
  );
};

const CaptionsVisual: React.FC<{ progress: number }> = ({ progress }) => {
  const frame = useCurrentFrame();
  const current = Math.floor((frame / 16) % 4);
  const lines = ["captions", "make", "meaning", "visible"];
  return (
    <div style={{ position: "absolute", right: 122, top: 190, width: 850, height: 620, opacity: progress }}>
      <Panel style={{ position: "absolute", left: 0, top: 40, width: 850, height: 370, padding: 30 }} accent={COLORS.yellow}>
        <div style={{ color: COLORS.yellow, fontSize: 23, fontFamily: "Menlo, monospace" }}>caption track / no voiceover</div>
        <div style={{ position: "absolute", left: 46, right: 46, bottom: 44, display: "flex", flexDirection: "column", gap: 13 }}>
          {lines.map((line, index) => <div key={line} style={{ height: 39, display: "flex", alignItems: "center", padding: "0 16px", color: index === current ? COLORS.text : COLORS.muted, background: index === current ? "rgba(67,217,255,0.22)" : "rgba(246,248,251,0.07)", borderLeft: `5px solid ${index === current ? COLORS.cyan : "transparent"}`, fontSize: 23, fontFamily: "Menlo, monospace", opacity: index <= current ? 1 : 0.55 }}>{index <= current ? `0${index + 1}  ${line}` : `0${index + 1}  ______`}</div>)}
        </div>
      </Panel>
      <div style={{ position: "absolute", left: 410, top: 462, width: 4, height: 88, background: COLORS.cyan }} />
      <div style={{ position: "absolute", right: 90, top: 474, color: COLORS.cyan, fontSize: 28, fontWeight: 800 }}>文字也有 timing</div>
      <Panel style={{ position: "absolute", left: 110, top: 522, width: 630, height: 92, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.text, fontSize: 28 }} accent={COLORS.cyan}>当前句高亮 · 已读句退场 · 下一句等待</Panel>
    </div>
  );
};

const StudioVisual: React.FC<{ progress: number }> = ({ progress }) => {
  const frame = useCurrentFrame();
  const checks = ["LAYOUT", "RHYTHM", "CAPTIONS"];
  const cursor = interpolate(progress, [0, 1], [0, 740]);
  return (
    <div style={{ position: "absolute", right: 108, top: 180, width: 870, height: 650, opacity: progress }}>
      <Panel style={{ position: "absolute", left: 0, top: 0, width: 870, height: 472, padding: 26 }} accent={COLORS.green}>
        <div style={{ color: COLORS.green, fontSize: 23, fontFamily: "Menlo, monospace" }}>studio / frame observer</div>
        <div style={{ position: "absolute", left: 30, top: 78, right: 30, bottom: 26, background: "#09111f", border: "1px solid rgba(246,248,251,0.15)" }}>
          <div style={{ position: "absolute", left: 38, top: 42, color: COLORS.text, fontSize: 42, fontWeight: 850 }}>看见每一帧</div>
          <div style={{ position: "absolute", left: 40, top: 120, width: 390, height: 16, background: "rgba(67,217,255,0.5)" }} />
          <div style={{ position: "absolute", left: 40, top: 166, width: 270, height: 12, background: "rgba(246,248,251,0.18)" }} />
          <div style={{ position: "absolute", left: 40, right: 40, bottom: 40, height: 4, background: "rgba(246,248,251,0.15)" }}>
            <div style={{ position: "absolute", left: cursor, top: -8, width: 4, height: 20, background: COLORS.yellow }} />
          </div>
        </div>
      </Panel>
      <div style={{ position: "absolute", left: 98, top: 530, display: "flex", gap: 32 }}>
        {checks.map((check, index) => {
          const local = easeIn(progress, index * 0.2, 0.5 + index * 0.12);
          return <Panel key={check} style={{ width: 210, height: 82, display: "flex", alignItems: "center", justifyContent: "center", color: index === 1 ? COLORS.yellow : COLORS.green, fontSize: 21, fontFamily: "Menlo, monospace", opacity: local, transform: `scale(${0.88 + local * 0.12})` }} accent={index === 1 ? COLORS.yellow : COLORS.green}>✓ {check}</Panel>;
        })}
      </div>
      <div style={{ position: "absolute", right: 0, top: 638, color: COLORS.muted, fontSize: 21, fontFamily: "Menlo, monospace" }}>frame {Math.round(frame)}</div>
    </div>
  );
};

const RenderVisual: React.FC<{ progress: number }> = ({ progress }) => (
  <div style={{ position: "absolute", right: 150, top: 210, width: 760, height: 580, opacity: progress }}>
    <Panel style={{ position: "absolute", left: 0, top: 24, width: 350, height: 320, padding: 28 }} accent={COLORS.cyan}>
      <div style={{ color: COLORS.cyan, fontSize: 23, fontFamily: "Menlo, monospace" }}>composition</div>
      <div style={{ color: COLORS.text, fontSize: 35, marginTop: 44 }}>preview</div>
      <div style={{ color: COLORS.green, fontSize: 22, fontFamily: "Menlo, monospace", marginTop: 42 }}>✓ looks right</div>
    </Panel>
    <div style={{ position: "absolute", left: 355, top: 176, width: 100, height: 4, background: COLORS.yellow, transform: `scaleX(${progress})`, transformOrigin: "left" }} />
    <Panel style={{ position: "absolute", right: 0, top: 0, width: 390, height: 400, padding: 30 }} accent={COLORS.green}>
      <div style={{ color: COLORS.green, fontSize: 23, fontFamily: "Menlo, monospace" }}>render</div>
      <div style={{ color: COLORS.text, fontSize: 34, marginTop: 42 }}>skill-video.mp4</div>
      <div style={{ color: COLORS.muted, fontSize: 22, lineHeight: 1.55, marginTop: 30 }}>1920 × 1080<br />30 fps<br />H.264</div>
      <div style={{ position: "absolute", left: 30, right: 30, bottom: 35, height: 8, background: "rgba(246,248,251,0.12)" }}><div style={{ width: `${progress * 100}%`, height: "100%", background: COLORS.green }} /></div>
    </Panel>
    <div style={{ position: "absolute", left: 110, top: 420, color: COLORS.yellow, fontSize: 29, fontWeight: 800 }}>preview ≠ delivery</div>
  </div>
);

const HelpersVisual: React.FC<{ progress: number }> = ({ progress }) => {
  const cards = [{ name: "docs", color: COLORS.cyan, copy: "查当前 API" }, { name: "upgrade", color: COLORS.yellow, copy: "维护版本" }];
  return <div style={{ position: "absolute", right: 170, top: 222, width: 720, height: 500, opacity: progress, display: "flex", gap: 26 }}>
    {cards.map((card, index) => { const local = easeIn(progress, index * 0.25, 0.65 + index * 0.14); return <Panel key={card.name} style={{ flex: 1, height: 300, padding: 28, opacity: local, transform: `translateY(${(1 - local) * 30}px)` }} accent={card.color}><div style={{ color: card.color, fontSize: 25, fontFamily: "Menlo, monospace" }}>/{card.name}</div><div style={{ color: COLORS.text, fontSize: 29, fontWeight: 800, marginTop: 48 }}>{card.copy}</div><div style={{ color: COLORS.muted, fontSize: 22, lineHeight: 1.5, marginTop: 32 }}>{index === 0 ? "版本敏感的地方\n先查证，再修改" : "相关依赖和 Skills\n保持可持续"}</div></Panel>; })}
    <div style={{ position: "absolute", left: 108, top: 360, color: COLORS.muted, fontSize: 25 }}>辅助台：降低不确定性，不打断主流程</div>
  </div>;
};

const CompareVisual: React.FC<{ progress: number }> = ({ progress }) => {
  const left = ["猜上下文", "临时搜索", "试错调用", "返工修正"];
  const right = ["识别任务", "加载 Skill", "预览确认", "渲染交付"];
  return <div style={{ position: "absolute", right: 120, top: 188, width: 850, height: 610, opacity: progress, display: "flex", gap: 30 }}>
    {[{ title: "WITHOUT SKILL", items: left, color: COLORS.coral, rotate: true }, { title: "WITH SKILL", items: right, color: COLORS.green, rotate: false }].map((column) => <Panel key={column.title} style={{ flex: 1, height: 520, padding: 28 }} accent={column.color}><div style={{ color: column.color, fontSize: 22, fontFamily: "Menlo, monospace" }}>{column.title}</div><div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 20 }}>{column.items.map((item, index) => <div key={item} style={{ display: "flex", alignItems: "center", gap: 13, opacity: easeIn(progress, index * 0.11, 0.52 + index * 0.1), transform: column.rotate ? `rotate(${index % 2 ? 2 : -2}deg)` : `translateX(${(1 - easeIn(progress, index * 0.11, 0.52 + index * 0.1)) * 20}px)` }}><div style={{ width: 13, height: 13, borderRadius: 3, background: column.color }} /><div style={{ color: COLORS.text, fontSize: 27 }}>{item}</div></div>)}</div><div style={{ position: "absolute", bottom: 32, left: 28, color: column.color, fontSize: 22 }}>{column.rotate ? "慢 · 散 · 易漏" : "稳 · 清晰 · 可复用"}</div></Panel>)}
  </div>;
};

const CloseVisual: React.FC<{ progress: number }> = ({ progress }) => {
  const steps = ["create", "markup", "captions", "studio", "render"];
  return <div style={{ position: "absolute", right: 92, top: 210, width: 900, height: 560, opacity: progress }}>
    <div style={{ display: "flex", alignItems: "center", gap: 0, position: "absolute", top: 120, left: 0, right: 0 }}>{steps.map((step, index) => { const local = easeIn(progress, index * 0.11, 0.58 + index * 0.08); return <div key={step} style={{ display: "flex", alignItems: "center", flex: 1 }}><Panel style={{ width: 140, height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: [COLORS.cyan, COLORS.green, COLORS.yellow, COLORS.purple, COLORS.coral][index], fontSize: 21, fontFamily: "Menlo, monospace", opacity: local, transform: `scale(${0.85 + local * 0.15})` }} accent={[COLORS.cyan, COLORS.green, COLORS.yellow, COLORS.purple, COLORS.coral][index]}>/{step}</Panel>{index < steps.length - 1 && <div style={{ height: 3, flex: 1, background: COLORS.green, opacity: local }} />}</div>; })}</div>
    <div style={{ position: "absolute", left: 180, top: 310, width: 540, color: COLORS.text, fontSize: 38, fontWeight: 850, textAlign: "center" }}>一条可复用的创作路径</div>
    <div style={{ position: "absolute", left: 205, top: 410, width: 490, color: COLORS.muted, fontSize: 25, lineHeight: 1.5, textAlign: "center" }}>不是让 agent 记住所有事，而是让它知道该加载哪一种专业能力。</div>
  </div>;
};

const Visual: React.FC<{ scene: Scene; progress: number }> = ({ scene, progress }) => {
  if (scene.kind === "hook") return <HookVisual progress={progress} />;
  if (scene.kind === "name") return <NameVisual progress={progress} />;
  if (scene.kind === "map") return <MapVisual progress={progress} />;
  if (scene.kind === "create") return <CreateVisual progress={progress} />;
  if (scene.kind === "captions") return <CaptionsVisual progress={progress} />;
  if (scene.kind === "studio") return <StudioVisual progress={progress} />;
  if (scene.kind === "render") return <RenderVisual progress={progress} />;
  if (scene.kind === "helpers") return <HelpersVisual progress={progress} />;
  if (scene.kind === "compare") return <CompareVisual progress={progress} />;
  return <CloseVisual progress={progress} />;
};

export const RemotionCoreSkillsVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = currentScene(frame);
  const progress = easeIn(frame, scene.from + 12, scene.from + 54);
  const opacity = 1;
  const intro = spring({ frame, fps, config: { damping: 100, stiffness: 80 } });
  const fade = interpolate(frame, [DURATION - 80, DURATION], [1, 0.45], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return <AbsoluteFill style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif" }}><Grid /><AbsoluteFill style={{ opacity: intro * fade }}><TitleBlock scene={scene} opacity={opacity} /><Visual scene={scene} progress={progress} /><CaptionBar /><Rail /></AbsoluteFill></AbsoluteFill>;
};

export const remotionCoreSkillsDurationInFrames = DURATION;
