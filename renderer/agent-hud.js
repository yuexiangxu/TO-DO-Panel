(() => {
  'use strict';
  const KEY = 'notch-agent-snapshots-v1';
  const providers = [
    { id: 'deepseek', name: 'DeepSeek', logo: '◈', url: 'https://platform.deepseek.com/transactions' },
    { id: 'grok', name: 'Grok Bot', logo: '⦿', appPath: '/Applications/Grok Bot.app' },
    { id: 'codex', name: 'Codex', logo: '⌘', url: 'https://chatgpt.com/codex/settings/usage' },
  ];
  const $ = id => document.getElementById(id);
  const editor = $('hud-editor');
  const form = $('hud-form');
  let sourceAccounts = [];
  let accounts = [];
  let sourceError = null;
  let statuses = {};
  let loading = false;
  let manual = {};
  try { const value = JSON.parse(localStorage.getItem(KEY) || '{}'); if (value && typeof value === 'object' && !Array.isArray(value)) manual = value; } catch {}
  const known = row => typeof row?.value === 'number' && Number.isFinite(row.value) && row.value >= 0 && row.value <= (row.id === 'deepseek' ? 100000000 : 100) && Number.isFinite(Date.parse(row.updatedAt));
  const dateLabel = date => new Date(date).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  function render() {
    accounts = providers.map(provider => {
      const source = sourceAccounts.find(row => row.id === provider.id) || { id: provider.id, value: null };
      const entry = manual[provider.id];
      if (entry && (entry.value === null || known({ ...entry, id: provider.id }))) return { ...entry, id: provider.id, source: 'manual' };
      return source;
    });
    $('home-agents-accounts').replaceChildren();
    providers.forEach((provider, index) => {
      const row = accounts[index];
      const valid = known(row);
      const balance = provider.id === 'deepseek';
      const remaining = valid && !balance ? Math.round((100 - row.value) * 10) / 10 : null;
      const color = !valid ? '#747b88' : balance ? (row.value < 10 ? 'var(--hud-yellow)' : 'var(--hud-green)') : remaining <= 10 ? 'var(--hud-red)' : remaining <= 30 ? 'var(--hud-yellow)' : 'var(--hud-green)';
      const openAccount = async () => {
        if (provider.appPath) {
          if (!window.notchAPI?.openPath || window.notchAPI.platform !== 'darwin') {
            showStatusToast('请在 Grok Bot 中打开左下角账户菜单 → 每周用量');
            return;
          }
          try {
            const error = await window.notchAPI.openPath(provider.appPath);
            if (typeof error === 'string' && error) showStatusToast('未能打开 Grok Bot，请确认应用已安装');
          } catch { showStatusToast('未能打开 Grok Bot，请确认应用已安装'); }
        } else if (window.notchAPI?.openExternal) {
          window.notchAPI.openExternal(provider.url).catch(() => showStatusToast('无法打开账户页面'));
        } else window.open(provider.url, '_blank', 'noopener,noreferrer');
      };
      const compact = document.createElement('button');
      compact.type = 'button';
      compact.className = 'home-agent-row';
      compact.style.setProperty('--agent-color', color);
      compact.style.setProperty('--agent-remaining', `${remaining ?? 0}%`);
      compact.innerHTML = '<span class="home-agent-brand"><i aria-hidden="true"></i><span></span></span><strong></strong><span class="home-agent-track" aria-hidden="true"><i></i></span>';
      compact.querySelector('.home-agent-brand i').textContent = provider.logo;
      compact.querySelector('.home-agent-brand>span').textContent = provider.name;
      compact.querySelector('strong').textContent = valid ? balance ? `¥${row.value.toFixed(2)}` : `${remaining}%` : '—';
      compact.querySelector('.home-agent-track').hidden = balance || !valid;
      const description = valid ? balance ? `余额 ¥${row.value.toFixed(2)}` : `本周剩余 ${remaining}%，已用 ${row.value}%` : '额度未知';
      compact.title = `${provider.name} · ${description}${valid ? ` · 采集 ${dateLabel(row.updatedAt)}` : ''} · ${statuses[provider.id] || (row.source === 'manual' ? '手动快照' : '账户快照')}`;
      compact.setAttribute('aria-label', `${compact.title}，${provider.appPath ? '打开 Grok Bot' : balance ? '查看账单' : '打开账户'}`);
      compact.addEventListener('click', openAccount);
      $('home-agents-accounts').append(compact);
    });
    const validAccounts = accounts.filter(known);
    const latest = validAccounts.length ? Math.max(...validAccounts.map(row => Date.parse(row.updatedAt))) : null;
    const sourceLabel = accounts.some(row => row.source === 'api' && known(row)) ? 'API / 快照' : accounts.some(row => row.source === 'manual') ? '手动快照' : '账户快照';
    const live = accounts.filter(row => row.source === 'api').length;
    $('home-agents-status').textContent = sourceError ? '更新失败 · 悬停查看原因' : Object.keys(statuses).length ? `${live}/3 项实时 · 悬停查看状态` : `${sourceLabel} · 百分比为剩余`;
    $('home-agents-status').title = sourceError || (Object.keys(statuses).length ? providers.map(p => `${p.name}：${statuses[p.id]}`).join('\n') : '') || (latest ? `最近采集 ${dateLabel(latest)} · ${validAccounts.length}/3 项有数据` : '未连接 · 可通过编辑快照开始');
  }
  async function refresh() {
    if (loading) return;
    loading = true; $('home-agents-refresh').disabled = true;
    $('home-agents-refresh').setAttribute('aria-busy', 'true');
    $('home-agents-status').textContent = '正在查询额度…';
    try {
      if (window.notchAPI?.getAgentUsage) {
        const result = await window.notchAPI.getAgentUsage();
        sourceAccounts = Array.isArray(result.accounts) ? result.accounts : [];
        sourceError = result.error || null;
        statuses = result.statuses || {};
        for (const row of sourceAccounts) {
          if (known(row) && (row.source === 'api' || (row.source === 'app-cache' && Date.parse(row.updatedAt) > Date.parse(manual[row.id]?.updatedAt || 0)))) delete manual[row.id];
        }
        try { localStorage.setItem(KEY, JSON.stringify(manual)); } catch {}
      } else sourceError = '浏览器预览 · 自动查询仅在桌面应用中可用';
    } catch { sourceError = '读取失败，保留已有数据。请稍后重试。'; }
    finally { $('home-agents-refresh').removeAttribute('aria-busy'); $('home-agents-refresh').disabled = false; loading = false; render(); }
  }
  $('home-agents-refresh').addEventListener('click', refresh);
  $('home-agents-edit').addEventListener('click', () => {
    for (const row of accounts) form.elements[row.id].value = known(row) ? row.value : '';
    editor.showModal();
  });
  $('hud-cancel').addEventListener('click', () => editor.close());
  $('hud-restore').addEventListener('click', () => {
    try { localStorage.removeItem(KEY); manual = {}; editor.close(); refresh(); }
    catch { showStatusToast('本机存储不可用，未能恢复来源'); }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const next = { ...manual };
    for (const provider of providers) {
      const input = form.elements[provider.id];
      const value = input.value.trim() === '' ? null : Number(input.value);
      const current = accounts.find(row => row.id === provider.id);
      if (value !== (known(current) ? current.value : null)) next[provider.id] = { value, updatedAt: new Date().toISOString(), resetsAt: null };
    }
    try { localStorage.setItem(KEY, JSON.stringify(next)); manual = next; render(); editor.close(); }
    catch { showStatusToast('本机存储不可用，快照未保存'); }
  });
  document.addEventListener('notch:tabchange', () => { if (editor.open) editor.close(); });
  new MutationObserver(() => { if (!app.classList.contains('expanded') && editor.open) editor.close(); }).observe(app, { attributes: true, attributeFilter: ['class'] });
  render(); refresh();
})();
