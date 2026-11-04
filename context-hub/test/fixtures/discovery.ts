export function discoveryFixture() {
  const fields=['scopeRelevant','scopeReason','repositoryVerified','dedupEligible','minimumEvidenceSatisfied','trend','ecosystem'];
  const scope=(id,metric,members)=>({id,label:id,query:`topic:${id}`,sourceUrl:`https://github.com/topics/${id}`,observedOn:'2026-10-16',windowStart:'2026-10-09',windowEnd:'2026-10-15',metric,members});
  const item=(fullName,scopeId,ecosystem,trend)=>({fullName,scopeId,ecosystem,scopeReason:'Verified workflow extension in the cited documentation',scopeRelevant:true,repositoryVerified:true,dedupEligible:true,minimumEvidenceSatisfied:true,evidenceUrls:[`https://github.com/${fullName}#readme`],verifiedFields:fields,trend});
  const attention=(added)=>({kind:'attention',metric:'stars',windowStart:'2026-10-09',windowEnd:'2026-10-15',added,coverageComplete:true,sourceUrl:'https://example.org/dated-star-observations',checkedOn:'2026-10-16'});
  return {asOf:'2026-10-16',limit:5,scopes:[scope('agents','stars',['acme/small','acme/established','acme/unknown']),scope('editor','recognition_events',['acme/plugin'])],items:[
    item('acme/small','agents','agent-tools',attention(120)),
    item('acme/established','agents','agent-tools',attention(0)),
    item('acme/unknown','agents','agent-tools',undefined),
    item('acme/plugin','editor','editor', {kind:'recognition',eventType:'official_listing',occurredOn:'2026-10-15',sourceUrl:'https://example.org/editor/releases/2026-10-15',actor:'Editor maintainers',description:'Plugin newly admitted to the official catalogue',independentOfProject:true,checkedOn:'2026-10-16'}),
  ]};
}
export function reportFixture(selection) {
  const cards=selection.selected.map(p=>`<article class="exhibit" id="project-${p.fullName.replaceAll('/','-')}" data-project="${p.fullName}"><div><h3><a data-role="repository" href="https://github.com/${p.fullName}">${p.fullName}：可组合的工作流</a></h3>
  <p data-field="positioning"><strong>项目定位。</strong> 面向具体工作流的工具。</p>
  <p data-field="capabilities"><strong>核心能力。</strong> 示例输入和输出可复现。</p>
  <p data-field="use-cases"><strong>适用场景。</strong> 用于探索新工作方式。</p>
  <p data-field="trend"><strong>关注依据。</strong> 在 <time datetime="${p.evidence.evidenceDate}">${p.evidence.evidenceDate}</time> 的来源中记录了关注变化。</p>
  <p data-field="limitations"><strong>局限。</strong> 实际部署还需验证。</p>
  <p data-field="sources"><a href="https://github.com/${p.fullName}#readme">README</a> · <a href="${p.evidence.sourceUrl}">趋势原始依据</a></p></div></article>`).join('\n');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="report-schema" content="ai-trending/1"><meta name="report-date" content="2026-10-16"><title>每日发现 · 2026-10-16</title></head><body><main data-report="ai-trending"><h1>探索工具的新用法</h1>
  <section id="report-summary"><h2>编辑摘要</h2><p data-field="summary">本期探索不同生态中的新能力与关注变化。</p></section>
  <section id="report-projects"><h2>今日发现</h2>${cards||'<p data-field="empty-state">今天没有符合证据要求的新项目。</p>'}</section>
  <section id="report-synthesis"><h2>观察与启发</h2><p>不同项目呈现不同工作流。</p></section>
  <section id="report-sources"><h2>来源说明</h2><p>依据项目原始文档及有日期的观察。</p></section></main></body></html>`;
}
