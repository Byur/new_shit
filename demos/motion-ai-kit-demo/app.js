const scenarios = {
  context: {
    title: "Docs & examples context",
    badge: "Free context",
    copy:
      "AI Kit 的第一层价值是让 agent 查询当前 Motion 文档和推荐模式，减少凭旧 API 或随机博客写动画的概率。",
    pills: ["latest docs", "recommended patterns", "Motion UI examples", "best practices"],
    code: `User: 做一个磁性 hover 卡片

AI Kit context:
- Use transform/scale for hover feedback
- Keep layout stable
- Prefer spring transitions for tactile response

Suggested implementation:
<motion.article
  whileHover={{ y: -8, scale: 1.04 }}
  transition={{ type: "spring", bounce: 0.28 }}
/>`,
  },
  audit: {
    title: "MotionScore source audit",
    badge: "Motion+ audit",
    copy:
      "MotionScore for Agents 会扫描 Motion、CSS、GSAP、Anime.js 等动画代码，并按渲染成本给出 S-F 等级和具体修复建议。",
    pills: ["source scan", "runtime profiling", "S-F grades", "top fixes"],
    code: `Finding: ProductHero.tsx:42
Tier: D / Layout + repaint each frame

Why:
- Animating left triggers layout on every frame
- The element is visible during the whole hero loop

Fix:
- Replace left with transform: translateX(...)
- Consider whileInView for long-running loops`,
  },
  spring: {
    title: "CSS spring generation",
    badge: "Motion+ MCP",
    copy:
      "AI Kit 可以把“snappy but bouncy”这种自然语言转成 CSS linear() 曲线。产物是普通 CSS，不需要在页面里跑 Motion runtime。",
    pills: ["natural language", "linear() easing", "no runtime", "production CSS"],
    code: `.card {
  transition:
    transform 520ms linear(
      0, 0.015, 0.058, 0.128, 0.286,
      0.612, 0.884, 1.041, 1.092,
      1.062, 1.018, 0.995, 1
    );
}`,
  },
  editor: {
    title: "Transition editor",
    badge: "Visual tuning",
    copy:
      "Transition editor 的意义是让 agent 和人都能在 IDE/chat 里看见曲线、调 duration / easing / spring，再把喜欢的 transition 保存复用。",
    pills: ["preview", "duration", "easing", "cloud saves"],
    code: `Saved transition: magnetic-card-pop

duration: 0.42s
easing: spring / bounce 0.32
target:
- y: -8
- scale: 1.04
- box-shadow: elevated`,
  },
};

const presets = {
  snappy: {
    ease:
      "linear(0, 0.015, 0.058, 0.128, 0.286, 0.612, 0.884, 1.041, 1.092, 1.062, 1.018, 0.995, 1)",
    duration: "520ms",
    label: "snappy but bouncy",
  },
  bouncy: {
    ease:
      "linear(0, 0.012, 0.047, 0.108, 0.236, 0.52, 0.83, 1.08, 1.22, 1.18, 1.06, 0.97, 1.01, 1)",
    duration: "720ms",
    label: "playful bounce",
  },
  gentle: {
    ease:
      "linear(0, 0.026, 0.092, 0.196, 0.34, 0.516, 0.688, 0.824, 0.918, 0.974, 1)",
    duration: "680ms",
    label: "soft settle",
  },
};

const title = document.querySelector("#scenario-title");
const badge = document.querySelector("#scenario-badge");
const copy = document.querySelector("#scenario-copy");
const pills = document.querySelector("#scenario-pills");
const code = document.querySelector("#scenario-code");
const springCard = document.querySelector("#spring-card");
const springCode = document.querySelector("#spring-code");

function renderScenario(name) {
  const scenario = scenarios[name];
  title.textContent = scenario.title;
  badge.textContent = scenario.badge;
  copy.textContent = scenario.copy;
  code.textContent = scenario.code;
  pills.replaceChildren(
    ...scenario.pills.map((label) => {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = label;
      return pill;
    }),
  );
}

function renderPreset(name) {
  const preset = presets[name];
  document.documentElement.style.setProperty("--active-ease", preset.ease);
  springCard.style.transitionDuration = preset.duration;
  springCode.textContent = `/* ${preset.label} */
.card {
  transition:
    transform ${preset.duration} ${preset.ease},
    border-radius ${preset.duration} ${preset.ease};
}`;
  springCard.classList.remove("is-playing");
  window.requestAnimationFrame(() => {
    springCard.classList.add("is-playing");
    window.setTimeout(() => springCard.classList.remove("is-playing"), 780);
  });
}

document.querySelectorAll(".scenario-button").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".scenario-button")
      .forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    renderScenario(button.dataset.scenario);
  });
});

document.querySelectorAll(".preset-button").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".preset-button")
      .forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    renderPreset(button.dataset.preset);
  });
});

renderScenario("context");
renderPreset("snappy");
