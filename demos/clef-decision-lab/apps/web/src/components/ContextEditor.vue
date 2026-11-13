<script setup lang="ts">
import { ref, watch } from 'vue';
import { Braces, FileText } from 'lucide-vue-next';
import { parseJson, describeError } from '../../../../packages/shared/src/schema';
import type { DecisionRequest } from '../../../../packages/shared/src/schema';
type State = DecisionRequest['state'];
const props = defineProps<{ modelValue: State; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: State]; invalid: [message: string] }>();
const mode = ref<'json' | 'text'>(typeof props.modelValue === 'string' ? 'text' : 'json');
const source = ref(mode.value === 'text' ? props.modelValue as string : JSON.stringify(props.modelValue, null, 2));
const error = ref('');
let editing = false;
watch(() => props.modelValue, value => {
  if (editing) return;
  mode.value = typeof value === 'string' ? 'text' : 'json';
  source.value = mode.value === 'text' ? value as string : JSON.stringify(value, null, 2);
  error.value = ''; emit('invalid', '');
}, { deep: true, flush: 'sync' });
function update(value: string) {
  source.value = value;
  try {
    const parsed = mode.value === 'json' ? parseJson(value) : value;
    if (parsed === null || !['string', 'object'].includes(typeof parsed)) throw new Error('Context 必须是文本、对象或数组。');
    if (typeof parsed === 'string' && !parsed.trim()) throw new Error('Context 不能为空。');
    editing = true; emit('update:modelValue', parsed as State); editing = false;
    error.value = ''; emit('invalid', '');
  } catch (e) { error.value = describeError(e); emit('invalid', error.value); }
}
function switchMode(value: 'json' | 'text') {
  if (mode.value === value) return;
  mode.value = value;
  update(value === 'json' ? JSON.stringify(props.modelValue, null, 2) : typeof props.modelValue === 'string' ? props.modelValue : JSON.stringify(props.modelValue, null, 2));
}
</script>
<template>
  <div class="editor-toolbar">
    <div class="segment" aria-label="Context 格式">
      <button :class="{ active: mode === 'json' }" :disabled="disabled" @click="switchMode('json')"><Braces :size="13" /> JSON</button>
      <button :class="{ active: mode === 'text' }" :disabled="disabled" @click="switchMode('text')"><FileText :size="13" /> Text</button>
    </div>
    <span class="micro">{{ source.length.toLocaleString() }} chars</span>
  </div>
  <label class="sr-only" for="context-input">角色状态 Context</label>
  <textarea id="context-input" class="code-editor context-code" :value="source" :disabled="disabled" spellcheck="false" :aria-invalid="!!error" aria-describedby="context-help" @input="update(($event.target as HTMLTextAreaElement).value)" />
  <p v-if="error" class="field-error" role="alert">{{ error }}</p>
  <div id="context-help" class="help-box"><span class="help-label">01 / 给模型一个世界切片</span><p>人物、目标、记忆与此刻的观察。改变一条记忆，观察同一组行为的概率如何变化。</p></div>
</template>
