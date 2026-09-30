/* ============================================================
   增量补丁（2026-09-30）
   ① 判断题（无选项）可提交
   ② 素材库（侧边栏入口 / 选中文字加入 / 手动添加 / AI 归类）
   ③ 正确率区间下拉的事件绑定（配合 Stage1 拆分的 #ratioRangeFilter）
   全部为「增量安装」，通过包装既有函数实现，不改动业务函数体。
   ============================================================ */
(function(){
'use strict';

/* ---------- Part 0: 样式注入 ---------- */
(function injectCss(){
  if(document.getElementById('ml-feature-style')) return;
  var css = ''
  + '.judge-box{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 4px;align-items:center;}'
  + '.judge-btn{flex:1 1 0;min-width:110px;min-height:48px;padding:10px 18px;border:2px solid var(--border,#d1d5db);'
  +   'border-radius:10px;background:var(--surface,#fff);color:var(--text,#1f2937);font-size:15px;font-weight:700;'
  +   'cursor:pointer;transition:all .15s ease;box-sizing:border-box;}'
  + '.judge-btn:hover{border-color:var(--main,#3b82f6);background:var(--light,#eef4fc);transform:translateY(-1px);}'
  + '.judge-btn:active{transform:scale(.97);}'
  + '.judge-verdict{padding:10px 14px;border-radius:8px;background:var(--light,#eef4fc);color:var(--text,#1f2937);'
  +   'font-size:14px;line-height:1.7;}'
  + '.judge-verdict b{color:var(--deep,#2c5f8a);}'
  + '.ml-sel-btn{position:absolute;z-index:100003;padding:8px 14px;border:0;border-radius:8px;'
  +   'background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:13px;font-weight:700;cursor:pointer;'
  +   'box-shadow:0 4px 16px rgba(217,119,6,.42);white-space:nowrap;-webkit-tap-highlight-color:transparent;'
  +   'transform:translate(-50%,-100%);transition:transform .12s ease;}'
  + '.ml-sel-btn:active{transform:translate(-50%,-100%) scale(.94);}'
  + '#toolFullscreen .ml-shell{width:min(880px,100%);}'
  + '#toolFullscreen .ml-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;'
  +   'background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:12px;margin-bottom:14px;}'
  + '#toolFullscreen .ml-search{flex:1 1 200px;min-width:0;font-size:14px;padding:10px 12px;text-align:left;height:42px;}'
  + '#toolFullscreen .ml-cat{flex:0 1 190px;min-width:0;font-size:13px;padding:10px 8px;height:42px;text-align:center;text-align-last:center;}'
  + '#toolFullscreen .ml-toolbar .btn{min-height:42px;font-size:13px;white-space:nowrap;}'
  + '#toolFullscreen .ml-stat{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;}'
  + '#toolFullscreen .ml-stat span{flex:1 1 0;min-width:90px;padding:8px 10px;border-radius:10px;'
  +   'background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);text-align:center;'
  +   'font-size:12px;color:var(--text-muted,#5a6b80);}'
  + '#toolFullscreen .ml-stat b{display:block;font-size:18px;color:var(--main,#1e3a5f);margin-top:2px;}'
  + '#toolFullscreen .ml-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}'
  + '@media (max-width:700px){#toolFullscreen .ml-list{grid-template-columns:1fr;}}'
  + '#toolFullscreen .ml-card{display:flex;flex-direction:column;background:var(--surface,#fff);'
  +   'border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:14px;box-sizing:border-box;'
  +   'border-left:4px solid var(--main,#3b82f6);transition:box-shadow .15s ease,transform .15s ease;}'
  + '#toolFullscreen .ml-card:hover{box-shadow:0 6px 20px rgba(0,0,0,.08);transform:translateY(-2px);}'
  + '#toolFullscreen .ml-card-title{font-size:15px;font-weight:700;color:var(--deep,#2c5f8a);'
  +   'margin-bottom:6px;word-break:break-word;}'
  + '#toolFullscreen .ml-card-body{font-size:13px;line-height:1.7;color:var(--text,#2d3748);'
  +   'flex:1;max-height:96px;overflow:hidden;white-space:pre-wrap;word-break:break-word;}'
  + '#toolFullscreen .ml-card-meta{margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;'
  +   'font-size:11px;color:var(--text-muted,#5a6b80);}'
  + '#toolFullscreen .ml-tag{padding:2px 9px;border-radius:99px;background:var(--light,#eef4fc);'
  +   'color:var(--deep,#2c5f8a);font-size:11px;font-weight:600;}'
  + '#toolFullscreen .ml-tag.cat{background:var(--main,#3b82f6);color:var(--on-main,#fff);}'
  + '#toolFullscreen .ml-actions{margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;}'
  + '#toolFullscreen .ml-actions .btn{flex:1 1 auto;min-width:0;min-height:36px;font-size:12px;padding:4px 8px;}'
  + '#toolFullscreen .ml-empty{padding:48px 20px;text-align:center;color:var(--text-muted,#5a6b80);font-size:14px;}'
  + '#toolFullscreen .ml-empty .big{font-size:42px;display:block;margin-bottom:10px;}'
  + '#toolFullscreen .ml-panel{background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);'
  +   'border-radius:12px;padding:20px;margin-bottom:14px;}'
  + '#toolFullscreen .ml-panel h3{margin:0 0 12px;color:var(--main,#1e3a5f);font-size:16px;}'
  + '#toolFullscreen .ml-field{margin-bottom:14px;}'
  + '#toolFullscreen .ml-field label{display:block;font-size:13px;font-weight:700;'
  +   'color:var(--deep,#2c5f8a);margin-bottom:6px;}'
  + '#toolFullscreen .ml-input,#toolFullscreen .ml-textarea,#toolFullscreen .ml-select{'
  +   'width:100%;box-sizing:border-box;padding:10px 12px;border:2px solid var(--border,#d1d5db);'
  +   'border-radius:8px;background:var(--surface,#fff);color:var(--text,#1f2937);font-size:14px;'
  +   'font-family:inherit;outline:none;}'
  + '#toolFullscreen .ml-input:focus,#toolFullscreen .ml-textarea:focus,#toolFullscreen .ml-select:focus{'
  +   'border-color:var(--main,#3b82f6);}'
  + '#toolFullscreen .ml-textarea{min-height:180px;resize:vertical;line-height:1.8;}'
  + '#toolFullscreen .ml-content{font-size:15px;line-height:2;color:var(--text,#2d3748);'
  +   'white-space:pre-wrap;word-break:break-word;}'
  + '#toolFullscreen .ml-ai-box{margin-top:14px;padding:14px 16px;border-radius:10px;'
  +   'background:linear-gradient(135deg,rgba(124,58,237,.08),rgba(59,130,246,.08));'
  +   'border-left:4px solid #7c3aed;font-size:14px;line-height:1.9;color:var(--text,#2d3748);}'
  + '#toolFullscreen .ml-ai-box h4{margin:0 0 8px;color:#7c3aed;font-size:14px;}'
  + '#toolFullscreen .ml-ai-box ul{margin:6px 0;padding-left:20px;}'
  + '#toolFullscreen .ml-busy{padding:12px;text-align:center;color:#7c3aed;font-style:italic;}'
  + '#toolFullscreen .ml-back{margin-bottom:12px;}'
  + '#mlModalOverlay{position:fixed;inset:0;z-index:100010;display:none;align-items:center;justify-content:center;'
  +   'background:rgba(0,0,0,.5);padding:18px;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);}'
  + '#mlModalOverlay.show{display:flex;}'
  + '#mlModalBox{width:min(520px,100%);max-height:88vh;overflow-y:auto;background:var(--surface,#fff);'
  +   'border-radius:16px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35);box-sizing:border-box;}'
  + '#mlModalBox h3{margin:0 0 14px;color:var(--main,#1e3a5f);font-size:17px;}'
  + '#mlModalBtns{display:flex;gap:10px;margin-top:16px;}'
  + '#mlModalBtns .btn{flex:1;min-height:46px;font-size:15px;}'
  + 'body.skin-dark #toolFullscreen .ml-ai-box{background:rgba(124,58,237,.16);color:#e6edf5;}'
  + 'body.skin-dark #toolFullscreen .ml-ai-box h4{color:#c4b5fd;}'
  ;
  var st = document.createElement('style');
  st.id = 'ml-feature-style';
  st.textContent = css;
  document.head.appendChild(st);
})();



/* ============================================================
   Part 1：判断题（无选项）可提交
   ============================================================ */
function extractJudgeCorrect(item){
  if(!item || typeof item !== 'object') return '';
  var cands = [item.correctAnswer, item.answer, item.correct, item.rightAnswer, item.key, item.result];
  for(var i=0;i<cands.length;i++){
    var c = cands[i];
    if(c === undefined || c === null) continue;
    var v = c;
    if(typeof v === 'object') v = (v.choice !== undefined ? v.choice : (v.answer !== undefined ? v.answer : (v.value !== undefined ? v.value : '')));
    var t = String(v == null ? '' : v).trim();
    if(!t) continue;
    if(/^(对|正确|√|✓|是|T|True|Y|Yes|正确的)$/i.test(t)) return '对';
    if(/^(错|错误|×|✗|x|否|F|False|N|No|不正确的)$/i.test(t)) return '错';
    if(/^A$/i.test(t)) return '对';
    if(/^B$/i.test(t)) return '错';
  }
  var sol = String(item.solution || item.analysis || item.explain || '');
  if(sol){
    if(/正确答案[是为：:、\s]{0,4}(正确|对|√|✓|A\b)/.test(sol)) return '对';
    if(/正确答案[是为：:、\s]{0,4}(错误|错|×|✗|B\b)/.test(sol)) return '错';
    if(/(本题|该题|此题|题干)[^。；\n]{0,12}(说法正确|表述正确|是正确的|正确的)/.test(sol)) return '对';
    if(/(本题|该题|此题|题干)[^。；\n]{0,12}(说法错误|表述错误|是错误的|不正确的)/.test(sol)) return '错';
  }
  return '';
}

isAnsweredCorrect = function(item){
  if(!item) return null;
  var a = item._answered;
  if(a === undefined || a === null) return null;
  var opts;
  try{ opts = getOptions(item); }catch(e){ opts = []; }
  if(!opts || !opts.length){
    var jc = extractJudgeCorrect(item);
    if(jc) return String(a).trim() === jc;
  }
  return _origIsAnsweredCorrect(item);
};

function selectJudgeOption(key, value){
  var item = filteredQuestions.find(function(q){ return q._key === key; });
  if(!item || item._answered !== undefined) return;
  var file = db[activeZone] && db[activeZone][item._fileId];
  if(file){
    if(!file.answered) file.answered = {};
    file.answered[key] = value;
    saveFile(activeZone, item._fileId);
  }
  var jc = extractJudgeCorrect(item);
  var correct = (value === jc);
  if(!wrongSet[activeZone]) wrongSet[activeZone] = {};
  if(!correct){ wrongSet[activeZone][key] = true; if(navigator.vibrate) navigator.vibrate(15); }
  saveWrong();
  try{ recordNormalAttempt(activeZone, key, correct); }catch(e){}
  try{ recordAnswerTiming(); }catch(e){}
  try{ incDaily(); }catch(e){}
  item._answered = value;
  if(typeof window.recordQuestionAttempt === 'function') window.recordQuestionAttempt(key);

  var el = document.getElementById('q-' + key);
  if(el){
    var box = el.querySelector('.judge-box');
    if(box){
      box.innerHTML = '<div class="judge-verdict">'
        + (correct ? '✅ 回答正确' : '❌ 回答错误')
        + ' ｜ 正确答案：<b>' + jc + '</b> ｜ 你的答案：<b>' + escapeHtml(String(value)) + '</b></div>';
    }
    var ansEl = el.querySelector('.q-answer');
    if(ansEl) ansEl.textContent = '✅ 正确答案：' + jc;
    var vd = el.querySelector('.q-verdict');
    if(vd){
      var va = vd.querySelector('.q-answer');
      if(va) va.textContent = correct ? '✅ 回答正确' : ('✅ 正确答案：' + jc);
      var ua = vd.querySelector('.q-user-answer');
      if(ua) ua.remove();
      if(!correct){
        var sp = document.createElement('span');
        sp.className = 'q-user-answer';
        sp.textContent = '❌ 你的答案：' + value;
        vd.appendChild(sp);
      }
    }
  }
  try{ renderZoneStats(); }catch(e){}
  try{ renderProgressPanel(); }catch(e){}
  try{ updateWrongCount(); }catch(e){}
}

function enhanceJudgeQuestions(){
  if(document.body.classList.contains('review-mode')) return;
  var els = content.querySelectorAll('.question.visible');
  for(var i=0;i<els.length;i++){
    var el = els[i];
    if(el.querySelector('.q-options')) continue;
    if(el.querySelector('.judge-box')) continue;
    if(el.classList.contains('essay-paper')) continue;
    if(el.classList.contains('mian-shi-question')) continue;
    if(el.querySelector('.essay-answer') || el.querySelector('.mian-shi-answer')) continue;
    var key = el.id.replace(/^q-/, '');
    if(!key) continue;
    var item = filteredQuestions.find(function(q){ return q._key === key; });
    if(!item) continue;
    var jc = extractJudgeCorrect(item);
    if(!jc) continue;
    var contentEl = el.querySelector('.q-content');
    if(!contentEl) continue;

    var box = document.createElement('div');
    box.className = 'judge-box';
    var answered = (item._answered !== undefined && item._answered !== null);
    if(answered){
      var ok = String(item._answered).trim() === jc;
      box.innerHTML = '<div class="judge-verdict">'
        + (ok ? '✅ 回答正确' : '❌ 回答错误')
        + ' ｜ 正确答案：<b>' + jc + '</b> ｜ 你的答案：<b>' + escapeHtml(String(item._answered)) + '</b></div>';
    }else{
      box.innerHTML = '<button type="button" class="judge-btn" data-v="对">✅ 正确</button>'
                    + '<button type="button" class="judge-btn" data-v="错">❌ 错误</button>';
      (function(k){
        box.querySelectorAll('.judge-btn').forEach(function(b){
          b.addEventListener('click', function(ev){
            ev.preventDefault(); ev.stopPropagation();
            selectJudgeOption(k, b.getAttribute('data-v'));
          });
        });
      })(key);
    }
    contentEl.insertAdjacentElement('afterend', box);

    var emptyAns = el.querySelector('.q-answer');
    if(emptyAns) emptyAns.textContent = '✅ 正确答案：' + jc;
    if(answered){
      var vAns = el.querySelector('.q-verdict .q-answer');
      if(vAns) vAns.textContent = (String(item._answered).trim() === jc) ? '✅ 回答正确' : ('✅ 正确答案：' + jc);
    }
  }
}

renderQuestions = function(){
  var r = _origRenderQuestions.apply(this, arguments);
  try{ enhanceJudgeQuestions(); }catch(e){ console.warn('[判断题增强]', e); }
  return r;
};



/* ============================================================
   Part 2A：素材库 —— 数据层 + 列表页 + 详情页 + 编辑页
   ============================================================ */
var ML_PREFIX = 'material:';
var MATERIAL_CATEGORIES = ['经济','政治','文化','社会','生态','人物','名言金句','数据统计','政策文件','案例事例','其他'];

var mlState = {
  view: 'list',
  items: [],
  keyword: '',
  category: 'all',
  currentId: null,
  busy: false,
  busyText: ''
};

async function mlLoadAll(){
  try{
    var list = await idbGetByPrefix(ML_PREFIX);
    list = (list || []).filter(function(x){ return x && x.id && x.content; });
    list.sort(function(a,b){ return (b.updatedAt||0) - (a.updatedAt||0); });
    return list;
  }catch(e){ console.warn('[素材库] 读取失败', e); return []; }
}
function mlSaveOne(m){ return idbSet(ML_PREFIX + m.id, m); }
function mlDeleteOne(id){ return idbDel(ML_PREFIX + id); }
function mlNewId(){ return 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

function mlFiltered(){
  var kw = String(mlState.keyword||'').trim().toLowerCase();
  return mlState.items.filter(function(m){
    if(mlState.category !== 'all' && (m.category||'其他') !== mlState.category) return false;
    if(!kw) return true;
    var hay = [m.title, m.content, m.category, (m.tags||[]).join(' '), m.core, m.structure].join(' ').toLowerCase();
    return hay.indexOf(kw) >= 0;
  });
}
function mlCategories(){
  var map = {};
  mlState.items.forEach(function(m){
    var c = m.category || '其他';
    map[c] = (map[c]||0) + 1;
  });
  return Object.keys(map).map(function(k){ return { name:k, count:map[k] }; })
    .sort(function(a,b){ return b.count - a.count; });
}
function mlCountStat(){
  var tags = {};
  mlState.items.forEach(function(m){ (m.tags||[]).forEach(function(t){ tags[t] = (tags[t]||0)+1; }); });
  var aiDone = mlState.items.filter(function(m){ return m.core || m.structure; }).length;
  return { total: mlState.items.length, cats: Object.keys(mlCategories()).length, tags: Object.keys(tags).length, aiDone: aiDone };
}

async function materialOpen(){
  mlState.view = 'list';
  mlState.keyword = '';
  mlState.category = 'all';
  mlState.currentId = null;
  await materialRefresh();
}
async function materialRefresh(){
  mlState.items = await mlLoadAll();
  renderMaterialLibrary();
}

function renderMaterialLibrary(){
  var root = document.getElementById('toolFullscreenContent');
  if(!root) return;
  if(mlState.view === 'detail'){ root.innerHTML = mlDetailHtml(); return; }
  if(mlState.view === 'edit'){ root.innerHTML = mlEditHtml(); mlBindEdit(); return; }

  var cats = mlCategories();
  var items = mlFiltered();
  var st = mlCountStat();

  var html = '<div class="tool-shell ml-shell">';
  html += '<div class="ml-toolbar">';
  html += '<input type="text" id="mlSearch" class="ml-input ml-search" placeholder="🔍 搜索标题 / 内容 / 标签…" value="' + escapeHtml(mlState.keyword) + '">';
  html += '<select id="mlCatSel" class="ml-select ml-cat">';
  html += '<option value="all">📂 全部分类 (' + mlState.items.length + ')</option>';
  cats.forEach(function(c){
    html += '<option value="' + escapeHtml(c.name) + '"' + (mlState.category === c.name ? ' selected' : '') + '>' + escapeHtml(c.name) + ' (' + c.count + ')</option>';
  });
  html += '</select>';
  html += '<button class="btn btn-primary" type="button" onclick="mlAddNew()">➕ 手动添加</button>';
  html += '<button class="btn btn-outline" type="button" onclick="mlAIOrganizeAll()">🤖 AI 智能归类</button>';
  html += '<button class="btn btn-outline" type="button" onclick="mlExport()">📤 导出</button>';
  html += '<button class="btn btn-outline" type="button" onclick="document.getElementById(\'mlImportInput\').click()">📥 导入</button>';
  html += '<input type="file" id="mlImportInput" accept=".json,application/json" style="display:none">';
  html += '</div>';

  html += '<div class="ml-stat">'
        + '<span>素材总数<b>' + st.total + '</b></span>'
        + '<span>已归类<b>' + st.cats + '</b></span>'
        + '<span>标签数<b>' + st.tags + '</b></span>'
        + '<span>AI 已分析<b>' + st.aiDone + '</b></span>'
        + '</div>';

  if(mlState.busy){
    html += '<div class="ml-panel"><div class="ml-busy">⏳ ' + escapeHtml(mlState.busyText || 'AI 处理中…') + '</div></div>';
  }

  if(!items.length){
    html += '<div class="ml-panel ml-empty"><span class="big">📚</span>'
          + (mlState.items.length ? '没有匹配的素材' : '素材库还是空的<br><br>在申论 / 综应 / 面试分区选中文字即可加入，<br>或点上方「➕ 手动添加」')
          + '</div>';
  }else{
    html += '<div class="ml-list">';
    items.forEach(function(m){
      var tags = (m.tags||[]).slice(0,4).map(function(t){ return '<span class="ml-tag">#' + escapeHtml(t) + '</span>'; }).join('');
      var preview = String(m.content||'').replace(/\s+/g,' ').slice(0, 120);
      html += '<div class="ml-card" data-id="' + escapeHtml(m.id) + '">'
            +   '<div class="ml-card-title">' + escapeHtml(m.title || '未命名素材') + '</div>'
            +   '<div class="ml-card-body">' + escapeHtml(preview) + (String(m.content||'').length > 120 ? '…' : '') + '</div>'
            +   '<div class="ml-card-meta">'
            +     '<span class="ml-tag cat">' + escapeHtml(m.category || '其他') + '</span>'
            +     tags
            +     '<span style="margin-left:auto">' + new Date(m.updatedAt || m.createdAt || Date.now()).toLocaleDateString() + '</span>'
            +   '</div>'
            +   '<div class="ml-actions">'
            +     '<button class="btn btn-outline" type="button" onclick="mlView(\'' + m.id + '\')">👁 查看</button>'
            +     '<button class="btn btn-outline" type="button" onclick="mlEdit(\'' + m.id + '\')">✏️ 编辑</button>'
            +     '<button class="btn btn-outline" type="button" onclick="mlAiOne(\'' + m.id + '\')">🤖 AI</button>'
            +     '<button class="btn btn-danger" type="button" onclick="mlDelete(\'' + m.id + '\')">🗑</button>'
            +   '</div>'
            + '</div>';
    });
    html += '</div>';
  }
  html += '</div>';
  root.innerHTML = html;

  var s1 = document.getElementById('mlSearch');
  if(s1){
    s1.addEventListener('input', function(){
      mlState.keyword = this.value;
      clearTimeout(window.__mlSearchTimer);
      window.__mlSearchTimer = setTimeout(function(){
        var pos = mlState.keyword;
        renderMaterialLibrary();
        var box = document.getElementById('mlSearch');
        if(box){ box.value = pos; box.focus(); box.setSelectionRange(pos.length, pos.length); }
      }, 220);
    });
  }
  var cs = document.getElementById('mlCatSel');
  if(cs){
    cs.addEventListener('change', function(){ mlState.category = this.value; renderMaterialLibrary(); });
  }
  var imp = document.getElementById('mlImportInput');
  if(imp){
    imp.addEventListener('change', function(){ mlImport(this); });
  }
}

function mlDetailHtml(){
  var m = mlState.items.find(function(x){ return x.id === mlState.currentId; });
  if(!m){ mlState.view = 'list'; return '<div class="ml-panel ml-empty">素材已不存在</div>'; }
  var tags = (m.tags||[]).map(function(t){ return '<span class="ml-tag">#' + escapeHtml(t) + '</span>'; }).join(' ');
  var html = '<div class="tool-shell ml-shell">';
  html += '<div class="ml-back"><button class="btn btn-outline" type="button" onclick="mlBackToList()">← 返回素材库</button></div>';
  html += '<div class="ml-panel">';
  html += '<h3>' + escapeHtml(m.title || '未命名素材') + '</h3>';
  html += '<div class="ml-card-meta" style="margin-bottom:12px">'
        + '<span class="ml-tag cat">' + escapeHtml(m.category || '其他') + '</span> ' + tags
        + '<span style="margin-left:auto">' + new Date(m.updatedAt || m.createdAt || Date.now()).toLocaleString() + '</span>'
        + '</div>';
  if(m.source && (m.source.zone || m.source.paper)){
    html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">来源：'
          + escapeHtml([zoneName(m.source.zone), m.source.paper, m.source.index != null ? ('第' + (m.source.index + 1) + '题') : ''].filter(Boolean).join(' · '))
          + '</div>';
  }
  html += '<div class="ml-content">' + escapeHtml(m.content) + '</div>';
  if(m.note){
    html += '<div style="margin-top:16px;padding:12px;border-radius:8px;background:var(--light);color:var(--text);font-size:14px;line-height:1.8">'
          + '<b>✏️ 我的批注：</b><br>' + escapeHtml(m.note) + '</div>';
  }
  if(m.core || m.structure || (m.angles && m.angles.length)){
    html += '<div class="ml-ai-box">';
    html += '<h4>🤖 AI 分析</h4>';
    if(m.core) html += '<div><b>核心观点：</b>' + escapeHtml(m.core) + '</div>';
    if(m.structure) html += '<div style="margin-top:8px"><b>写作结构：</b>' + escapeHtml(m.structure) + '</div>';
    if(m.angles && m.angles.length){
      html += '<div style="margin-top:8px"><b>可论证角度：</b><ul>';
      m.angles.forEach(function(a){ html += '<li>' + escapeHtml(a) + '</li>'; });
      html += '</ul></div>';
    }
    html += '</div>';
  }
  html += '<div class="ml-actions" style="margin-top:16px">'
        + '<button class="btn btn-primary" type="button" onclick="mlAiOne(\'' + m.id + '\')">🤖 重新 AI 分析</button>'
        + '<button class="btn btn-outline" type="button" onclick="mlEdit(\'' + m.id + '\')">✏️ 编辑</button>'
        + '<button class="btn btn-outline" type="button" onclick="mlCopyOne(\'' + m.id + '\')">📋 复制</button>'
        + '<button class="btn btn-danger" type="button" onclick="mlDelete(\'' + m.id + '\')">🗑 删除</button>'
        + '</div>';
  html += '</div></div>';
  return html;
}

function mlEditHtml(){
  var m = mlState.currentId ? mlState.items.find(function(x){ return x.id === mlState.currentId; }) : null;
  var isNew = !m;
  m = m || { id:'', title:'', content:'', category:'其他', tags:[], note:'' };
  var catOpts = MATERIAL_CATEGORIES.map(function(c){
    return '<option value="' + escapeHtml(c) + '"' + ((m.category||'其他') === c ? ' selected' : '') + '>' + escapeHtml(c) + '</option>';
  }).join('');
  var html = '<div class="tool-shell ml-shell">';
  html += '<div class="ml-back"><button class="btn btn-outline" type="button" onclick="mlBackToList()">← 返回素材库</button></div>';
  html += '<div class="ml-panel">';
  html += '<h3>' + (isNew ? '➕ 添加素材' : '✏️ 编辑素材') + '</h3>';
  html += '<div class="ml-field"><label>标题</label>'
        + '<input type="text" id="mlEditTitle" class="ml-input" placeholder="给这段素材起个名字" value="' + escapeHtml(m.title||'') + '"></div>';
  html += '<div class="ml-field"><label>正文</label>'
        + '<textarea id="mlEditContent" class="ml-textarea" placeholder="粘贴素材正文…">' + escapeHtml(m.content||'') + '</textarea></div>';
  html += '<div class="ml-field"><label>分类</label>'
        + '<select id="mlEditCat" class="ml-select">' + catOpts + '</select></div>';
  html += '<div class="ml-field"><label>标签（用空格或逗号分隔）</label>'
        + '<input type="text" id="mlEditTags" class="ml-input" placeholder="如：乡村振兴 基层治理 民生" value="' + escapeHtml((m.tags||[]).join(' ')) + '"></div>';
  html += '<div class="ml-field"><label>我的批注（可选）</label>'
        + '<textarea id="mlEditNote" class="ml-textarea" style="min-height:90px" placeholder="记录这段素材怎么用、想用在哪个论点…">' + escapeHtml(m.note||'') + '</textarea></div>';
  html += '<div class="ml-actions" style="margin-top:6px">'
        + '<button class="btn btn-primary" type="button" id="mlEditSave">💾 保存</button>'
        + '<button class="btn btn-outline" type="button" onclick="mlBackToList()">取消</button>'
        + '</div>';
  html += '</div></div>';
  return html;
}
function mlBindEdit(){
  var btn = document.getElementById('mlEditSave');
  if(!btn) return;
  btn.addEventListener('click', async function(){
    var title = (document.getElementById('mlEditTitle').value || '').trim();
    var content = (document.getElementById('mlEditContent').value || '').trim();
    if(!content){ alert('正文不能为空'); return; }
    var category = document.getElementById('mlEditCat').value || '其他';
    var tagsRaw = (document.getElementById('mlEditTags').value || '').trim();
    var tags = tagsRaw ? tagsRaw.split(/[\s,，、;；]+/).filter(Boolean).slice(0, 12) : [];
    var note = (document.getElementById('mlEditNote').value || '').trim();
    var now = Date.now();
    var m;
    if(mlState.currentId){ m = mlState.items.find(function(x){ return x.id === mlState.currentId; }); }
    if(m){
      m.title = title || m.title;
      m.content = content;
      m.category = category;
      m.tags = tags;
      m.note = note;
      m.updatedAt = now;
    }else{
      m = {
        id: mlNewId(), title: title || ('素材 ' + new Date().toLocaleString()),
        content: content, category: category, tags: tags, note: note,
        source: null, core: '', structure: '', angles: [],
        createdAt: now, updatedAt: now
      };
      mlState.items.unshift(m);
    }
    await mlSaveOne(m);
    mlState.currentId = null;
    mlState.view = 'list';
    await materialRefresh();
  });
}

window.mlBackToList = function(){ mlState.view = 'list'; mlState.currentId = null; renderMaterialLibrary(); };
window.mlAddNew = function(){ mlState.currentId = null; mlState.view = 'edit'; renderMaterialLibrary(); };
window.mlView = function(id){ mlState.currentId = id; mlState.view = 'detail'; renderMaterialLibrary(); };
window.mlEdit = function(id){ mlState.currentId = id; mlState.view = 'edit'; renderMaterialLibrary(); };
window.mlDelete = function(id){
  var m = mlState.items.find(function(x){ return x.id === id; });
  showConfirm('确定删除素材「' + ((m && m.title) || '未命名') + '」吗？此操作不可撤销。', async function(){
    await mlDeleteOne(id);
    if(mlState.currentId === id){ mlState.currentId = null; mlState.view = 'list'; }
    await materialRefresh();
  });
};
window.mlCopyOne = function(id){
  var m = mlState.items.find(function(x){ return x.id === id; });
  if(!m) return;
  var text = (m.title ? m.title + '\n\n' : '') + m.content;
  var done = function(){
    var b = document.querySelector('#toolFullscreenContent .ml-actions .btn-outline[onclick*="mlCopyOne"]');
    if(b){ var t = b.textContent; b.textContent = '✅ 已复制'; setTimeout(function(){ b.textContent = t; }, 1400); }
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(function(){ fallbackCopyML(text); done(); });
  }else{ fallbackCopyML(text); done(); }
};
function fallbackCopyML(text){
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
  document.body.appendChild(ta);
  ta.select();
  try{ document.execCommand('copy'); }catch(e){}
  ta.remove();
}



/* ============================================================
   Part 2B-1：素材库 —— 选中文字浮按钮 + 快速保存弹窗
   ============================================================ */
var mlSelBtn = null;
function mlRemoveSelBtn(){
  if(mlSelBtn && mlSelBtn.parentNode) mlSelBtn.parentNode.removeChild(mlSelBtn);
  mlSelBtn = null;
}
function mlShowSelBtn(rect, text, questionEl){
  mlRemoveSelBtn();
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ml-sel-btn';
  btn.textContent = '📚 加入素材库';
  btn.style.left = (rect.left + rect.width / 2 + window.pageXOffset) + 'px';
  btn.style.top  = (rect.top + window.pageYOffset - 8) + 'px';
  btn.addEventListener('mousedown', function(e){ e.preventDefault(); e.stopPropagation(); });
  btn.addEventListener('touchstart', function(e){ e.preventDefault(); e.stopPropagation(); }, {passive:false});
  btn.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    mlRemoveSelBtn();
    mlOpenQuickSave(text, questionEl);
  });
  document.body.appendChild(btn);
  mlSelBtn = btn;
}
function mlZoneAllowed(){
  return activeZone === 'sl' || activeZone === 'zy' || activeZone === 'ms';
}
function mlSelectionHandler(){
  if(document.body.classList.contains('chat-panel-open')){ mlRemoveSelBtn(); return; }
  var fs = document.getElementById('toolFullscreen');
  if(fs && fs.style.display === 'block'){ mlRemoveSelBtn(); return; }
  if(!mlZoneAllowed()){ mlRemoveSelBtn(); return; }

  var sel = window.getSelection();
  if(!sel || sel.isCollapsed || sel.rangeCount === 0){ mlRemoveSelBtn(); return; }
  var text = String(sel.toString() || '').trim();
  if(!text || text.length < 4){ mlRemoveSelBtn(); return; }

  var range;
  try{ range = sel.getRangeAt(0); }catch(e){ mlRemoveSelBtn(); return; }
  var node = range.commonAncestorContainer;
  var el = (node && node.nodeType === 1) ? node : (node && node.parentElement);
  if(!el || !el.closest){ mlRemoveSelBtn(); return; }

  if(el.closest('textarea, input, .essay-note-input, .q-note-input, .q-note-box, .q-chat-box, .chat-history-panel, #sidebar, .ml-sel-btn')){ mlRemoveSelBtn(); return; }

  var qEl = el.closest('.question');
  if(!qEl){ mlRemoveSelBtn(); return; }

  var okArea = el.closest('.q-content, .q-material, .essay-answer, .essay-analysis, .mian-shi-answer, .essay-material');
  if(!okArea){ mlRemoveSelBtn(); return; }

  var rect = range.getBoundingClientRect();
  if(!rect || (!rect.width && !rect.height)){ mlRemoveSelBtn(); return; }
  mlShowSelBtn(rect, text, qEl);
}
document.addEventListener('mouseup', function(){ setTimeout(mlSelectionHandler, 60); });
document.addEventListener('touchend', function(){ setTimeout(mlSelectionHandler, 180); }, {passive:true});
document.addEventListener('mousedown', function(e){
  if(mlSelBtn && e.target !== mlSelBtn) mlRemoveSelBtn();
});
document.addEventListener('scroll', mlRemoveSelBtn, {passive:true});

function mlEnsureModal(){
  var ov = document.getElementById('mlModalOverlay');
  if(ov) return ov;
  ov = document.createElement('div');
  ov.id = 'mlModalOverlay';
  ov.innerHTML = '<div id="mlModalBox"></div>';
  ov.addEventListener('click', function(e){ if(e.target === ov) mlCloseModal(); });
  document.body.appendChild(ov);
  return ov;
}
function mlCloseModal(){
  var ov = document.getElementById('mlModalOverlay');
  if(ov) ov.classList.remove('show');
  var box = document.getElementById('mlModalBox');
  if(box) box.innerHTML = '';
}
window.mlCloseModal = mlCloseModal;

function mlSourceOfQuestion(qEl){
  try{
    var key = (qEl && qEl.id || '').replace(/^q-/, '');
    var item = key ? (filteredQuestions.find(function(q){ return q._key === key; }) || findQuestionByKey(key)) : null;
    if(!item) return { zone: activeZone, paper:'', index:null };
    return {
      zone: activeZone,
      paper: item._paperName || item.source || '',
      index: (typeof item._qi === 'number' ? item._qi : null)
    };
  }catch(e){ return { zone: activeZone, paper:'', index:null }; }
}

function mlOpenQuickSave(text, questionEl){
  var ov = mlEnsureModal();
  var box = document.getElementById('mlModalBox');
  var src = mlSourceOfQuestion(questionEl);
  var autoTitle = String(text).replace(/\s+/g,' ').slice(0, 24);
  var catOpts = MATERIAL_CATEGORIES.map(function(c){
    return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
  }).join('');

  box.innerHTML =
      '<h3>📚 加入素材库</h3>'
    + '<div class="ml-field"><label>标题</label>'
    +   '<input type="text" id="mlqTitle" class="ml-input" value="' + escapeHtml(autoTitle) + '"></div>'
    + '<div class="ml-field"><label>素材内容</label>'
    +   '<textarea id="mlqContent" class="ml-textarea" style="min-height:150px">' + escapeHtml(text) + '</textarea></div>'
    + '<div class="ml-field"><label>分类</label>'
    +   '<select id="mlqCat" class="ml-select">' + catOpts + '</select></div>'
    + '<div class="ml-field"><label>标签（空格 / 逗号分隔，可留空）</label>'
    +   '<input type="text" id="mlqTags" class="ml-input" placeholder="如：乡村振兴 基层治理"></div>'
    + '<div class="ml-field"><label>我的批注（可选）</label>'
    +   '<textarea id="mlqNote" class="ml-textarea" style="min-height:80px" placeholder="记下这段素材的用法 / 适用论点"></textarea></div>'
    + '<div style="font-size:12px;color:var(--text-muted)">来源：'
    +   escapeHtml([zoneName(src.zone), src.paper, src.index != null ? ('第' + (src.index + 1) + '题') : ''].filter(Boolean).join(' · '))
    + '</div>'
    + '<div id="mlModalBtns">'
    +   '<button class="btn btn-outline" type="button" onclick="mlCloseModal()">取消</button>'
    +   '<button class="btn btn-primary" type="button" id="mlqSave">💾 保存</button>'
    + '</div>';

  document.getElementById('mlqSave').addEventListener('click', async function(){
    var content = (document.getElementById('mlqContent').value || '').trim();
    if(!content){ alert('素材内容不能为空'); return; }
    var tagsRaw = (document.getElementById('mlqTags').value || '').trim();
    var now = Date.now();
    var m = {
      id: mlNewId(),
      title: (document.getElementById('mlqTitle').value || '').trim() || ('素材 ' + new Date().toLocaleString()),
      content: content,
      category: document.getElementById('mlqCat').value || '其他',
      tags: tagsRaw ? tagsRaw.split(/[\s,，、;；]+/).filter(Boolean).slice(0,12) : [],
      note: (document.getElementById('mlqNote').value || '').trim(),
      source: src,
      core: '', structure: '', angles: [],
      createdAt: now, updatedAt: now
    };
    await mlSaveOne(m);
    mlCloseModal();
    mlToast('✅ 已加入素材库');
    if(document.getElementById('toolFullscreen').style.display === 'block'){
      await materialRefresh();
    }
  });

  ov.classList.add('show');
  setTimeout(function(){
    var t = document.getElementById('mlqTitle');
    if(t) t.focus();
  }, 50);
}

function mlToast(msg){
  var d = document.createElement('div');
  d.textContent = msg;
  d.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:100020;'
    + 'background:var(--main,#3b82f6);color:#fff;padding:10px 20px;border-radius:10px;'
    + 'font-size:14px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.22);pointer-events:none;'
    + 'transition:opacity .3s ease;';
  document.body.appendChild(d);
  setTimeout(function(){ d.style.opacity = '0'; }, 1600);
  setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 2000);
}



/* ============================================================
   Part 2B-2：AI 分析 + 批量归类 + 导入导出 + 入口挂载 + 区间事件
   ============================================================ */
var ML_AI_PROMPT = [
  '你是公考申论 / 综应 / 面试教研员。下面给出一段备考素材，请完成分析。',
  '',
  '只输出一个 JSON 对象，不要任何解释文字、不要 markdown 代码块。JSON 结构如下：',
  '{',
  '  "category": "从这些里选一个：经济|政治|文化|社会|生态|人物|名言金句|数据统计|政策文件|案例事例|其他",',
  '  "tags": ["3-6 个关键词，每个不超过 6 字"],',
  '  "core": "用一句话概括这段素材的核心观点，30 字以内",',
  '  "structure": "写作结构分析。说明这段素材适合放在议论文的什么位置（开头引入 / 分论点论据 / 结尾升华），可以支撑哪些论点，怎样展开。120 字以内",',
  '  "angles": ["可以论证的角度 1", "角度 2", "角度 3"]',
  '}',
  '',
  '要求：',
  '1. 分类必须从给定列表中选，不要自创；',
  '2. tags 要具体，便于以后检索；',
  '3. structure 要落到"怎么用"，不要空泛；',
  '4. 全部使用中文。'
].join('\n');

function mlExtractJson(text){
  var s = String(text || '');
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  var start = s.indexOf('{'), end = s.lastIndexOf('}');
  if(start < 0 || end <= start) return null;
  try{ return JSON.parse(s.slice(start, end + 1)); }catch(e){ return null; }
}

async function mlAiAnalyzeOne(m){
  var resp = await requestAI({
    provider: aiConfig.provider || 'deepseek',
    model: aiConfig.model || (AI_ENDPOINTS[aiConfig.provider || 'deepseek'] || {}).model,
    messages: [
      { role:'system', content: ML_AI_PROMPT },
      { role:'user', content: '素材标题：' + (m.title || '') + '\n\n素材正文：\n' + String(m.content || '').slice(0, 4000) }
    ],
    temperature: 0.3,
    max_tokens: 1600
  });
  var data = resp && resp.data ? resp.data : resp;
  if(data && data.error){
    throw new Error((data.error && data.error.message) || JSON.stringify(data.error));
  }
  var content = '';
  if(data && data.choices && data.choices[0]){
    var msg = data.choices[0].message || data.choices[0].delta || {};
    content = msg.content || '';
  }
  if(!content) throw new Error('AI 返回为空');
  var obj = mlExtractJson(content);
  if(!obj) throw new Error('AI 返回的不是有效 JSON');
  return obj;
}

window.mlAiOne = async function(id){
  var m = mlState.items.find(function(x){ return x.id === id; });
  if(!m) return;
  if(!aiConfig || !aiConfig.apiKey){ alert('请先点左下角 ⚙️ 配置 API Key'); return; }
  mlState.busy = true;
  mlState.busyText = '正在分析「' + (m.title || '未命名') + '」…';
  if(mlState.view === 'list') renderMaterialLibrary();
  try{
    var r = await mlAiAnalyzeOne(m);
    m.category = MATERIAL_CATEGORIES.indexOf(r.category) >= 0 ? r.category : (m.category || '其他');
    m.tags = Array.isArray(r.tags) ? r.tags.slice(0, 8).map(String) : (m.tags || []);
    m.core = String(r.core || '');
    m.structure = String(r.structure || '');
    m.angles = Array.isArray(r.angles) ? r.angles.slice(0, 6).map(String) : [];
    m.updatedAt = Date.now();
    await mlSaveOne(m);
    mlToast('✅ AI 分析完成');
  }catch(e){
    alert('AI 分析失败：' + (e && (e.message || e)) + '\n\n提示：若直连不通，请在 AI_PROXY_URL 配置中转。');
  }finally{
    mlState.busy = false;
    mlState.busyText = '';
    await materialRefresh();
  }
};

var ML_GROUP_PROMPT = [
  '你是公考素材库的归类助手。下面给出若干条备考素材（编号 + 标题 + 摘要）。',
  '',
  '任务：',
  '1. 为每条素材指定一个分类（从以下列表里选：经济|政治|文化|社会|生态|人物|名言金句|数据统计|政策文件|案例事例|其他）；',
  '2. 为每条素材提取 2-5 个关键词标签；',
  '3. 指出哪些素材属于同一主题、可以放在一起使用（同一主题的编号归为一组）。',
  '',
  '只输出 JSON，不要任何解释、不要 markdown 代码块：',
  '{',
  '  "items": [ { "id": "原编号", "category": "分类", "tags": ["标签1","标签2"] } ],',
  '  "groups": [ { "theme": "主题名", "ids": ["编号1","编号2"] } ]',
  '}',
  '',
  '全部使用中文。'
].join('\n');

window.mlAIOrganizeAll = async function(){
  if(!mlState.items.length){ alert('素材库为空'); return; }
  if(!aiConfig || !aiConfig.apiKey){ alert('请先点左下角 ⚙️ 配置 API Key'); return; }
  if(mlState.busy) return;
  mlState.busy = true;
  mlState.busyText = 'AI 正在对 ' + mlState.items.length + ' 条素材做归类…';
  renderMaterialLibrary();
  try{
    var batch = mlState.items.slice(0, 60);
    var payload = batch.map(function(m, i){
      return (i + 1) + '. [id=' + m.id + '] ' + (m.title || '未命名')
        + '\n摘要：' + String(m.content || '').replace(/\s+/g, ' ').slice(0, 120);
    }).join('\n\n');

    var resp = await requestAI({
      provider: aiConfig.provider || 'deepseek',
      model: aiConfig.model || (AI_ENDPOINTS[aiConfig.provider || 'deepseek'] || {}).model,
      messages: [
        { role:'system', content: ML_GROUP_PROMPT },
        { role:'user', content: payload }
      ],
      temperature: 0.2,
      max_tokens: 4000
    });
    var data = resp && resp.data ? resp.data : resp;
    if(data && data.error) throw new Error((data.error && data.error.message) || JSON.stringify(data.error));
    var content = '';
    if(data && data.choices && data.choices[0]){
      var msg = data.choices[0].message || data.choices[0].delta || {};
      content = msg.content || '';
    }
    if(!content) throw new Error('AI 返回为空');
    var obj = mlExtractJson(content);
    if(!obj) throw new Error('AI 返回的不是有效 JSON');

    var map = {};
    (obj.items || []).forEach(function(it){ if(it && it.id) map[it.id] = it; });
    var changed = 0;
    for(var i=0;i<mlState.items.length;i++){
      var m = mlState.items[i];
      var it = map[m.id];
      if(!it) continue;
      if(MATERIAL_CATEGORIES.indexOf(it.category) >= 0) m.category = it.category;
      if(Array.isArray(it.tags) && it.tags.length) m.tags = it.tags.slice(0,8).map(String);
      m.updatedAt = Date.now();
      await mlSaveOne(m);
      changed++;
    }

    var groups = Array.isArray(obj.groups) ? obj.groups : [];
    if(groups.length){
      var lines = groups.map(function(g){
        var titles = (g.ids || []).map(function(id){
          var mm = mlState.items.find(function(x){ return x.id === id; });
          return mm ? (mm.title || '未命名') : null;
        }).filter(Boolean);
        return '· ' + (g.theme || '未命名主题') + '：' + (titles.join('、') || '（无匹配素材）');
      }).join('\n');
      alert('✅ AI 归类完成，共更新 ' + changed + ' 条素材。\n\n发现的主题分组：\n' + lines);
    }else{
      alert('✅ AI 归类完成，共更新 ' + changed + ' 条素材。');
    }
  }catch(e){
    alert('AI 归类失败：' + (e && (e.message || e)));
  }finally{
    mlState.busy = false;
    mlState.busyText = '';
    await materialRefresh();
  }
};

window.mlExport = function(){
  if(!mlState.items.length){ alert('素材库为空，无法导出'); return; }
  var payload = {
    _type: 'helium_material_backup_v1',
    version: 1,
    exportedAt: new Date().toISOString(),
    count: mlState.items.length,
    items: mlState.items
  };
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '素材库_' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 0);
};

window.mlImport = async function(input){
  var file = input && input.files && input.files[0];
  if(!file) return;
  try{
    var text = await file.text();
    var data = null;
    try{ data = JSON.parse(text); }catch(e){ alert('文件不是合法 JSON'); return; }
    var items = null;
    if(data && data._type === 'helium_material_backup_v1' && Array.isArray(data.items)) items = data.items;
    else if(Array.isArray(data)) items = data;
    if(!items){ alert('文件格式不对：不是本程序导出的素材库备份'); return; }

    var merged = 0, skipped = 0;
    var existing = {};
    mlState.items.forEach(function(m){ existing[m.id] = m; });

    for(var i=0;i<items.length;i++){
      var it = items[i];
      if(!it || !it.content){ skipped++; continue; }
      var id = it.id || mlNewId();
      if(existing[id]){ skipped++; continue; }
      var m = {
        id: id,
        title: String(it.title || '未命名素材'),
        content: String(it.content),
        category: MATERIAL_CATEGORIES.indexOf(it.category) >= 0 ? it.category : (it.category || '其他'),
        tags: Array.isArray(it.tags) ? it.tags.slice(0,12).map(String) : [],
        note: String(it.note || ''),
        source: it.source || null,
        core: String(it.core || ''),
        structure: String(it.structure || ''),
        angles: Array.isArray(it.angles) ? it.angles.slice(0,8).map(String) : [],
        createdAt: Number(it.createdAt) || Date.now(),
        updatedAt: Number(it.updatedAt) || Date.now()
      };
      await mlSaveOne(m);
      existing[id] = m;
      merged++;
    }
    alert('✅ 导入完成：新增 ' + merged + ' 条' + (skipped ? '，跳过 ' + skipped + ' 条（重复或无效）' : ''));
    await materialRefresh();
  }catch(e){
    alert('导入失败：' + (e && (e.message || e)));
  }finally{
    if(input) input.value = '';
  }
};

(function installMaterialEntry(){
  if(typeof window.openToolFullscreen !== 'function') return;
  var _orig = window.openToolFullscreen;
  window.openToolFullscreen = function(k){
    if(k === 'material'){
      var box = document.getElementById('toolFullscreen');
      if(!box) return;
      box.style.display = 'block';
      document.body.style.overflow = 'hidden';
      var titleEl = document.getElementById('toolFullscreenTitle');
      if(titleEl) titleEl.textContent = '📚 素材库';
      var cb = document.querySelector('#toolFullscreen .tool-head button');
      if(cb) cb.textContent = '✕ 返回题库';
      document.querySelectorAll('.sidebar-tool-btn').forEach(function(b){
        b.classList.toggle('active', b.dataset.tool === 'material');
      });
      materialOpen().catch(function(e){ console.warn('[素材库]', e); });
      return;
    }
    return _orig.apply(this, arguments);
  };
})();

/* ---------- Part 3：正确率区间下拉事件绑定 ---------- */
(function bindRatioRange(){
  var sel = document.getElementById('ratioRangeFilter');
  if(!sel || sel.__bound) return;
  sel.__bound = true;
  sel.addEventListener('change', function(){
    filterState.ratioRange = this.value;
    if(isRatioRangeMode(this.value)){
      var mn = document.getElementById('minRatioInput');
      var mx = document.getElementById('maxRatioInput');
      if(mn) mn.value = '';
      if(mx) mx.value = '';
      filterState.minRatio = '';
      filterState.maxRatio = '';
    }
    currentPage = 1;
    saveView();
    renderQuestions();
  });
})();

/* 暴露给外部（调试用） */
window.__materialDebug = { mlState: mlState, materialRefresh: materialRefresh, materialOpen: materialOpen };

console.log('✅ 增量补丁已加载（判断题 + 素材库 + 区间下拉）');
})();
