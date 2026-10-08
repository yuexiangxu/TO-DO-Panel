const fs = require('node:fs/promises');
const PROVIDERS = ['deepseek', 'grok', 'codex'];
function normalizeAccount(id, raw) {
  const record = raw && typeof raw === 'object' ? raw : {};
  const max = id === 'deepseek' ? 100000000 : 100;
  const valid = typeof record.value === 'number' && Number.isFinite(record.value) && record.value >= 0 && record.value <= max;
  const updatedAt = Number.isFinite(Date.parse(record.updatedAt)) ? new Date(record.updatedAt).toISOString() : null;
  const resetsAt = Number.isFinite(Date.parse(record.resetsAt)) ? new Date(record.resetsAt).toISOString() : null;
  return { id, value: valid && updatedAt ? record.value : null, updatedAt, resetsAt, source: 'snapshot' };
}
async function readAgentUsage({ snapshotPath, apiKey, fetchImpl = fetch }) {
  let stored = {};
  let error = null;
  try { stored = JSON.parse(await fs.readFile(snapshotPath, 'utf8')); }
  catch (err) { if (err.code !== 'ENOENT') error = '本机快照无法读取，请检查数据文件。'; }
  const accounts = PROVIDERS.map(id => normalizeAccount(id, stored?.[id]));
  if (apiKey) {
    try {
      const response = await fetchImpl('https://api.deepseek.com/user/balance', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000), redirect: 'error',
      });
      if (!response.ok) throw new Error('request_failed');
      const payload = await response.json();
      const balance = payload.balance_infos?.find(row => row.currency === 'CNY');
      if (!balance || balance.total_balance === '' || balance.total_balance == null) throw new Error('invalid_balance');
      const value = Number(balance.total_balance);
      if (!Number.isFinite(value) || value < 0 || value > 100000000) throw new Error('invalid_balance');
      accounts[0] = { id: 'deepseek', value, updatedAt: new Date().toISOString(), resetsAt: null, source: 'api' };
    } catch { error = 'DeepSeek API 更新失败，保留本机快照。请检查 API Key 或网络。'; }
  }
  return { accounts, error };
}
module.exports = { normalizeAccount, readAgentUsage };

// Use Codex's own authenticated app-server; credentials never enter the renderer.
function queryCodex(binary, { spawnImpl = require('node:child_process').spawn, timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(binary, ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let buffer = '', settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer); child.kill();
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('Codex 查询超时，请检查网络或登录状态')), timeoutMs);
    const send = message => child.stdin.write(JSON.stringify(message) + '\n');
    child.on('error', () => finish(new Error('未找到 Codex CLI')));
    child.on('exit', () => finish(new Error('Codex 查询进程已退出')));
    child.stdin.on('error', () => finish(new Error('Codex 查询连接已关闭')));
    child.stderr.resume();
    child.stdout.on('data', chunk => {
      buffer += chunk;
      if (buffer.length > 2 * 1024 * 1024) return finish(new Error('Codex 返回异常数据'));
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
        let message; try { message = JSON.parse(line); } catch { continue; }
        if (message.id !== 1 && message.id !== 2) continue;
        if (message.error) return finish(new Error('Codex 查询失败，请检查 CLI 登录状态'));
        if (message.id === 1) {
          send({ method: 'initialized' }); send({ id: 2, method: 'account/rateLimits/read' });
        } else {
          const data = message.result;
          const bucket = data?.rateLimitsByLimitId?.codex || data?.rateLimits;
          const week = [bucket?.primary, bucket?.secondary].find(window => window?.windowDurationMins === 10080);
          if (!week || !Number.isFinite(week.usedPercent) || week.usedPercent < 0 || week.usedPercent > 100) return finish(new Error('Codex 未返回本周额度'));
          finish(null, { id: 'codex', value: week.usedPercent, updatedAt: new Date().toISOString(), resetsAt: Number.isFinite(week.resetsAt) ? new Date(week.resetsAt * 1000).toISOString() : null, source: 'api' });
        }
      }
    });
    send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'todo_panel', version: '1.0.0' } } });
  });
}
function decodeCacheName(name) {
  let bits = 0, value = 0, result = '';
  for (const char of name.replace(/\.blob$/, '').toUpperCase()) {
    const digit = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char);
    if (digit < 0) return '';
    value = (value << 5) | digit; bits += 5;
    if (bits >= 8) { bits -= 8; result += String.fromCharCode((value >>> bits) & 255); }
  }
  return result;
}
async function readGrokCache(directory) {
  const files = (await fs.readdir(directory)).filter(name => decodeCacheName(name).endsWith('weekly-usage.cache'));
  // Multiple accounts need an explicit selection rather than guessing an account.
  if (files.length !== 1) throw new Error(files.length ? 'Grok Bot 有多个账户缓存，请在应用中确认账户' : '请先在 Grok Bot 打开每周用量');
  const data = JSON.parse(await fs.readFile(require('node:path').join(directory, files[0]), 'utf8'));
  const value = data?.value;
  if (data.schemaVersion !== 2 || value?.kind !== 'present' || !Number.isFinite(value.reading?.readAtMs)) throw new Error('Grok Bot 缓存不可用');
  const usage = value.reading.usage;
  const row = normalizeAccount('grok', { value: usage?.percentUsed, updatedAt: new Date(value.reading.readAtMs).toISOString(), resetsAt: Number.isFinite(usage?.nextResetMs) ? new Date(usage.nextResetMs).toISOString() : null });
  if (row.value === null) throw new Error('Grok Bot 缓存额度无效');
  return { ...row, source: 'app-cache' };
}
async function refreshAgentUsage(options) {
  const result = await readAgentUsage(options);
  const statuses = { deepseek: options.apiKey ? (result.accounts[0].source === 'api' ? '实时查询成功' : '查询失败，保留旧数据') : '未配置 DEEPSEEK_API_KEY，保留旧数据' };
  const readers = { codex: options.codexReader, grok: options.grokReader };
  await Promise.all(Object.entries(readers).map(async ([id, reader]) => {
    try {
      if (!reader) throw new Error('此平台尚未配置查询来源');
      const row = await reader();
      result.accounts[PROVIDERS.indexOf(id)] = row;
      statuses[id] = row.source === 'api' ? '实时查询成功' : '已同步应用缓存，非实时查询';
    } catch (error) { statuses[id] = `${error.message}，保留旧数据`; }
  }));
  result.statuses = statuses;
  result.error = null;
  // Persist successful reads, retaining source acquisition times on failure.
  if (options.cachePath) {
    try {
      await fs.mkdir(require('node:path').dirname(options.cachePath), { recursive: true });
      await fs.writeFile(options.cachePath + '.tmp', JSON.stringify(Object.fromEntries(result.accounts.map(row => [row.id, row]))), { mode: 0o600 });
      await fs.rename(options.cachePath + '.tmp', options.cachePath);
    } catch { result.error = '额度已查询，但本机缓存保存失败'; }
  }
  return result;
}
module.exports = { normalizeAccount, readAgentUsage, queryCodex, readGrokCache, refreshAgentUsage, decodeCacheName };
