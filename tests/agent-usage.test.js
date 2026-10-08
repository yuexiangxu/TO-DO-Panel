const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAccount, readAgentUsage } = require('../agent-usage');
const timestamp = '2026-10-06T00:00:00Z';
test('unknown, malformed and out-of-range quotas stay unknown', () => {
  for (const value of [null, '', -1, 101, Infinity, '24']) assert.equal(normalizeAccount('codex', { value, updatedAt: timestamp }).value, null);
  assert.equal(normalizeAccount('codex', { value: 24 }).value, null);
  assert.equal(normalizeAccount('codex', { value: 0, updatedAt: timestamp }).value, 0);
  assert.equal(normalizeAccount('codex', { value: 100, updatedAt: timestamp }).value, 100);
});
test('missing private snapshot is a supported empty state', async () => {
  const result = await readAgentUsage({snapshotPath: '/nonexistent/agent-usage-test.json'});
  assert.equal(result.error, null);
  assert.ok(result.accounts.every(row => row.value === null));
});
test('DeepSeek reads only CNY and never exposes the credential', async () => {
  const result = await readAgentUsage({snapshotPath:'/nonexistent/agent-usage-test.json',apiKey:'test-secret',fetchImpl:async (url,options) => {
    assert.equal(url,'https://api.deepseek.com/user/balance');
    assert.equal(options.redirect,'error');
    return {ok:true,json:async()=>({balance_infos:[{currency:'USD',total_balance:'99'},{currency:'CNY',total_balance:'12.34'}]})};
  }});
  assert.equal(result.accounts[0].value,12.34);
  assert.equal(result.accounts[0].source,'api');
  assert.ok(!JSON.stringify(result).includes('test-secret'));
});
test('API errors and malformed balances cannot become a zero balance', async () => {
  for (const response of [{ok:false},{ok:true,json:async()=>({balance_infos:[{currency:'CNY',total_balance:null}]})}]) {
    const result = await readAgentUsage({snapshotPath:'/nonexistent/agent-usage-test.json',apiKey:'test-secret',fetchImpl:async()=>response});
    assert.equal(result.accounts[0].value,null); assert.ok(result.error);
  }
});
const { refreshAgentUsage, queryCodex } = require('../agent-usage');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
test('refresh isolates failures and preserves actual cache acquisition time', async () => {
  const row = {id:'grok',value:71.5,source:'app-cache',updatedAt:timestamp};
  const result = await refreshAgentUsage({snapshotPath:'/nonexistent/agent-usage-test.json',grokReader:async()=>row,codexReader:async()=>{throw new Error('离线')}});
  assert.equal(result.accounts[1].updatedAt,timestamp);
  assert.equal(result.accounts[2].value,null);
  assert.match(result.statuses.grok,/非实时/);
  assert.match(result.statuses.codex,/离线/);
  assert.match(result.statuses.deepseek,/未配置/);
});
test('Codex protocol selects the weekly window by duration, not field position', async () => {
  let killed=false;
  const child=new EventEmitter(); child.stdin=new PassThrough(); child.stdout=new PassThrough(); child.stderr=new PassThrough();child.kill=()=>{killed=true};
  const requests=[];
  child.stdin.on('data',data=>{
    const request=JSON.parse(data);requests.push(request.method);
    if(request.id===1)setImmediate(()=>child.stdout.write(JSON.stringify({id:1,result:{}})+'\n'));
    if(request.id===2)setImmediate(()=>child.stdout.write(JSON.stringify({id:2,result:{rateLimitsByLimitId:{codex:{primary:{usedPercent:42,windowDurationMins:10080,resetsAt:1791961545},secondary:{usedPercent:10,windowDurationMins:300}}}}})+'\n'));
  });
  const row=await queryCodex('mock',{spawnImpl:()=>child});
  assert.equal(row.value,42);assert.equal(row.source,'api');assert.ok(killed);
  assert.deepEqual(requests,['initialize','initialized','account/rateLimits/read']);
});
test('Codex timeout terminates the helper', async () => {
  const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();let killed=false;child.kill=()=>{killed=true};
  await assert.rejects(queryCodex('mock',{spawnImpl:()=>child,timeoutMs:5}),/超时/);assert.ok(killed);
});
