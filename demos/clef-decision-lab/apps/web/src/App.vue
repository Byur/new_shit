<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Play, Square, ArrowUpRight, ChevronRight, BookOpen, FlaskConical, History, Columns2, ChartNoAxesCombined, Download, Upload, CircleAlert, Braces, Code2, Check } from 'lucide-vue-next';
import { Button } from './components/ui/button';
import { useDecisionLab } from './composables/useDecisionLab';
import { downloadJson } from './lib/storage';
import type { RunRecord } from '../../../packages/shared/src/decision';
import { exampleScenarios, identifyExample } from '../../../packages/shared/src/examples';
import ModelSelector from './components/ModelSelector.vue';
import ContextEditor from './components/ContextEditor.vue';
import QuestionsEditor from './components/QuestionsEditor.vue';
import ResultViewer from './components/ResultViewer.vue';
import RunHistory from './components/RunHistory.vue';
import RunComparison from './components/RunComparison.vue';
import BatchBenchmark from './components/BatchBenchmark.vue';
import LearningGuide from './components/LearningGuide.vue';

const { request, runs, selected, rawDraft, contextError, questionsError, storageWarning, busy, progress, batchRuns,
  error, ready, validationError, editRaw, setRequest, scenario, run, cancel, clearHistory, checkHealth } = useDecisionLab();
type View = 'workspace' | 'history' | 'compare' | 'benchmark' | 'guide';
const view = ref<View>('workspace');
const mobilePanel = ref('context');
const editor = ref<'form' | 'raw'>('form');
const importInput = ref<HTMLInputElement>();
const importError = ref('');
const stale = computed(() => !!selected.value && JSON.stringify(selected.value.request) !== JSON.stringify(request.value));
const questionCount = computed(() => Object.keys(request.value.questions).length);
const activeScenario = computed(() => identifyExample(request.value));
const views = [ { id: 'workspace', label: '工作台', icon: FlaskConical }, { id: 'history', label: '历史记录', icon: History }, { id: 'compare', label: 'A / B 对比', icon: Columns2 }, { id: 'benchmark', label: '重复试验', icon: ChartNoAxesCombined } ] as const;
function exportRun(item: RunRecord) { downloadJson(`clef-run-${item.id.slice(0, 8)}.json`, item); }
function selectRun(item: RunRecord) { selected.value = item; view.value = 'workspace'; mobilePanel.value = 'results'; }
function restoreRun(item: RunRecord) { setRequest(item.request); selected.value = item; view.value = 'workspace'; }
function loadExamples() { scenario('A'); editor.value = 'form'; mobilePanel.value = 'context'; }
async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 256 * 1024) importError.value = '导入文件不能超过 256 KiB。';
  else { editRaw(await file.text()); editor.value = 'raw'; view.value = 'workspace'; mobilePanel.value = 'questions'; importError.value = ''; }
  (event.target as HTMLInputElement).value = '';
}
async function runSingle() { mobilePanel.value = 'results'; await run(); }
function shortcut(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void runSingle(); }
}
onMounted(() => { void checkHealth(); window.addEventListener('keydown', shortcut); });
onUnmounted(() => window.removeEventListener('keydown', shortcut));
</script>
<template>
  <div class="app-shell">
    <header class="app-header"><a class="brand" href="#" @click.prevent="view = 'workspace'"><span class="brand-mark"><ChevronRight :size="22" /><ChevronRight :size="22" /></span><span>clef<span class="brand-divider">/</span><span class="brand-light">decision lab</span></span><span class="version">v0.1</span></a><div class="header-right"><span class="local-status" :class="{ offline: ready === false }"><i />{{ ready === null ? '正在连接' : ready ? '本地代理已就绪' : '代理或凭据未就绪' }}</span><button class="guide-button" :class="{ active: view === 'guide' }" @click="view = view === 'guide' ? 'workspace' : 'guide'"><BookOpen :size="15" /> 理解 Clef <ArrowUpRight :size="13" /></button></div></header>
    <main>
      <section class="workspace-heading"><div><div class="eyebrow lab-eyebrow"><span /> NPC BEHAVIOR PLAYGROUND</div><h1>把每一次选择，摊开来看。</h1><p>给定状态，定义候选，观察 Clef 如何决策。</p></div><div class="heading-meta"><span class="mono">STATE + QUESTIONS → DECISIONS</span><span>由 Cloudflare Workers AI 提供推理</span></div></section>
      <section class="experiment-bar"><div class="experiment-name"><span class="experiment-icon"><FlaskConical :size="18" /></span><div><span class="eyebrow">EXPERIMENT</span><strong>艾琳的酒馆之夜</strong></div><span class="experiment-tag">{{ questionCount }} QUESTIONS</span></div><div class="experiment-controls"><ModelSelector v-model="request.model" :disabled="busy" /><Button v-if="!busy" :disabled="!!validationError" class="run-button" @click="runSingle"><Play :size="14" fill="currentColor" /> Run <kbd>↵</kbd></Button><Button v-else variant="destructive" class="run-button" @click="cancel"><Square :size="13" fill="currentColor" /> Cancel</Button></div></section>
      <nav class="view-navigation" aria-label="实验视图"><div class="view-links"><button v-for="item in views" :key="item.id" :class="{ active: view === item.id }" @click="view = item.id"><component :is="item.icon" :size="15" />{{ item.label }}<span v-if="item.id === 'history' && runs.length" class="nav-count">{{ runs.length }}</span></button></div><div class="import-export"><button :disabled="busy" @click="importInput?.click()"><Upload :size="13" /> 导入请求</button><button @click="downloadJson('clef-request.json', request)"><Download :size="13" /> 导出请求</button><input ref="importInput" type="file" accept=".json,application/json" hidden @change="importFile" /></div></nav>
      <div v-if="validationError || error || importError" class="global-error" role="alert"><CircleAlert :size="17" /><span>{{ validationError || error?.message || importError }}</span><span v-if="error && !validationError" class="mono error-code">{{ error.code }}</span></div>
      <div v-if="storageWarning" class="inline-note">{{ storageWarning }}</div>
      <template v-if="view === 'workspace'">
        <div class="scenario-bar"><div><button class="load-examples" :disabled="busy" @click="loadExamples">载入三题示例</button><span class="scenario-label">状态预设</span><button v-for="item in exampleScenarios" :key="item.id" :class="{ 'scenario-active': activeScenario?.id === item.id }" :aria-pressed="activeScenario?.id === item.id" :title="item.description" :disabled="busy" @click="scenario(item.id)"><span class="scenario-letter">{{ item.id }}</span> {{ item.label }}</button></div><span class="micro"><Check :size="12" /> 输入自动保存在本机</span></div>
        <p class="scenario-description">{{ activeScenario ? `${activeScenario.id} · ${activeScenario.description} 问题集保持固定，点击 Run 才会发出真实请求。` : '当前为自定义输入。点击“载入三题示例”可替换为完整的 choice / noul / score 示例；A、B、C、D 各自载入完整状态，B/C/D 分别只比 A 改一处。' }}</p>
        <nav class="mobile-panels" aria-label="编辑区域"><button v-for="panel in [{ id: 'context', label: 'Context' }, { id: 'questions', label: 'Questions' }, { id: 'results', label: 'Results' }]" :key="panel.id" :class="{ active: mobilePanel === panel.id }" @click="mobilePanel = panel.id">{{ panel.label }}</button></nav>
        <div class="workspace-grid">
          <section class="workspace-panel context-panel" :class="{ 'mobile-active': mobilePanel === 'context' }"><div class="panel-heading"><span class="panel-number">01</span><div><h2>Context</h2><p>角色此刻所处的世界</p></div><Braces :size="16" class="panel-heading-icon" /></div><div class="panel-content"><ContextEditor v-model="request.state" :disabled="busy" @invalid="contextError = $event" /></div><div class="panel-footer"><span class="status-dot" />{{ contextError ? '请修正输入' : '文本 / JSON 状态输入' }}</div></section>
          <section class="workspace-panel questions-panel" :class="{ 'mobile-active': mobilePanel === 'questions' }"><div class="panel-heading"><span class="panel-number">02</span><div><h2>Questions</h2><p>定义允许的答案空间</p></div><span class="count-badge">{{ questionCount }}</span></div><div class="panel-content"><div class="editor-toolbar"><div class="segment"><button :class="{ active: editor === 'form' }" @click="editor = 'form'">表单</button><button :class="{ active: editor === 'raw' }" @click="editor = 'raw'"><Code2 :size="12" /> Raw JSON</button></div><span class="micro">3 question types</span></div><QuestionsEditor v-show="editor === 'form'" v-model="request.questions" :disabled="busy" @invalid="questionsError = $event" /><div v-if="editor === 'raw'" class="raw-request-editor"><label class="field-label" for="raw-request">完整请求 · 与表单双向同步</label><textarea id="raw-request" class="code-editor" :value="rawDraft" :disabled="busy" spellcheck="false" :aria-invalid="!!validationError" @input="editRaw(($event.target as HTMLTextAreaElement).value)" /><p class="micro">包含 model、state 与 questions。重复 ID 会被拒绝。</p></div></div><div class="panel-footer"><span class="mono">choice</span><span>·</span><span class="mono">noul</span><span>·</span><span class="mono">score</span></div></section>
          <section class="workspace-panel results-panel" :class="{ 'mobile-active': mobilePanel === 'results' }"><div class="panel-heading"><span class="panel-number">03</span><div><h2>Results <span v-if="busy" class="loading-dot" /></h2><p>真实结果，逐项可见</p></div><button class="export-result" :disabled="!selected" aria-label="导出当前运行" @click="selected && exportRun(selected)"><Download :size="16" /></button></div><div class="panel-content" :aria-busy="busy"><ResultViewer :run="selected" :busy="busy" :stale="stale" /></div><div class="panel-footer"><span class="status-dot" :class="{ pending: busy }" />{{ busy ? `请求进行中 · ${progress.completed} / ${progress.planned}` : selected ? '结果绑定运行时的输入快照' : '等待第一次决策' }}</div></section>
        </div>
      </template>
      <RunHistory v-else-if="view === 'history'" :runs="runs" :selected-id="selected?.id" :busy="busy" @select="selectRun" @restore="restoreRun" @export="exportRun" @clear="clearHistory" />
      <RunComparison v-else-if="view === 'compare'" :runs="runs" />
      <BatchBenchmark v-else-if="view === 'benchmark'" :runs="batchRuns" :busy="busy" :validation-error="validationError" :progress="progress" @run="run" @cancel="cancel" @export="downloadJson('clef-benchmark.json', batchRuns)" />
      <LearningGuide v-else />
      <footer class="app-footer"><span><i /> LOCAL PLAYGROUND <span class="footer-divider">/</span> 密钥仅在服务端</span><span>先理解决策，再接入世界。<a href="https://developers.cloudflare.com/workers-ai/models/clef-flash/" target="_blank" rel="noreferrer">API Docs <ArrowUpRight :size="12" /></a></span></footer>
    </main>
  </div>
</template>
