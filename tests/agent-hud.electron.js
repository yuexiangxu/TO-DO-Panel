const assert = require('node:assert/strict');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
app.setPath('userData', process.env.TODO_TEST_USER_DATA);
async function main() {
  await app.whenReady();
  const win = new BrowserWindow({show:false,width:1240,height:616,useContentSize:true,webPreferences:{backgroundThrottling:false}});
  const errors=[];
  win.webContents.on('console-message',d=>{if(d.level==='error')errors.push(d.message);});
  const file=path.join(__dirname,'..','renderer','index.html');
  try {
    await win.loadFile(file);
    await win.webContents.executeJavaScript(`
      localStorage.setItem('notch-home-order-v3',JSON.stringify(['music','pomodoro','windows','recorder','mirror','note','commands']));
      localStorage.setItem('notch-home-widget-sizes-v2',JSON.stringify({mirror:'medium'}));
      localStorage.setItem('notch-home-hidden-modules-v1',JSON.stringify(['mirror']));
    `);
    await win.loadFile(file);
    const migrated=await win.webContents.executeJavaScript(`({order:homeOrder,size:homeSizes.agents,hidden:hiddenHomeModules,camera:!!document.getElementById('mirror-video')})`);
    assert.deepEqual(migrated,{order:['music','pomodoro','windows','recorder','agents','note','commands'],size:'medium',hidden:['agents'],camera:false});
    await win.webContents.executeJavaScript(`(async()=>{
      window.NotchHome.setModuleVisible('agents',true);
      window.notchAPI={getAgentUsage:async()=>({accounts:[{id:'deepseek',value:12.34,updatedAt:'2026-10-06T00:00:00Z',source:'snapshot'},{id:'codex',value:24,updatedAt:'2026-10-06T00:00:00Z',source:'snapshot'}]})};
      applyFeatureSettings({defaultTab:'agents',features:{clip:false}});
      await setMode(true);
      document.getElementById('home-agents-refresh').click();
    })()`);
    await new Promise(resolve=>setTimeout(resolve,600));
    const state=await win.webContents.executeJavaScript(`(()=>{
      const tile=document.querySelector('.home-agents'),bounds=tile.getBoundingClientRect();
      const rows=[...tile.querySelectorAll('.home-agent-row')];
      return {tab:activeTab,standalone:!!document.querySelector('#tab-agents,#tab-button-agents,option[value="agents"]'),values:rows.map(row=>row.querySelector('strong').textContent),contained:rows.every(row=>{const r=row.getBoundingClientRect();return r.top>=bounds.top&&r.bottom<=bounds.bottom})};
    })()`);
    assert.deepEqual(state,{tab:'home',standalone:false,values:['¥12.34','—','76%'],contained:true});
    const edited=await win.webContents.executeJavaScript(`(()=>{
      document.getElementById('home-agents-edit').click();
      const dialog=document.getElementById('hud-editor');const editable=dialog.open&&!dialog.closest('[inert]');
      const form=document.getElementById('hud-form');form.elements.grok.value='70';form.requestSubmit();
      return {editable,open:dialog.open,value:document.querySelectorAll('.home-agent-row strong')[1].textContent};
    })()`);
    assert.deepEqual(edited,{editable:true,open:false,value:'30%'});
    await win.webContents.executeJavaScript(`
      window.refreshCalls=0;
      window.notchAPI.getAgentUsage=()=>{window.refreshCalls++;return new Promise(resolve=>window.finishRefresh=resolve)};
      document.getElementById('home-agents-refresh').click();
      document.getElementById('home-agents-refresh').click();
    `);
    assert.deepEqual(await win.webContents.executeJavaScript(`({calls:window.refreshCalls,disabled:document.getElementById('home-agents-refresh').disabled,status:document.getElementById('home-agents-status').textContent})`),{calls:1,disabled:true,status:'正在查询额度…'});
    await win.webContents.executeJavaScript(`window.finishRefresh({accounts:[{id:'grok',value:20,updatedAt:new Date().toISOString(),source:'api'}],statuses:{grok:'实时查询成功'}})`);
    await new Promise(resolve=>setTimeout(resolve,50));
    assert.equal(await win.webContents.executeJavaScript(`document.querySelectorAll('.home-agent-row strong')[1].textContent`),'80%');
    assert.equal(await win.webContents.executeJavaScript(`JSON.parse(localStorage.getItem('notch-agent-snapshots-v1')).grok`),undefined);
    await win.loadFile(file);
    assert.equal(await win.webContents.executeJavaScript(`document.querySelectorAll('.home-agent-row strong')[1].textContent`),'—');
    assert.deepEqual(errors,[]);
    console.log('Workbench-only HUD: migration, removed page, default fallback, layout, refresh, editing and persistence passed');
  } finally {win.destroy();}
}
main().then(()=>app.quit(),e=>{console.error(e);app.exit(1);});
