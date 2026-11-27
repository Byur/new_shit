const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function renderMetrics(status) {
  const queue = status.queue || {};
  const cards = [
    ['todo', queue.available ? queue.todo : '—', '队列 todo'],
    ['doing', queue.available ? queue.doing : '—', '处理中 doing'],
    ['done', queue.available ? queue.done : '—', 'B 已交付 done'],
    ['failed', queue.available ? queue.failed : '—', 'B 失败卡'],
    ['cPending', queue.available ? queue.cPending : '—', 'C 待出图批次'],
    ['leases', (status.leases || []).length, '活跃租约'],
  ];
  $('#metrics').innerHTML = cards
    .map(([, val, label]) => `<div class="metric"><div class="metric-value">${escapeHtml(val)}</div><div class="metric-label">${escapeHtml(label)}</div></div>`)
    .join('');
}

function renderTasks(tasks = []) {
  $('#tasks-table').innerHTML = tasks.length
    ? tasks
        .map(
          (t) =>
            `<tr><td><strong>${escapeHtml(t.taskId)}</strong><br><small>${escapeHtml(t.name)}</small></td><td>${escapeHtml(t.trigger?.kind || '-')}</td><td>${escapeHtml(t.unitConcurrency)}</td><td><span class="status ${t.enabled ? '' : 'legacy'}">${t.enabled ? 'enabled' : t.pausedReason ? 'paused' : 'manual-only'}</span></td><td>${escapeHtml(t.pausedReason || '—')}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="5" class="empty">暂无任务定义。</td></tr>';
}

function renderPreflight(preflight) {
  if (!preflight) {
    $('#preflight-list').innerHTML = '<div class="empty">未配置工作区。</div>';
    return;
  }
  const pill = $('#preflight-pill');
  pill.textContent = preflight.ok ? 'L2 前置通过' : 'L2 存在异常';
  pill.className = preflight.ok ? 'pill' : 'pill pill-warm';
  $('#preflight-list').innerHTML = (preflight.checks || [])
    .map(
      (c) =>
        `<div class="source-row"><div class="source-provider">${c.ok ? 'OK' : c.level || 'ERR'}</div><div class="source-title">${escapeHtml(c.name)}</div><div class="source-date">${escapeHtml(c.detail)}</div></div>`,
    )
    .join('');
}

function renderRuns(runs = []) {
  $('#runs-table').innerHTML = runs.length
    ? runs
        .map((r) => {
          const failedUnits = (r.units || []).filter((u) => u.failure_reason);
          const note = failedUnits.length
            ? failedUnits.map((u) => `${u.node || u.unit_type}: ${u.failure_reason}`).join('；')
            : r.next_retry_at
              ? `将于 ${r.next_retry_at} 重试`
              : '—';
          return `<tr><td class="mono">${escapeHtml(r.run_key)}</td><td>${escapeHtml(r.task_id)}</td><td>${escapeHtml(r.trigger)}</td><td><span class="status">${escapeHtml(r.status)}</span></td><td>${escapeHtml(r.started_at)}</td><td>${escapeHtml(note)}</td></tr>`;
        })
        .join('')
    : '<tr><td colspan="6" class="empty">尚无自动化运行记录。</td></tr>';
}

function renderAlerts(alerts = []) {
  $('#alerts-list').innerHTML = alerts.length
    ? alerts
        .map(
          (a) =>
            `<div class="source-row"><div class="source-provider">${escapeHtml(a.level)}</div><div class="source-title">${escapeHtml(a.kind)} (${escapeHtml(a.run_key || 'global')})</div><div class="source-date">${escapeHtml(a.sent_at)}</div></div>`,
        )
        .join('')
    : '<div class="empty">近期无告警。</div>';
}

async function refresh() {
  try {
    const [status, runsPayload] = await Promise.all([fetchJson('/api/automation/status'), fetchJson('/api/automation/runs?limit=25')]);
    $('#daemon-status').textContent = '常驻调度在线';
    $('.status-dot').style.background = '#315b52';
    $('#daemon-pid').textContent = `pid ${status.pid}`;
    $('#shanghai-clock').textContent = status.shanghaiNow || '—';
    renderMetrics(status);
    renderTasks(status.tasks);
    renderPreflight(status.preflight);
    renderAlerts(status.recentAlerts);
    renderRuns(runsPayload.runs);
  } catch (error) {
    $('#daemon-status').textContent = '守护进程未连接（可能以纯 dashboard 模式运行）';
    $('.status-dot').style.background = '#8f1d16';
    $('#preflight-list').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

refresh();
setInterval(refresh, 15000);
