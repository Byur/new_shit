<script setup lang="ts">
import type { Model } from '../../../../packages/shared/src/decision';
defineProps<{ modelValue: Model; disabled?: boolean }>();
defineEmits<{ 'update:modelValue': [value: Model] }>();
</script>
<template>
  <label class="model-selector">
    <span class="eyebrow">DECISION MODEL</span>
    <select aria-label="决策模型" :value="modelValue" :disabled="disabled" @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value as Model)">
      <option value="clef-flash">clef-flash · 9B</option><option value="clef">clef · 27B</option>
    </select>
  </label>
</template>
