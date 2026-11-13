<script setup lang="ts">
import { Download, RotateCcw, Trash2, Check, AlertCircle } from 'lucide-vue-next';
import { Button } from './ui/button';
import { answerTitle, type RunRecord } from '../../../../packages/shared/src/decision';
import { identifyExample } from '../../../../packages/shared/src/examples';
defineProps<{ runs: RunRecord[]; selectedId?: string; busy: boolean }>();
defineEmits<{ select: [run: RunRecord]; restore: [run: RunRecord]; export: [run: RunRecord]; clear: [] }>();
</script>
<template>
  <section class="wide-panel">
    <div class="section-heading"><div><span class="eyebrow">YOUR LOCAL EXPERIMENTS</span><h2>运行历史 <span>{{ runs.length }} / 100</span></h2><p>记录请求快照与真实响应。最多保留 100 条、合计 2 MB，存储在当前浏览器。</p></div><Button variant="outline" :disabled="busy || !runs.length" @click="$emit('clear')"><Trash2 :size="14" /> 清空历史</Button></div>
    <div v-if="!runs.length" class="wide-empty">还没有运行记录。在工作台发起第一次决策请求。</div>
    <div class="history-list">
      <article v-for="run in runs" :key="run.id" class="history-row" :class="{ 'history-selected': selectedId === run.id }">
        <button class="history-main" @click="$emit('select', run)"><span class="history-icon" :class="{ failed: run.error }"><Check v-if="run.response" :size="17" /><AlertCircle v-else :size="17" /></span><div><strong>{{ run.request.model }}</strong><span v-if="identifyExample(run.request)" class="micro">{{ identifyExample(run.request)!.id }} · {{ identifyExample(run.request)!.label }}</span><span class="micro">{{ new Date(run.requestedAt).toLocaleString('zh-CN') }}</span></div><span class="history-answer">{{ run.response ? Object.entries(run.request.questions).map(([id, q]) => answerTitle(q, run.response!.answers[id])).join(' · ') : run.error?.message }}</span><span class="mono">{{ run.response?.durationMs ?? run.clientDurationMs }} ms</span></button>
        <Button variant="ghost" size="icon" :disabled="busy" aria-label="载入此记录的输入" @click="$emit('restore', run)"><RotateCcw :size="15" /></Button><Button variant="ghost" size="icon" aria-label="导出此记录" @click="$emit('export', run)"><Download :size="15" /></Button>
      </article>
    </div>
  </section>
</template>
