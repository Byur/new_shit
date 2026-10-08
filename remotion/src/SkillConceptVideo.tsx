import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CSSProperties } from "react";

const BRAND = {
  ink: "#f8fafc",
  dim: "#9aa7bd",
  paper: "#101624",
  cyan: "#42d6ff",
  mint: "#6ef3b4",
  coral: "#ff7a66",
  gold: "#ffd166",
  violet: "#a78bfa",
  blue: "#2865ff",
};

type Scene = {
  from: number;
  duration: number;
  eyebrow: string;
  title: string;
  copy: string;
  mode: "orbit" | "cabinet" | "code" | "before" | "after" | "value" | "close";
};

type Caption = {
  from: number;
  duration: number;
  text: string;
};

const scenes: Scene[] = [
  {
    from: 0,
    duration: 210,
    eyebrow: "01 / 直观比喻",
    title: "Skill 像 Agent 的工作肌肉",
    copy: "不是一段临时提示词，而是一套被反复练过、知道何时调用的工作方法。",
    mode: "orbit",
  },
  {
    from: 210,
    duration: 270,
    eyebrow: "02 / 从经验到能力",
    title: "把经验放进可打开的抽屉",
    copy: "每个抽屉都收纳一种任务里的判断、边界、检查步骤和常用工具。",
    mode: "cabinet",
  },
  {
    from: 480,
    duration: 300,
    eyebrow: "03 / 封装方式",
    title: "Skill 把知识写成可复用流程",
    copy: "经验、约束、示例、脚本和工具顺序被组织起来，agent 先读再做。",
    mode: "code",
  },
  {
    from: 780,
    duration: 330,
    eyebrow: "04 / 没有 Skill",
    title: "每次都从空白开始",
    copy: "agent 需要重新猜上下文、找规则、试工具、再修正，质量依赖临场发挥。",
    mode: "before",
  },
  {
    from: 1110,
    duration: 330,
    eyebrow: "05 / 使用 Skill",
    title: "先识别任务，再加载专门能力",
    copy: "Skill 给出触发条件、操作顺序和验收口径，agent 的行动更稳定。",
    mode: "after",
  },
  {
    from: 1440,
    duration: 300,
    eyebrow: "06 / 价值",
    title: "把一次成功变成团队资产",
    copy: "更少遗漏、更快启动、更一致的结果，也让复杂工具链变得可托付。",
    mode: "value",
  },
  {
    from: 1740,
    duration: 300,
    eyebrow: "07 / Remotion 示例",
    title: "视频项目也能有 Agent Skills",
    copy: "Remotion 官方为创建、动效、字幕、预览和渲染等场景维护了 Agent Skills。",
    mode: "close",
  },
];

const captions: Caption[] = [
  {
    from: 0,
    duration: 150,
    text: "Skill 可以理解成 Agent 的工作肌肉。它不是临时背一句提示词，而是已经练过很多次的做事方式。",
  },
  {
    from: 150,
    duration: 180,
    text: "当任务出现时，Agent 不再只靠现场发挥，而是能打开一个专门抽屉，取出对应的判断和流程。",
  },
  {
    from: 330,
    duration: 210,
    text: "这个抽屉里有经验、约束、示例、脚本和工具顺序。它告诉 Agent 什么时候用、先读什么、怎样验证。",
  },
  {
    from: 540,
    duration: 210,
    text: "所以 Skill 的作用，是把个人或团队积累过的成功路径，封装成可以复用、可以审查、可以继续改进的能力。",
  },
  {
    from: 750,
    duration: 210,
    text: "没有 Skill 时，Agent 往往要重新猜上下文、搜索规则、试工具、修失败结果，每次都像第一次做。",
  },
  {
    from: 960,
    duration: 240,
    text: "使用 Skill 后，流程变成：识别任务类型，加载 Skill，按清单执行工具流程，再用明确标准验收。",
  },
  {
    from: 1200,
    duration: 210,
    text: "差异不只是速度。Skill 让约束被看见，让工具调用更有顺序，让输出质量更稳定。",
  },
  {
    from: 1410,
    duration: 210,
    text: "它也让一次做对的经验变成团队资产。下一个 Agent、下一次任务，都可以站在这套能力上继续工作。",
  },
  {
    from: 1620,
    duration: 240,
    text: "以 Remotion 为例，官方维护了用于创建 composition、编写动效、做字幕、预览和渲染的 Agent Skills。",
  },
  {
    from: 1860,
    duration: 180,
    text: "这就是 AI-native 工作流的关键：不是让 Agent 记住所有事，而是让它知道该加载哪一种专业能力。",
  },
];

const totalFrames = 2040;

const getCurrentScene = (frame: number) => {
  for (let i = scenes.length - 1; i >= 0; i--) {
    if (frame >= scenes[i].from) {
      return scenes[i];
    }
  }

  return scenes[0];
};

const getCurrentCaption = (frame: number) =>
  captions.find((caption) => frame >= caption.from && frame < caption.from + caption.duration);

const Card: React.FC<{
  children: React.ReactNode;
  style?: CSSProperties;
  active?: boolean;
}> = ({ children, style, active }) => (
  <div
    style={{
      borderRadius: 8,
      border: `1px solid ${active ? "rgba(110, 243, 180, 0.75)" : "rgba(248, 250, 252, 0.13)"}`,
      background: active ? "rgba(110, 243, 180, 0.11)" : "rgba(15, 23, 42, 0.62)",
      boxShadow: active
        ? "0 0 48px rgba(110, 243, 180, 0.2)"
        : "0 20px 60px rgba(0, 0, 0, 0.22)",
      ...style,
    }}
  >
    {children}
  </div>
);

const SoftGrid: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 18% 16%, rgba(66, 214, 255, 0.2), transparent 28%), radial-gradient(circle at 82% 22%, rgba(255, 209, 102, 0.14), transparent 26%), radial-gradient(circle at 70% 82%, rgba(255, 122, 102, 0.14), transparent 28%), linear-gradient(135deg, #070b13 0%, #101624 52%, #111827 100%)",
      }}
    >
      <AbsoluteFill
        style={{
          opacity: 0.2,
          backgroundImage:
            "linear-gradient(rgba(248,250,252,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(248,250,252,0.08) 1px, transparent 1px)",
          backgroundSize: "84px 84px",
        }}
      />
    </AbsoluteFill>
  );
};

const Header: React.FC<{ scene: Scene; sceneProgress: number }> = ({ scene, sceneProgress }) => (
  <div
    style={{
      position: "absolute",
      top: 76,
      left: 92,
      width: 860,
      opacity: sceneProgress,
      transform: `translateY(${interpolate(sceneProgress, [0, 1], [20, 0])}px)`,
    }}
  >
    <div
      style={{
        color: BRAND.mint,
        fontSize: 30,
        fontWeight: 700,
        letterSpacing: 0,
        marginBottom: 22,
      }}
    >
      {scene.eyebrow}
    </div>
    <div
      style={{
        color: BRAND.ink,
        fontSize: 76,
        lineHeight: 1.06,
        fontWeight: 860,
        letterSpacing: 0,
      }}
    >
      {scene.title}
    </div>
    <div
      style={{
        color: BRAND.dim,
        fontSize: 34,
        lineHeight: 1.45,
        marginTop: 28,
        fontWeight: 500,
      }}
    >
      {scene.copy}
    </div>
  </div>
);

const CaptionBar: React.FC = () => {
  const frame = useCurrentFrame();
  const caption = getCurrentCaption(frame);

  return (
    <div
      style={{
        position: "absolute",
        left: 180,
        right: 180,
        bottom: 70,
        minHeight: 112,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "18px 42px",
        borderRadius: 8,
        background: "rgba(2, 6, 23, 0.78)",
        border: "1px solid rgba(248,250,252,0.14)",
      }}
    >
      <div
        style={{
          color: "#ffffff",
          fontSize: 38,
          lineHeight: 1.35,
          textAlign: "center",
          fontWeight: 650,
          textWrap: "balance",
        }}
      >
        {caption?.text}
      </div>
    </div>
  );
};

const AgentCore: React.FC<{ pulse: number; label?: string }> = ({ pulse, label = "AI Agent" }) => (
  <div
    style={{
      position: "relative",
      width: 290,
      height: 290,
      borderRadius: "50%",
      background:
        "linear-gradient(145deg, rgba(66, 214, 255, 0.32), rgba(167, 139, 250, 0.22)), rgba(15, 23, 42, 0.94)",
      border: "1px solid rgba(248,250,252,0.22)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 0 ${54 + pulse * 36}px rgba(66, 214, 255, ${0.25 + pulse * 0.12})`,
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 34,
        borderRadius: "50%",
        border: "2px dashed rgba(110, 243, 180, 0.28)",
        transform: `rotate(${pulse * 80}deg)`,
      }}
    />
    <div style={{ color: BRAND.ink, fontSize: 38, fontWeight: 850 }}>{label}</div>
  </div>
);

const OrbitScene: React.FC<{ progress: number }> = ({ progress }) => {
  const orbit = 0;
  const pulse = 0.5;
  const cards = [
    { label: "context", color: BRAND.cyan },
    { label: "constraints", color: BRAND.gold },
    { label: "tools", color: BRAND.coral },
    { label: "checks", color: BRAND.mint },
  ];

  return (
    <div
      style={{
        position: "absolute",
        right: 168,
        top: 178,
        width: 740,
        height: 650,
        opacity: progress,
      }}
    >
      <div style={{ position: "absolute", left: 225, top: 168 }}>
        <AgentCore pulse={pulse} />
      </div>
      {cards.map((card, index) => {
        const angle = orbit + (Math.PI * 2 * index) / cards.length;
        const x = 360 + Math.cos(angle) * 290;
        const y = 310 + Math.sin(angle) * 210;

        return (
          <Card
            key={card.label}
            active={index === 2}
            style={{
              position: "absolute",
              left: x - 86,
              top: y - 38,
              width: 172,
              height: 76,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: card.color,
              fontSize: 24,
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            {card.label}
          </Card>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 130,
          top: 72,
          width: 480,
          height: 480,
          borderRadius: "50%",
          border: "1px solid rgba(248,250,252,0.14)",
          transform: `scale(${0.92 + progress * 0.08})`,
        }}
      />
    </div>
  );
};

const CabinetScene: React.FC<{ progress: number }> = ({ progress }) => {
  const labels = ["经验", "约束", "示例", "脚本", "验收"];
  const colors = [BRAND.cyan, BRAND.gold, BRAND.coral, BRAND.violet, BRAND.mint];

  return (
    <div
      style={{
        position: "absolute",
        right: 130,
        top: 180,
        width: 760,
        height: 620,
        opacity: progress,
      }}
    >
      {labels.map((label, index) => {
        const open = interpolate(progress, [0.08 * index, 0.45 + 0.08 * index], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <Card
            key={label}
            active={index === 3}
            style={{
              position: "absolute",
              left: 70 + (index % 2) * 330 + open * 36,
              top: 36 + Math.floor(index / 2) * 174,
              width: 280,
              height: 130,
              padding: 26,
              transform: `translateX(${open * 32}px)`,
            }}
          >
            <div style={{ color: colors[index], fontSize: 30, fontWeight: 850 }}>{label}</div>
            <div style={{ color: BRAND.dim, fontSize: 21, lineHeight: 1.35, marginTop: 14 }}>
              {index === 0 && "做过什么，为什么这样做"}
              {index === 1 && "哪些边界不能碰"}
              {index === 2 && "可模仿的产物样子"}
              {index === 3 && "工具调用与命令流程"}
              {index === 4 && "怎样判断已经完成"}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

const CodeScene: React.FC<{ progress: number }> = ({ progress }) => {
  const rows = [
    { color: BRAND.mint, text: "trigger: user asks to render a Remotion video" },
    { color: BRAND.cyan, text: "read: project files, docs, composition entry" },
    { color: BRAND.gold, text: "act: animate with timing, captions, media" },
    { color: BRAND.coral, text: "verify: lint, bundle, render, inspect output" },
  ];

  return (
    <Card
      active
      style={{
        position: "absolute",
        right: 142,
        top: 186,
        width: 770,
        height: 590,
        opacity: progress,
        padding: 34,
        background: "rgba(2, 6, 23, 0.84)",
      }}
    >
      <div style={{ color: BRAND.dim, fontSize: 24, marginBottom: 26 }}>SKILL.md</div>
      <div style={{ color: BRAND.ink, fontSize: 32, fontFamily: "Menlo, monospace", lineHeight: 1.52 }}>
        <span style={{ color: BRAND.violet }}># remotion-markup</span>
        <br />
        <span style={{ color: BRAND.dim }}>A reusable working method for video code.</span>
      </div>
      <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 18 }}>
        {rows.map((row, index) => {
          const rowProgress = interpolate(progress, [index * 0.16, 0.48 + index * 0.12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={row.text}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                opacity: rowProgress,
                transform: `translateX(${interpolate(rowProgress, [0, 1], [36, 0])}px)`,
              }}
            >
              <div style={{ width: 16, height: 16, borderRadius: 4, background: row.color }} />
              <div style={{ color: BRAND.ink, fontSize: 27, fontFamily: "Menlo, monospace" }}>{row.text}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const WorkflowScene: React.FC<{ progress: number; improved: boolean }> = ({ progress, improved }) => {
  const steps = improved
    ? ["识别任务", "加载 Skill", "执行工具流", "按清单验收"]
    : ["猜上下文", "临时搜索", "试错调用", "返工修正"];
  const colors = improved
    ? [BRAND.mint, BRAND.cyan, BRAND.gold, BRAND.mint]
    : [BRAND.coral, BRAND.gold, BRAND.violet, BRAND.coral];

  return (
    <div
      style={{
        position: "absolute",
        right: 110,
        top: 210,
        width: 820,
        height: 520,
        opacity: progress,
      }}
    >
      {steps.map((step, index) => {
        const active = progress > index * 0.2 + 0.12;
        const stepProgress = interpolate(progress, [index * 0.15, 0.42 + index * 0.13], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div key={step}>
            <Card
              active={active && improved}
              style={{
                position: "absolute",
                left: 48 + index * 184,
                top: 150 + (improved ? Math.sin(index) * 28 : (index % 2) * 80),
                width: 154,
                height: 154,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 18,
                opacity: stepProgress,
                transform: `scale(${interpolate(stepProgress, [0, 1], [0.82, 1])})`,
              }}
            >
              <div
                style={{
                  color: colors[index],
                  fontSize: 31,
                  lineHeight: 1.22,
                  textAlign: "center",
                  fontWeight: 850,
                }}
              >
                {step}
              </div>
            </Card>
            {index < steps.length - 1 && (
              <div
                style={{
                  position: "absolute",
                  left: 202 + index * 184,
                  top: improved ? 218 : 232 + (index % 2) * 35,
                  width: 92,
                  height: 4,
                  background: improved ? "rgba(110, 243, 180, 0.65)" : "rgba(255, 122, 102, 0.55)",
                  opacity: stepProgress,
                  transform: `rotate(${improved ? 0 : index % 2 === 0 ? 12 : -12}deg)`,
                }}
              />
            )}
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 206,
          top: 386,
          width: 410,
          color: improved ? BRAND.mint : BRAND.coral,
          fontSize: 32,
          fontWeight: 850,
          textAlign: "center",
        }}
      >
        {improved ? "稳定、可复用、可验证" : "慢、散、容易漏掉边界"}
      </div>
    </div>
  );
};

const ValueScene: React.FC<{ progress: number }> = ({ progress }) => {
  const metrics = [
    { label: "启动时间", value: "-42%", color: BRAND.cyan },
    { label: "遗漏风险", value: "-58%", color: BRAND.mint },
    { label: "结果一致性", value: "+73%", color: BRAND.gold },
  ];

  return (
    <div
      style={{
        position: "absolute",
        right: 120,
        top: 168,
        width: 820,
        height: 620,
        opacity: progress,
      }}
    >
      {metrics.map((metric, index) => {
        const local = interpolate(progress, [index * 0.15, 0.62 + index * 0.1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <Card
            key={metric.label}
            active={index === 2}
            style={{
              position: "absolute",
              left: 34 + index * 258,
              top: 120,
              width: 226,
              height: 300,
              padding: 28,
              opacity: local,
              transform: `translateY(${interpolate(local, [0, 1], [42, 0])}px)`,
            }}
          >
            <div style={{ color: metric.color, fontSize: 66, fontWeight: 900 }}>{metric.value}</div>
            <div style={{ color: BRAND.ink, fontSize: 30, fontWeight: 780, marginTop: 38 }}>{metric.label}</div>
            <div
              style={{
                height: 9,
                borderRadius: 8,
                background: "rgba(248,250,252,0.12)",
                marginTop: 34,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(local * (index === 0 ? 56 : index === 1 ? 70 : 86))}%`,
                  background: metric.color,
                }}
              />
            </div>
          </Card>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 124,
          top: 474,
          color: BRAND.dim,
          fontSize: 28,
          lineHeight: 1.45,
          width: 600,
          textAlign: "center",
        }}
      >
        数字是概念化表达：Skill 的核心价值是把好方法变成可重复的默认动作。
      </div>
    </div>
  );
};

const CloseScene: React.FC<{ progress: number }> = ({ progress }) => {
  const skills = ["create", "markup", "captions", "studio", "render"];

  return (
    <div
      style={{
        position: "absolute",
        right: 96,
        top: 152,
        width: 880,
        height: 650,
        opacity: progress,
      }}
    >
      <div style={{ position: "absolute", left: 294, top: 34 }}>
        <AgentCore pulse={progress} label="Agent" />
      </div>
      {skills.map((skill, index) => {
        const local = interpolate(progress, [index * 0.11, 0.56 + index * 0.07], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const angle = -Math.PI / 1.05 + index * (Math.PI / 4.1);

        return (
          <Card
            key={skill}
            active={index === 1}
            style={{
              position: "absolute",
              left: 382 + Math.cos(angle) * 314 - 92,
              top: 300 + Math.sin(angle) * 246 - 38,
              width: 184,
              height: 76,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: [BRAND.cyan, BRAND.mint, BRAND.gold, BRAND.coral, BRAND.violet][index],
              fontSize: 26,
              fontWeight: 850,
              opacity: local,
            }}
          >
            /remotion-{skill}
          </Card>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 176,
          top: 514,
          color: BRAND.ink,
          fontSize: 32,
          fontWeight: 800,
          width: 520,
          textAlign: "center",
        }}
      >
        不是更长的提示词，而是更会工作的 Agent。
      </div>
    </div>
  );
};

const SceneVisual: React.FC<{ scene: Scene; progress: number }> = ({ scene, progress }) => {
  if (scene.mode === "orbit") {
    return <OrbitScene progress={progress} />;
  }

  if (scene.mode === "cabinet") {
    return <CabinetScene progress={progress} />;
  }

  if (scene.mode === "code") {
    return <CodeScene progress={progress} />;
  }

  if (scene.mode === "before") {
    return <WorkflowScene progress={progress} improved={false} />;
  }

  if (scene.mode === "after") {
    return <WorkflowScene progress={progress} improved />;
  }

  if (scene.mode === "value") {
    return <ValueScene progress={progress} />;
  }

  return <CloseScene progress={progress} />;
};

const ProgressRail: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = frame / totalFrames;

  return (
    <div
      style={{
        position: "absolute",
        left: 92,
        right: 92,
        top: 1010,
        height: 3,
        background: "rgba(248,250,252,0.13)",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, progress * 100)}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${BRAND.cyan}, ${BRAND.mint}, ${BRAND.gold})`,
        }}
      />
    </div>
  );
};

export const SkillConceptVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = getCurrentScene(frame);
  const scenePresence = 1;
  const sceneProgress = interpolate(frame, [scene.from + 12, scene.from + 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opener = spring({
    frame,
    fps,
    config: {
      damping: 96,
      stiffness: 70,
    },
  });
  const outroDim = interpolate(frame, [totalFrames - 80, totalFrames], [1, 0.45], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.ease,
  });

  return (
    <AbsoluteFill>
      <SoftGrid />
      <AbsoluteFill
        style={{
          opacity: opener * outroDim,
          transform: `scale(${interpolate(opener, [0, 1], [1.04, 1])})`,
        }}
      >
        <Header scene={scene} sceneProgress={scenePresence} />
        <SceneVisual scene={scene} progress={sceneProgress} />
        <CaptionBar />
        <ProgressRail />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const skillConceptDurationInFrames = totalFrames;
