<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowUpRight, Check, Clock3, Braces, CircleDot } from 'lucide-vue-next';
import { record, probabilities, optionLabel, answerTitle, type RunRecord } from '../../../../packages/shared/src/decision';
import ProbabilityChart from './ProbabilityChart.vue';
const props = defineProps<{ run: RunRecord | null; busy: boolean; stale: boolean }>();
const tab = ref<'answers' | 'raw' | 'request'>('answers');
const result = computed(() => props.run?.response);
const entries = computed(() => props.run ? Object.entries(props.run.request.questions) : []);
</script>
<template>
  <div class="editor-toolbar result-tabs"><div class="segment"><button :class="{ active: tab === 'answers' }" @click="tab = 'answers'">答案</button><button :class="{ active: tab === 'raw' }" @click="tab = 'raw'">响应 JSON</button><button :class="{ active: tab === 'request' }" @click="tab = 'request'">请求</button></div></div>
  <div v-if="!run" class="result-empty"><div class="empty-symbol"><CircleDot :size="28" :stroke-width="1.3" /></div><h3>{{ busy ? '正在评估候选行为…' : '让状态，变成决策。' }}</h3><p>准备好 Context 与 Questions，<br />点击 Run，观察真实的行为分布。</p><div class="empty-flow"><span>STATE</span><ArrowUpRight :size="15" /><span>QUESTIONS</span><ArrowUpRight :size="15" /><span>DECISIONS</span></div><span class="micro">这里的结果均来自真实 API 请求</span></div>
  <template v-else>
    <div v-if="stale" class="inline-note">表单已修改。当前展示的是下方运行快照的结果。</div>
    <div class="run-metadata"><span class="run-status" :class="{ failed: run.error }"><Check v-if="result" :size="13" />{{ run.error ? run.error.code : '完成 · REAL RESPONSE' }}</span><span class="mono"><Clock3 :size="12" /> {{ result?.durationMs ?? run.clientDurationMs }} ms</span></div>
    <div class="result-model mono">{{ run.request.model }} <span>· {{ new Date(run.requestedAt).toLocaleTimeString('zh-CN') }}</span></div>
    <div v-if="run.error" class="error-card" role="alert"><strong>{{ run.error.code }}</strong><p>{{ run.error.message }}</p></div>
    <template v-if="tab === 'answers' && result">
      <article v-for="([id, question], index) in entries" :key="id" class="answer-card">
        <div class="answer-top"><span class="question-index">Q{{ String(index + 1).padStart(2, '0') }}</span><span class="mono answer-id">{{ id }}</span><span class="type-pill">{{ question.type }}</span></div>
        <h3>{{ answerTitle(question, result.answers[id]) }}</h3>
        <template v-if="question.type === 'noul' && typeof record(result.answers[id])?.noul === 'number'">
          <ProbabilityChart :items="[{ id: 'yes', label: '是 · P(Yes)', value: record(result.answers[id])!.noul as number }]" selected="yes" />
          <p class="answer-note">提供商返回的是“是”的概率，并非一次随机抽样的 Yes / No。</p>
        </template>
        <template v-else>
          <ProbabilityChart :items="Object.entries(probabilities(result.answers[id])).map(([key, value]) => ({ id: key, label: optionLabel(question, key, result!.answers[id]), value }))" :selected="typeof record(result.answers[id])?.choice === 'string' ? record(result.answers[id])!.choice as string : undefined" />
          <p v-if="question.type === 'score'" class="answer-note">概率加权的等级均值，可落在两个等级之间；0 为最低等级。</p>
        </template>
        <div v-if="typeof record(result.answers[id])?.confidence === 'number'" class="confidence"><span>提供商 confidence</span><span class="mono">{{ (Number(record(result.answers[id])!.confidence) * 100).toFixed(2) }}%</span></div>
      </article>
      <div class="usage-box"><span class="field-label">PROVIDER USAGE</span><div v-if="result.usage" class="usage-values"><span v-for="(value, key) in result.usage" :key="key"><span class="micro">{{ key }}</span><strong class="mono">{{ value }}</strong></span></div><p v-else class="micro">本次提供商未返回用量。</p></div>
      <p class="answer-note">confidence 是提供商从分布衍生的指标，不等于所选项概率或现实正确率。</p>
      <details class="response-details"><summary><Braces :size="14" /> 原始响应</summary><pre>{{ JSON.stringify(result.raw, null, 2) }}</pre></details>
    </template>
    <pre v-else-if="tab === 'raw'" class="json-output">{{ JSON.stringify(result?.raw ?? run.error, null, 2) }}</pre>
    <pre v-else-if="tab === 'request'" class="json-output">{{ JSON.stringify(run.request, null, 2) }}</pre>
    <div class="micro timing-note">API 耗时：{{ result?.durationMs ?? '—' }} ms · 浏览器往返：{{ run.clientDurationMs }} ms</div>
  </template>
</template>
