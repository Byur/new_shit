<script setup lang="ts">
import { computed, ref } from 'vue';
import { Play, Download, Square } from 'lucide-vue-next';
import { Button } from './ui/button';
import { summarize, optionLabel, type RunRecord } from '../../../../packages/shared/src/decision';
import ProbabilityChart from './ProbabilityChart.vue';
const props = defineProps<{ runs: RunRecord[]; busy: boolean; validationError: string; progress: { completed: number; planned: number } }>();
defineEmits<{ run: [count: number]; cancel: []; export: [] }>();
const count = ref(5);
const stats = computed(() => summarize(props.runs));
const baseline = computed(() => props.runs[0]?.request);
</script>
<template>
  <section class="wide-panel">
    <div class="section-heading"><div><span class="eyebrow">MEASURE, THEN DECIDE.</span><h2>重复试验</h2><p>冻结工作台当前输入，串行发送 N 次真实请求。认证失败或配额限流时自动停止。</p></div><Button variant="outline" :disabled="!runs.length" @click="$emit('export')"><Download :size="15" /> 导出实验</Button></div>
    <div class="benchmark-controls"><label class="field-label">请求次数<select v-model.number="count" :disabled="busy" aria-label="重复次数"><option v-for="n in [5, 10, 20, 50]" :key="n" :value="n">{{ n }} 次</option></select></label><Button v-if="!busy" :disabled="!!validationError" @click="$emit('run', count)"><Play :size="14" /> 开始 {{ count }} 次真实请求</Button><Button v-else variant="destructive" @click="$emit('cancel')"><Square :size="14" /> 停止 · {{ progress.completed }} / {{ progress.planned }}</Button><span class="micro">使用当前账户额度，不自动重试。每次运行单独进入历史。</span></div>
    <p v-if="validationError" class="field-error">请先修正工作台输入：{{ validationError }}</p>
    <div class="stat-grid"><div><span class="eyebrow">SUCCESS / FAILED</span><strong>{{ stats.success }} <small>/ {{ stats.failed }}</small></strong></div><div><span class="eyebrow">FAILURE RATE</span><strong>{{ (stats.failureRate * 100).toFixed(1) }}<small>%</small></strong></div><div><span class="eyebrow">P50 · SUCCESS</span><strong>{{ stats.p50 ?? '—' }}<small>ms</small></strong></div><div><span class="eyebrow">P95 · SUCCESS</span><strong>{{ stats.p95 ?? '—' }}<small>ms</small></strong></div></div>
    <div v-if="baseline" class="benchmark-results">
      <article v-for="([id, q]) in Object.entries(baseline.questions)" :key="id" class="benchmark-card"><div class="answer-top"><span class="mono">{{ id }}</span><span class="type-pill">{{ q.type }}</span></div>
        <template v-if="q.type === 'choice'"><h3>被选中的次数</h3><div v-for="(description, key) in q.criteria" :key="key" class="frequency-row"><span>{{ optionLabel(q, String(key)) }}</span><strong class="mono">{{ stats.frequencies[id]?.[key] ?? 0 }} 次 · {{ stats.success ? (((stats.frequencies[id]?.[key] ?? 0) / stats.success) * 100).toFixed(1) : '0.0' }}%</strong></div></template>
        <template v-if="stats.meanProbabilities[id]"><h3>提供商概率均值</h3><ProbabilityChart :items="Object.entries(stats.meanProbabilities[id]).map(([key, value]) => ({ id: key, label: optionLabel(q, key), value }))" /></template>
        <p v-else class="micro">本题未返回逐候选 probabilities 字段；原始数据见导出记录。</p>
      </article>
    </div>
    <div v-if="stats.usage" class="usage-box"><span class="eyebrow">PROVIDER USAGE · SUM</span><pre>{{ JSON.stringify(stats.usage, null, 2) }}</pre></div>
    <div class="help-box"><span class="help-label">读懂重复试验</span><p>choice 是最高概率选项，不是按概率抽样。多次得到相同选项，不代表它的概率是 100%。延迟分位数使用成功请求、nearest-rank 算法；小样本仅用于探索。</p></div>
  </section>
</template>
