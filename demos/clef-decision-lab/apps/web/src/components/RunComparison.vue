<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ArrowRight } from 'lucide-vue-next';
import { comparisonIssue, probabilities, optionLabel, answerTitle, record, type RunRecord } from '../../../../packages/shared/src/decision';
import { identifyExample } from '../../../../packages/shared/src/examples';
import ProbabilityChart from './ProbabilityChart.vue';
const props = defineProps<{ runs: RunRecord[] }>();
const success = computed(() => props.runs.filter(r => r.response));
const aId = ref(''), bId = ref('');
watch(success, runs => {
  if (!runs.some(r => r.id === aId.value)) aId.value = runs[1]?.id ?? runs[0]?.id ?? '';
  if (!runs.some(r => r.id === bId.value)) bId.value = runs[0]?.id ?? '';
}, { immediate: true });
const a = computed(() => success.value.find(r => r.id === aId.value));
const b = computed(() => success.value.find(r => r.id === bId.value));
const issue = computed(() => !a.value || !b.value ? '请先完成至少两次真实请求。' : aId.value === bId.value ? '请选择两条不同的运行记录。' : comparisonIssue(a.value, b.value));
function runLabel(run: RunRecord) {
  const scenario = identifyExample(run.request);
  return `${scenario ? `${scenario.id} ${scenario.label}` : '自定义'} · ${new Date(run.requestedAt).toLocaleTimeString('zh-CN')} · ${run.request.model} · ${run.id.slice(0, 6)}`;
}
</script>
<template>
  <section class="wide-panel">
    <div class="section-heading"><div><span class="eyebrow">CHANGE THE STATE. OBSERVE THE SHIFT.</span><h2>状态 A / B 对比</h2><p>固定模型与 Questions，只改变一项 State。Δ = B − A，单位为百分点（pp）。</p></div><span class="real-chip">两次独立的真实请求</span></div>
    <div class="compare-selectors"><label>运行 A<select v-model="aId" aria-label="运行 A"><option value="" disabled>选择记录</option><option v-for="run in success" :key="run.id" :value="run.id">{{ runLabel(run) }}</option></select></label><ArrowRight :size="20" /><label>运行 B<select v-model="bId" aria-label="运行 B"><option value="" disabled>选择记录</option><option v-for="run in success" :key="run.id" :value="run.id">{{ runLabel(run) }}</option></select></label></div>
    <p v-if="issue" class="inline-note">{{ issue }}</p>
    <template v-else-if="a && b">
      <div class="compare-states"><details><summary>Context A · {{ a.response?.durationMs }} ms</summary><pre>{{ JSON.stringify(a.request.state, null, 2) }}</pre></details><details><summary>Context B · {{ b.response?.durationMs }} ms</summary><pre>{{ JSON.stringify(b.request.state, null, 2) }}</pre></details></div>
      <article v-for="([id, q]) in Object.entries(a.request.questions)" :key="id" class="compare-card"><div class="answer-top"><span class="mono">{{ id }}</span><span class="type-pill">{{ q.type }}</span></div><div class="compare-answers"><div><span class="eyebrow">A</span><h3>{{ answerTitle(q, a.response!.answers[id]) }}</h3></div><div><span class="eyebrow">B</span><h3>{{ answerTitle(q, b.response!.answers[id]) }}</h3></div></div>
        <template v-if="q.type === 'noul' && typeof record(a.response!.answers[id])?.noul === 'number' && typeof record(b.response!.answers[id])?.noul === 'number'"><p class="mono delta-summary">P(Yes) Δ {{ ((Number(record(b.response!.answers[id])!.noul) - Number(record(a.response!.answers[id])!.noul)) * 100).toFixed(2) }} pp</p></template>
        <div v-else class="compare-distributions"><ProbabilityChart :items="Object.entries(probabilities(a.response!.answers[id])).map(([key, value]) => ({ id: key, label: optionLabel(q, key, a!.response!.answers[id]), value }))" /><ProbabilityChart :items="Object.entries(probabilities(b.response!.answers[id])).map(([key, value]) => ({ id: key, label: optionLabel(q, key, b!.response!.answers[id]), value, ...(key in probabilities(a!.response!.answers[id]) ? { delta: value - probabilities(a!.response!.answers[id])[key] } : {}) }))" /></div>
      </article>
    </template>
  </section>
</template>
