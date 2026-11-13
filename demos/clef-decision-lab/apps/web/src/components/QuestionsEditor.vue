<script setup lang="ts">
import { ref, watch } from 'vue';
import { Plus, Trash2, GripVertical } from 'lucide-vue-next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { label } from '../../../../packages/shared/src/decision';
import type { DecisionRequest, Question } from '../../../../packages/shared/src/schema';
const props = defineProps<{ modelValue: DecisionRequest['questions']; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: DecisionRequest['questions']]; invalid: [message: string] }>();
type Row = { uid: number; id: string; type: Question['type']; instructions: string; complexInstructions?: Question['instructions']; options: { id: string; text: string; original?: unknown }[]; noulCriteria?: Extract<Question, { type: 'noul' }>['criteria'] };
const rows = ref<Row[]>([]);
let next = 0, editing = false;
const legacyPlaceholders = new Set(['选项一', '选项二', '新候选项']);
function optionError(): string {
  for (const row of rows.value) {
    if (row.type === 'noul') continue;
    const index = row.options.findIndex(option => !option.text.trim() || legacyPlaceholders.has(option.text.trim()));
    if (index !== -1) return `${row.id || '当前问题'}：请为第 ${index + 1} 个${row.type === 'choice' ? '候选填写具体行为' : '等级填写明确含义'}，占位文案不能直接用于实验。`;
  }
  return '';
}
function hydrate() {
  rows.value = Object.entries(props.modelValue).map(([id, q]) => ({ uid: next++, id, type: q.type, instructions: label(q.instructions),
    complexInstructions: typeof q.instructions === 'string' ? undefined : q.instructions,
    noulCriteria: q.type === 'noul' ? q.criteria : undefined,
    options: q.type === 'choice' ? Object.entries(q.criteria).map(([id, value]) => ({ id, text: label(value), original: value })) : q.type === 'score' ? q.criteria.map((value, index) => ({ id: String(index), text: label(value), original: value })) : [],
  }));
  emit('invalid', optionError());
}
watch(() => props.modelValue, () => { if (!editing) hydrate(); }, { deep: true, immediate: true, flush: 'sync' });
function sync() {
  const ids = rows.value.map(row => row.id);
  if (new Set(ids).size !== ids.length) { emit('invalid', '问题 ID 重复，请为每个问题设置唯一 ID。'); return; }
  if (rows.value.some(row => row.type === 'choice' && new Set(row.options.map(o => o.id)).size !== row.options.length)) {
    emit('invalid', '候选 ID 重复，请为每个候选项设置唯一 ID。'); return;
  }
  const value = Object.fromEntries(rows.value.map(row => {
    const instructions = row.complexInstructions !== undefined && row.instructions === label(row.complexInstructions) ? row.complexInstructions : row.instructions;
    const base = { type: row.type, instructions };
    const optionValue = (o: Row['options'][number]) => o.original !== undefined && o.text === label(o.original) ? o.original : o.text;
    return [row.id, row.type === 'choice' ? { ...base, criteria: Object.fromEntries(row.options.map(o => [o.id, optionValue(o)])) } :
      row.type === 'score' ? { ...base, criteria: row.options.map(optionValue) } : { ...base, ...(row.noulCriteria ? { criteria: row.noulCriteria } : {}) }];
  })) as DecisionRequest['questions'];
  editing = true; emit('update:modelValue', value); editing = false; emit('invalid', optionError());
}
function changeType(row: Row) {
  if (row.type === 'noul') row.options = [];
  else if (!row.options.length) row.options = [{ id: 'option_a', text: '' }, { id: 'option_b', text: '' }];
  sync();
}
function add() {
  let id = `question_${next + 1}`;
  while (rows.value.some(row => row.id === id)) id += '_new';
  rows.value.push({ uid: next++, id, type: 'noul', instructions: '角色是否愿意采取行动？', options: [] }); sync();
}
function addOption(row: Row) {
  let id = `option_${row.options.length + 1}`;
  while (row.options.some(o => o.id === id)) id += '_new';
  row.options.push({ id, text: '' }); sync();
}
</script>
<template>
  <div class="questions-list">
    <article v-for="(row, index) in rows" :key="row.uid" class="question-card">
      <div class="question-card-top"><span class="question-index">Q{{ String(index + 1).padStart(2, '0') }}</span><select v-model="row.type" :aria-label="`问题 ${index + 1} 类型`" :disabled="disabled" class="type-select" @change="changeType(row)"><option value="choice">choice</option><option value="noul">noul</option><option value="score">score</option></select><Button variant="ghost" size="icon-sm" :disabled="disabled" :aria-label="`删除问题 ${index + 1}`" @click="rows.splice(index, 1); sync()"><Trash2 :size="14" /></Button></div>
      <label class="field-label" :for="`qid-${row.uid}`">问题 ID</label><Input :id="`qid-${row.uid}`" v-model="row.id" :disabled="disabled" class="mono question-id" @update:model-value="sync" />
      <label class="field-label" :for="`instructions-${row.uid}`">判断说明</label><Textarea :id="`instructions-${row.uid}`" v-model="row.instructions" :disabled="disabled" rows="2" class="instructions-input" @update:model-value="sync" />
      <div v-if="row.type !== 'noul'" class="options-editor">
        <div class="options-heading"><span class="field-label">{{ row.type === 'choice' ? '候选行为' : '有序等级 · 从 0 开始' }}</span><span class="micro">{{ row.options.length }} options</span></div>
        <p class="question-note">{{ row.type === 'choice' ? 'ID 用于程序识别；描述请写具体行为，例如“向爱丽丝点头”。' : '每级都需明确含义，并按程度从低到高排列，例如“完全没必要”到“必须立即离开”。切换题型后请核对问题与等级是否匹配。' }}</p>
        <div v-for="(option, oi) in row.options" :key="oi" class="option-row">
          <GripVertical v-if="row.type === 'choice'" :size="13" class="muted" aria-hidden="true" /><span v-else class="level-index">{{ oi }}</span>
          <Input v-if="row.type === 'choice'" v-model="option.id" :disabled="disabled" :aria-label="`问题 ${index + 1} 候选 ${oi + 1} ID`" class="option-key mono" @update:model-value="sync" />
          <Input v-model="option.text" :disabled="disabled" :placeholder="row.type === 'choice' ? '例如：向爱丽丝点头' : oi === 0 ? '最低等级，例如：完全没必要' : '更高等级，例如：稍有必要'" :aria-invalid="!option.text.trim() || legacyPlaceholders.has(option.text.trim())" :aria-describedby="!option.text.trim() || legacyPlaceholders.has(option.text.trim()) ? `options-error-${row.uid}` : undefined" :aria-label="`问题 ${index + 1} 候选 ${oi + 1} 描述`" class="option-description" @update:model-value="sync" />
          <button class="remove-option" :disabled="disabled" :aria-label="`删除问题 ${index + 1} 候选 ${oi + 1}`" @click="row.options.splice(oi, 1); sync()">×</button>
        </div>
        <p v-if="row.options.some(option => !option.text.trim() || legacyPlaceholders.has(option.text.trim()))" :id="`options-error-${row.uid}`" class="field-error">{{ row.type === 'choice' ? '请给每个候选填写具体行为。' : '请给每个等级填写明确的程度含义。' }}“选项一”等占位文案需先替换。</p>
        <button class="add-option" :disabled="disabled" @click="addOption(row)"><Plus :size="12" /> 添加{{ row.type === 'choice' ? '候选' : '等级' }}</button>
      </div>
      <p v-else class="question-note">noul 返回“是”的概率：0 → 否，1 → 是。</p>
    </article>
    <Button variant="outline" class="add-question" :disabled="disabled" @click="add"><Plus :size="15" /> 添加问题</Button>
  </div>
</template>
