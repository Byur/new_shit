<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next';
</script>
<template>
  <section class="wide-panel learning-guide">
    <span class="eyebrow">A SMALL LAB FOR A DIFFERENT KIND OF MODEL</span><h2>从一段状态，到一组可执行的判断。</h2><p class="guide-intro">你描述此刻发生了什么，并定义允许的答案。Clef 在这个范围内评估每个选项，把结果交还给你的程序。</p>
    <div class="learning-flow"><div><span>01</span><h3>State</h3><p>世界切片：人物、记忆、目标、观察。</p></div><ArrowRight /><div><span>02</span><h3>Questions</h3><p>带类型的问题与明确的候选项。</p></div><ArrowRight /><div><span>03</span><h3>Decisions</h3><p>结构化选择、概率与等级评分。</p></div></div>
    <div class="guide-grid"><article><span class="type-pill">choice</span><h3>在允许的行为中选一个</h3><p>程序先生成合法动作，模型返回最高概率选项与完整分布。酒馆示例的候选是原地喝茶、点头、不远处走近交谈、经安全出口离开；每项都有具体描述。</p></article><article><span class="type-pill">noul</span><h3>判断一件事有多可能为“是”</h3><p>示例判断“此刻是否愿意主动进行友好的简短交谈”，与长期修复关系的目标分开。noul 是 0–1 的 Yes 概率，应用可以自定阈值。</p></article><article><span class="type-pill">score</span><h3>用有序量表评分</h3><p>示例量表从“安全且无须离开”到“有即时危险，必须撤离”。0 为最低等级，输出为概率加权均值，可落在两个等级之间。</p></article></div>
    <div class="guide-section"><h3>建议按这个顺序试</h3><ol><li>点击“载入三题示例”，在 A 钱包找回状态下 Run 一次，作为基准。</li><li>载入 B 钱包被偷，保持同一模型再次 Run。相对 A 只改变 memory[1]；修复友谊的目标仍在，观察负面经历的影响。</li><li>分别运行 C 暂不和解和 D 现场危险。C 相对 A 只改 goal；D 相对 A 只改 observation.situation。每组都与 A 比较，不把 C 当作 B 的后续。</li><li>进入 A / B 对比，按预设名称选择两条运行，观察行动概率、友好交谈意愿和离开必要性。也可以自己只改一处状态，再 Run。</li></ol></div>
    <div class="guide-grid two"><article><h3>它适合放在 NPC 流程的哪里？</h3><p>World Server 生成合法动作 → Clef 评估候选 → 你的策略选取动作 → World Server 校验与执行 → 记录事件。模型不负责移动角色、写回世界或维护长期记忆。</p></article><article><h3>这个实验能证明什么？</h3><p>证明接口可用、结构化输出能接入程序，并观察具体输入的行为倾向。模型概率尚未在你的任务上校准；一次 A/B 不能证明角色可信，仍需设计场景集评测。</p></article></div>
    <p class="guide-sources">官方资料：<a href="https://developers.cloudflare.com/workers-ai/models/clef-flash/" target="_blank" rel="noreferrer">Clef-flash · 9B</a><span> / </span><a href="https://developers.cloudflare.com/workers-ai/models/clef/" target="_blank" rel="noreferrer">Clef · 27B</a>。本 Demo 聚焦文本 / JSON 输入；图像与视频不在本次范围。</p>
  </section>
</template>
