#!/usr/bin/env node
/* ============================================================
 * Phase A 性能探针（只读）
 * ------------------------------------------------------------
 * 纪律：
 *   · 不修改 index.html（本脚本以只读方式读取并 serve）
 *   · 不修改题库数据（只读文件路径）
 *   · 所有埋点通过浏览器注入完成，不改动应用源码
 *
 * 用法：
 *   node work/perf_phaseA_probe.js --phase=import  [--zones=gk,sy,mk]
 *   node work/perf_phaseA_probe.js --phase=measure
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { chromium } = require('playwright-core');

const PROJECT = '/Users/helium/Library/Mobile Documents/com~apple~CloudDocs/我的程序/My project';
const BANK = '/Users/helium/Library/Mobile Documents/com~apple~CloudDocs/题库';
const WORK = path.join(PROJECT, 'work');
const PORT = Number(Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2]] : [a, true];
})).port) || 47831;
/* profile 固定绑定端口：同一端口 ⇒ 同一 origin ⇒ 同一 IndexedDB；
   不同端口天然隔离，故无需删除旧 profile（也就不触发删除守卫）。 */
const PROFILE = path.join(require('os').tmpdir(), 'qz-perf-profile-' + PORT);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_JSON = path.join(WORK, 'perf-phaseA-evidence.json');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
const PHASE = argv.phase || 'measure';
const ZONES = String(argv.zones || 'gk,sy,mk').split(',').map(s => s.trim()).filter(Boolean);

const HTML_PATH = path.join(PROJECT, 'index.html');
const HTML = fs.readFileSync(HTML_PATH, 'utf8');
const HTML_SHA = crypto.createHash('sha256').update(HTML).digest('hex');
const IDB_VER_IN_CODE = (HTML.match(/IDB_VER\s*=\s*(\d+)/) || [])[1];

const ZONE_DIRS = { gk: '行测总库', sy: '事业单位总库', mk: '历年粉笔模考' };
const ZONE_LABEL = { gk: '国考/省考', mk: '粉笔模考', sy: '事业单位', sl: '申论', zy: '综应', ms: '面试' };

/* ---------- 题库文件 ---------- */
function bankFiles(zone) {
  const dir = path.join(BANK, ZONE_DIRS[zone]);
  if (!dir) return [];
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('_'))
    .sort()
    .map(f => path.join(dir, f));
}

/* ---------- 静态服务器（只 serve 内存里的 index.html，不落盘） ----------
 * 必须使用固定端口：IndexedDB 按 origin（含端口）隔离，
 * 端口随机会导致每次运行都是「新 origin」→ 库里数据看似消失。 */
function startServer(port) {
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/app' || url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(HTML);
      return;
    }
    if (url === '/icon.png') {
      const p = path.join(PROJECT, 'icon.png');
      if (fs.existsSync(p)) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(fs.readFileSync(p)); return; }
    }
    res.writeHead(404); res.end('not found');
  });
  return new Promise((res, rej) => {
    server.once('error', rej);
    server.listen(port, '127.0.0.1', () => res(server));
  });
}

/* ---------- 注入式埋点（不触碰 index.html） ---------- */
const INIT = `(() => {
  const ev = window.__ev = {
    idbGet:0, idbGetKeys:0, jsonParse:0, jsonParseChars:0,
    renderQuestions:0, getZoneQuestions:0, preparedFile:0, prepareQuestion:0,
    getFiltered:0, getFilterBaseQuestions:0, buildSearchText:0, buildRestrictedSearchText:0,
    releaseSearchTextCache:0, countZoneQuestions:0, switchZone:0, exportBackup:0,
    bigFilter:0, bigFilterElems:0, bigMap:0, bigMapElems:0, bigSort:0, bigSortElems:0,
    longtasks:[], alerts:[], errors:[], wrapped:''
  };
  window.addEventListener('error', e => ev.errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', e => ev.errors.push('unhandled: ' + String(e.reason)));
  const _parse = JSON.parse;
  JSON.parse = function(s){ ev.jsonParse++; if (typeof s === 'string') ev.jsonParseChars += s.length; return _parse.apply(JSON, arguments); };
  try {
    const oget = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function(){ ev.idbGet++; return oget.apply(this, arguments); };
    const okeys = IDBObjectStore.prototype.getAllKeys;
    IDBObjectStore.prototype.getAllKeys = function(){ ev.idbGetKeys++; return okeys.apply(this, arguments); };
  } catch(e){}
  (function(){
    const f = Array.prototype.filter, m = Array.prototype.map, s = Array.prototype.sort;
    Array.prototype.filter = function(cb, t){ if (this.length > 10000) { ev.bigFilter++; ev.bigFilterElems += this.length; } return f.call(this, cb, t); };
    Array.prototype.map    = function(cb, t){ if (this.length > 10000) { ev.bigMap++;    ev.bigMapElems    += this.length; } return m.call(this, cb, t); };
    Array.prototype.sort   = function(cb)  { if (this.length > 10000) { ev.bigSort++;   ev.bigSortElems   += this.length; } return s.call(this, cb); };
  })();
  try {
    new PerformanceObserver(list => {
      list.getEntries().forEach(en => ev.longtasks.push({ t: Math.round(en.startTime), dur: Math.round(en.duration) }));
    }).observe({ entryTypes: ['longtask'] });
  } catch(e){}
  window.alert = function(m){ ev.alerts.push(String(m).slice(0, 240)); };
  window.confirm = function(m){ ev.alerts.push('[confirm] ' + String(m).slice(0, 160)); return true; };
  document.addEventListener('DOMContentLoaded', function(){
    const names = ['renderQuestions','getZoneQuestions','preparedFile','prepareQuestion','getFiltered',
                   'getFilterBaseQuestions','buildSearchText','buildRestrictedSearchText',
                   'releaseSearchTextCache','countZoneQuestions','switchZone','exportBackup'];
    const done = [];
    names.forEach(n => {
      const fn = window[n];
      if (typeof fn !== 'function') { done.push(n + ':MISS'); return; }
      window[n] = function(){ ev[n]++; return fn.apply(this, arguments); };
      done.push(n + ':ok');
    });
    if (typeof window.showConfirm === 'function') {
      window.showConfirm = function(msg, onYes){ ev.alerts.push('[showConfirm] ' + String(msg).slice(0,160)); try { onYes && onYes(); } catch(e){} };
    }
    ev.wrapped = done.join(' ');
    window.__evReady = true;
  }, true);
})();`;

/* ---------- 工具 ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MB = n => +(n / 1048576).toFixed(1);

async function heap(cdp) {
  await cdp.send('HeapProfiler.collectGarbage');
  const u = await cdp.send('Runtime.getHeapUsage');
  let metrics = {};
  try {
    const m = await cdp.send('Performance.getMetrics');
    metrics = Object.fromEntries((m.metrics || []).map(x => [x.name, x.value]));
  } catch (e) {}
  return {
    jsHeapMB: MB(u.usedSize),
    jsHeapTotalMB: MB(u.totalSize),
    embedderMB: MB(u.embedderHeapUsedSize),
    backingMB: MB((u.backingStorageSize === undefined ? 0 : u.backingStorageSize)),
    domNodes: metrics.Nodes === undefined ? null : metrics.Nodes,
    documents: metrics.Documents === undefined ? null : metrics.Documents,
    layoutCount: metrics.LayoutCount === undefined ? null : metrics.LayoutCount,
    recalcStyleCount: metrics.RecalcStyleCount === undefined ? null : metrics.RecalcStyleCount,
    frames: metrics.Frames === undefined ? null : metrics.Frames
  };
}

async function heapNoGC(cdp) {
  const u = await cdp.send('Runtime.getHeapUsage');
  return MB(u.usedSize);
}

async function appState(page) {
  return page.evaluate(() => {
    const zq = z => { let n = 0; const o = db[z] || {}; for (const k in o) { const f = o[k]; if (f && Array.isArray(f.questions)) n += f.questions.length; } return n; };
    const zp = z => { let n = 0; const c = _prepFiles[z] || {}; for (const k in c) n += (c[k] || []).length; return n; };
    const searchCached = () => {
      let a = 0, b = 0;
      if (_snap && Array.isArray(_snap.arr)) for (const p of _snap.arr) {
        if (typeof p._searchText === 'string') a++;
        if (typeof p._restrictedSearchText === 'string') b++;
      }
      return { full: a, restricted: b };
    };
    let prepBytes = 0;
    try { prepBytes = JSON.stringify(_snap && _snap.arr ? _snap.arr.length : 0).length; } catch (e) {}
    return {
      activeZone, activeFile, currentPage,
      indexFiles: Object.fromEntries(ZONE_IDS.map(z => [z, (index[z] || []).length])),
      dbQuestions: Object.fromEntries(ZONE_IDS.map(z => [z, zq(z)])),
      prepQuestions: Object.fromEntries(ZONE_IDS.map(z => [z, zp(z)])),
      snap: { zone: _snap.zone, epoch: _snap.epoch, len: _snap.arr ? _snap.arr.length : 0, fileCount: _snap.fileCount },
      dbEpoch: _dbEpoch,
      filteredQuestions: filteredQuestions.length,
      domQuestionNodes: document.querySelectorAll('#content .question').length,
      domAllNodes: document.getElementsByTagName('*').length,
      searchTextCached: searchCached(),
      wrongKeys: Object.fromEntries(ZONE_IDS.map(z => [z, Object.keys(wrongSet[z] || {}).length])),
      ev: window.__ev
    };
  });
}

async function waitInit(page, timeout = 600000) {
  try {
    await page.waitForFunction(() => typeof renderQuestions === 'function'
      && typeof index !== 'undefined'
      && window.__evReady === true
      && !!document.getElementById('zoneTabs')
      && document.getElementById('zoneTabs').innerHTML.length > 0, null, { timeout });
    return true;
  } catch (e) {
    const diag = await page.evaluate(() => {
      const t = {};
      try { t.renderQuestions = typeof renderQuestions; } catch (x) { t.renderQuestions = 'ERR'; }
      try { t.index = typeof index; } catch (x) { t.index = 'ERR'; }
      try { t.db = typeof db; } catch (x) { t.db = 'ERR'; }
      try { t.zoneTabsLen = (document.getElementById('zoneTabs') || {}).innerHTML ? document.getElementById('zoneTabs').innerHTML.length : -1; } catch (x) {}
      t.evReady = !!(window.__ev && window.__evReady);
      t.evWrapped = (window.__ev && window.__ev.wrapped) || '';
      t.errors = (window.__ev && window.__ev.errors) || [];
      t.alerts = (window.__ev && window.__ev.alerts) || [];
      t.readyState = document.readyState;
      t.bodyLen = document.body ? document.body.innerHTML.length : -1;
      return t;
    }).catch(e2 => ({ evaluateFailed: String(e2.message) }));
    console.error('waitInit 失败诊断:', JSON.stringify(diag, null, 2));
    throw e;
  }
}

async function waitIndexSettle(page, settleMs = 20000, hardMs = 25 * 60 * 1000) {
  const t0 = Date.now();
  let last = '', lastChange = Date.now(), peak = 0;
  while (Date.now() - t0 < hardMs) {
    const snap = await page.evaluate(() => ZONE_IDS.map(z => (index[z] || []).length).join(',') + '|' +
      ZONE_IDS.reduce((s, z) => { let n = 0; const o = db[z] || {}; for (const k in o) { const f = o[k]; if (f && Array.isArray(f.questions)) n += f.questions.length; } return s + n; }, 0));
    const cur = await heapNoGC(stateCdp);
    peak = Math.max(peak, cur);
    if (snap !== last) { last = snap; lastChange = Date.now(); }
    else if (Date.now() - lastChange > settleMs) break;
    await sleep(3000);
  }
  return { key: last, peakHeapMB: peak };
}

/* ---------- 主流程 ---------- */
let stateCdp = null;

(async function main() {
  fs.mkdirSync(WORK, { recursive: true });
  fs.mkdirSync(PROFILE, { recursive: true });
  console.log('index.html sha256 =', HTML_SHA);
  console.log('代码内 IDB_VER =', IDB_VER_IN_CODE);
  console.log('phase =', PHASE, ' zones =', ZONES.join(','));

  const server = await startServer(Number(argv.port) || 47831);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  console.log('server =', base);

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    executablePath: CHROME,
    headless: true,
    viewport: { width: 1180, height: 820 },
    args: ['--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
  });
  await ctx.addInitScript(INIT);
  const page = ctx.pages()[0] || await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  stateCdp = cdp;
  await cdp.send('HeapProfiler.enable');
  try { await cdp.send('Performance.enable'); } catch (e) {}

  const result = { indexHtmlSha256: HTML_SHA, idbVerInCode: IDB_VER_IN_CODE, phase: PHASE, zones: ZONES, steps: [] };
  const rec = (label, heapObj, extra) => {
    const row = { label, ...heapObj, ...(extra || {}) };
    result.steps.push(row);
    console.log(`[${label}] jsHeap=${heapObj.jsHeapMB}MB domNodes=${heapObj.domNodes} layout=${heapObj.layoutCount}`);
    return row;
  };

  try {
    if (PHASE === 'import') {
      await page.goto(base + '/app', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await waitInit(page);
      rec('M0 空库冷启动', await heap(cdp));

      const batches = ZONES.map(z => ({ zone: z, files: bankFiles(z) }));
      for (const b of batches) {
        console.log(`\n=== 导入 ${b.zone}（${ZONE_LABEL[b.zone]}）${b.files.length} 个文件 ===`);
        b.files.forEach(f => console.log('   ', path.basename(f), (fs.statSync(f).size / 1048576).toFixed(1) + 'MB'));
        await page.selectOption('#zoneSelect', b.zone);
        const t0 = Date.now();
        const before = await heapNoGC(cdp);
        await page.setInputFiles('#fileInput', b.files);
        const settle = await waitIndexSettle(page);
        const after = await heapNoGC(cdp);
        const h = await heap(cdp);
        rec('M1 导入' + b.zone + '后（GC 后）', h, {
          importSeconds: Math.round((Date.now() - t0) / 1000),
          heapBeforeImportMB: before, heapSettledNoGCMB: after, peakHeapNoGCMB: settle.peakHeapMB
        });
        const st = await appState(page);
        console.log('    index:', JSON.stringify(st.indexFiles), ' db题数:', JSON.stringify(st.dbQuestions));
      }
      const st = await appState(page);
      result.afterImport = st;
      // 落盘后等一会，确保 IDB 写事务完成
      await sleep(15000);
      console.log('\n最终 index:', JSON.stringify(st.indexFiles));
      console.log('最终 db 题数:', JSON.stringify(st.dbQuestions), '合计', Object.values(st.dbQuestions).reduce((a, b) => a + b, 0));
    }

    if (PHASE === 'measure') {
      const t0 = Date.now();
      await page.goto(base + '/app', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await waitInit(page, 300000);
      const bootSeconds = Math.round((Date.now() - t0) / 1000);
      rec('M2 冷启动完成（loadAll 后，GC 后）', await heap(cdp), { bootSeconds, ...(await appState(page)) });

      // —— IndexedDB 真实形态（store 清单 / 版本 / 配额）——
      result.idbInfo = await page.evaluate(async () => {
        const out = { databases: null, qzdbStores: null, qzdbVersion: null, estimate: null, kvKeyCount: null, prefixCounts: {} };
        try { out.databases = (await indexedDB.databases()).map(d => ({ name: d.name, version: d.version })); }
        catch (e) { out.databases = 'ERR:' + e.message; }
        try {
          out.qzdbVersion = _db ? _db.version : null;
          out.qzdbStores = _db ? Array.from(_db.objectStoreNames) : null;
        } catch (e) { out.qzdbStores = 'ERR:' + e.message; }
        try { const e2 = await navigator.storage.estimate(); out.estimate = { usageMB: +(e2.usage / 1048576).toFixed(1), quotaMB: +(e2.quota / 1048576).toFixed(1) }; } catch (e) {}
        try {
          const keys = await idbGetAllKeys();
          out.kvKeyCount = keys.length;
          keys.forEach(k => { const p = String(k).split(':')[0]; out.prefixCounts[p] = (out.prefixCounts[p] || 0) + 1; });
        } catch (e) {}
        return out;
      });
      console.log('[IDB]', JSON.stringify(result.idbInfo));

      // —— 首屏
      rec('M3 练习首屏', await heap(cdp), await appState(page));

      // —— 连续翻页 20 次 + FPS/longtask
      const ltBefore = (await appState(page)).ev.longtasks.length;
      const fps = await page.evaluate(async () => {
        const frames = []; let last = performance.now(); let stop = false;
        const loop = () => { const n = performance.now(); frames.push(n - last); last = n; if (!stop) requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
        for (let i = 0; i < 20; i++) {
          window.goPage(window.currentPage + 1);
          await new Promise(r => setTimeout(r, 120));
        }
        stop = true;
        await new Promise(r => setTimeout(r, 120));
        const sorted = frames.slice().sort((a, b) => a - b);
        return {
          frameCount: frames.length,
          avgFrameMs: +(frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length)).toFixed(2),
          p95FrameMs: +(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(2),
          maxFrameMs: +Math.max(...frames, 0).toFixed(2)
        };
      });
      const stTurn = await appState(page);
      rec('M4 连续翻页 20 页后', await heap(cdp), { fps, newLongTasks: stTurn.ev.longtasks.length - ltBefore, ...stTurn });

      // —— 分区切换 A→B→A (gk→sy→mk→gk) ——
      let prev = await appState(page);
      const switchTrace = [];
      for (const z of ['sy', 'mk', 'gk']) {
        await page.evaluate(zz => window.switchZone(zz), z);
        await sleep(2500);
        const ltB = prev.ev.longtasks.length;
        const h = await heap(cdp);
        const st = await appState(page);
        switchTrace.push({ to: z, jsHeapMB: h.jsHeapMB, domNodes: h.domNodes, prep: st.prepQuestions, snapLen: st.snap.len, newLongTasks: st.ev.longtasks.length - ltB });
        prev = st;
      }
      rec('M5 分区 A→B→A 后（gk→sy→mk→gk）', await heap(cdp), { switchTrace, ...(await appState(page)) });

      // —— 搜索 ——
      const search = async (kw) => {
        await page.evaluate(k => {
          const box = document.getElementById('searchBox');
          box.value = k;
          box.dispatchEvent(new Event('input', { bubbles: true }));
        }, kw);
        await sleep(1200);
        await page.evaluate(() => {
          const box = document.getElementById('searchBox');
          box.value = '';
          box.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await sleep(900);
      };
      const ltB4 = (await appState(page)).ev.longtasks.length;
      await page.evaluate(() => {
        const box = document.getElementById('searchBox');
        box.value = '下列';
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await sleep(2500);
      const stSearch = await appState(page);
      rec('M6 搜索「下列」后（含搜索文本缓存）', await heap(cdp), { newLongTasks: stSearch.ev.longtasks.length - ltB4, ...stSearch });

      const ltB5 = (await appState(page)).ev.longtasks.length;
      await search('下列');   // 清空 → 再搜索 → 再清空
      const stAfter = await appState(page);
      rec('M7 搜索→清空→再搜索→清空后', await heap(cdp), { newLongTasks: stAfter.ev.longtasks.length - ltB5, ...stAfter });

      // —— 长时操作趋势：再翻 60 页 + 3 轮搜索 ——
      const ltB6 = (await appState(page)).ev.longtasks.length;
      for (let i = 0; i < 3; i++) { await search(i % 2 ? '下列' : '正确的是'); }
      await page.evaluate(async () => {
        for (let i = 0; i < 60; i++) { window.goPage(window.currentPage + 1); await new Promise(r => setTimeout(r, 30)); }
        window.goPage(1);
      });
      await sleep(1500);
      const stLong = await appState(page);
      rec('M8 长时操作后（3 轮搜索 + 60 页翻页）', await heap(cdp), { newLongTasks: stLong.ev.longtasks.length - ltB6, ...stLong });

      // —— 归因：展开副本占用（破坏性，放最后）——
      const beforeDrop = await heap(cdp);
      const prepSnapshot = (await appState(page)).prepQuestions;
      await page.evaluate(() => {
        for (const z of ZONE_IDS) { if (_prepFiles[z]) _prepFiles[z] = {}; }
        _snap.zone = null; _snap.epoch = -1; _snap.arr = null; _snap.fileCount = -1;
      });
      const afterDrop = await heap(cdp);
      rec('M9 归因：清空 _prepFiles + _snap 后', afterDrop, {
        prepBeforeDrop: prepSnapshot,
        deltaMB: +(beforeDrop.jsHeapMB - afterDrop.jsHeapMB).toFixed(1)
      });

      // —— 归因：db 原始数据文本量（不破坏会话）——
      const dbChars = await page.evaluate(() => {
        const out = {};
        for (const z of ZONE_IDS) {
          const o = db[z] || {};
          let n = 0;
          for (const k in o) { try { n += JSON.stringify(o[k]).length; } catch (e) {} }
          out[z] = n;
        }
        return out;
      });
      result.dbJsonChars = dbChars;

      // —— 归因：重新展开单分区（切题路径成本）——
      // 注意：必须让 page.evaluate 只返回「数字」，否则 Playwright 会把 5 万个对象
      // 序列化成 JSON 传回 Node，计时会被序列化时间污染（首版踩过这个坑）。
      const t1 = Date.now();
      await page.evaluate(() => { window.getZoneQuestions(activeZone, '__all__'); return 1; });
      const expandMs = Date.now() - t1;
      const afterReexpand = await heap(cdp);
      rec('M10 重新展开当前分区', afterReexpand, { expandMs, prep: (await appState(page)).prepQuestions });

      result.final = await appState(page);
      result.dbJsonChars = dbChars;
    }

    if (PHASE === 'timing') {
      await page.goto(base + '/app', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await waitInit(page, 300000);
      rec('T0 冷启动完成', await heap(cdp), await appState(page));

      /* 全部计时在页内完成，只把「数字」传回 Node */
      const t = await page.evaluate(async () => {
        const out = {};
        const time = (fn) => { const a = performance.now(); const r = fn(); return { ms: +(performance.now() - a).toFixed(1), ret: r }; };
        const clearPrep = () => { for (const z of ZONE_IDS) { if (_prepFiles[z]) _prepFiles[z] = {}; } _snap.zone = null; _snap.epoch = -1; _snap.arr = null; _snap.fileCount = -1; };
        const resetFilter = () => { filterState = { module:'all', year:'all', province:'all', source:'all', subType:'all', leafType:'all', search:'', status:'all', sortBy:'default', minRatio:'', maxRatio:'' }; _gfbMemo.sig = null; _gfbMemo.arr = null; _moduleStatsMemo.sig = null; _moduleStatsMemo.stats = null; };
        const qCount = z => { let n = 0; const o = db[z] || {}; for (const k in o) { const f = o[k]; if (f && Array.isArray(f.questions)) n += f.questions.length; } return n; };

        // 1) loadAll（IDB 全量读 + 重建 db）
        const a0 = performance.now(); await loadAll(); out.loadAll_ms = +(performance.now() - a0).toFixed(1);

        // 2) 分区展开（清缓存后单次）
        resetFilter(); clearPrep();
        for (const z of ['mk', 'sy', 'gk']) {
          const r = time(() => getZoneQuestions(z, '__all__'));
          out['expand_' + z + '_ms'] = r.ms;
          out['expand_' + z + '_n'] = qCount(z);
        }

        // 3) 无筛选 getFiltered（含全量 sort）
        activeZone = 'gk'; resetFilter(); clearPrep();
        const r3 = time(() => getFiltered());
        out.getFiltered_gk_ms = r3.ms; out.getFiltered_gk_n = (r3.ret || []).length;
        activeZone = 'mk'; resetFilter();
        const r3b = time(() => getFiltered());
        out.getFiltered_mk_ms = r3b.ms; out.getFiltered_mk_n = (r3b.ret || []).length;

        // 4) 建立搜索（受限搜索文本 + 过滤）
        activeZone = 'gk'; resetFilter(); clearPrep();
        getZoneQuestions('gk', '__all__');
        releaseSearchTextCache('gk');
        filterState.search = '下列'; currentPage = 1;
        const r4 = time(() => { const qs = getFiltered(); return qs.length; });
        out.searchFirst_gk_ms = r4.ms; out.searchFirst_gk_hits = r4.ret;
        const r4b = time(() => { const qs = getFiltered(); return qs.length; });
        out.searchSecond_gk_ms = r4b.ms;   // 命中缓存后的第二次
        const r4c = time(() => { releaseSearchTextCache('gk'); return 1; });
        out.releaseSearchText_gk_ms = r4c.ms;

        // 5) 切换分区（含 DOM 全量重渲染）
        activeZone = 'gk'; resetFilter();
        const r5 = time(() => switchZone('sy'));
        out.switchZone_gk2sy_ms = r5.ms;
        const r5b = time(() => switchZone('mk'));
        out.switchZone_sy2mk_ms = r5b.ms;

        // 6) 筛选栏构建（全分区正则 + 扫描）
        activeZone = 'mk'; resetFilter(); clearPrep();
        const r6 = time(() => updateFilterOptions());
        out.updateFilterOptions_mk_ms = r6.ms;
        const r6b = time(() => renderZoneStats());
        out.renderZoneStats_mk_ms = r6b.ms;
        const r6c = time(() => renderModuleBar());
        out.renderModuleBar_mk_ms = r6c.ms;

        // 7) 翻页（goPage 内部含 renderQuestions）
        const turns = [];
        for (let i = 0; i < 5; i++) { const a = performance.now(); goPage(currentPage + 1); turns.push(performance.now() - a); }
        out.pageTurn_ms = turns.map(x => +x.toFixed(1));

        // 8) 单题判定/状态统计
        const r8 = time(() => renderZoneStats());
        out.renderZoneStats_mk_ms_2 = r8.ms;

        // 收尾：回到 gk 且恢复无筛选
        activeZone = 'gk'; resetFilter();
        out.dbQuestions = Object.fromEntries(ZONE_IDS.map(z => [z, qCount(z)]));
        return out;
      });
      result.timing = t;
      for (const [k, v] of Object.entries(t)) console.log('  T·' + k + ' =', JSON.stringify(v));
      rec('T1 计时阶段结束', await heap(cdp), await appState(page));
    }
  } catch (e) {
    console.error('!! 探测中断:', e && e.message);
    result.fatalError = String((e && e.stack) || e);
  } finally {
    try { result.finalState = await appState(page); } catch (e) {}
    try { await page.close(); } catch (e) {}
    try { await ctx.close(); } catch (e) {}
    server.close();
    fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));
    console.log('\n[落盘]', OUT_JSON);
    console.log('index.html sha256 复核 =', crypto.createHash('sha256').update(fs.readFileSync(HTML_PATH)).digest('hex'));
  }
})();
