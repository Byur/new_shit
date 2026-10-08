const state = {query: '', itemQuery: ''};
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value || 0));
const formatBytes = (value) => `${formatNumber(Math.round(Number(value || 0) / 1000))}k chars`;

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function renderMetrics(overview) {
  const counts = overview.counts || {};
  const cards = [['runs', '导入运行'], ['documents', '结构化报告'], ['items', '来源条目'], ['uniqueSources', '唯一 URL'], ['memoryChars', '原始 memory 字符']];
  $('#metrics').innerHTML = cards.map(([key, label]) => `<div class="metric"><div class="metric-value">${key === 'memoryChars' ? formatBytes(counts[key]) : formatNumber(counts[key])}</div><div class="metric-label">${label}</div></div>`).join('');
}

function renderRuns(runs = []) {
  $('#runs-table').innerHTML = runs.length ? runs.map((run) => `<tr><td>${escapeHtml(run.run_date || '—')}</td><td>${escapeHtml(run.kind)}</td><td>${escapeHtml(run.run_key)}</td><td><span class="status ${run.kind === 'legacy' ? 'legacy' : ''}">${escapeHtml(run.status)}</span></td><td class="size">${formatBytes(run.output_chars)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">还没有导入记录。</td></tr>';
}

function renderMemory(overview) {
  const memory = overview.memory || {};
  const original = Number(memory.source_chars || 0);
  const compact = Number((overview.counts || {}).uniqueSources || 0) * 120;
  const ratio = original ? Math.min(100, Math.max(6, Math.round((compact / original) * 100))) : 6;
  $('#memory-card').innerHTML = `<div class="memory-numbers"><div><strong>${formatBytes(original)}</strong><small>历史 memory / source</small></div><div><strong>${formatNumber(memory.item_count)}</strong><small>已序列化排重条目</small></div></div><div><div class="memory-bar" role="progressbar" aria-label="compact index 相对原始 memory 的估算比例" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${ratio}"><span style="width:${ratio}%"></span></div><p class="memory-note">下一次运行读取 compact index，而不是把 ${formatBytes(original)} 的原始记忆重新塞进上下文。固定报告只在需要复盘时打开。</p></div>`;
}

function renderReports(reports = []) {
  $('#report-list').innerHTML = reports.length ? reports.map((report) => `<article class="report-card"><div><div class="report-meta"><span class="kind">${escapeHtml(report.kind)}</span><span>${escapeHtml(report.report_date || '—')}</span></div><h3>${escapeHtml(report.title)}</h3><p>${escapeHtml(report.content?.summary || '已导入并保存为结构化 document。')}</p></div><div class="report-meta"><span>${formatNumber(report.content?.items?.length || 0)} sources</span><span>${escapeHtml(report.sha256.slice(0, 10))}</span></div></article>`).join('') : '<div class="empty">没有匹配的报告。</div>';
}

function renderItems(items = []) {
  $('#item-list').innerHTML = items.length ? items.slice(0, 80).map((item) => `<div class="source-row"><div class="source-provider">${escapeHtml(item.provider || 'Unknown')}</div><div class="source-title"><a href="${escapeHtml(item.url || '#')}" target="_blank" rel="noreferrer">${escapeHtml(item.title || item.url || 'Untitled')}</a></div><div class="source-date">${escapeHtml(item.published_at || 'in archive')}</div></div>`).join('') : '<div class="empty">没有匹配的来源条目。</div>';
}

async function load(query = '') {
  const [overview, reports, items] = await Promise.all([fetchJson('/api/overview'), fetchJson(`/api/reports?q=${encodeURIComponent(query)}`), fetchJson(`/api/items?q=${encodeURIComponent(state.itemQuery)}`)]);
  renderMetrics(overview); renderRuns(overview.recentRuns); renderMemory(overview); renderReports(reports); renderItems(items);
  $('#connection-status').textContent = `${overview.workspace?.name || 'workspace'} · 已连接`;
  $('.status-dot').style.background = '#315b52';
  return overview;
}

async function boot() {
  try {
    const workspaces = await fetchJson('/api/workspaces');
    $('#workspace-list').innerHTML = workspaces.map((workspace, index) => `<button class="workspace-button" type="button" aria-current="${index === 0}" data-slug="${escapeHtml(workspace.slug)}"><span class="workspace-icon" aria-hidden="true"></span><span>${escapeHtml(workspace.name)}</span></button>`).join('');
    await load();
  } catch (error) {
    $('#connection-status').textContent = '数据库未连接';
    $('.status-dot').style.background = '#8f1d16';
    $('#main').insertAdjacentHTML('afterbegin', `<div class="panel" role="alert"><strong>无法读取本地数据库。</strong><p>${escapeHtml(error.message)}</p><p>先运行 <code>npm run import -- --source "/Users/byur/Documents/优化是个好事" --memory "/Users/byur/.codex/automations/ai/memory.md"</code>。</p></div>`);
  }
}

$('#report-search').addEventListener('input', (event) => {state.query = event.target.value; load(state.query).catch(() => {});});
$('#item-search').addEventListener('input', (event) => {state.itemQuery = event.target.value; load(state.query).catch(() => {});});
boot();
