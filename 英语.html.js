




// ============================================================
// 1. 主模块切换 (新增)
// ============================================================
let currentMainModule = 'gk';

function switchMainModule(module) {
  if (currentMainModule === module) return;
  currentMainModule = module;
  document.querySelectorAll('.side-nav-item[data-module]').forEach(b => {
    b.classList.toggle('active', b.dataset.module === module);
  });
  document.querySelectorAll('.module-container').forEach(c => {
    c.classList.toggle('active', c.id === 'module-' + module);
  });
  try { localStorage.setItem('qz_main_module', module); } catch(e) {}
  if (module === 'en') initEnglish();
}

function restoreMainModule() {
  try { const s = localStorage.getItem('qz_main_module'); if (s === 'en') switchMainModule('en'); } catch(e) {}
}

// ============================================================
// 3. 英语数据管理 (IndexedDB)
// ============================================================
const EN_DB_NAME = 'en_db';
const EN_DB_VER = 1;
const EN_STORE = 'data';
let enDB = null;
let enData = {
  tasks: [
    { id: 't1', text: '背单词 20个', done: false, tag: '单词' },
    { id: 't2', text: '阅读 1篇', done: false, tag: '阅读' },
    { id: 't3', text: '听力 15分钟', done: false, tag: '听力' },
    { id: 't4', text: '语法练习 1组', done: false, tag: '语法' },
    { id: 't5', text: '写作 1段', done: false, tag: '写作' },
    { id: 't6', text: '口语练习 10分钟', done: false, tag: '口语' },
    { id: 't7', text: '复习昨日单词', done: false, tag: '单词' },
  ],
  streak: 0,
  lastStudyDate: '',
  words: [],
  readings: [],
  aiGenerated: {}
};

function openENDB() {
  return new Promise((resolve) => {
    if (enDB) { resolve(enDB); return; }
    const req = indexedDB.open(EN_DB_NAME, EN_DB_VER);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(EN_STORE)) d.createObjectStore(EN_STORE);
    };
    req.onsuccess = (e) => { enDB = e.target.result; resolve(enDB); };
    req.onerror = () => { resolve(null); };
  });
}

function enLoadData() {
  return new Promise((resolve) => {
    openENDB().then((db) => {
      if (!db) { resolve(false); return; }
      const tx = db.transaction(EN_STORE, 'readonly');
      const r = tx.objectStore(EN_STORE).get('data');
      r.onsuccess = () => {
        if (r.result) {
          enData = { ...enData, ...r.result };
          if (!enData.words) enData.words = [];
          if (!enData.readings) enData.readings = [];
          if (!enData.tasks) enData.tasks = [];
          if (!enData.aiGenerated) enData.aiGenerated = {};
        }
        resolve(true);
      };
      r.onerror = () => resolve(false);
    });
  });
}

function enSaveData() {
  return new Promise((resolve) => {
    openENDB().then((db) => {
      if (!db) { resolve(false); return; }
      const tx = db.transaction(EN_STORE, 'readwrite');
      tx.objectStore(EN_STORE).put(enData, 'data');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  });
}

// ============================================================
// 4. 英语核心功能
// ============================================================
let enInitialized = false;

async function initEnglish() {
  if (enInitialized) { renderAllEN(); return; }
  await enLoadData();
  enInitialized = true;
  document.getElementById('enTodayDate').textContent = new Date().toISOString().slice(0, 10);
  renderAllEN();
}

function renderAllEN() {
  renderTasks();
  renderWords();
  renderReadings();
  updateStats();
}

function renderTasks() {
  const container = document.getElementById('enTaskList');
  if (!container) return;
  const done = enData.tasks.filter(t => t.done).length;
  const total = enData.tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const ring = document.getElementById('enProgressRing');
  if (ring) {
    const circ = 326.7;
    ring.style.strokeDashoffset = circ - (pct / 100) * circ;
  }
  document.getElementById('enDailyPct').textContent = pct + '%';
  document.getElementById('enDoneCount').textContent = done;
  document.getElementById('enTotalTasks').textContent = total;
  document.getElementById('enStreakNum').textContent = enData.streak || 0;

  const tagColors = { '单词': '#8b5cf6', '阅读': '#10b981', '听力': '#ef4444', '语法': '#f59e0b', '写作': '#3b82f6', '口语': '#ec4899' };
  let html = '';
  enData.tasks.forEach(t => {
    const color = tagColors[t.tag] || '#6b7280';
    html += `
      <div class="en-task-item ${t.done ? 'done' : ''}" onclick="enToggleTask('${t.id}')">
        <span class="en-task-check">${t.done ? '✓' : ''}</span>
        <span class="en-task-text">${t.text}</span>
        <span class="en-task-tag" style="background:${color}20;color:${color};">${t.tag || '任务'}</span>
        <button class="en-task-del" onclick="event.stopPropagation();enDeleteTask('${t.id}')">✕</button>
      </div>
    `;
  });
  container.innerHTML = html;
}

function enToggleTask(id) {
  const t = enData.tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  if (enData.tasks.every(x => x.done)) {
    const today = new Date().toDateString();
    if (enData.lastStudyDate !== today) {
      enData.lastStudyDate = today;
      enData.streak = (enData.streak || 0) + 1;
    }
  }
  enSaveData().then(() => renderTasks());
}

function enDeleteTask(id) {
  enData.tasks = enData.tasks.filter(x => x.id !== id);
  enSaveData().then(() => renderTasks());
}

function enAddTask() {
  const input = document.getElementById('enNewTaskInput');
  const text = input.value.trim();
  if (!text) return;
  enData.tasks.push({ id: 't_' + Date.now().toString(36), text, done: false, tag: '自定义' });
  input.value = '';
  enSaveData().then(() => renderTasks());
}

// ===== 单词本 =====
function renderWords() {
  const container = document.getElementById('enWordList');
  if (!container) return;
  document.getElementById('enWordCount').textContent = enData.words.length + ' 个';
  if (enData.words.length === 0) {
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--secondary);">📭 还没有单词，上传 TXT/CSV</div>';
    return;
  }
  let html = '';
  enData.words.forEach(w => {
    const learned = w.learned ? 'learned' : '';
    html += `
      <div class="en-word-card ${learned}">
        <div class="en-word">${w.word}</div>
        <div class="en-meaning">${w.meaning || '⏳ 待生成'}</div>
        ${w.example ? `<div class="en-example">"${w.example}"</div>` : ''}
        ${w.root ? `<div class="en-extra">🌱 词根: ${w.root}</div>` : ''}
        ${w.memoryTip ? `<div class="en-extra">💡 ${w.memoryTip}</div>` : ''}
        <div class="en-word-actions">
          <button onclick="enToggleLearned('${w.id}')">${w.learned ? '✅ 已学' : '⬜ 标记已学'}</button>
          <button onclick="enGenerateWord('${w.id}')">🤖 AI 生成</button>
          <button onclick="enDeleteWord('${w.id}')" style="color:#ef4444;">删除</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function enImportWords(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const lines = text.split('\n').filter(l => l.trim());
    let count = 0;
    lines.forEach(line => {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        if (!enData.words.find(w => w.word.toLowerCase() === parts[0].toLowerCase())) {
          enData.words.push({
            id: 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5),
            word: parts[0],
            meaning: parts[1],
            example: parts[2] || '',
            root: '', memoryTip: '', learned: false, createdAt: Date.now()
          });
          count++;
        }
      } else if (line.trim()) {
        const word = line.trim();
        if (!enData.words.find(w => w.word.toLowerCase() === word.toLowerCase())) {
          enData.words.push({
            id: 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5),
            word: word,
            meaning: '', example: '', root: '', memoryTip: '',
            learned: false, createdAt: Date.now()
          });
          count++;
        }
      }
    });
    enSaveData().then(() => { renderWords(); updateStats(); alert(`✅ 导入 ${count} 个单词！点击「AI 批量生成」获取释义。`); });
  };
  reader.readAsText(file);
  event.target.value = '';
}

async function enGenerateWord(id) {
  const w = enData.words.find(x => x.id === id);
  if (!w) return;
  if (!aiConfig.apiKey) { alert('请先配置 AI API Key'); return; }
  const btn = event.target;
  btn.textContent = '⏳...';
  btn.disabled = true;
  try {
    const result = await callAI(`请为英语单词 "${w.word}" 生成：中文释义（2-3个）、英文例句（带中文翻译）、词根分析、记忆技巧。返回 JSON 格式：{"meaning":"...","example":"...","root":"...","memoryTip":"..."}`);
    const data = JSON.parse(result);
    w.meaning = data.meaning || w.meaning;
    w.example = data.example || w.example;
    w.root = data.root || '';
    w.memoryTip = data.memoryTip || '';
    await enSaveData();
    renderWords();
  } catch(err) { alert('生成失败: ' + err.message); }
  btn.textContent = '🤖 AI 生成';
  btn.disabled = false;
}

async function enBatchGenerate() {
  const toProcess = enData.words.filter(w => !w.meaning || w.meaning === '');
  if (toProcess.length === 0) { alert('所有单词已有释义'); return; }
  if (!aiConfig.apiKey) { alert('请先配置 AI API Key'); return; }
  if (!confirm(`为 ${toProcess.length} 个单词生成释义，继续？`)) return;
  for (let i = 0; i < toProcess.length; i++) {
    const w = toProcess[i];
    document.getElementById('enWordCount').textContent = `⏳ ${i+1}/${toProcess.length}`;
    try {
      const result = await callAI(`请为英语单词 "${w.word}" 生成中文释义（2-3个）和英文例句。返回 JSON：{"meaning":"...","example":"..."}`);
      const data = JSON.parse(result);
      w.meaning = data.meaning || w.meaning;
      w.example = data.example || w.example;
      await enSaveData();
    } catch(err) { console.error(err); }
    await new Promise(r => setTimeout(r, 500));
  }
  renderWords();
  updateStats();
  alert('✅ 批量生成完成！');
}

function enToggleLearned(id) {
  const w = enData.words.find(x => x.id === id);
  if (w) { w.learned = !w.learned; enSaveData().then(() => renderWords()); }
}

function enDeleteWord(id) {
  if (!confirm('确定删除？')) return;
  enData.words = enData.words.filter(x => x.id !== id);
  enSaveData().then(() => { renderWords(); updateStats(); });
}

// ===== 阅读分析 =====
let currentReading = null;

function renderReadings() {
  const container = document.getElementById('enReadingList');
  if (!container) return;
  document.getElementById('enReadingCount').textContent = enData.readings.length + ' 篇';
  if (enData.readings.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--secondary);">暂无阅读材料</div>';
    return;
  }
  let html = '<div style="display:grid;gap:10px;">';
  enData.readings.forEach(r => {
    html += `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg);border-radius:10px;flex-wrap:wrap;gap:6px;">
        <div><strong>${r.title || '未命名'}</strong><span style="font-size:12px;color:var(--secondary);margin-left:10px;">${r.content ? r.content.length + ' 字' : ''}</span></div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="enViewReading('${r.id}')">查看</button>
          <button class="btn btn-danger btn-sm" onclick="enDeleteReading('${r.id}')">删除</button>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

async function enImportReading(event) {
  const file = event.target.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  let content = '';
  try {
    if (ext === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const txt = await page.getTextContent();
        text += txt.items.map(item => item.str).join(' ') + '\n';
      }
      content = text;
    } else if (ext === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      content = result.value;
    } else { alert('支持 .pdf .docx'); return; }
  } catch(err) { alert('解析失败: ' + err.message); return; }
  if (!content.trim()) { alert('未能提取文本'); return; }
  const reading = {
    id: 'r_' + Date.now().toString(36),
    title: file.name,
    content: content,
    source: file.name,
    createdAt: Date.now(),
    analysis: null,
    questions: null
  };
  enData.readings.push(reading);
  await enSaveData();
  renderReadings();
  currentReading = reading;
  showReading(reading);
  event.target.value = '';
}

function enPasteReading() {
  const text = document.getElementById('enReadingPaste').value.trim();
  if (!text) { alert('请粘贴文本'); return; }
  const reading = {
    id: 'r_' + Date.now().toString(36),
    title: '粘贴文本 ' + new Date().toLocaleDateString(),
    content: text,
    source: '粘贴',
    createdAt: Date.now(),
    analysis: null,
    questions: null
  };
  enData.readings.push(reading);
  enSaveData().then(() => { renderReadings(); currentReading = reading; showReading(reading); });
  document.getElementById('enReadingPaste').value = '';
}

function showReading(reading) {
  const container = document.getElementById('enReadingContent');
  container.style.display = 'block';
  document.getElementById('enReadingPreview').textContent = reading.content;
  const analysis = document.getElementById('enReadingAnalysis');
  if (reading.analysis) {
    analysis.innerHTML = `
      <div class="en-analysis-grid">
        <div class="en-analysis-item"><div class="en-label">词汇量</div><div class="en-value">${reading.analysis.wordCount || 0}</div></div>
        <div class="en-analysis-item"><div class="en-label">句数</div><div class="en-value">${reading.analysis.sentenceCount || 0}</div></div>
        <div class="en-analysis-item"><div class="en-label">难度</div><div class="en-value">${reading.analysis.difficulty || '待分析'}</div></div>
        <div class="en-analysis-item"><div class="en-label">核心词汇</div><div class="en-value">${(reading.analysis.keyWords || []).length} 个</div></div>
      </div>
      ${reading.analysis.keyWords ? `<div style="margin-top:8px;"><strong>核心词汇：</strong>${reading.analysis.keyWords.map(w => `<span style="background:var(--light);padding:2px 10px;border-radius:12px;margin:3px;display:inline-block;">${w}</span>`).join('')}</div>` : ''}
      ${reading.analysis.grammarTips ? `<div style="margin-top:8px;background:#fef3c7;padding:10px 14px;border-radius:8px;"><strong>📖 语法要点：</strong>${reading.analysis.grammarTips}</div>` : ''}
    `;
  } else {
    analysis.innerHTML = '<div style="color:var(--secondary);">点击「AI 分析语法」获取详细分析</div>';
  }
  document.getElementById('enReadingResult').className = 'en-ai-result';
  document.getElementById('enReadingResult').textContent = '';
}

function enViewReading(id) {
  const r = enData.readings.find(x => x.id === id);
  if (r) { currentReading = r; showReading(r); }
}

function enDeleteReading(id) {
  if (!confirm('确定删除？')) return;
  enData.readings = enData.readings.filter(x => x.id !== id);
  if (currentReading && currentReading.id === id) {
    currentReading = null;
    document.getElementById('enReadingContent').style.display = 'none';
  }
  enSaveData().then(() => renderReadings());
}

function enClearReading() {
  document.getElementById('enReadingContent').style.display = 'none';
  currentReading = null;
}

async function enAnalyzeReading() {
  if (!currentReading) { alert('请先上传或粘贴文章'); return; }
  if (!aiConfig.apiKey) { alert('请配置 AI API Key'); return; }
  const result = document.getElementById('enReadingResult');
  result.className = 'en-ai-result show';
  result.innerHTML = '<span class="en-ai-loading">🧠 AI 分析中...</span>';
  try {
    const text = currentReading.content.slice(0, 3000);
    const response = await callAI(`分析以下英文文章，返回 JSON：{"wordCount":词数,"sentenceCount":句数,"difficulty":"初级/中级/高级","keyWords":["核心词汇"最多10个],"grammarTips":"语法要点","summary":"主旨"}\n\n${text}`);
    const data = JSON.parse(response);
    currentReading.analysis = data;
    await enSaveData();
    showReading(currentReading);
    result.innerHTML = '✅ 分析完成！';
    setTimeout(() => result.className = 'en-ai-result', 2000);
  } catch(err) {
    result.innerHTML = `<span class="en-ai-error">❌ 分析失败: ${err.message}</span>`;
  }
}

async function enGenerateQuestions() {
  if (!currentReading) { alert('请先上传或粘贴文章'); return; }
  if (!aiConfig.apiKey) { alert('请配置 AI API Key'); return; }
  const result = document.getElementById('enReadingResult');
  result.className = 'en-ai-result show';
  result.innerHTML = '<span class="en-ai-loading">📝 AI 生成题目...</span>';
  try {
    const text = currentReading.content.slice(0, 2000);
    const response = await callAI(`根据文章生成3道阅读理解选择题，返回 JSON：[{"question":"题目","options":["A.","B.","C.","D."],"answer":"A"}]\n\n${text}`);
    const data = JSON.parse(response);
    currentReading.questions = data;
    await enSaveData();
    let html = '<div style="margin-top:12px;"><strong>📝 阅读理解题</strong></div>';
    data.forEach((q, i) => {
      html += `<div style="background:var(--bg);padding:12px 16px;border-radius:10px;margin-top:10px;">
        <div><strong>${i+1}. ${q.question}</strong></div>
        <div style="margin:6px 0 0 16px;">${q.options.join('<br>')}</div>
        <div style="margin-top:6px;color:#10b981;font-weight:600;">✅ ${q.answer}</div>
      </div>`;
    });
    result.innerHTML = html;
  } catch(err) {
    result.innerHTML = `<span class="en-ai-error">❌ 生成失败: ${err.message}</span>`;
  }
}

// ===== AI 调用 =====
async function callAI(prompt) {
  const endpoints = {
    deepseek: 'https://api.deepseek.com/chat/completions',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    openai: 'https://api.openai.com/v1/chat/completions'
  };
  const ep = endpoints[aiConfig.provider];
  if (!ep) throw new Error('未知 AI 服务商');
  const models = { deepseek: 'deepseek-chat', qwen: 'qwen-turbo', zhipu: 'glm-4-flash', openai: 'gpt-4o-mini' };
  const model = aiConfig.model || models[aiConfig.provider];
  const resp = await fetch(ep, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + aiConfig.apiKey },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 800
    })
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('返回内容为空');
  return content;
}

// ===== 数据管理 =====
function updateStats() {
  document.getElementById('enStatWords').textContent = enData.words.length;
  document.getElementById('enStatReadings').textContent = enData.readings.length;
  document.getElementById('enStatTasks').textContent = enData.tasks.length;
}

function enExportData() {
  const data = {
    exportTime: new Date().toISOString(),
    tasks: enData.tasks,
    streak: enData.streak,
    lastStudyDate: enData.lastStudyDate,
    words: enData.words,
    readings: enData.readings,
    aiGenerated: enData.aiGenerated
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '英语学习数据_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function enImportData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.words) enData.words = data.words;
      if (data.readings) enData.readings = data.readings;
      if (data.tasks) enData.tasks = data.tasks;
      if (data.streak) enData.streak = data.streak;
      if (data.lastStudyDate) enData.lastStudyDate = data.lastStudyDate;
      if (data.aiGenerated) enData.aiGenerated = data.aiGenerated;
      enSaveData().then(() => { renderAllEN(); alert('✅ 导入成功！'); });
    } catch(err) { alert('导入失败: ' + err.message); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function enClearAll() {
  if (!confirm('⚠️ 确定清空所有英语数据？不可撤销！')) return;
  enData.words = [];
  enData.readings = [];
  enData.tasks = [];
  enData.streak = 0;
  enData.aiGenerated = {};
  enSaveData().then(() => renderAllEN());
}

function enSwitchTab(tab) {
  document.querySelectorAll('.en-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.classList.toggle('btn-primary', b.dataset.tab === tab);
    b.classList.toggle('btn-outline', b.dataset.tab !== tab);
  });
  document.querySelectorAll('.en-tab-content').forEach(c => {
    c.classList.toggle('active', c.id === 'enTab-' + tab);
  });
}
// 注：由于篇幅限制，这里放置占位函数。
// 实际使用时，将你原有的公考 JS 代码复制到此处。
// ============================================================
// 公考题库 JavaScript 代码
// ============================================================

const PAGE_SIZE = 20;
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const IDX_KEY = 'qz_index';
const VIEW_KEY = 'qz_view';
const WRONG_KEY = 'qz_wrong';
const FAV_KEY   = 'qz_fav';
const DAILY_KEY = 'qz_daily';
const EXAM_KEY  = 'qz_exam';
const STUDY_POSITION_KEY = 'qz_study_position';

const ZONES = [
  { id:'gk', name:'国考/省考' },
  { id:'mk', name:'粉笔模考' },
  { id:'sy', name:'事业单位' }
];
const MODS = ['常识判断','政治理论','言语理解与表达','数量关系','判断推理','资料分析'];

const ZONE_THEMES = {
  gk: { main:'#4a90d9', mid:'#7fb0e8', deep:'#2c6b9e', bg:'#e8f0fe', onMain:'#ffffff' },
  mk: { main:'#f5a623', mid:'#f8c560', deep:'#b97312', bg:'#fef3e2', onMain:'#2d3748' },
  sy: { main:'#f7c948', mid:'#fae08a', deep:'#8a6d12', bg:'#fef9e0', onMain:'#2d3748' }
};

function applyZoneTheme(z){
  const t = ZONE_THEMES[z] || ZONE_THEMES.gk;
  const r = document.documentElement.style;
  r.setProperty('--main', t.main);
  r.setProperty('--mid', t.mid);
  r.setProperty('--deep', t.deep);
  r.setProperty('--bg', t.bg);
  r.setProperty('--light', t.bg);
  r.setProperty('--on-main', t.onMain);
}

let index = { gk:[], mk:[], sy:[] };
let db = { gk:{}, mk:{}, sy:{} };
let activeZone = 'gk';
let activeFile = '__all__';
let currentPage = 1;
let filteredQuestions = [];
let restoredStudyPosition = null;
let filterState = {
  module:'all', year:'all', province:'all', source:'all', subType:'all', leafType:'all', search:'',
  status:'all', sortBy:'default', minRatio:'', maxRatio:''
};

let wrongSet = { gk:{}, mk:{}, sy:{} };
let favorites = { gk:{}, mk:{}, sy:{} };
let daily = { date:'', count:0, goal:50 };
let examDate = '';

// ============================================================
// DOM 引用
// ============================================================
const zoneTabs = document.getElementById('zoneTabs');
const zoneStats = document.getElementById('zoneStats');
const moduleBar = document.getElementById('moduleBar');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const zoneSelect = document.getElementById('zoneSelect');
const moduleSelect = document.getElementById('moduleSelect');
const fileListContainer = document.getElementById('fileListContainer');
const fileTabs = document.getElementById('fileTabs');
const content = document.getElementById('content');
let blobUrls = [];
const controls = document.getElementById('controls');
const pageMeta = document.getElementById('pageMeta');
const pagination = document.getElementById('pagination');
const noResult = document.getElementById('noResult');
const searchBox = document.getElementById('searchBox');
const yearFilter = document.getElementById('yearFilter');
const provinceFilter = document.getElementById('provinceFilter');
const sourceFilter = document.getElementById('sourceFilter');
const sourceOptions = document.getElementById('sourceOptions');
let sourceValues = [];
let sourceProvince = 'all';
const statusFilter = document.getElementById('statusFilter');
const sortFilter = document.getElementById('sortFilter');
const moduleFilter = document.getElementById('moduleFilter');
const leafTypeFilter = document.getElementById('leafTypeFilter');
const minRatioInput = document.getElementById('minRatioInput');
const maxRatioInput = document.getElementById('maxRatioInput');
let fileListExpanded = false;

function getFileCount(){
  return (index[activeZone] || []).length;
}

function updateFileToggle(){
  const button=document.getElementById('fileToggleBtn');
  const badge=document.getElementById('fileCountBadge');
  const container=document.getElementById('fileListContainer');
  const count=getFileCount();
  if(badge) badge.textContent=String(count);
  if(button) button.innerHTML=(fileListExpanded?'📂 收起(':'📂 已上传(')+count+')';
  if(container) container.classList.toggle('show', fileListExpanded && count>0);
}

function toggleFileList(){
  if(!getFileCount()) return;
  fileListExpanded=!fileListExpanded;
  updateFileToggle();
}
// ============================================================
// 持久化
// ============================================================
function genId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

function loadStudyPosition(){
  try{
    const raw=localStorage.getItem(STUDY_POSITION_KEY);
    if(!raw) return;
    const value=JSON.parse(raw);
    if(value && ['gk','mk','sy'].includes(value.zone)) restoredStudyPosition=value;
  }catch(e){}
}

function saveStudyPosition(){
  try{
    localStorage.setItem(STUDY_POSITION_KEY, JSON.stringify({
      zone:activeZone,
      page:currentPage,
      questionIndex:Math.max(0, (currentPage-1)*PAGE_SIZE)
    }));
  }catch(e){}
}

function showStudyPositionRestored(){
  const notice=document.createElement('div');
  notice.textContent='已恢复到上次位置';
  notice.style.cssText='position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:10000;background:#2c6b9e;color:#fff;padding:10px 18px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.2);font-size:14px;';
  document.body.appendChild(notice);
  setTimeout(function(){ notice.remove(); }, 2400);
}

function setupStudyPositionTracking(){
  if(window.__studyPositionTracking) return;
  window.__studyPositionTracking=true;
  let saveTimer=0;
  window.addEventListener('scroll', function(){
    if(saveTimer) return;
    saveTimer=setTimeout(function(){
      saveTimer=0;
      const questions=Array.from(document.querySelectorAll('#content .question'));
      if(!questions.length) return;
      let current=questions[0];
      questions.forEach(function(question){
        if(question.getBoundingClientRect().top<=window.innerHeight*0.35) current=question;
      });
      const indexInPage=questions.indexOf(current);
      const globalIndex=(currentPage-1)*PAGE_SIZE+Math.max(0,indexInPage);
      try{ localStorage.setItem(STUDY_POSITION_KEY, JSON.stringify({zone:activeZone, page:currentPage, questionIndex:globalIndex})); }catch(e){}
    }, 120);
  }, {passive:true});
}

// ============================================================
// IndexedDB 持久化
// ============================================================
const IDB_NAME='qzdb', IDB_VER=1, IDB_STORE='kv';
let _db=null;

function idbOpen(){
  return new Promise(function(res,rej){
    const req=indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded=function(e){ const d=e.target.result; if(!d.objectStoreNames.contains(IDB_STORE)) d.createObjectStore(IDB_STORE); };
    req.onsuccess=function(e){ _db=e.target.result; res(_db); };
    req.onerror=function(e){ rej(e.target.error); };
  });
}

function idbGet(key){
  return new Promise(function(res){
    if(!_db){ return res(null); }
    try{
      const tx=_db.transaction(IDB_STORE,'readonly');
      const r=tx.objectStore(IDB_STORE).get(key);
      r.onsuccess=function(){ res(r.result===undefined?null:r.result); };
      r.onerror=function(){ res(null); };
    }catch(e){ res(null); }
  });
}

function idbSet(key,val){
  if(!_db){ return Promise.resolve(false); }
  return new Promise(function(res){
    try{
      const tx=_db.transaction(IDB_STORE,'readwrite');
      tx.objectStore(IDB_STORE).put(val,key);
      tx.oncomplete=function(){ res(true); };
      tx.onerror=function(){ res(false); };
    }catch(e){ res(false); }
  });
}

function idbDel(key){
  if(!_db){ return Promise.resolve(false); }
  return new Promise(function(res){
    try{
      const tx=_db.transaction(IDB_STORE,'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete=function(){ res(true); };
      tx.onerror=function(){ res(false); };
    }catch(e){ res(false); }
  });
}

async function loadAll(){
  const idx=await idbGet('idx');
  if(idx) index=idx;
  ['gk','mk','sy'].forEach(function(z){ if(!Array.isArray(index[z])) index[z]=[]; });
  db={gk:{},mk:{},sy:{}};
  for(let zi=0; zi<3; zi++){
    const z=['gk','mk','sy'][zi];
    for(let mi=0; mi<index[z].length; mi++){
      const m=index[z][mi];
      const f=await idbGet('file:'+z+':'+m.id);
      if(f) db[z][m.id]=f;
    }
  }
}

function saveIndex(){ return idbSet('idx', index); }
function saveFile(z,id){ return idbSet('file:'+z+':'+id, db[z][id]); }
function saveView(){ return idbSet('view', {activeZone, activeFile, filterState}); }

async function loadView(){
  const v=await idbGet('view');
  if(v){ if(v.activeZone) activeZone=v.activeZone; if(v.activeFile) activeFile=v.activeFile; if(v.filterState) filterState=Object.assign(filterState, v.filterState); }
}

async function loadWrong(){ const r=await idbGet('wrong'); if(r) wrongSet=r; ['gk','mk','sy'].forEach(function(z){ if(!wrongSet[z]||typeof wrongSet[z]!=='object') wrongSet[z]={}; }); }
function saveWrong(){ return idbSet('wrong', wrongSet); }

async function loadFav(){ const r=await idbGet('fav'); if(r) favorites=r; ['gk','mk','sy'].forEach(function(z){ if(!favorites[z]||typeof favorites[z]!=='object') favorites[z]={}; }); }
function saveFav(){ return idbSet('fav', favorites); }

function isFavorite(key){ return !!(favorites[activeZone]&&favorites[activeZone][key]); }
function toggleFavorite(key){ if(!favorites[activeZone]) favorites[activeZone]={}; if(favorites[activeZone][key]) delete favorites[activeZone][key]; else favorites[activeZone][key]=true; saveFav(); renderQuestions(); }

function unmarkWrong(key){ if(wrongSet[activeZone]&&wrongSet[activeZone][key]){ delete wrongSet[activeZone][key]; saveWrong(); renderQuestions(); } }
function viewWrongSet(){ filterState.status='wrong'; currentPage=1; saveView(); renderAll(); }
function wrongCount(){ return Object.keys(wrongSet[activeZone]||{}).length; }

function todayStr(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

async function loadDaily(){ const r=await idbGet('daily'); if(r) daily=r; if(!daily||typeof daily!=='object') daily={date:'',count:0,goal:50}; if(daily.date!==todayStr()){ daily.date=todayStr(); daily.count=0; saveDaily(); } if(!daily.goal||daily.goal<1) daily.goal=50; }
function saveDaily(){ return idbSet('daily', daily); }

function incDaily(){ if(daily.date!==todayStr()){ daily.date=todayStr(); daily.count=0; } daily.count++; saveDaily(); renderProgressPanel(); }

function setDailyGoal(v){ v=parseInt(v); if(isNaN(v)||v<1) v=50; if(v>9999) v=9999; daily.goal=v; saveDaily(); renderProgressPanel(); }

async function loadExam(){ examDate=(await idbGet('exam'))||''; }
function saveExam(){ return idbSet('exam', examDate); }
function setExamDate(v){ examDate=v||''; saveExam(); renderProgressPanel(); }
function clearExamDate(){ examDate=''; saveExam(); const inp=document.getElementById('examDateInput'); if(inp) inp.value=''; renderProgressPanel(); }

async function migrateFromLocalStorage(){
  try{
    const idxInIdb=await idbGet('idx');
    if(idxInIdb) return;
    const oldIdxRaw=localStorage.getItem(IDX_KEY);
    if(!oldIdxRaw) return;
    const oldIndex=JSON.parse(oldIdxRaw);
    if(oldIndex && Array.isArray(oldIndex.gk) && Array.isArray(oldIndex.mk) && Array.isArray(oldIndex.sy)){
      index=oldIndex;
      ['gk','mk','sy'].forEach(function(z){ if(!Array.isArray(index[z])) index[z]=[]; });
      await saveIndex();
      for(let zi=0; zi<3; zi++){
        const z=['gk','mk','sy'][zi];
        for(let mi=0; mi<index[z].length; mi++){
          const m=index[z][mi];
          const f=localStorage.getItem('qz_file_'+z+'_'+m.id);
          if(f){ try{ db[z][m.id]=JSON.parse(f); await saveFile(z,m.id); }catch(e){} }
        }
      }
      const ov=localStorage.getItem(VIEW_KEY); if(ov){ try{ const v=JSON.parse(ov); if(v.activeZone) activeZone=v.activeZone; if(v.activeFile) activeFile=v.activeFile; if(v.filterState) filterState=Object.assign(filterState, v.filterState); await saveView(); }catch(e){} }
      const ow=localStorage.getItem(WRONG_KEY); if(ow){ try{ wrongSet=JSON.parse(ow); ['gk','mk','sy'].forEach(function(z){ if(!wrongSet[z]) wrongSet[z]={}; }); await saveWrong(); }catch(e){} }
      const ofav=localStorage.getItem(FAV_KEY); if(ofav){ try{ favorites=JSON.parse(ofav); ['gk','mk','sy'].forEach(function(z){ if(!favorites[z]) favorites[z]={}; }); await saveFav(); }catch(e){} }
      const od=localStorage.getItem(DAILY_KEY); if(od){ try{ daily=JSON.parse(od); await saveDaily(); }catch(e){} }
      const oe=localStorage.getItem(EXAM_KEY); if(oe){ examDate=oe; await saveExam(); }
      console.log('[迁移] localStorage 数据已迁移到 IndexedDB');
    }
  }catch(e){ console.log('[迁移] 失败（非致命）:', e && e.message); }
}

function daysUntilExam(){ if(!examDate) return null; const t=new Date(examDate+'T00:00:00'); if(isNaN(t.getTime())) return null; const now=new Date(); now.setHours(0,0,0,0); return Math.round((t.getTime()-now.getTime())/86400000); }

function renderProgressPanel(){
  const dc=document.getElementById('dailyCount'); if(dc) dc.textContent=daily.count;
  const dg=document.getElementById('dailyGoal'); if(dg) dg.textContent=daily.goal;
  const dgi=document.getElementById('dailyGoalInput'); if(dgi && String(dgi.value)!==String(daily.goal)) dgi.value=daily.goal;
  const ds=document.getElementById('dailyStatus');
  if(ds){ if(daily.goal>0 && daily.count>=daily.goal){ ds.innerHTML=' ✅ 目标完成'; ds.style.color='#10b981'; ds.style.fontWeight='bold'; } else { ds.innerHTML=' 还差 '+(daily.goal-daily.count)+' 题'; ds.style.color='var(--secondary)'; ds.style.fontWeight='normal'; } }
  const ec=document.getElementById('examCountdown');
  const edi=document.getElementById('examDateInput'); if(edi && examDate && edi.value!==examDate) edi.value=examDate;
  if(ec){ if(!examDate){ ec.textContent='未设置'; } else { const d=daysUntilExam(); if(d===null){ ec.textContent='日期无效'; } else if(d>0){ ec.textContent='距考试 '+d+' 天'; } else if(d===0){ ec.textContent='🎯 今天考试！'; } else { ec.textContent='已过 '+(-d)+' 天'; } } }
  const wc=document.getElementById('wrongCount'); if(wc) wc.textContent=wrongCount();
  const ppCard = document.querySelector('#progressPanel .pp-card');
  if (ppCard && !ppCard.querySelector('.daily-reset-btn')) {
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'daily-reset-btn';
    resetBtn.textContent = 'RESET';
    resetBtn.onclick = function(e) {
      e.stopPropagation();
      showConfirm('确定要重置今日刷题计数吗？', function() {
        daily.count = 0;
        daily.date = todayStr();
        saveDaily();
        renderProgressPanel();
      });
    };
    ppCard.appendChild(resetBtn);
  }
}

// ============================================================
// 自动识别
// ============================================================
function detectZone(name){
  const n=name.toLowerCase();
  if(/国考|省考|行测|xingce/.test(n)) return 'gk';
  if(/模考|模拟/.test(n)) return 'mk';
  if(/事业单位|职测|syzc/.test(n)) return 'sy';
  return '';
}

function detectModule(name, data){
  const n=name.toLowerCase();
  if(/常识|政治|法律|历史/.test(n)) return '常识判断';
  if(/言语|片段|逻辑填空/.test(n)) return '言语理解';
  if(/数量|数学|工程|行程|概率|排列/.test(n)) return '数量关系';
  if(/判断|逻辑|图形|定义|类比|推理/.test(n)) return '判断推理';
  if(/资料|统计|图表|增长率|比重/.test(n)) return '资料分析';
  let s=(data||[]).slice(0,10).map(q=>(q.content||'')).join(' ');
  if(s.includes('资料分析')||s.includes('同比增长')) return '资料分析';
  if(s.includes('言语理解')||s.includes('片段阅读')) return '言语理解';
  if(s.includes('数量关系')) return '数量关系';
  if(s.includes('判断推理')||s.includes('图形推理')) return '判断推理';
  if(s.includes('常识判断')) return '常识判断';
  return '其他';
}

function normalizeQuestions(data){
  if(Array.isArray(data)) return data;
  if(data && typeof data==='object'){
    if(Array.isArray(data.questions)) return data.questions;
    if(Array.isArray(data.categories)){
      const out=[];
      data.categories.forEach(cat=>{
        if(!cat) return;
        if(Array.isArray(cat.questions)) out.push(...cat.questions);
        else if(Array.isArray(cat.items)) out.push(...cat.items);
        else if(Array.isArray(cat)) out.push(...cat);
        else if(Array.isArray(cat.data)) out.push(...cat.data);
      });
      return out;
    }
    if(Array.isArray(data.subCategories)){
      const out=[];
      data.subCategories.forEach(sub=>{
        if(sub && Array.isArray(sub.questions)){
          sub.questions.forEach(q=>{ q.subType=sub.name; });
          out.push(...sub.questions);
        }
      });
      return out;
    }
  }
  return null;
}

// ============================================================
// 上传
// ============================================================
function handleFiles(fileListArr){
  const files=Array.from(fileListArr);
  files.forEach(file=>{
    if(file.size > MAX_FILE_BYTES){
      alert('文件「'+file.name+'」过大（'+(file.size/1048576).toFixed(1)+'MB），文件大小不能超过15MB，请拆分后上传。');
      return;
    }
    const reader=new FileReader();
    reader.onload=function(e){
      try{
        const raw=JSON.parse(e.target.result);
        if(raw && typeof raw==='object' && raw._type==='helium_quiz_backup'){
          importBackupFromObject(raw);
          return;
        }
        const questions=normalizeQuestions(raw);
        if(!questions || !Array.isArray(questions) || questions.length===0){
          alert('数据格式错误：无法识别的 JSON 结构（'+file.name+'）。\n\n支持的格式：\n· 含 questions 数组的对象：{ "questions": [...] }\n· 含 categories 数组的对象：{ "categories": [...] }\n· 纯题目数组：[ ... ]');
          return;
        }
        const mz=zoneSelect.value, mm=moduleSelect.value;
        let zone = mz==='auto' ? detectZone(file.name) : mz;
        if(!zone) zone = activeZone;
        let module = mm==='auto' ? detectModule(file.name, questions) : mm;
        if(!module) module = '常识判断';
        const id=genId();
        const exist=index[zone].find(x=>x.fileName===file.name);
        function addNew(){
          var fn = file.name;
          var name = fn.replace('.json', '').replace(/_\d+题$/, '');
          var parts = name.split('_');
          var cat = parts[0];
          var sub = parts.length > 1 ? parts.slice(1).join('_') : parts[0];
          questions.forEach(function(q) {
              if (!q.category) q.category = cat;
              if (!q.subType) q.subType = sub;
          });
          var moduleMap = {
              '言语理解与表达': '言语理解',
              '政治理论': '常识判断',
              '判断推理': '判断推理',
              '常识判断': '常识判断',
              '数量关系': '数量关系',
              '资料分析': '资料分析'
          };
          questions.forEach(function(q) {
              if (q.category && moduleMap[q.category]) {
                  q.category = moduleMap[q.category];
              }
          });
          questions.forEach(function(q) {
              if (!q._qid) {
                  q._qid = generateQuestionId(q);
              }
          });
          const obj={ id, fileName:file.name, zone, module, uploadTime:Date.now(), size:file.size, questions:questions, answered:{} };
          db[zone][id]=obj;
          index[zone].push({id, fileName:file.name, zone, module, uploadTime:obj.uploadTime, size:file.size, count:questions.length});
          saveIndex(); saveFile(zone,id);
          activeZone=zone; activeFile=id;
          filterState={module:'all',year:'all',province:'all',source:'all',subType:'all',leafType:'all',search:'',status:'all',sortBy:'default',minRatio:'',maxRatio:''};
          currentPage=1; saveView(); renderAll();setTimeout(function() {
    window.updateSubTypeFilter();
}, 500);
        }
        if(exist){
          const ef=exist;
          showConfirm('分区「'+zoneName(zone)+'」中已存在同名文件「'+file.name+'」，是否覆盖？', ()=>{
            delete db[zone][ef.id];
            index[zone]=index[zone].filter(x=>x.id!==ef.id);
            try{ idbDel('file:'+zone+':'+ef.id); }catch(e){}
            addNew();
          });
        } else {
          addNew();
        }
      }catch(err){ alert('解析失败: '+err.message); }
    };
    reader.readAsText(file);
  });
  fileInput.value='';
}

fileInput.addEventListener('change', e=> handleFiles(e.target.files));

function openFilePicker(){ try{ fileInput.value=''; fileInput.click(); }catch(err){} }

const uploadButton = document.getElementById('uploadButton');
if(uploadButton){
  uploadButton.addEventListener('click', function(e){
    e.preventDefault();
    e.stopPropagation();
    openFilePicker();
  });
}

uploadZone.addEventListener('click', e=>{
  const t=e.target;
  if(!t || t===fileInput || (t.tagName && t.tagName==='SELECT')) return;
  openFilePicker();
});

let dragDepth=0;
uploadZone.addEventListener('dragenter', e=>{ e.preventDefault(); dragDepth++; uploadZone.classList.add('drag'); });
uploadZone.addEventListener('dragover', e=>{ e.preventDefault(); });
uploadZone.addEventListener('dragleave', e=>{ dragDepth=Math.max(0,dragDepth-1); if(dragDepth===0) uploadZone.classList.remove('drag'); });
uploadZone.addEventListener('drop', e=>{ e.preventDefault(); dragDepth=0; uploadZone.classList.remove('drag'); if(e.dataTransfer && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });

function zoneName(z){ const zz=ZONES.find(x=>x.id===z); return zz?zz.name:z; }

// ============================================================
// 渲染总入口
// ============================================================
function renderAll(){
  renderZoneTabs();
  renderZoneStats();
  renderModuleBar();
  updateFilterOptions();
  if(window.updateSubTypeFilter) window.updateSubTypeFilter();
  applyFilterStateToUI();
  renderFileList();
  renderQuestions();
}

function renderZoneTabs(){
  zoneTabs.innerHTML = ZONES.map(z=>{
    const total=index[z.id].reduce((s,m)=>s+(m.count||0),0);
    return `<button class="zone-tab ${z.id===activeZone?'active':''}" data-zone="${z.id}" onclick="switchZone('${z.id}')">📂 ${z.name}<span class="z-count">${total} 题</span></button>`;
  }).join('');
}

function getQuestionCorrectRatio(q){
  if(!q) return 0;
  if(q.correctRatio!==undefined && q.correctRatio!==null && q.correctRatio!=='') return Number(q.correctRatio);
  if(q.questionMeta && q.questionMeta.correctRatio!==undefined && q.questionMeta.correctRatio!==null && q.questionMeta.correctRatio!=='') return Number(q.questionMeta.correctRatio);
  return 0;
}

function getZoneQuestions(zone, fileId){
  let arr=[];
  let files;
  if(fileId && fileId!=='__all__' && db[zone][fileId]) files=[db[zone][fileId]];
  else files=Object.values(db[zone]);
  files.forEach(f=>{
    if(!f) return;
    (f.questions||[]).forEach((q,qi)=>{
      const key='f'+f.id+'_q'+qi;
      arr.push({...q, correctRatio:getQuestionCorrectRatio(q), _fileId:f.id, _qi:qi, _key:key, _answered: (f.answered&&f.answered[key]!==undefined)?f.answered[key]:undefined});
    });
  });
  return arr;
}

function renderZoneStats(){
  const qs=getZoneQuestions(activeZone, '__all__');
  let total=qs.length, done=0, corr=0;
  qs.forEach(q=>{ const a=q._answered; if(a!==undefined){ done++; if(isAnsweredCorrect(q)) corr++; } });
  const acc=done?((corr/done)*100).toFixed(1):'0.0';
  document.getElementById('zoneTotal').textContent='📝 总 '+total+' 题';
  document.getElementById('zoneDone').textContent='✅ 已做 '+done+' 题';
  document.getElementById('zoneCorrect').textContent='🎯 正确 '+corr+' 题';
  document.getElementById('zoneAccuracy').textContent='📈 正确率 '+acc+'%';
  document.getElementById('zoneNameLabel').textContent=zoneName(activeZone);

  const fi=document.getElementById('fileInfo');
  if(activeFile && activeFile!=='__all__' && db[activeZone][activeFile]){
    const f=db[activeZone][activeFile];
    let fdone=0, fcorr=0;
    if(f.answered) for(const k in f.answered){ const a=f.answered[k]; if(a!==undefined&&a!==null){ fdone++; const qi=parseInt(String(k).split('_q')[1]); const q=f.questions[qi]; if(q){ if(typeof a==='string'){ if(getCorrectLetter(q)===a) fcorr++; } else { if(a) fcorr++; } } } }
    const facc=fdone? (fcorr/fdone*100).toFixed(1):'0.0';
    fi.style.display='block';
    fi.innerHTML='当前文件：<b>'+escapeHtml(f.fileName)+'</b> · '+zoneName(f.zone)+' · '+f.module+' · 共 <b>'+f.questions.length+'</b> 题 · 已做 <b>'+fdone+'</b> 题 · 正确率 <b>'+facc+'%</b>';
  } else if(activeFile==='__all__'){
    const n=(index[activeZone]||[]).length;
    fi.style.display='block';
    fi.innerHTML='当前显示：<b>本分区全部文件</b>（共 '+n+' 个文件合并）。点击上方标签可单独切换某个文件。';
  } else {
    fi.style.display='none';
  }
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function showConfirm(message, onYes){
  const overlay=document.getElementById('confirmOverlay');
  const msgEl=document.getElementById('confirmMsg');
  const yesBtn=document.getElementById('confirmYes');
  const noBtn=document.getElementById('confirmNo');
  if(!overlay||!yesBtn||!noBtn||!msgEl){
    if(typeof confirm==='function' && confirm(message)){ onYes&&onYes(); }
    return;
  }
  msgEl.textContent=message;
  overlay.classList.add('show');
  function cleanup(){ overlay.classList.remove('show'); yesBtn.onclick=null; noBtn.onclick=null; document.removeEventListener('keydown', onKey); }
  function onKey(e){ if(e.key==='Escape'){ cleanup(); } else if(e.key==='Enter'){ cleanup(); onYes&&onYes(); } }
  document.addEventListener('keydown', onKey);
  yesBtn.onclick=function(){ cleanup(); onYes&&onYes(); };
  noBtn.onclick=function(){ cleanup(); };
}

function showInlineConfirm(panel, message, onYes){
  if(!panel){ showConfirm(message, onYes); return; }
  const old=panel.querySelector('.inline-confirm-overlay');
  if(old) old.remove();
  const overlay=document.createElement('div');
  overlay.className='inline-confirm-overlay';
  const box=document.createElement('div');
  box.className='inline-confirm-box';
  const title=document.createElement('div');
  title.className='confirm-title'; title.textContent='⚠️ 确认清空';
  const msg=document.createElement('div');
  msg.className='confirm-message'; msg.textContent=message;
  const actions=document.createElement('div');
  actions.className='confirm-actions';
  const no=document.createElement('button');
  no.className='btn btn-outline'; no.type='button'; no.textContent='取消';
  const yes=document.createElement('button');
  yes.className='btn btn-danger'; yes.type='button'; yes.textContent='确定清除';
  actions.appendChild(no); actions.appendChild(yes);
  box.appendChild(title); box.appendChild(msg); box.appendChild(actions);
  overlay.appendChild(box); panel.appendChild(overlay);
  function cleanup(){ overlay.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(event){ if(event.key==='Escape'){ cleanup(); } else if(event.key==='Enter'){ cleanup(); onYes&&onYes(); } }
  no.onclick=cleanup;
  yes.onclick=function(){ cleanup(); onYes&&onYes(); };
  document.addEventListener('keydown', onKey);
}

function renderModuleBar(){
  const qs=getZoneQuestions(activeZone, '__all__');
  const counts={all: qs.length};
  qs.forEach(q=>{ 
    let m = getQuestionBigCategory(q);
    m = normalizeModuleName(m);
    if (!counts[m]) counts[m] = 0;
    counts[m]++; 
  });
  let html=`<button class="module-btn ${filterState.module==='all'?'active':''}" data-module="all">📂 全部<span class="count">${counts.all} 题</span></button>`;
  MODS.forEach(m=>{ html+=`<button class="module-btn ${filterState.module===m?'active':''}" data-module="${m}">${m}<span class="count">${counts[m] || 0} 题</span></button>`; });
  moduleBar.innerHTML=html;
  moduleBar.querySelectorAll('.module-btn').forEach(b=>{
    b.onclick=function(){
      moduleBar.querySelectorAll('.module-btn').forEach(x=>x.classList.remove('active'));
      this.classList.add('active');
      filterState.module=this.dataset.module;
      filterState.subType='all';
      filterState.leafType='all';
      currentPage=1; saveView();
      window.updateSubTypeFilter();
      renderQuestions();
    };
  });
}

window.updateSubTypeFilter=function(){
  const subTypeFilter=document.getElementById('subTypeFilter');
  if(!moduleFilter||!subTypeFilter||!leafTypeFilter) return;
  const questions=getZoneQuestions(activeZone,'__all__');
  const modules=new Set();
  questions.forEach(function(q){ if(q.bigCategory) modules.add(q.bigCategory); });

  if(filterState.module!=='all'&&!modules.has(filterState.module)){
    filterState.module='all';
    filterState.subType='all';
    filterState.leafType='all';
  }
  moduleFilter.innerHTML='<option value="all">📂 全部模块</option>';
  Array.from(modules).sort().forEach(function(module){
    const option=document.createElement('option');
    option.value=module;
    option.textContent=module;
    moduleFilter.appendChild(option);
  });
  moduleFilter.value=filterState.module;

  const moduleQuestions=filterState.module==='all'
    ? questions
    : questions.filter(function(q){ return q.bigCategory===filterState.module; });
  const subTypes=new Set();
  moduleQuestions.forEach(function(q){ if(q.subCategory) subTypes.add(q.subCategory); });
  if(filterState.subType!=='all'&&!subTypes.has(filterState.subType)){
    filterState.subType='all';
    filterState.leafType='all';
  }
  subTypeFilter.innerHTML='<option value="all">📋 全部题型</option>';
  Array.from(subTypes).sort().forEach(function(subType){
    const option=document.createElement('option');
    option.value=subType;
    option.textContent=subType;
    subTypeFilter.appendChild(option);
  });
  subTypeFilter.value=filterState.subType;

  const leafQuestions=filterState.subType==='all'
    ? moduleQuestions
    : moduleQuestions.filter(function(q){ return q.subCategory===filterState.subType; });
  const leafTypes=new Set();
  leafQuestions.forEach(function(q){ if(q.leafCategory) leafTypes.add(q.leafCategory); });
  if(filterState.leafType!=='all'&&!leafTypes.has(filterState.leafType)) filterState.leafType='all';
  leafTypeFilter.innerHTML='<option value="all">📋 全部细分题型</option>';
  Array.from(leafTypes).sort().forEach(function(leafType){
    const option=document.createElement('option');
    option.value=leafType;
    option.textContent=leafType;
    leafTypeFilter.appendChild(option);
  });
  leafTypeFilter.value=filterState.leafType;

  moduleFilter.onchange=function(){
    filterState.module=this.value;
    filterState.subType='all';
    filterState.leafType='all';
    currentPage=1;
    saveView();
    renderAll();
  };
  subTypeFilter.onchange=function(){
    filterState.subType=this.value;
    filterState.leafType='all';
    currentPage=1;
    saveView();
    renderAll();
  };
  leafTypeFilter.onchange=function(){
    filterState.leafType=this.value;
    currentPage=1;
    saveView();
    renderQuestions();
  };
  saveView();
};

function initProvinceFilter(){
  if(!provinceFilter) return;
  const provinces=['国考','辽宁','北京','天津','河北','山西','内蒙古','吉林','黑龙江','上海','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆','深圳'];
  provinceFilter.innerHTML='<option value="all">📍 全部省份</option>'+provinces.map(function(province){
    return '<option value="'+province+'">'+province+'</option>';
  }).join('');
  provinceFilter.onchange=function(){
    filterState.province=this.value;
    if(this.value!=='all') activeFile='__all__';
    currentPage=1;
    saveView();
    renderSourceSuggestions(sourceFilter.value);
    renderQuestions();
  };
}

function updateFilterOptions(){
  const years=new Set(), sources=new Set();
  getZoneQuestions(activeZone, '__all__').forEach(q=>{
    const src=q.source||'';
    if(src){ sources.add(src); const ym=src.match(/(\d{4})年/); if(ym) years.add(ym[1]); }
  });
  yearFilter.innerHTML='<option value="all">📅 全部年份</option>'+[...years].sort(function(a,b){return b-a;}).map(y=>`<option value="${y}">${y}年</option>`).join('');
  sourceValues=[...sources].sort();
  renderSourceSuggestions();
}

function sourceMatchesProvince(source, province){
  if(!province || province==='all') return true;
  if(province==='国考') return /国考|副省|地市/.test(source);
  if(province==='新疆') return /新疆区考|（新疆/.test(source);
  if(province==='江苏') return /（江苏/.test(source);
  if(province==='深圳') return /（深圳/.test(source);
  return source.includes(province);
}

function renderSourceSuggestions(query){
  if(!sourceOptions) return;
  const keyword=String(query||'').trim().toLowerCase();
  const matches=sourceValues.filter(function(source){
    return sourceMatchesProvince(source, sourceProvince) && (!keyword || source.toLowerCase().includes(keyword));
  }).slice(0,200);
  sourceOptions.innerHTML=matches.map(function(source){ return '<option value="'+escapeHtml(source)+'"></option>'; }).join('');
}

function setSelectValue(sel, val){ if([...sel.options].some(o=>o.value===val)) sel.value=val; else sel.value='all'; }

function applyFilterStateToUI(){
  setSelectValue(yearFilter, filterState.year);
  if(provinceFilter) setSelectValue(provinceFilter, filterState.province);
  sourceFilter.value=filterState.source==='all'?'':filterState.source;
  setSelectValue(statusFilter, filterState.status);
  setSelectValue(sortFilter, filterState.sortBy);
  searchBox.value=filterState.search;
  minRatioInput.value=filterState.minRatio;
  maxRatioInput.value=filterState.maxRatio;
  filterState.year=yearFilter.value; if(provinceFilter) filterState.province=provinceFilter.value; filterState.source=sourceFilter.value;
  filterState.status=statusFilter.value; filterState.sortBy=sortFilter.value;
  filterState.search=searchBox.value; filterState.minRatio=minRatioInput.value; filterState.maxRatio=maxRatioInput.value;
}

function renderFileList(){
  const list=index[activeZone]||[];
  updateFileToggle();
  if(!list.length){ fileListContainer.classList.remove('show'); return; }
  fileListContainer.classList.toggle('show', fileListExpanded);
  const tabAttrs=(id, extra='')=>{
    const active=activeFile===id?' active':'';
    return `class="file-tab${active}" data-file="${id}" role="button" tabindex="0"${extra}`;
  };
  let html=`<div ${tabAttrs('__all__')}>
    <span>📂 全部文件（${list.length}）</span>
    <span class="ft-count">本分区合并视图</span>
  </div>`;
  html+=list.map(m=>{
    const f=db[activeZone][m.id];
    let done=0; if(f&&f.answered) for(const k in f.answered) if(f.answered[k]!==undefined) done++;
    return `<div ${tabAttrs(m.id, ` title="${escapeHtml(m.fileName)}"`)}>
      <span>📄 ${escapeHtml(m.fileName)}</span>
      <span class="ft-count">${m.module} · ${m.count}题 · 已做 ${done}</span>
      <button class="ft-del" type="button" onclick="event.stopPropagation(); event.preventDefault(); removeFile('${m.id}')" title="删除文件">✕</button>
    </div>`;
  }).join('');
  fileTabs.innerHTML=html;
}

let tabJustTouched=false;
function bindFileTabSwitch(){
  if(!fileTabs) return;
  if(fileTabs.__bound) return;
  fileTabs.__bound=true;
  function pick(e){
    const tab=e.target.closest('.file-tab');
    if(!tab) return null;
    if(e.target.closest('.ft-del')) return null;
    return tab.dataset.file;
  }
  let tsX=0, tsY=0;
  fileTabs.addEventListener('touchstart', function(e){
    const t=e.changedTouches && e.changedTouches[0]; if(t){ tsX=t.clientX; tsY=t.clientY; }
  }, {passive:true});
  fileTabs.addEventListener('touchend', function(e){
    const t=e.changedTouches && e.changedTouches[0];
    if(t && (Math.abs(t.clientX-tsX)>10 || Math.abs(t.clientY-tsY)>10)) return;
    const id=pick(e); if(id===null) return;
    tabJustTouched=true;
    setTimeout(function(){ tabJustTouched=false; }, 450);
    try{ e.preventDefault(); }catch(err){}
    switchFile(id);
  }, {passive:false});
  fileTabs.addEventListener('click', function(e){
    if(tabJustTouched) return;
    const id=pick(e); if(id!==null) switchFile(id);
  });
  fileTabs.addEventListener('keydown', function(e){
    if(e.key!=='Enter' && e.key!==' ') return;
    const tab=e.target.closest('.file-tab');
    if(!tab || e.target.closest('.ft-del')) return;
    e.preventDefault();
    switchFile(tab.dataset.file);
  });
}

// ============================================================
// 筛选 + 排序
// ============================================================
function testProvince(source){
  source=String(source||'');
  if(/国家公务员|国家公考|国考/.test(source)) return '国考';
  const provinces=['内蒙古','黑龙江','广西','宁夏','新疆','西藏','北京','天津','河北','山西','辽宁','吉林','上海','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','海南','重庆','四川','贵州','云南','陕西','甘肃','青海','深圳'];
  for(let i=0;i<provinces.length;i++){
    const name=provinces[i];
    if(source.includes(name)) return name;
  }
  return '';
}

function getQuestionSubType(q){
  if(!q) return '';
  return q.leafCategory || q.subType || q.subCategory || q.type || q.questionType || '';
}

function getQuestionBigCategory(q){
  if(!q) return '';
  const file=db[activeZone]&&db[activeZone][q._fileId];
  return q.bigCategory || q.category || q.module || (file&&file.module) || '';
}

function normalizeModuleName(value){
  return value==='言语理解' ? '言语理解与表达' : value;
}

function matchModule(q, selectedModule){
  if(!selectedModule || selectedModule==='all') return true;
  const value=normalizeModuleName(String(getQuestionBigCategory(q)));
  const selected=normalizeModuleName(String(selectedModule));
  return value===selected;
}

function getFiltered(){
  let qs=getZoneQuestions(activeZone, '__all__');
  const kw=(filterState.search||'').toLowerCase().trim();

  if(filterState.module!=='all')
    qs=qs.filter(q=>q.bigCategory===filterState.module);
  if(filterState.subType!=='all')
    qs=qs.filter(q=>q.subCategory===filterState.subType);
  if(filterState.leafType!=='all')
    qs=qs.filter(q=>q.leafCategory===filterState.leafType);

  if(kw)
    qs=qs.filter(q=>(q.content||'').toLowerCase().includes(kw));

  if(filterState.year!=='all'){
    qs=qs.filter(q=>(q.source||'').includes(filterState.year+'年'));
  }

  if(filterState.province && filterState.province!=='all'){
    qs=qs.filter(q=>testProvince(q.source||'')===filterState.province);
  }

  if(filterState.source && filterState.source!=='all'){
    qs=qs.filter(q=>(q.source||'')===filterState.source);
  }

  const st=filterState.status;
  if(st!=='all'){
    qs=qs.filter(q=>{ const ic=isAnsweredCorrect(q);      
      if(st==='unanswered') return ic===null;
      if(st==='answered')   return ic!==null;
      if(st==='wrong')      return ic===false;
      if(st==='correct')    return ic===true;
      if(st==='favorite')   return isFavorite(q._key);
      return true; });
  }
  let min=filterState.minRatio===''?0:parseFloat(filterState.minRatio);
  let max=filterState.maxRatio===''?100:parseFloat(filterState.maxRatio);
  if(isNaN(min)) min=0; if(isNaN(max)) max=100;
  if(min>max){ const t=min; min=max; max=t; }
  if(min>0||max<100) qs=qs.filter(q=>{ const r=Number(q.correctRatio||0); return r>=min&&r<=max; });
  if(filterState.sortBy==='ratioDesc') qs.sort((a,b)=>Number(b.correctRatio||0)-Number(a.correctRatio||0));
  else if(filterState.sortBy==='ratioAsc') qs.sort((a,b)=>Number(a.correctRatio||0)-Number(b.correctRatio||0));
  return qs;
}

function getOptions(item){
  if(item.accessories&&item.accessories.length) for(const a of item.accessories) if(a.options&&a.options.length) return a.options;
  return item.options||[];
}

function getCorrectLetter(item){
  const opts=getOptions(item), ltrs=['A','B','C','D','E','F'];
  let c=item.correctAnswer;
  if(c===undefined||c===null||c==='') c=item.answer;
  if(c===undefined||c===null||c==='') c=item.correct;
  if(c===undefined||c===null||c==='') c=item.rightAnswer;
  if(c===undefined||c===null||c==='') c=item.key;
  if(c===undefined||c===null||c===''){
    for(let i=0;i<opts.length;i++){ const o=opts[i]; if(o&&(o.isCorrect===true||o.correct===true)) return ltrs[i]; }
    const sol=item.solution||'';
    if(sol){
      const pats=[
        /正确答案[^\n]{0,6}?([A-F])(?![A-F])/,
        /故选\s*([A-F])(?![A-F])/,
        /[应因]此选\s*([A-F])(?![A-F])/,
        /本题选?\s*([A-F])(?![A-F])/,
        /当选\s*([A-F])(?![A-F])/,
        /答案[为是为：:、\s]{1,3}([A-F])(?![A-F])/
      ];
      for(const p of pats){ const mm=sol.match(p); if(mm) return mm[1].toUpperCase(); }
    }
    return '';
  }
  const normStr=(v)=>{ if(typeof v!=='string') return null; v=v.trim();
    if(/^[A-F]$/i.test(v)) return v.toUpperCase();
    const m=v.match(/[A-F]/i); return m? m[0].toUpperCase(): null; };
  let r=normStr(c); if(r) return r;
  if(typeof c==='number' && c>=0 && c<opts.length) return ltrs[c];
  if(typeof c==='object'){
    if(Array.isArray(c)&&c.length){ const rr=normStr(c[0]); if(rr) return rr; }
    if(c.choice!==undefined){
      const v=c.choice;
      const rr=normStr(v); if(rr) return rr;
      if(typeof v==='number'&&v>=0&&v<opts.length) return ltrs[v];
      if(typeof v==='string'&&!isNaN(parseInt(v))){ const i=parseInt(v); if(i>=0&&i<opts.length) return ltrs[i]; }
    }
  }
  return '';
}

function isAnsweredCorrect(item){
  const a=item._answered;
  if(a===undefined||a===null) return null;
  if(typeof a==='string') return getCorrectLetter(item)===a;
  return !!a;
}

function selectedLetter(item){ const a=item._answered; return (typeof a==='string')?a:''; }

function revokeBlobUrls(){
  for(let i=0;i<blobUrls.length;i++){ try{ URL.revokeObjectURL(blobUrls[i]); }catch(e){} }
  blobUrls = [];
}

function forceJpegUrl(src){
  if(!src) return src;
  if(src.indexOf('blob:')===0 || src.indexOf('data:')===0) return src;
  if(/[?&]format=/.test(src)) return src;
  return src + (src.indexOf('?')>=0 ? '&' : '?') + 'format=jpg';
}

function normalizeImgUrl(src){
  if(!src) return src;
  if(src.indexOf('blob:')===0 || src.indexOf('data:')===0) return src;
  if(src.indexOf('file://')===0){
    let rest=src.slice(7);
    if(rest.indexOf('/')===0) rest=rest.slice(1);
    return 'https://'+rest;
  }
  if(src.indexOf('//')===0) return 'https:'+src;
  return src;
}

function fixProtocols(s){
  if(!s) return s;
  return s.replace(/src=["']file:\/\/+\/?([^"']*)["']/g, 'src="https://$1"')
          .replace(/src=["']\/\/([^"']*)["']/g, 'src="https://$1"');
}

function fixImg(im){
  if(!im || im.__imgFixed) return;
  let s=im.getAttribute('src');
  if(!s) return;
  im.__imgFixed=true;
  s=normalizeImgUrl(s);
  if(!im.dataset.origSrc) im.dataset.origSrc=s;
  im.src=forceJpegUrl(s);
  if(!window.__noImageHack){
    im.onerror=function(){ tryProxyImage(im, im.dataset.origSrc, 0); };
    im.onload =function(){ if(im.naturalWidth===0) tryProxyImage(im, im.dataset.origSrc, 0); };
  }
}

let _imgObserver=null;
function setupImgObserver(){
  if(_imgObserver || !window.MutationObserver || !content) return;
  _imgObserver=new MutationObserver(function(muts){
    muts.forEach(function(mu){
      mu.addedNodes.forEach(function(node){
        if(node.nodeType!==1) return;
        if(node.tagName==='IMG') fixImg(node);
        else if(node.querySelectorAll){ node.querySelectorAll('img').forEach(fixImg); }
      });
    });
  });
  _imgObserver.observe(content, {childList:true, subtree:true});
}

const IMG_PROXIES = [
  (u) => 'https://images.weserv.nl/?url=' + encodeURIComponent('ssl:' + u.replace(/^https?:\/\//, '')) + '&output=jpg',
  (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u)
];

function proxyImageUrl(originalUrl, idx){
  idx = idx || 0;
  if(idx >= IMG_PROXIES.length) return originalUrl;
  return IMG_PROXIES[idx](originalUrl);
}

function tryProxyImage(img, originalSrc, idx){
  if(!img || !img.isConnected) return;
  if(img.dataset.proxied === 'done') return;
  idx = idx || 0;
  if(idx >= IMG_PROXIES.length){
    if(window.console) console.log('所有图片代理均失败（建议自备代理/中转）:', originalSrc);
    img.dataset.proxied = 'done';
    return;
  }
  const nextSrc = proxyImageUrl(originalSrc, idx);
  if(!nextSrc || nextSrc === img.src) return;
  img.dataset.proxyIdx = String(idx);
  img.onerror = function(){
    if(window.console) console.log('图片代理(' + (idx+1) + ')失败，尝试下一个:', originalSrc);
    tryProxyImage(img, originalSrc, idx + 1);
  };
  img.onload = function(){
    if(img.naturalWidth === 0){
      tryProxyImage(img, originalSrc, idx + 1);
    } else {
      img.dataset.proxied = 'done';
    }
  };
  img.src = nextSrc;
}

function renderQuestions(){
  revokeBlobUrls();
  filteredQuestions=getFiltered();
  const total=filteredQuestions.length;
  if(!total){
    content.innerHTML = (index[activeZone]&&index[activeZone].length) ? '<div style="text-align:center;padding:40px;color:var(--secondary);">🔍 没有匹配的题目</div>' : '<div style="text-align:center;padding:40px;color:var(--secondary);">📂 上传 JSON 文件开始刷题</div>';
    pageMeta.style.display='none'; pagination.style.display='none'; noResult.style.display='none';
    controls.style.display=(index[activeZone]&&index[activeZone].length)?'flex':'none';
    renderZoneStats();
    return;
  }
  controls.style.display='flex';
  const totalPages=Math.ceil(total/PAGE_SIZE);
  if(currentPage>totalPages) currentPage=totalPages;
  if(currentPage<1) currentPage=1;
  const start=(currentPage-1)*PAGE_SIZE, end=Math.min(start+PAGE_SIZE,total);
  let html=''; const optLtrs=['A','B','C','D','E','F'];
  for(let i=start;i<end;i++){
    const item=filteredQuestions[i], key=item._key;
    const hasAnswered=item._answered!==undefined;
    const isCorrect=isAnsweredCorrect(item)||false;
    const correctLetter=getCorrectLetter(item);
    const ratio=item.correctRatio||0;
    const source=item.source||'';
    const options=getOptions(item);
    const solution=item.solution||'';
    let badge='';
    if(ratio>0){
      if(ratio>=70) badge='<span style="background:#10b981;color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;margin-left:6px;">✅高</span>';
      else if(ratio>=40) badge='<span style="background:#f59e0b;color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;margin-left:6px;">⚠️中</span>';
      else badge='<span style="background:#ef4444;color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;margin-left:6px;">🔴低</span>';
    }
    const favStar = isFavorite(key) ? '⭐' : '☆';
    const contentHtml = fixProtocols(item.content||'');
    const solutionHtml = fixProtocols(solution);
    let materialHtml = '';
    if(item.material && item.material.content){ materialHtml = '<div class="q-material">'+fixProtocols(item.material.content)+'</div>'; }
    html+=`<div class="question visible" id="q-${key}"><div class="q-title">第 ${i+1} 题 📊 ${ratio.toFixed(2)}% ${badge} <span class="q-source">${source}</span> <span class="q-fav" onclick="event.stopPropagation();toggleFavorite('${key}')" title="收藏/取消收藏">${favStar}</span></div>`;
    if(materialHtml) html+=materialHtml;
    html+=`<div class="q-content">${contentHtml}</div>`;
    if(options&&options.length){
      html+='<div class="q-options">';
      options.forEach((opt,j)=>{
        const letter=optLtrs[j]||String.fromCharCode(65+j);
        const isCorr=letter===correctLetter;
        let cls='option';
        if(hasAnswered) cls+=' disabled';
        if(hasAnswered&&isCorr) cls+=' correct selected selected-correct';
        if(hasAnswered&&letter===selectedLetter(item)&&!isCorr) cls+=' wrong selected selected-wrong';
        html+=`<div class="${cls}" data-letter="${letter}" data-key="${key}" onclick="selectOption('${key}','${letter}')">${letter}. ${opt}</div>`;
      });
      html+='</div>';
    }
    if(hasAnswered){
      const inWrong = !!(wrongSet[activeZone]&&wrongSet[activeZone][key]);
      const unmarkBtn = inWrong ? ` <button type="button" class="q-unmark" onclick="event.stopPropagation();unmarkWrong('${key}')" title="从错题集移除">➖ 取消错题标记</button>` : '';
      const userAnswer=selectedLetter(item);
      html+=`<div class="q-verdict"><span class="q-answer show">${isCorrect?'✅ 回答正确':'✅ 正确答案：'+correctLetter}</span>${!isCorrect&&userAnswer?`<span class="q-user-answer">❌ 你的答案：${userAnswer}</span>`:''}${unmarkBtn}</div>`;
    } else {
      html+=`<div class="q-answer">✅ 正确答案: ${correctLetter}</div>`;
    }
    if(solutionHtml) html+=`<div class="q-solution${hasAnswered?' show':''}"><strong>💡 解析</strong><br>${solutionHtml}</div>`;
    if(solutionHtml) html+=`<button type="button" class="q-ai-btn" onclick="simplifySolution('${key}', this)">🤖 AI 简化解析</button><button type="button" class="q-chat-btn" onclick="toggleChat('${key}', this)">💬 AI 答疑</button><div class="q-ai-result" id="ai-${key}"></div><div class="q-chat-box" id="chat-${key}"></div>`;
    html+='</div>';
  }
  content.innerHTML=html;
  saveStudyPosition();
  restoreAIHistoryForVisibleQuestions();
  try{ content.querySelectorAll('img').forEach(fixImg); }catch(e){}
  bindImageDebug();
  pageMeta.style.display='block';
  pageMeta.textContent=`第 ${currentPage} / ${totalPages} 页 · 共 ${total} 题 · 每页 ${PAGE_SIZE} 题`;
  if(totalPages>1){
    let ph=`<button onclick="goPage(1)" ${currentPage===1?'disabled':''}>首页</button><button onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>上一页</button>`;
    for(let p=Math.max(1,currentPage-4); p<=Math.min(totalPages,currentPage+4); p++) ph+=`<button onclick="goPage(${p})" class="${p===currentPage?'active':''}">${p}</button>`;
    ph+=`<button onclick="goPage(${currentPage+1})" ${currentPage===totalPages?'disabled':''}>下一页</button><button onclick="goPage(${totalPages})" ${currentPage===totalPages?'disabled':''}>末页</button>`;
    pagination.innerHTML=ph; pagination.style.display='flex';
  } else { pagination.style.display='none'; }
  renderZoneStats();
}

function selectOption(key, letter){
  const item=filteredQuestions.find(q=>q._key===key);
  if(!item || item._answered!==undefined) return;
  const f=db[activeZone][item._fileId];
  if(f){ if(!f.answered) f.answered={}; f.answered[key]=letter; saveFile(activeZone, item._fileId); }
  if(!wrongSet[activeZone]) wrongSet[activeZone]={};
  const correct = (function(){ try{ return getCorrectLetter(item)===letter; }catch(e){ return false; } })();
  if(!correct){ wrongSet[activeZone][key]=true; if(navigator.vibrate) navigator.vibrate(15); }
  else { delete wrongSet[activeZone][key]; }
  saveWrong();
  recordAnswerTiming();
  incDaily();
  renderQuestions();
}

function goPage(p){ const total=Math.ceil(filteredQuestions.length/PAGE_SIZE); if(p<1||p>total) return; currentPage=p; renderQuestions(); window.scrollTo(0,0); }

// ============================================================
// 文件管理
// ============================================================
function removeFile(id){
  showConfirm('确定移除该文件？此操作会删除该文件及其做题进度。', ()=>{
    if(activeFile===id) activeFile='__all__';
    delete db[activeZone][id];
    index[activeZone]=index[activeZone].filter(m=>m.id!==id);
    try{ idbDel('file:'+activeZone+':'+id); }catch(e){}
    saveIndex(); if(!index[activeZone].length){ searchBox.value=''; filterState.module='all'; filterState.subType='all'; filterState.leafType='all'; }
    renderAll();setTimeout(function() {
    var ft = document.querySelector('.file-tabs');
    if (ft) ft.innerHTML = '<div class="file-tab active" data-file="__all__"><span>📂 全部文件（' + index[activeZone].length + '）</span></div>';
}, 100);
  });
}

function clearAllFiles(){
  showConfirm('清空本分区「'+zoneName(activeZone)+'」的全部文件？此操作不可撤销。', ()=>{
    index[activeZone].forEach(function(m){ try{ idbDel('file:'+activeZone+':'+m.id); }catch(e){} });
    index[activeZone]=[]; db[activeZone]={}; activeFile='__all__';
    saveIndex(); searchBox.value=''; filterState.module='all'; filterState.subType='all'; filterState.leafType='all'; renderAll();setTimeout(function() {
    var ft = document.querySelector('.file-tabs');
    if (ft) ft.innerHTML = '<div class="file-tab active" data-file="__all__"><span>📂 全部文件（0）</span></div>';
}, 100);
  });
}

function resetProgress(){
  showConfirm('重置本分区所有做题进度？已作答记录将清空。', ()=>{
    Object.values(db[activeZone]).forEach(f=>{ f.answered={}; saveFile(activeZone, f.id); });
    timerData={answered:0,totalSec:0,startedAt:0,questionStart:0,pos:(timerData&&timerData.pos)||null};
    saveTimerData();
    renderTimerStats();
    renderAll();
  });
}

// ============================================================
// 筛选操作
// ============================================================
function clearFilters(){
  filterState.module='all'; filterState.year='all'; filterState.province='all'; filterState.source='all'; filterState.subType='all'; filterState.leafType='all'; filterState.search='';
  filterState.status='all'; filterState.sortBy='default'; filterState.minRatio=''; filterState.maxRatio='';
  yearFilter.value='all'; sourceFilter.value=''; searchBox.value='';
  statusFilter.value='all'; sortFilter.value='default';
  if(moduleFilter) moduleFilter.value='all';
  if(document.getElementById('subTypeFilter')) document.getElementById('subTypeFilter').value='all';
  if(leafTypeFilter) leafTypeFilter.value='all';
  minRatioInput.value=''; maxRatioInput.value='';
  currentPage=1; saveView(); renderAll();
}

function switchFile(id){
  activeFile = (id && id!=='__all__' && db[activeZone][id]) ? id : '__all__';
  filterState={module:'all',year:'all',province:'all',source:'all',subType:'all',leafType:'all',search:'',status:'all',sortBy:'default',minRatio:'',maxRatio:''};
  currentPage=1; saveView(); renderAll();
}

function switchZone(z){
  activeZone=z; activeFile='__all__'; filterState={module:'all',year:'all',province:'all',source:'all',subType:'all',leafType:'all',search:'',status:'all',sortBy:'default',minRatio:'',maxRatio:''};
  applyZoneTheme(z); currentPage=1; saveView(); renderAll();
  forceNormalizeZoneTabs();
}

function forceNormalizeZoneTabs(){
  document.querySelectorAll('.zone-tab').forEach(function(t){
    t.style.transform='none';
    t.style.transition='none';
  });
}

// ============================================================
// 导出
// ============================================================
function buildExportItem(q){
  return {
    module: db[activeZone][q._fileId]?db[activeZone][q._fileId].module:'',
    content: q.content||'',
    options: getOptions(q),
    correctAnswer: getCorrectLetter(q),
    solution: q.solution||'',
    source: q.source||'',
    correctRatio: q.correctRatio||0,
    status: q._answered!==undefined ? (isAnsweredCorrect(q)?'正确':'错误') : '未做'
  };
}

function findQuestionByKey(key){
  for (const zone of ['gk', 'mk', 'sy']) {
    const zoneData = db[zone] || {};
    for (const fileId of Object.keys(zoneData)) {
      const fileData = zoneData[fileId];
      if (!fileData || !Array.isArray(fileData.questions)) continue;
      for (let qi = 0; qi < fileData.questions.length; qi++) {
        const q = fileData.questions[qi];
        if (q && ('f' + fileId + '_q' + qi) === key) {
          if (!q._key) q._key = 'f' + fileId + '_q' + qi;
          return q;
        }
      }
    }
  }
  return null;
}

function buildQuestionInfoText(item){
  const q = item || {};
  const options = getOptions(q);
  let text = '============================================================\n📝 题目信息\n============================================================\n\n';
  text += '📌 题干：\n' + (q.content || '无题干') + '\n\n';
  text += '📋 选项：\n';
  if (options.length) {
    options.forEach(function(opt, idx){
      text += '  ' + String.fromCharCode(65 + idx) + '. ' + (opt || '') + '\n';
    });
  } else {
    text += '  无选项\n';
  }
  text += '\n✅ 正确答案：' + (getCorrectLetter(q) || '未知') + '\n';
  return text;
}

function buildChatExportText(messages, question){
  const safeMessages = Array.isArray(messages) ? messages.filter(Boolean) : [];
  const simplifyMessages = safeMessages.filter(function(msg){ return msg && msg.type === 'simplify'; });
  const chatMessages = safeMessages.filter(function(msg){ return !(msg && msg.type === 'simplify'); });
  let text = '';
  if (question) {
    text += buildQuestionInfoText(question);
    const aiSimplify = simplifyMessages.length ? simplifyMessages[simplifyMessages.length - 1].content : '';
    text += '\n🤖 AI 简化解析：\n' + (aiSimplify || '暂无 AI 简化解析') + '\n\n';
  }
  text += '------------------------------------------------------------\n💬 对话记录\n------------------------------------------------------------\n\n';
  if (!chatMessages.length && !simplifyMessages.length) {
    text += '暂无对话记录\n';
    return text;
  }
  let index = 1;
  chatMessages.forEach(function(msg){
    const role = msg.role === 'user' ? '🙋 用户' : '🤖 AI';
    text += role + ' (' + index + ')：\n' + (msg.content || '') + '\n\n';
    index++;
  });
  simplifyMessages.forEach(function(msg){
    text += '🤖 AI (' + index + ')：\n' + (msg.content || '') + '\n\n';
    index++;
  });
  return text + '============================================================\n导出时间：' + new Date().toLocaleString() + '\n============================================================\n';
}

function generateQuestionId(q){
  const content = ((q.content||'').slice(0, 100) + (q.question||'').slice(0, 100)).slice(0, 100);
  const options = getOptions(q);
  const optionsStr = JSON.stringify(options.slice(0, 4));
  const answer = getCorrectLetter(q);
  const str = JSON.stringify({
    c: content,
    o: optionsStr,
    a: answer
  });
  let hash = 0;
  for(let i = 0; i < str.length; i++){
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return 'q_' + Math.abs(hash).toString(36);
}

function buildExportName(tag){
  const parts=[tag||'', zoneName(activeZone)];
  if(filterState.module!=='all') parts.push(filterState.module);
  if(filterState.year!=='all') parts.push(filterState.year+'年');
  if(filterState.source!=='all') parts.push(filterState.source);
  const sm={unanswered:'未做',answered:'已做',wrong:'错题',correct:'做对'};
  if(filterState.status!=='all') parts.push(sm[filterState.status]);
  if(filterState.minRatio!==''||filterState.maxRatio!=='') parts.push('正确率'+(filterState.minRatio||0)+'-'+(filterState.maxRatio||100));
  if(filterState.sortBy!=='default') parts.push(filterState.sortBy==='ratioDesc'?'正确率降序':'正确率升序');
  if(filterState.search) parts.push('搜索_'+filterState.search);
  return parts.filter(Boolean).join('_')+'.json';
}

function downloadJSON(data, filename){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function exportFiltered(){
  if(!filteredQuestions.length){ alert('当前没有可导出的题目'); return; }
  downloadJSON(filteredQuestions.map(buildExportItem), buildExportName('筛选'));
}

function exportWrong(){
  const wrongs=[];
  getZoneQuestions(activeZone).forEach(q=>{ if(isAnsweredCorrect(q)===false) wrongs.push(buildExportItem(q)); });
  if(!wrongs.length){ alert('本分区暂无错题记录'); return; }
  downloadJSON(wrongs, buildExportName('错题本'));
}

async function exportBackup(){
  let totalAnswered = 0;
  const answeredByZone = {};
  const dataByZone = { gk: {}, mk: {}, sy: {} };
  
  ['gk', 'mk', 'sy'].forEach(zone => {
    answeredByZone[zone] = 0;
    Object.keys(db[zone] || {}).forEach(fileId => {
      const fileData = db[zone][fileId];
      if (!fileData || !fileData.questions) return;
      const answeredQuestions = [];
      fileData.questions.forEach((q, qi) => {
        const key = 'f' + fileId + '_q' + qi;
        const userAnswer = fileData.answered && fileData.answered[key];
        if (userAnswer !== undefined && userAnswer !== null) {
          answeredByZone[zone]++;
          totalAnswered++;
          if (!q._qid) {
            q._qid = generateQuestionId(q);
          }
          const isCorrect = getCorrectLetter(q) === userAnswer;
          answeredQuestions.push({
            qid: q._qid,
            answer: userAnswer,
            isCorrect: isCorrect,
            content: q.content || '',
            options: getOptions(q),
            correctAnswer: getCorrectLetter(q),
            bigCategory: q.category || '',
            subCategory: q.subType || '',
            leafCategory: q.leafType || ''
          });
        }
      });
      if (answeredQuestions.length > 0) {
        if (!dataByZone[zone]) dataByZone[zone] = {};
        dataByZone[zone][fileId] = {
          fileName: fileData.fileName || '未命名文件',
          module: fileData.module || '未分类',
          questions: answeredQuestions
        };
      }
    });
  });
  
  if (totalAnswered === 0) {
    alert('📭 当前没有做过任何题目，无需备份');
    return;
  }
  
  const wrongSetData = { gk: {}, mk: {}, sy: {} };
  const favoritesData = { gk: {}, mk: {}, sy: {} };
  const attemptsData = {};
  let chatHistory = {};
  
  try {
    chatHistory = await loadAllChats();
    Object.keys(chatHistory).forEach(key => {
      if (!chatHistory[key] || !Array.isArray(chatHistory[key]) || chatHistory[key].length === 0) {
        delete chatHistory[key];
      }
    });
  } catch (e) {
    console.warn('导出对话记录失败:', e);
    chatHistory = {};
  }
  
  ['gk', 'mk', 'sy'].forEach(zone => {
    const qidToKeys = {};
    Object.keys(db[zone] || {}).forEach(fileId => {
      const fileData = db[zone][fileId];
      if (!fileData || !fileData.questions) return;
      fileData.questions.forEach((q, qi) => {
        const key = 'f' + fileId + '_q' + qi;
        const userAnswer = fileData.answered && fileData.answered[key];
        if (userAnswer !== undefined && userAnswer !== null) {
          if (!q._qid) q._qid = generateQuestionId(q);
          qidToKeys[q._qid] = key;
        }
      });
    });
    if (wrongSet[zone]) {
      Object.keys(qidToKeys).forEach(qid => {
        const key = qidToKeys[qid];
        if (wrongSet[zone][key]) {
          wrongSetData[zone][qid] = true;
        }
      });
    }
    if (favorites[zone]) {
      Object.keys(qidToKeys).forEach(qid => {
        const key = qidToKeys[qid];
        if (favorites[zone][key]) {
          favoritesData[zone][qid] = true;
        }
      });
    }
  });
  
  try {
    const attemptKey = 'qz_question_attempts_v1';
    const attempts = JSON.parse(localStorage.getItem(attemptKey) || '{}');
    ['gk', 'mk', 'sy'].forEach(zone => {
      Object.keys(db[zone] || {}).forEach(fileId => {
        const fileData = db[zone][fileId];
        if (!fileData || !fileData.questions) return;
        fileData.questions.forEach((q, qi) => {
          const key = 'f' + fileId + '_q' + qi;
          const userAnswer = fileData.answered && fileData.answered[key];
          if (userAnswer !== undefined && userAnswer !== null) {
            if (!q._qid) q._qid = generateQuestionId(q);
            if (attempts[key]) {
              attemptsData[q._qid] = attempts[key];
            }
          }
        });
      });
    });
  } catch (e) {}
  
  const chatCount = Object.values(chatHistory).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  
  const backup = {
    _type: 'helium_quiz_backup_v2',
    version: 2,
    exportTime: new Date().toISOString(),
    totalAnswered: totalAnswered,
    data: dataByZone,
    wrongSet: wrongSetData,
    favorites: favoritesData,
    attempts: attemptsData,
    chatHistory: chatHistory,
    view: { activeZone, activeFile }
  };
  
  const backupStr = JSON.stringify(backup);
  const fileSize = Math.round(backupStr.length / 1024);
  const confirmMsg = `将导出 ${totalAnswered} 道做过的题目，含 ${chatCount} 条AI对话记录（约 ${fileSize} KB），确认继续？`;
  showConfirm(confirmMsg, () => {
    downloadJSON(backup, 'Helium题库_做题备份_' + new Date().toISOString().slice(0, 10) + '.json');
    alert(`✅ 备份导出成功！已导出 ${totalAnswered} 道题目的做题记录，含 ${chatCount} 条AI对话记录。`);
  });
}

function importBackup(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{ const data=JSON.parse(e.target.result); importBackupFromObject(data); }
    catch(err){ alert('导入失败：'+err.message); }
    input.value='';
  };
  reader.readAsText(file);
}

async function importBackupFromObject(data){
  if(!data || typeof data!=='object'){ alert('数据格式错误（需为题目数组或备份对象）'); return; }
  
  if(data._type === 'helium_quiz_backup_v2' && data.version === 2 && data.data){
    alert('检测到新版做题备份格式，正在恢复...');
    const qidMap = {};
    const keyMap = {};
    ['gk', 'mk', 'sy'].forEach(zone => {
      Object.keys(db[zone] || {}).forEach(fileId => {
        const fileData = db[zone][fileId];
        if (!fileData || !fileData.questions) return;
        fileData.questions.forEach((q, qi) => {
          if (!q._qid) q._qid = generateQuestionId(q);
          const qid = q._qid;
          const key = 'f' + fileId + '_q' + qi;
          qidMap[qid] = { zone, fileId, qi, key };
          keyMap[key] = { zone, fileId, qi, qid };
        });
      });
    });
    let matchedCount = 0, skippedCount = 0;
    const backupData = data.data || {};
    ['gk', 'mk', 'sy'].forEach(zone => {
      Object.keys(backupData[zone] || {}).forEach(fileId => {
        const fileBackup = backupData[zone][fileId];
        if (!fileBackup || !fileBackup.questions) return;
        fileBackup.questions.forEach(qBackup => {
          const qid = qBackup.qid;
          if (!qid) return;
          const match = qidMap[qid];
          if (match) {
            const currentFileData = db[match.zone][match.fileId];
            if (!currentFileData.answered) currentFileData.answered = {};
            currentFileData.answered[match.key] = qBackup.answer;
            matchedCount++;
          } else {
            skippedCount++;
          }
        });
      });
    });
    let wrongSetRestored = 0;
    if (data.wrongSet) {
      ['gk', 'mk', 'sy'].forEach(zone => {
        if (!wrongSet[zone]) wrongSet[zone] = {};
        Object.keys(data.wrongSet[zone] || {}).forEach(qid => {
          const match = qidMap[qid];
          if (match) {
            wrongSet[match.zone][match.key] = true;
            wrongSetRestored++;
          }
        });
      });
    }
    let favoritesRestored = 0;
    if (data.favorites) {
      ['gk', 'mk', 'sy'].forEach(zone => {
        if (!favorites[zone]) favorites[zone] = {};
        Object.keys(data.favorites[zone] || {}).forEach(qid => {
          const match = qidMap[qid];
          if (match) {
            favorites[match.zone][match.key] = true;
            favoritesRestored++;
          }
        });
      });
    }
    let attemptsRestored = 0;
    const attemptKey = 'qz_question_attempts_v1';
    try {
      const attempts = JSON.parse(localStorage.getItem(attemptKey) || '{}');
      if (data.attempts) {
        Object.keys(data.attempts).forEach(qid => {
          const match = qidMap[qid];
          if (match) {
            attempts[match.key] = data.attempts[qid];
            attemptsRestored++;
          }
        });
      }
      localStorage.setItem(attemptKey, JSON.stringify(attempts));
    } catch (e) {}
    let chatRestored = 0;
    if (data.chatHistory && typeof data.chatHistory === 'object') {
      try {
        const existingChats = await loadAllChats();
        const newChats = { ...existingChats };
        Object.keys(data.chatHistory).forEach(function(qid) {
          const match = qidMap[qid];
          if (!match) return;
          const key = match.key;
          const incoming = Array.isArray(data.chatHistory[qid]) ? data.chatHistory[qid] : [];
          if (!incoming.length) return;
          if (!newChats[key]) newChats[key] = [];
          incoming.forEach(function(msg) {
            if (!msg || typeof msg !== 'object') return;
            const exists = newChats[key].some(function(existing) {
              return existing && typeof existing === 'object' &&
                (existing.role || '') === (msg.role || '') &&
                String(existing.content || '') === String(msg.content || '') &&
                (existing.type || '') === (msg.type || '');
            });
            if (!exists) {
              newChats[key].push(msg);
              chatRestored++;
            }
          });
        });
        await idbSet(CHAT_DB_KEY, newChats);
      } catch (e) {
        console.warn('恢复对话记录失败:', e);
      }
    }
    ['gk', 'mk', 'sy'].forEach(z => {
      (index[z] || []).forEach(m => {
        saveFile(z, m.id);
      });
    });
    saveWrong();
    saveFav();
    const v = data.view || null;
    if (v && v.activeZone) {
      activeZone = v.activeZone;
      if (v.activeFile !== undefined) activeFile = v.activeFile;
    }
    applyZoneTheme(activeZone);
    currentPage = 1;
    saveView();
    renderAll();
    const resultMsg = `✅ 恢复完成！\n匹配成功 ${matchedCount} 题，跳过 ${skippedCount} 题（未找到对应题目）\n恢复错题集 ${wrongSetRestored} 题；恢复收藏 ${favoritesRestored} 题；恢复做题次数 ${attemptsRestored} 题；恢复AI对话 ${chatRestored} 条`;
    alert(resultMsg);
    return;
  }
  
  let newIndex={gk:[],mk:[],sy:[]};
  let newDb={gk:{},mk:{},sy:{}};
  let fromLabel='';
  
  if(data._type==='helium_quiz_backup' && data.index){
    alert('检测到旧版备份格式，正在导入...');
    fromLabel='备份对象';
    const zoneMap={'gk':'gk','mk':'mk','sy':'sy','国考省考':'gk','国考/省考':'gk','粉笔模考':'mk','事业单位':'sy'};
    Object.keys(data.index).forEach(zoneKey=>{
      const zone=zoneMap[zoneKey]||zoneKey;
      if(!newIndex[zone]){ newIndex[zone]=[]; newDb[zone]={}; }
      const files=Array.isArray(data.index[zoneKey])?data.index[zoneKey]:[];
      files.forEach(f=>{
        if(!f) return;
        const id=f.id||genId();
        const dbEntry=(data.db && data.db[zoneKey] && data.db[zoneKey][id]) || (data.db && data.db[zone] && data.db[zone][id]) || null;
        const questions= dbEntry ? (dbEntry.questions||[]) : (Array.isArray(f.questions)?f.questions:[]);
        const answered = dbEntry ? (dbEntry.answered||{}) : (f.answered&&typeof f.answered==='object'?f.answered:{});
        const fileName=f.fileName||'未命名文件';
        const moduleName=f.module||'未分类';
        const uploadTime=f.uploadTime||Date.now();
        const size=f.size||0;
        if (questions && Array.isArray(questions)) {
          questions.forEach(q => {
            if (!q._qid) q._qid = generateQuestionId(q);
          });
        }
        newIndex[zone].push({id, fileName, zone, module:moduleName, uploadTime, size, count:(questions.length||f.count||0)});
        newDb[zone][id]={id, fileName, zone, module:moduleName, uploadTime, size, questions, answered};
      });
    });
  } else if(Array.isArray(data)){
    fromLabel='数组格式';
    const zoneMap={'国考省考':'gk','国考/省考':'gk','粉笔模考':'mk','事业单位':'sy'};
    data.forEach(item=>{
      if(!item) return;
      const zone=zoneMap[item.partition]||'gk';
      const id=genId();
      const questions=Array.isArray(item.questions)?item.questions:[];
      const answered=(item.answered&&typeof item.answered==='object')?item.answered:{};
      const fileName=item.fileName||'未命名文件';
      const moduleName=item.module||'未分类';
      questions.forEach(q => {
        if (!q._qid) q._qid = generateQuestionId(q);
      });
      newIndex[zone].push({id, fileName, zone, module:moduleName, uploadTime:Date.now(), size:0, count:questions.length});
      newDb[zone][id]={id, fileName, zone, module:moduleName, uploadTime:Date.now(), size:0, questions, answered};
    });
  } else {
    alert('数据格式错误（需为题目数组或备份对象）'); return;
  }
  
  let totalQ=0, totalFiles=0;
  ['gk','mk','sy'].forEach(z=>{ Object.keys(newDb[z]).forEach(id=>{ totalFiles++; totalQ+=(newDb[z][id].questions.length||0); }); });
  if(!totalFiles){ alert('备份中没有可恢复的文件数据'); return; }
  showConfirm('导入「'+fromLabel+'」将覆盖当前所有分区的数据与做题进度，确定继续？', ()=>{
    index=newIndex; db=newDb;
    ['gk','mk','sy'].forEach(z=>{ if(!Array.isArray(index[z])) index[z]=[]; if(typeof db[z]!=='object'||!db[z]) db[z]={}; });
    ['gk','mk','sy'].forEach(z=>{ (index[z]||[]).forEach(m=>{ saveFile(z,m.id); }); });
    saveIndex();
    const v=data.view||null;
    if(v&&v.activeZone){ activeZone=v.activeZone; if(v.activeFile!==undefined) activeFile=v.activeFile; }
    applyZoneTheme(activeZone);
    currentPage=1; saveView(); renderAll();
    if(totalQ===0){
      alert('导入成功！但备份中未包含题目内容（可能为文件清单），请重新上传原始题目文件以恢复题目。');
    } else {
      alert('数据备份导入成功！共恢复 '+totalFiles+' 个文件、'+totalQ+' 道题。');
    }
  });
}

// ============================================================
// 事件绑定
// ============================================================
searchBox.addEventListener('input', ()=>{ filterState.search=searchBox.value; currentPage=1; saveView(); renderQuestions(); });
yearFilter.addEventListener('change', ()=>{ filterState.year=yearFilter.value; currentPage=1; saveView(); if(window.updateSubTypeFilter) window.updateSubTypeFilter(); renderQuestions(); });
sourceFilter.addEventListener('focus', ()=>{ renderSourceSuggestions(''); });
sourceFilter.addEventListener('pointerdown', ()=>{
  renderSourceSuggestions('');
});
sourceFilter.addEventListener('input', ()=>{
  renderSourceSuggestions(sourceFilter.value);
  if(!sourceFilter.value.trim() && filterState.source!=='all'){
    filterState.source='all';
    currentPage=1;
    saveView();
    renderQuestions();
  }
});
sourceFilter.addEventListener('keydown', (e)=>{
  if(e.key==='Escape'){
    sourceFilter.value='';
    filterState.source='all';
    currentPage=1;
    saveView();
    renderSourceSuggestions();
    renderQuestions();
    sourceFilter.blur();
  }
});
sourceFilter.addEventListener('change', ()=>{
  const value=sourceFilter.value.trim();
  if(value && sourceValues.includes(value) && sourceMatchesProvince(value, sourceProvince)) filterState.source=value;
  else { filterState.source='all'; sourceFilter.value=''; }
  currentPage=1; saveView(); renderQuestions();
});
statusFilter.addEventListener('change', ()=>{ filterState.status=statusFilter.value; currentPage=1; saveView(); renderQuestions(); });
sortFilter.addEventListener('change', ()=>{ filterState.sortBy=sortFilter.value; currentPage=1; saveView(); renderQuestions(); });

function onRatioInput(){
  let mn=minRatioInput.value.trim(), mx=maxRatioInput.value.trim();
  if(mn!==''&&!isNaN(parseFloat(mn))) mn=Math.max(0,Math.min(100,parseFloat(mn)));
  if(mx!==''&&!isNaN(parseFloat(mx))) mx=Math.max(0,Math.min(100,parseFloat(mx)));
  filterState.minRatio=(mn===''||isNaN(mn))?'':String(mn);
  filterState.maxRatio=(mx===''||isNaN(mx))?'':String(mx);
  currentPage=1; saveView(); renderQuestions();
}
minRatioInput.addEventListener('input', onRatioInput);
maxRatioInput.addEventListener('input', onRatioInput);

// ============================================================
// PC / 手机 模式切换
// ============================================================
const MODE_KEY = 'qz_mode';

function applyMode(mode){
  const m = mode==='mobile' ? 'mobile' : 'pc';
  document.body.classList.remove('pc-mode','mobile-mode','pc-touch');
  document.body.classList.add(m==='mobile'?'mobile-mode':'pc-mode');
  if(m==='pc'){
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints>0);
    if(isTouch) document.body.classList.add('pc-touch');
  }
  const btn=document.getElementById('modeToggle');
  if(btn) btn.textContent = (m==='mobile' ? '💻 切换到PC' : '📱 切换到手机');
}

function toggleMode(){
  const cur = document.body.classList.contains('mobile-mode') ? 'mobile' : 'pc';
  const next = cur==='mobile' ? 'pc' : 'mobile';
  try{ localStorage.setItem(MODE_KEY, next); }catch(e){}
  applyMode(next);
}

function initMode(){
  let m=null;
  try{ m=localStorage.getItem(MODE_KEY); }catch(e){}
  if(m!=='pc' && m!=='mobile'){ m = window.innerWidth>768 ? 'pc' : 'mobile'; }
  applyMode(m);
}

// ============================================================
// 字体缩放
// ============================================================
const FS_KEY = 'qz_fontsize';
const FS_MIN = 5, FS_MAX = 40, FS_DEFAULT = 16;

function getFs(){
  let v=FS_DEFAULT;
  try{ const s=localStorage.getItem(FS_KEY); if(s){ v=parseInt(s)||FS_DEFAULT; } }catch(e){}
  return Math.max(FS_MIN, Math.min(FS_MAX, v));
}

function applyFs(v){
  v=Math.max(FS_MIN, Math.min(FS_MAX, v));
  document.documentElement.style.setProperty('--fs', v+'px');
  try{ localStorage.setItem(FS_KEY, String(v)); }catch(e){}
}

function fontZoom(delta){
  applyFs(getFs()+delta);
}

// ============================================================
// 计时统计
// ============================================================
const TIMER_KEY='qz_timer_data';
let timerData={answered:0, totalSec:0, startedAt:0, questionStart:0};

function loadTimerData(){ try{const r=localStorage.getItem(TIMER_KEY); if(r) timerData=JSON.parse(r);}catch(e){} if(!timerData||typeof timerData!=='object') timerData={answered:0,totalSec:0,startedAt:0,questionStart:0}; }
function saveTimerData(){ try{localStorage.setItem(TIMER_KEY, JSON.stringify(timerData));}catch(e){} }

function fmtTime(sec){ sec=Math.max(0,Math.floor(sec)); if(sec<60) return sec+'秒'; const m=Math.floor(sec/60), s=sec%60; return m+'分'+(s>0?s+'秒':''); }

function recordAnswerTiming(){
  const now=Date.now();
  if(!timerData.startedAt) timerData.startedAt=now;
  if(timerData.questionStart){
    timerData.totalSec += Math.max(0, Math.round((now-timerData.questionStart)/1000));
  }
  timerData.questionStart=now;
  timerData.answered++;
  saveTimerData();
  renderTimerStats();
}

function renderTimerStats(){
  const ts=document.getElementById('timerStats'); if(!ts) return;
  const total=timerData.totalSec;
  const avg=timerData.answered?Math.round(total/timerData.answered):0;
  ts.innerHTML='📝 已答 '+timerData.answered+'<br>⏰ 总 '+fmtTime(total)+'<br>📊 均 '+fmtTime(avg);
  const sp=document.getElementById('totalTimeSpan'); if(sp) sp.textContent=fmtTime(total);
  ts.style.left='auto'; ts.style.right='20px'; ts.style.top='80px'; ts.style.bottom='auto';
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'timer-reset-btn';
  resetBtn.textContent = 'RESET';
  resetBtn.onclick = function(e) {
    e.stopPropagation();
    showConfirm('确定要重置计时统计吗？', function() {
      timerData = {
        answered: 0,
        totalSec: 0,
        startedAt: Date.now(),
        questionStart: 0,
        pos: (timerData && timerData.pos) || null
      };
      saveTimerData();
      renderTimerStats();
    });
  };
  ts.appendChild(resetBtn);
}

function setupTimerDrag(){
  const el=document.getElementById('timerStats'); if(!el || el.__dragBound) return;
  el.__dragBound=true;
  let dragging=false, sX=0, sY=0, oX=0, oY=0;
  el.addEventListener('pointerdown', function(e){
    dragging=true; sX=e.clientX; sY=e.clientY;
    const r=el.getBoundingClientRect(); oX=r.left; oY=r.top;
    try{ el.setPointerCapture(e.pointerId); }catch(err){}
    e.preventDefault();
  });
  el.addEventListener('pointermove', function(e){
    if(!dragging) return;
    let nx=oX+(e.clientX-sX), ny=oY+(e.clientY-sY);
    const w=el.offsetWidth, h=el.offsetHeight;
    nx=Math.max(0, Math.min(nx, window.innerWidth-w));
    ny=Math.max(0, Math.min(ny, window.innerHeight-h));
    el.style.left=nx+'px'; el.style.top=ny+'px'; el.style.right='auto'; el.style.bottom='auto';
  });
  function endDrag(){
    if(!dragging) return; dragging=false;
    const r=el.getBoundingClientRect();
    timerData.pos={x:r.left, y:r.top};
    saveTimerData();
  }
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
}

// ============================================================
// 长按排除选项
// ============================================================
let _pressTimer=null, _pressTarget=null;

function setupLongPressExclude(){
  if(!content || content.__lpBound) return;
  content.__lpBound=true;
  function startPress(e){
    const opt=e.target.closest && e.target.closest('.q-options .option');
    if(!opt) return;
    if(opt.classList.contains('disabled')) return;
    _pressTarget=opt;
    if(e.pointerType==='mouse'){
      opt.dataset._hadExcluded = opt.classList.contains('excluded') ? '1' : '0';
    }
    clearTimeout(_pressTimer);
    _pressTimer=setTimeout(function(){
      if(_pressTarget===opt){
        opt.classList.toggle('excluded');
        if(opt.classList.contains('excluded')) opt.dataset.excluded='1';
        else delete opt.dataset.excluded;
        if(navigator.vibrate) navigator.vibrate(10);
      }
    }, 500);
  }
  function cancelPress(){ clearTimeout(_pressTimer); _pressTarget=null; }
  content.addEventListener('pointerdown', startPress);
  content.addEventListener('pointerup', cancelPress);
  content.addEventListener('pointerleave', cancelPress);
  content.addEventListener('pointercancel', cancelPress);
  content.addEventListener('click', function(e){
    const opt=e.target.closest && e.target.closest('.q-options .option');
    if(!opt) return;
    if(opt.dataset.excluded==='1'){ e.preventDefault(); e.stopPropagation(); return; }
    if(opt.dataset._hadExcluded==='1'){
      e.preventDefault(); e.stopPropagation();
      delete opt.dataset._hadExcluded;
    }
  }, true);
}

// ============================================================
// 皮肤切换
// ============================================================
const SKIN_KEY='qz_skin_v4';
let currentSkin='default';

function loadSkin(){ try{ currentSkin=localStorage.getItem(SKIN_KEY)||'default'; }catch(e){} applySkin(currentSkin); }

function applySkin(skin){
  document.body.classList.remove('skin-dark','skin-eye','skin-warm','ink-mode');
  if(skin==='dark') document.body.classList.add('skin-dark');
  else if(skin==='eye') document.body.classList.add('skin-eye');
  else if(skin==='warm') document.body.classList.add('skin-warm');
  else if(skin==='ink') document.body.classList.add('ink-mode');
  currentSkin=skin;
  try{ localStorage.setItem(SKIN_KEY, skin); }catch(e){}
  document.querySelectorAll('.skin-opt').forEach(function(o){ o.classList.toggle('active', o.dataset.skin===skin); });
}

function toggleSkinPanel(){
  const p=document.getElementById('skinPanel');
  if(!p) return;
  const isVisible=p.style.display==='flex' || p.classList.contains('show');
  p.style.display=isVisible?'none':'flex';
  p.classList.toggle('show', !isVisible);
}
function selectSkin(s){
  applySkin(s);
  const panel=document.getElementById('skinPanel');
  if(panel){ panel.classList.remove('show'); panel.style.display='none'; }
}
function toggleInkMode(){
  if(document.body.classList.contains('ink-mode')) applySkin('default');
  else applySkin('ink');
}

document.addEventListener('click', function(event){
  if(event.target.closest('#skinPanel, #aiPanel, .side-nav-bottom .side-nav-item')) return;
  ['skinPanel','aiPanel'].forEach(function(id){
    const panel=document.getElementById(id);
    if(panel){ panel.classList.remove('show'); panel.style.display='none'; }
  });
});

// ============================================================
// 返回顶部按钮
// ============================================================
function setupBackToTop(){
  const btn=document.getElementById('backToTop'); if(!btn) return;
  window.addEventListener('scroll', function(){
    if(window.scrollY>300) btn.classList.add('visible');
    else btn.classList.remove('visible');
  }, {passive:true});
}

// ============================================================
// AI 简化解析
// ============================================================
const AI_KEY='qz_ai_config';
const AI_HISTORY_DB_NAME='aiChatHistoryDB';
const AI_HISTORY_STORE='chats';
let aiHistoryDb=null;
let aiConfig={provider:'', apiKey:'', model:''};
const AI_ENDPOINTS={
  deepseek:{url:'https://api.deepseek.com/chat/completions', model:'deepseek-chat'},
  qwen:{url:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model:'qwen-turbo'},
  zhipu:{url:'https://open.bigmodel.cn/api/paas/v4/chat/completions', model:'glm-4-flash'},
  openai:{url:'https://api.openai.com/v1/chat/completions', model:'gpt-4o-mini'}
};

function loadAIConfig(){
  try{ const r=localStorage.getItem(AI_KEY); if(r) aiConfig=JSON.parse(r); }catch(e){}
  if(!aiConfig||typeof aiConfig!=='object') aiConfig={provider:'',apiKey:'',model:''};
  const p=document.getElementById('aiProvider'); if(p && aiConfig.provider) p.value=aiConfig.provider;
  const k=document.getElementById('aiKey'); if(k) k.value=aiConfig.apiKey||'';
  const m=document.getElementById('aiModel'); if(m) m.value=aiConfig.model||'';
}

function saveAIConfig(){ try{ localStorage.setItem(AI_KEY, JSON.stringify(aiConfig)); }catch(e){} }

function formatAIResponse(text){ return String(text||'').replace(/。/g, '。\n'); }

function openAIHistoryDb(){
  if(aiHistoryDb) return Promise.resolve(aiHistoryDb);
  return new Promise(function(resolve,reject){
    const req=indexedDB.open(AI_HISTORY_DB_NAME, 1);
    req.onupgradeneeded=function(e){
      const d=e.target.result;
      if(!d.objectStoreNames.contains(AI_HISTORY_STORE)) d.createObjectStore(AI_HISTORY_STORE);
    };
    req.onsuccess=function(e){ aiHistoryDb=e.target.result; resolve(aiHistoryDb); };
    req.onerror=function(e){ reject(e.target.error); };
  });
}

function getAIHistory(key){
  return openAIHistoryDb().then(function(d){
    return new Promise(function(resolve){
      const req=d.transaction(AI_HISTORY_STORE,'readonly').objectStore(AI_HISTORY_STORE).get(key);
      req.onsuccess=function(){ resolve(Array.isArray(req.result)?req.result:[]); };
      req.onerror=function(){ resolve([]); };
    });
  }).catch(function(){ return []; });
}

function saveAIHistoryMessage(key, message){
  return getAIHistory(key).then(function(messages){
    messages.push(message);
    return openAIHistoryDb().then(function(d){
      return new Promise(function(resolve){
        const tx=d.transaction(AI_HISTORY_STORE,'readwrite');
        tx.objectStore(AI_HISTORY_STORE).put(messages, key);
        tx.oncomplete=function(){
          loadAllChats().then(function(allChats){
            const oldMessages=allChats[key]||[];
            oldMessages.push(message);
            saveChat(key, oldMessages);
          });
          resolve(true);
        };
        tx.onerror=function(){ resolve(false); };
      });
    });
  }).catch(function(){ return false; });
}

function restoreAIHistoryForVisibleQuestions(){
  filteredQuestions.forEach(function(item){
    const result=document.getElementById('ai-'+item._key);
    if(!result) return;
    getAIHistory(item._key).then(function(messages){
      const last=messages.slice().reverse().find(function(message){ return message.type==='simplify'; });
      if(last && result.isConnected){
        result.className='q-ai-result show';
        result.innerHTML='<strong>🤖 AI 简化解析</strong><br>'+escapeHtml(formatAIResponse(last.content)).replace(/\n/g,'<br>');
      }
    });
  });
}

function toggleAIPanel(){
  const p=document.getElementById('aiPanel');
  if(!p) return;
  const isVisible=p.style.display==='flex' || p.classList.contains('show');
  p.style.display=isVisible?'none':'flex';
  p.classList.toggle('show', !isVisible);
}

function saveAISettings(){
  aiConfig.provider=document.getElementById('aiProvider').value;
  aiConfig.apiKey=(document.getElementById('aiKey').value||'').trim();
  aiConfig.model=(document.getElementById('aiModel').value||'').trim();
  saveAIConfig();
  toggleAIPanel();
  alert('AI 配置已保存');
}

async function simplifySolution(key, btn){
  const item=filteredQuestions.find(function(q){ return q._key===key; });
  if(!item || !item.solution) return;
  const result=document.getElementById('ai-'+key); if(!result) return;
  if(!aiConfig.apiKey){ result.className='q-ai-result show'; result.innerHTML='<span class="q-ai-error">请先点左下角 ⚙️ 配置 API Key</span>'; return; }
  const ep=AI_ENDPOINTS[aiConfig.provider];
  if(!ep){ result.className='q-ai-result show'; result.innerHTML='<span class="q-ai-error">未知的 AI 服务商，请先配置</span>'; return; }
  btn.disabled=true;
  result.className='q-ai-result show';
  result.innerHTML='<span class="q-ai-loading">🤖 AI 正在简化解析...</span>';
  try{
    const resp=await fetch(ep.url, {
      method:'POST',
      headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+aiConfig.apiKey},
      body:JSON.stringify({
        model: aiConfig.model || ep.model,
        messages:[
          {role:'system', content:'你是公考辅导老师。请把下面的题目解析简化成通俗易懂的大白话，保留关键推理步骤，控制在200字内。'},
          {role:'user', content:'题目：'+(item.content||'').substring(0,500)+'\n\n原解析：'+(item.solution||'').substring(0,1000)}
        ],
        temperature:0.5, max_tokens:400
      })
    });
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    const data=await resp.json();
    const text=data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if(!text) throw new Error('返回格式异常');
    const formattedText=formatAIResponse(text);
    result.innerHTML='<strong>🤖 AI 简化解析</strong><br>'+escapeHtml(formattedText).replace(/\n/g,'<br>');
    saveAIHistoryMessage(key, {
      role:'assistant', type:'simplify', content:text,
      questionContent:item.content||'', questionOptions:getOptions(item), at:Date.now()
    });
  }catch(e){
    result.innerHTML='<span class="q-ai-error">❌ AI 调用失败：'+e.message+'（可能是 CORS/网络/API Key 无效）</span>';
  }finally{
    btn.disabled=false;
  }
}

// AI 答疑对话
const CHAT_DB_KEY = 'qz_ai_chats';

async function loadAllChats() {
  try {
    const r = await idbGet(CHAT_DB_KEY);
    return (r && typeof r === 'object') ? r : {};
  } catch(e) { return {}; }
}

async function saveChat(key, messages) {
  try {
    const allChats = await loadAllChats();
    allChats[key] = messages;
    await idbSet(CHAT_DB_KEY, allChats);
  } catch(e) { console.error('保存对话失败:', e); }
}

function renderChatBox(key, messages) {
  const box = document.getElementById('chat-' + key);
  if (!box) return;
  let html = '<div class="q-chat-messages" id="chat-msgs-' + key + '">';
  if (!messages.length) {
    html += '<div style="color:#94a3b8;text-align:center;padding:20px;">💡 直接问，精准答</div>';
  } else {
    messages.forEach(function(msg) {
      const cls = msg.role === 'user' ? 'q-chat-user' : 'q-chat-ai';
      const label = msg.role === 'user' ? '🙋' : '🤖';
      html += '<div class="q-chat-msg ' + cls + '">' + label + ' ' + msg.content.replace(/</g,'&lt;').replace(/\n/g,'<br>') + '</div>';
    });
  }
  html += '</div>';
  html += '<div class="q-chat-input">';
  html += '<textarea id="chat-input-' + key + '" placeholder="直接问，比如：为什么选B？" rows="2"></textarea>';
  html += '<button type="button" id="chat-send-' + key + '">发送</button>';
  html += '</div>';
  box.innerHTML = html;
  document.getElementById('chat-send-' + key).onclick = function() { sendChatMessage(key); };
  document.getElementById('chat-input-' + key).onkeydown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(key); }
  };
}

function toggleChat(key, btn) {
  const box = document.getElementById('chat-' + key);
  if (!box) return;
  if (box.classList.contains('show')) { box.classList.remove('show'); return; }
  box.classList.add('show');
  loadAllChats().then(function(allChats) {
    renderChatBox(key, allChats[key] || []);
  });
}

async function sendChatMessage(key) {
  const input = document.getElementById('chat-input-' + key);
  if (!input) return;
  const question = input.value.trim();
  if (!question) return;
  if (!aiConfig.apiKey) { alert('请先配置 API Key'); return; }
  const ep = AI_ENDPOINTS[aiConfig.provider];
  if (!ep) { alert('未知 AI 服务商'); return; }
  const item = filteredQuestions.find(function(q) { return q._key === key; });
  if (!item) return;
  input.value = '';
  const allChats = await loadAllChats();
  const messages = allChats[key] || [];
  messages.push({role: 'user', content: question});
  renderChatBox(key, messages);
  const aiMessages = [
    {role: 'system', content: '你是公考辅导老师。直接、简洁、精准回答，不重复题目，不说废话。回答100字以内。\n题目：' + (item.content || '').substring(0,200) + '\n答案：' + (item.correctAnswer || item.answer || '') + '\n解析：' + (item.solution || '').substring(0,300)}
  ];
  aiMessages.push(...messages.slice(-4));
  const sendBtn = document.getElementById('chat-send-' + key);
  if (sendBtn) sendBtn.disabled = true;
  const msgsDiv = document.getElementById('chat-msgs-' + key);
  if (msgsDiv) {
    msgsDiv.innerHTML += '<div class="q-chat-msg q-chat-ai" id="loading-' + key + '">🤖...</div>';
    msgsDiv.scrollTop = msgsDiv.scrollHeight;
  }
  try {
    const resp = await fetch(ep.url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + aiConfig.apiKey},
      body: JSON.stringify({
        model: aiConfig.model || ep.model,
        messages: aiMessages,
        temperature: 0.2,
        max_tokens: 200
      })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error('返回格式异常');
    const loadingEl = document.getElementById('loading-' + key);
    if (loadingEl) loadingEl.remove();
    messages.push({role: 'assistant', content: text});
    await saveChat(key, messages);
    renderChatBox(key, messages);
  } catch(e) {
    const loadingEl = document.getElementById('loading-' + key);
    if (loadingEl) loadingEl.remove();
    if (msgsDiv) msgsDiv.innerHTML += '<div class="q-chat-msg q-chat-ai">❌ ' + e.message + '</div>';
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function exportAllChats() {
  const allChats = await loadAllChats();
  const keys = Object.keys(allChats).filter(function(key){
    const messages = Array.isArray(allChats[key]) ? allChats[key] : [];
    return messages.length > 0;
  });
  if (!keys.length) { alert('暂无对话记录'); return; }
  let exportText = '============================================================\n📤 AI 对话记录导出\n============================================================\n\n';
  exportText += '导出时间：' + new Date().toLocaleString() + '\n';
  exportText += '总对话数：' + keys.length + '\n';
  exportText += '有效题目数：' + keys.length + '\n\n';
  keys.forEach(function(key, index) {
    const messages = Array.isArray(allChats[key]) ? allChats[key] : [];
    const item = findQuestionByKey(key) || filteredQuestions.find(function(q) { return q._key === key; });
    const questionText = buildChatExportText(messages, item);
    exportText += '============================================================\n题目 ' + (index + 1) + '\n============================================================\n\n';
    exportText += questionText;
    exportText += '\n';
  });
  exportText += '============================================================\n导出完成\n============================================================\n';
  const blob = new Blob([exportText], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'AI对话记录_' + new Date().toISOString().slice(0,10) + '.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyAllChats() {
  try {
    const allChats=await loadAllChats();
    const keys=Object.keys(allChats&&typeof allChats==='object'?allChats:{}).filter(function(key){
      const messages = Array.isArray(allChats[key]) ? allChats[key] : [];
      return messages.length > 0;
    });
    if(!keys.length){ alert('暂无对话可复制'); return; }
    let text='============================================================\n📝 全部 AI 对话记录\n============================================================\n\n';
    text += '导出时间：' + new Date().toLocaleString() + '\n';
    text += '总对话数：' + keys.length + '\n';
    text += '有效题目数：' + keys.length + '\n\n';
    keys.forEach(function(key,index){
      const messages=Array.isArray(allChats[key])?allChats[key]:[];
      const item = findQuestionByKey(key) || filteredQuestions.find(function(q){ return q._key === key; });
      text += '============================================================\n题目 ' + (index + 1) + '\n============================================================\n\n';
      text += buildChatExportText(messages, item);
      text += '\n';
    });
    text += '============================================================\n复制完成\n============================================================\n';
    if(navigator.clipboard&&navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
    else {
      const textarea=document.createElement('textarea');
      textarea.value=text; textarea.style.cssText='position:fixed;left:-9999px;top:0;';
      document.body.appendChild(textarea); textarea.select();
      if(!document.execCommand('copy')) throw new Error('复制失败');
      textarea.remove();
    }
    const button=document.querySelector('.btn-copy-all');
    if(button){ button.textContent='✅ 已复制'; setTimeout(function(){ button.textContent='📋 复制全部对话'; },2000); }
  }catch(e){ alert('复制失败：'+e.message); }
}

async function clearAllChats() {
  const allChats=await idbGet(CHAT_DB_KEY);
  if(!Object.keys(allChats&&typeof allChats==='object'?allChats:{}).length){ alert('暂无对话可清空'); return; }
  const panel=document.querySelector('.chat-history-panel');
  showInlineConfirm(panel, '确定要清空所有题目的全部对话记录吗？\n此操作不可撤销！', async function(){
    await idbSet(CHAT_DB_KEY,{});
    await refreshChatHistoryPanel();
    alert('✅ 已清空全部对话');
  });
}

async function refreshChatHistoryPanel() {
  const panel=document.querySelector('.chat-history-panel');
  if(!panel) return;
  const allChats=await idbGet(CHAT_DB_KEY);
  const keys=Object.keys(allChats&&typeof allChats==='object'?allChats:{});
  const header=panel.querySelector('.chat-history-header span');
  if(header) header.textContent='💬 对话记录 ('+keys.length+')';
  const list=panel.querySelector('.chat-history-list');
  if(!list) return;
  if(!keys.length){ list.innerHTML='<div class="chat-history-empty">暂无对话记录</div>'; return; }
  list.innerHTML=keys.map(function(key){
    const messages=Array.isArray(allChats[key])?allChats[key]:[];
    const firstUser=messages.find(function(message){ return message.role==='user'; });
    const preview=firstUser?(firstUser.content||'').substring(0,50):'对话记录';
    const item=filteredQuestions.find(function(question){ return question._key===key; });
    const title=item?(item.content||'').substring(0,30):key;
    return '<div class="chat-history-item" onclick="location.hash=\'q-'+key+'\'; this.closest(\'.chat-history-panel\').remove();"><div class="chat-history-item-title">'+title+'...</div><div class="chat-history-item-preview">'+preview+'... ('+messages.length+'条消息)</div></div>';
  }).join('');
}

async function openChatHistory() {
  const oldPanel = document.querySelector('.chat-history-panel');
  if (oldPanel) oldPanel.remove();
  const allChats = await loadAllChats();
  const keys = Object.keys(allChats);
  const panel = document.createElement('div');
  panel.className = 'chat-history-panel';
  let headerHtml = '<div class="chat-history-header">';
  headerHtml += '<span>💬 对话记录 (' + keys.length + ')</span>';
  headerHtml += '<div style="display:flex;gap:8px;align-items:center;">';
  headerHtml += '<button class="chat-history-export-btn" onclick="exportAllChats()">📥 一键导出</button>';
  headerHtml += '<span class="chat-history-close" onclick="this.closest(\'.chat-history-panel\').remove()">✕</span>';
  headerHtml += '</div></div>';
  let listHtml = '<div class="chat-history-list">';
  if (!keys.length) {
    listHtml += '<div class="chat-history-empty">暂无对话记录</div>';
  } else {
    keys.forEach(function(key) {
      const messages = allChats[key];
      const firstUserMsg = messages.find(function(m) { return m.role === 'user'; });
      const preview = firstUserMsg ? firstUserMsg.content.substring(0, 50) : '对话记录';
      const count = messages.length;
      const item = filteredQuestions.find(function(q) { return q._key === key; });
      const title = item ? (item.content || '').substring(0, 30) : key;
      listHtml += '<div class="chat-history-item" onclick="location.hash=\'q-' + key + '\'; this.closest(\'.chat-history-panel\').remove();">';
      listHtml += '<div class="chat-history-item-title">' + title + '...</div>';
      listHtml += '<div class="chat-history-item-preview">' + preview + '... (' + count + '条消息)</div>';
      listHtml += '</div>';
    });
  }
  listHtml += '</div>';
  panel.innerHTML = headerHtml + listHtml;
  document.body.appendChild(panel);
  setTimeout(function() { panel.classList.add('show'); }, 50);
}

// ============================================================
// 增量功能
// ============================================================
(function setupIncrementalFeatures(){
  const ATTEMPT_KEY='qz_question_attempts_v1';
  const newClasses={
    copy:'new-chat-copy-btn', clear:'new-chat-clear-btn', count:'new-question-attempts',
    detail:'new-chat-detail-panel', detailClose:'new-chat-detail-close', detailButton:'new-chat-detail-btn'
  };

  function readAttempts(){
    try{
      const value=JSON.parse(localStorage.getItem(ATTEMPT_KEY)||'{}');
      return value && typeof value==='object' ? value : {};
    }catch(e){ return {}; }
  }

  function incrementAttempt(key){
    const attempts=readAttempts();
    attempts[key]=(Number(attempts[key])||0)+1;
    try{ localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempts)); }catch(e){}
  }

  function renderAttemptCounts(){
    const attempts=readAttempts();
    document.querySelectorAll('#content .question').forEach(function(question){
      const title=question.querySelector('.q-title');
      if(!title) return;
      const key=question.id.replace(/^q-/,'');
      let count=title.querySelector('.'+newClasses.count);
      if(!count){
        count=document.createElement('span');
        count.className=newClasses.count;
        title.appendChild(document.createTextNode(' '));
        title.appendChild(count);
      }
      const nextText='做过'+(Number(attempts[key])||0)+'次';
      if(count.textContent!==nextText) count.textContent=nextText;
      count.title='本题累计答题次数';
    });
  }

  function copyText(text){
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function(resolve,reject){
      const input=document.createElement('textarea');
      input.value=text; input.setAttribute('readonly','');
      input.style.cssText='position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(input); input.select();
      try{ document.execCommand('copy') ? resolve() : reject(new Error('复制失败')); }
      catch(e){ reject(e); }
      input.remove();
    });
  }

  function messageText(messages){
    return messages.map(function(message){
      const role=message.role==='user'?'用户':'AI';
      return role+'：'+(message.content||'');
    }).join('\n');
  }

  function getCurrentChatKey(box){
    return (box.id||'').replace(/^chat-/,'');
  }

  function deleteChatHistory(key){
    return loadAllChats().then(function(allChats){
      delete allChats[key];
      return idbSet(CHAT_DB_KEY, allChats);
    }).then(function(){
      return openAIHistoryDb();
    }).then(function(d){
      return new Promise(function(resolve){
        const tx=d.transaction(AI_HISTORY_STORE,'readwrite');
        tx.objectStore(AI_HISTORY_STORE).delete(key);
        tx.oncomplete=function(){ resolve(true); };
        tx.onerror=function(){ resolve(false); };
      });
    });
  }

  function clearCurrentChat(box){
    const key=getCurrentChatKey(box);
    if(!key) return;
    showConfirm('确定清空当前题目的全部对话记录吗？', function(){
      deleteChatHistory(key).then(function(){
        renderChatBox(key, []);
        enhanceChatBox(box);
      });
    });
  }

  function copyCurrentChat(box, button){
    const key=getCurrentChatKey(box);
    Promise.all([loadAllChats(), getAIHistory(key)]).then(function(values){
      const chat=Array.isArray(values[0][key]) ? values[0][key] : [];
      const simplify=Array.isArray(values[1]) ? values[1].filter(function(message){ return message && message.type==='simplify'; }) : [];
      const question = findQuestionByKey(key) || filteredQuestions.find(function(item){ return item._key===key; });
      const text=buildChatExportText(chat.concat(simplify), question);
      if(!chat.length && !simplify.length){ button.textContent='📋 暂无对话'; setTimeout(function(){ button.textContent='📋 复制对话'; },1200); return; }
      return copyText(text).then(function(){
        button.textContent='✅ 已复制';
        setTimeout(function(){ button.textContent='📋 复制对话'; },1200);
      });
    }).catch(function(){
      button.textContent='❌ 复制失败';
      setTimeout(function(){ button.textContent='📋 复制对话'; },1200);
    });
  }

  function enhanceChatBox(box){
    if(!box || box.querySelector('.'+newClasses.copy)) return;
    box.dataset.newChatEnhanced='1';
    const key=getCurrentChatKey(box);
    const top=document.createElement('div');
    top.className='new-chat-actions-top';
    const copy=document.createElement('button');
    copy.type='button'; copy.className=newClasses.copy; copy.textContent='📋 复制对话';
    copy.addEventListener('click',function(){ copyCurrentChat(box,copy); });
    top.appendChild(copy);
    box.insertBefore(top,box.firstChild);
    const clear=document.createElement('button');
    clear.type='button'; clear.className=newClasses.clear; clear.textContent='🗑 清空对话';
    clear.addEventListener('click',function(){ clearCurrentChat(box); });
    box.appendChild(clear);
    if(key) box.setAttribute('data-new-chat-key',key);
  }

  function normalizeAIResult(result){
    if(!result || result.dataset.newAIFormat==='1' || !result.textContent.includes('AI 简化解析')) return;
    const normalized=result.innerHTML.replace(/(?:<br\s*\/?>(?:\s|&nbsp;)*){2,}/gi,'<br>');
    if(normalized!==result.innerHTML) result.innerHTML=normalized;
    result.dataset.newAIFormat='1';
  }

  function enhanceVisibleContent(){
    document.querySelectorAll('#content .q-chat-box').forEach(enhanceChatBox);
    document.querySelectorAll('#content .q-ai-result').forEach(normalizeAIResult);
    renderAttemptCounts();
  }

  function openChatDetail(key){
    const old=document.querySelector('.'+newClasses.detail);
    if(old) old.remove();
    Promise.all([loadAllChats(), getAIHistory(key)]).then(function(values){
      const currentQuestion=filteredQuestions.find(function(item){ return item._key===key; });
      const chatMessages=values[0][key]||[];
      const chatSimplify=chatMessages.filter(function(m){ return m.type==='simplify'; });
      const historySimplify=values[1].filter(function(m){ return m.type==='simplify'; });
      const messages=chatMessages.filter(function(m){ return m.type!=='simplify'; })
        .concat(historySimplify.length ? historySimplify : chatSimplify);
      const panel=document.createElement('div');
      panel.className=newClasses.detail;
      const close=document.createElement('button');
      close.type='button'; close.className=newClasses.detailClose; close.textContent='✕';
      close.addEventListener('click',function(){ panel.remove(); });
      const title=document.createElement('div'); title.className='new-chat-detail-title'; title.textContent='对话详细内容';
      panel.appendChild(close); panel.appendChild(title);
      if(!messages.length){
        const empty=document.createElement('div'); empty.textContent='暂无对话记录'; panel.appendChild(empty);
      }else{
        messages.forEach(function(message){
          const row=document.createElement('div'); row.className='new-chat-detail-message';
          if(message.type==='simplify'){
            const questionContent=message.questionContent || (currentQuestion && currentQuestion.content) || '';
            const questionOptions=message.questionOptions || [];
            const optionsFromMessage=Array.isArray(questionOptions) ? questionOptions : [];
            let options=[];
            if(optionsFromMessage.some(function(option){ return typeof option==='string'; })) options=optionsFromMessage;
            else {
              const accessory=optionsFromMessage.find(function(option){ return option && Array.isArray(option.options); });
              if(accessory) options=accessory.options;
            }
            if(!options.length && currentQuestion) options=getOptions(currentQuestion);
            if(questionContent){
              const question=document.createElement('div');
              question.className='msg-question';
              question.textContent='📝 题干：'+questionContent;
              row.appendChild(question);
            }
            if(Array.isArray(options) && options.length){
              const optionsBox=document.createElement('div');
              optionsBox.className='msg-options';
              optionsBox.textContent='📋 选项：';
              options.forEach(function(option,index){
                const optionLine=document.createElement('div');
                optionLine.textContent=String.fromCharCode(65+index)+'. '+option;
                optionsBox.appendChild(optionLine);
              });
              row.appendChild(optionsBox);
            }else{
              const noOptions=document.createElement('div');
              noOptions.className='msg-options msg-options-empty';
              noOptions.textContent='📋 选项：暂无选项';
              row.appendChild(noOptions);
            }
            const ai=document.createElement('div');
            ai.className='msg-ai';
            ai.textContent='🤖 AI解析：'+(message.content||'');
            row.appendChild(ai);
          }else{
            row.textContent=(message.role==='user'?'用户：':'AI：')+(message.content||'');
          }
          panel.appendChild(row);
        });
      }
      document.body.appendChild(panel);
    });
  }

  function enhanceHistoryPanel(panel){
    if(panel.dataset.newHistoryEnhanced==='1') return;
    panel.dataset.newHistoryEnhanced='1';
    panel.querySelectorAll('.chat-history-item').forEach(function(item){
      const match=(item.getAttribute('onclick')||'').match(/q-([^'\\]+)/);
      if(!match) return;
      const key=match[1]; item.setAttribute('data-new-chat-key',key);
      const detail=document.createElement('button');
      detail.type='button'; detail.className=newClasses.detailButton; detail.textContent='查看详情';
      detail.addEventListener('click',function(e){ e.stopPropagation(); openChatDetail(key); });
      item.appendChild(detail);
    });
    const close=panel.querySelector('.chat-history-close');
    if(close) close.classList.add('new-chat-history-close-hit');
    const actions=document.createElement('div');
    actions.className='chat-history-footer';
    const copyAll=document.createElement('button');
    copyAll.type='button';
    copyAll.className='footer-btn btn-copy-all';
    copyAll.textContent='📋 复制全部对话';
    copyAll.addEventListener('click',function(){ copyAllChats(copyAll); });
    const clearAll=document.createElement('button');
    clearAll.type='button';
    clearAll.className='footer-btn btn-clear-all';
    clearAll.textContent='🗑 清空全部对话';
    clearAll.addEventListener('click',clearAllChats);
    actions.appendChild(copyAll);
    actions.appendChild(clearAll);
    panel.appendChild(actions);
  }

  function formatAllChats(allChats){
    let text='============================================================\n📝 全部 AI 对话记录\n============================================================\n\n';
    let number=0;
    const keys = Object.keys(allChats).filter(function(key){
      return Array.isArray(allChats[key]) && allChats[key].length > 0;
    });
    text += '总对话数：' + keys.length + '\n';
    text += '有效题目数：' + keys.length + '\n\n';
    keys.forEach(function(key){
      const messages=Array.isArray(allChats[key])?allChats[key]:[];
      if(!messages.length) return;
      number++;
      const item = findQuestionByKey(key) || filteredQuestions.find(function(q){ return q._key === key; });
      text += '============================================================\n题目 ' + number + '\n============================================================\n\n';
      text += buildChatExportText(messages, item);
      text += '\n';
    });
    return number ? text : '';
  }

  function copyAllChats(button){
    loadAllChats().then(function(allChats){
      const text=formatAllChats(allChats);
      if(!text){ alert('暂无对话可复制'); return; }
      return copyText(text).then(function(){
        button.textContent='✅ 已复制';
        setTimeout(function(){ button.textContent='📋 复制全部对话'; },1200);
      });
    }).catch(function(){
      button.textContent='❌ 复制失败';
      setTimeout(function(){ button.textContent='📋 复制全部对话'; },1200);
    });
  }

  function clearAllChats(){
    const panel=document.querySelector('.chat-history-panel');
    showInlineConfirm(panel, '确定要清空所有题目的全部对话记录吗？\n此操作不可撤销！',function(){
      idbSet(CHAT_DB_KEY,{}).then(function(){
        const currentPanel=document.querySelector('.chat-history-panel');
        if(currentPanel) currentPanel.remove();
        openChatHistory();
      });
    });
  }

  let enhancementQueued=false;
  const observer=new MutationObserver(function(){
    if(enhancementQueued) return;
    enhancementQueued=true;
    queueMicrotask(function(){
      enhancementQueued=false;
      enhanceVisibleContent();
      document.querySelectorAll('.chat-history-panel').forEach(enhanceHistoryPanel);
    });
  });
  observer.observe(document.body,{childList:true,subtree:true});

  document.addEventListener('click',function(e){
    const item=e.target.closest && e.target.closest('.chat-history-item');
    if(item && !e.target.closest('.'+newClasses.detailButton)){
      const key=item.getAttribute('data-new-chat-key');
      if(key) setTimeout(function(){ openChatDetail(key); },0);
    }
  });

  document.addEventListener('click',function(e){
    const option=e.target.closest && e.target.closest('#content .q-options .option');
    if(!option) return;
    const key=option.getAttribute('data-key');
    const item=filteredQuestions.find(function(question){ return question._key===key; });
    if(item && item._answered===undefined) incrementAttempt(key);
  },true);

  const style=document.createElement('style');
  style.textContent='.'+newClasses.copy+'{background:#2563eb;color:#fff;border:0;border-radius:6px;padding:7px 12px;cursor:pointer;}.'+newClasses.clear+'{display:block;background:#dc2626;color:#fff;border:0;border-radius:6px;padding:7px 12px;margin:10px 0 0;cursor:pointer;} .new-chat-actions-top{margin-bottom:8px;} .'+newClasses.count+'{margin-left:6px;color:var(--secondary);font-size:.9em;white-space:nowrap;} .'+newClasses.detail+'{position:fixed;inset:10% 5%;z-index:10001;overflow:auto;background:#fff;padding:18px;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.3);} .'+newClasses.detailClose+'{float:right;min-width:44px;min-height:44px;border:0;background:transparent;font-size:24px;cursor:pointer;} .new-chat-detail-title{font-weight:bold;font-size:16px;margin-bottom:14px;} .new-chat-detail-message{padding:10px;margin:8px 0;background:#f1f5f9;border-radius:6px;white-space:pre-wrap;} .'+newClasses.detailButton+'{margin-top:6px;background:#2563eb;color:#fff;border:0;border-radius:5px;padding:5px 9px;cursor:pointer;} .new-chat-history-close-hit{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;} .chat-history-panel{height:100vh !important;max-height:100vh !important;bottom:0 !important;overflow:hidden !important;} .chat-history-header{flex-shrink:0 !important;min-height:60px !important;} .chat-history-list{flex:1 1 auto !important;min-height:0 !important;overflow-y:auto !important;} .chat-history-footer{flex:0 0 auto !important;display:flex !important;gap:10px !important;align-items:center !important;justify-content:center !important;padding:8px 16px 12px !important;border-top:1px solid #e2e8f0 !important;background:#fff !important;min-height:56px !important;box-sizing:border-box !important;} .chat-history-footer .footer-btn{flex:1 1 0 !important;min-width:0 !important;max-width:200px !important;min-height:44px !important;padding:10px 12px !important;border:0 !important;border-radius:8px !important;color:#fff !important;font-size:14px !important;font-weight:600 !important;cursor:pointer !important;text-align:center !important;touch-action:manipulation !important;} .chat-history-footer .btn-copy-all{background:#2563eb !important;} .chat-history-footer .btn-clear-all{background:#dc2626 !important;} @media(max-width:480px){.chat-history-panel{width:100vw !important;max-width:100vw !important;}.chat-history-footer{padding:6px 12px 10px !important;gap:8px !important;min-height:50px !important;}.chat-history-footer .footer-btn{min-height:48px !important;font-size:13px !important;padding:8px 6px !important;}} @media(max-width:768px){.'+newClasses.detail+'{inset:4% 3%;}.'+newClasses.copy+','+'.'+newClasses.clear+'{min-height:44px;}}';
  document.head.appendChild(style);
  enhanceVisibleContent();
})();

// ============================================================
// 独立错题管理
// ============================================================
(function setupLocalWrongList(){
  const qzLocalWrongKey='qz_wrong_list';
  const qzLocalZones=['gk','mk','sy'];

  function qzLocalRead(){
    try{
      const value=JSON.parse(localStorage.getItem(qzLocalWrongKey)||'{}');
      return value&&typeof value==='object'?value:{};
    }catch(e){ return {}; }
  }

  function qzLocalWrite(value){
    try{ localStorage.setItem(qzLocalWrongKey,JSON.stringify(value)); }catch(e){}
  }

  function qzLocalValidQuestion(zone,key){
    if(!db[zone]||!key) return false;
    const match=String(key).match(/^f(.+)_q(\d+)$/);
    return !!(match&&db[zone][match[1]]&&db[zone][match[1]].questions&&db[zone][match[1]].questions[Number(match[2])]);
  }

  function qzLocalValidList(){
    const source=qzLocalRead();
    const valid={};
    qzLocalZones.forEach(function(zone){
      valid[zone]={};
      const entries=source[zone]&&typeof source[zone]==='object'?source[zone]:{};
      Object.keys(entries).forEach(function(key){
        if(entries[key]===true&&qzLocalValidQuestion(zone,key)) valid[zone][key]=true;
      });
    });
    return valid;
  }

  function qzLocalUpdateCount(){
    const list=qzLocalValidList();
    let total=0;
    qzLocalZones.forEach(function(zone){ total+=Object.keys(list[zone]).length; });
    const count=document.getElementById('wrongCount');
    if(count) count.textContent=String(total);
  }

  function qzLocalSyncAnswer(zone,key,isWrong){
    const list=qzLocalRead();
    if(!list[zone]||typeof list[zone]!=='object') list[zone]={};
    if(isWrong) list[zone][key]=true;
    else delete list[zone][key];
    qzLocalWrite(list);
    qzLocalUpdateCount();
  }

  let qzLocalBootstrapped=false;
  function qzLocalBootstrap(){
    if(qzLocalBootstrapped) return;
    qzLocalBootstrapped=true;
    const current=localStorage.getItem(qzLocalWrongKey);
    if(current===null&&typeof wrongSet!=='undefined'){
      const legacy=qzLocalRead();
      qzLocalZones.forEach(function(zone){
        legacy[zone]={};
        const entries=wrongSet[zone]&&typeof wrongSet[zone]==='object'?wrongSet[zone]:{};
        Object.keys(entries).forEach(function(key){ if(entries[key]) legacy[zone][key]=true; });
      });
      qzLocalWrite(legacy);
    }
    qzLocalUpdateCount();
  }

  document.addEventListener('click',function(event){
    const option=event.target.closest&&event.target.closest('#content .q-options .option');
    if(!option) return;
    const key=option.getAttribute('data-key');
    const letter=option.getAttribute('data-letter');
    const item=filteredQuestions.find(function(question){ return question._key===key; });
    if(!item||item._answered!==undefined) return;
    let correct=false;
    try{ correct=getCorrectLetter(item)===letter; }catch(e){}
    qzLocalSyncAnswer(activeZone,key,!correct);
  },true);

  const qzOriginalGetFiltered=getFiltered;
  getFiltered=function(){
    const requestedStatus=filterState.status;
    if(requestedStatus==='wrong') filterState.status='all';
    let result=qzOriginalGetFiltered();
    filterState.status=requestedStatus;
    if(requestedStatus==='wrong'){
      const list=qzLocalValidList();
      result=result.filter(function(question){ return !!(list[activeZone]&&list[activeZone][question._key]); });
    }
    return result;
  };

  const qzOriginalRenderAll=renderAll;
  renderAll=function(){
    qzLocalBootstrap();
    return qzOriginalRenderAll();
  };

  window.viewWrongSet=function(){
    filterState.status='wrong';
    currentPage=1;
    saveView();
    renderAll();
    qzLocalUpdateCount();
  };

  window.addEventListener('storage',function(event){
    if(event.key===qzLocalWrongKey){ qzLocalUpdateCount(); if(filterState.status==='wrong') renderQuestions(); }
  });
  qzLocalUpdateCount();
})();

// ============================================================
// 图片诊断
// ============================================================
function bindImageDebug(){
  try{
    const imgs=content.querySelectorAll('img');
    imgs.forEach(function(im){
      if(im.__dbgBound) return; im.__dbgBound=true;
      im.addEventListener('load', function(){ const o=document.getElementById('dbgLog'); if(o) o.textContent+='✓ 加载成功: '+(this.src||'').substring(0,40)+'\n'; });
      im.addEventListener('error', function(){ const o=document.getElementById('dbgLog'); if(o) o.textContent+='✗ 加载失败: '+(this.src||'').substring(0,40)+'\n'; });
    });
  }catch(e){}
}

function dbgClear(){ const o=document.getElementById('dbgOut'); if(o) o.textContent=''; const l=document.getElementById('dbgLog'); if(l) l.textContent=''; }

function dbgPrint(m){ const o=document.getElementById('dbgOut'); if(o) o.textContent+=m+'\n'; }

function diagnoseImages(){
  try{
    const imgs=document.querySelectorAll('.q-content img, .q-solution img');
    dbgPrint('【图片数量】 '+imgs.length);
    if(!imgs.length) dbgPrint('（当前题目页无图片）');
    imgs.forEach(function(img,i){
      const cs=getComputedStyle(img);
      const pe=img.parentElement||img;
      const ps=getComputedStyle(pe);
      const nat=(img.naturalWidth||0)+'x'+(img.naturalHeight||0);
      const typ=img.src.indexOf('blob:')===0?'BLOB':(img.src.indexOf('http')===0?'HTTP':'OTHER');
      dbgPrint('— 图片'+i+' —');
      dbgPrint('  src: '+(img.src||'').substring(0,80));
      dbgPrint('  origSrc: '+(img.dataset.origSrc||'(无)').substring(0,80));
      dbgPrint('  代理: '+(img.dataset.proxied?('已'+img.dataset.proxied+(img.dataset.proxyIdx!==undefined?('['+(Number(img.dataset.proxyIdx)+1)+']'):'')):'未触发'));
      dbgPrint('  类型: '+typ+' | complete: '+img.complete+' | natural: '+nat);
      dbgPrint('  display: '+cs.display+' | visibility: '+cs.visibility+' | opacity: '+cs.opacity);
      dbgPrint('  css宽高: '+cs.width+' x '+cs.height);
      dbgPrint('  父display: '+ps.display+' | 父overflow: '+ps.overflow+' | 父高: '+ps.height);
      const v=[];
      if(cs.display==='none') v.push('IMG被display:none');
      if(cs.visibility==='hidden'||cs.visibility==='collapse') v.push('IMG被visibility隐藏');
      if(parseFloat(cs.opacity)===0) v.push('IMG透明度0');
      if(ps.display==='none') v.push('父容器display:none');
      if(img.complete&&(img.naturalWidth||0)===0) v.push('已加载但像素0(破图/解码失败)');
      if(!img.complete&&typ==='HTTP') v.push('HTTP图未加载完(等load/或受JS干扰)');
      dbgPrint(v.length?('  ⚠ 判定: '+v.join('；')):'  ✓ 无明显隐藏，若仍空白=绘制/合成层问题');
    });
  }catch(e){ dbgPrint('诊断异常: '+e.message); }
}

function toggleDebug(){
  const p=document.getElementById('dbgPanel');
  if(!p) return;
  p.style.display=(p.style.display==='block')?'none':'block';
  if(p.style.display==='block'){ const o=document.getElementById('dbgOut'); if(o) o.textContent=''; diagnoseImages(); }
}

function toggleNoHack(on){
  window.__noImageHack=!!on;
  dbgClear();
  renderQuestions();
  diagnoseImages();
}
// ============================================================
// 6. 初始化
// ============================================================
(async function initPublicExam(){
  try{ await idbOpen(); }catch(e){ console.error('IndexedDB 打开失败:',e); }
  try{ await migrateFromLocalStorage(); }catch(e){}
  try{ await loadAll(); }catch(e){ console.error('loadAll 失败:',e); }
  try{ await loadView(); }catch(e){}
  try{ await loadWrong(); await loadFav(); await loadDaily(); await loadExam(); }catch(e){}
  if(!ZONES.some(function(zone){ return zone.id===activeZone; })) activeZone='gk';
  applyZoneTheme(activeZone);
  initMode();
  applyFs(getFs());
  initProvinceFilter();
  bindFileTabSwitch();
  setupImgObserver();
  setupLongPressExclude();
  setupTimerDrag();
  loadTimerData();
  renderProgressPanel();
  renderAll();

  const historyButton=document.createElement('button');
  historyButton.type='button';
  historyButton.className='chat-history-btn';
  historyButton.textContent='💬';
  historyButton.title='对话记录';
  historyButton.onclick=function(){ openChatHistory(); };
  document.body.appendChild(historyButton);
})();

loadAIConfig();
loadSkin();
restoreMainModule();

// 如果当前在英语模块，初始化
if (document.getElementById('module-en').classList.contains('active')) {
  initEnglish();
}

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

console.log('✅ Helium 已启动！点击左侧「📚 公考」或「🇬🇧 英语」切换模块');
