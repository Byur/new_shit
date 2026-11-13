<script setup lang="ts">
defineProps<{ items: { id: string; label: string; value: number; delta?: number }[]; selected?: string }>();
</script>
<template>
  <div class="probability-chart">
    <div v-for="item in items" :key="item.id" class="probability-row" :class="{ chosen: selected === item.id }">
      <div class="probability-label"><span>{{ item.label }}</span><span class="probability-number">{{ (item.value * 100).toFixed(2) }}% <small v-if="item.delta !== undefined" :class="item.delta >= 0 ? 'delta-up' : 'delta-down'">{{ item.delta >= 0 ? '+' : '' }}{{ (item.delta * 100).toFixed(2) }} pp</small></span></div>
      <div class="probability-track" role="meter" :aria-label="item.label" :aria-valuenow="Number((item.value * 100).toFixed(2))" :aria-valuemin="0" :aria-valuemax="100"><div class="probability-fill" :style="{ transform: `scaleX(${item.value})` }" /></div>
    </div>
  </div>
</template>
