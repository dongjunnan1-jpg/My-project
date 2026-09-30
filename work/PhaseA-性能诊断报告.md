# Phase A 性能架构诊断报告（只读，未修改任何代码）

- 生成时间：2026-09-27
- 诊断对象：`/Users/helium/Library/Mobile Documents/com~apple~CloudDocs/我的程序/My project/index.html`
- 该文件 sha256：`c29bdbb937935e96adf4f66f820d670f45db4f6e7a5c568debfb2b2ff5cc5417`（诊断前后一致，**零修改**）
- 代码内 `IDB_VER`：`1`
- Git：分支 `main` = `7e0487f` = `origin/main`；工作区干净（仅未跟踪 `work/`、`.workbuddy/`）
- 测量环境：**桌面 Chrome（headless）**，非 iPad。凡 iPad 专有结论均标注 `需要真实 iPad 验证`
- 证据文件：
  - `work/perf_phaseA_probe.js`（只读探针，注入式埋点）
  - `work/perf-phaseA-import.log` / `work/perf-phaseA-measure.log` / `work/perf-phaseA-timing.log`
  - `work/perf-phaseA-evidence.json`

---

## 0. 先纠正 6 处与描述不符的事实（以代码/实测为准）

| # | 你的描述 | 实测事实 | 证据 |
|---|---|---|---|
| 1 | 两个 Bug 已推到 GitHub `main`，`origin/main = 7e0487f` | ✅ **正确** | `git ls-remote origin refs/heads/main` = `7e0487f…` |
| 2 | 当前 qzdb 已是 version 2，stores = `kv` + `meta`，代码已改成 `IDB_VER = 2` | ❌ **不符** | 当前工作区（=合并后的 main）代码是 `IDB_VER=1`；浏览器实测 `qzdb` **version = 1**，`objectStoreNames = ["kv"]`，**不存在 meta store** |
| 3 | `meta` store / `window.metaIndex` / `buildMetaForFile` / `buildMetaIndex` / `saveMetaIndex` 的现状 | ❌ **一行都不存在** | main 中 5 个标识符出现次数均为 0；`plan-a-meta-index` 分支同样为 0；`stash@{0}` 中也为 0 |
| 4 | `zoneDataComplete(zone)` 安全守卫已加入 | ⚠️ **不在当前工作区** | 它在 `stash@{0}`（`WIP on perf/phase0-prepfiles-audit`）里，**未应用**。当前 `cleanInvalidWrongSilent`(4323) **没有**守卫 |
| 5 | `_prepFiles ≈ 0.78MB`、`db ≈ 25MB / 15180 题` | ⚠️ **量级已过时** | 实测 174,385 题：`db` 序列化文本 **243.2M 字符**；JS 堆 **412.6MB** |
| 6 | `countZoneQuestions` 命中 `db[sl]`/`db[zy]` 是热点，不能换成 `index.count` | ⚠️ **部分不符** | 代码 5371：**gk/mk/sy 已经走 `index[zone].count`**；只有 sl/zy 才扫 db（因为要数 subquestion） |

**另外两处工作区状态变化（非我所为，需你确认）**：
- 13:10 前后，主工作区从 `perf/phase0-prepfiles-audit` 切到 `main`，原有的 `22 增 / 1 删`（G1 + `IDB_VER=2`）已被 **`git stash` 保存为 `stash@{0}`**（reflog：`reset: moving to HEAD` + `checkout: moving from perf/… to main`），**未丢失，也未应用**。
- 主工作区的 `docs/` 与 `.workbuddy/` 目录已不存在，`work/` 被清空到只剩 2 个 `.diff`。测试证据的副本仍完整保存在 fix worktree（`/Users/helium/qz-worktrees/fix-historical-question-bugs/work/`）。

---

## 1. 当前实际架构（真实代码）

### 启动链
```
DOMContentLoaded
 └─ init()
     ├─ initDrawer()
     ├─ await idbOpen()                     // 3855，indexedDB.open('qzdb', IDB_VER=1)
     ├─ await migrateFromLocalStorage()     // 旧 localStorage → IDB（幂等）
     ├─ await loadAll()                     // 3961 ← 关键
     ├─ 全库补全 category / subType         // 遍历 db 的「所有 zone × 所有文件 × 所有题」
     ├─ bumpDbEpoch()
     ├─ await loadView()
     ├─ loadStudyPosition()
     ├─ await loadWrong(); loadFav(); loadDaily(); loadExam()
     ├─ await loadReview(); backfillReviewFromWrongSet()
     ├─ await loadNotesAsync()              // 申论笔记 → essayNotesCache
     └─ renderAll()                         // 5356
```

### `loadAll()`（3961）：**启动即把 6 个分区的全部题目对象读进内存**
```js
const idx = await idbGet('idx');                       // 轻量清单
db = {}; ZONE_IDS.forEach(z => db[z] = {});
for (const z of ZONE_IDS)                              // 6 个分区
  for (const m of index[z])                            // 该分区所有文件
    db[z][m.id] = await idbGet('file:'+z+':'+m.id);    // ← 完整 questions[] 整包读入
bumpDbEpoch();
```
实测：24 个文件 → **27 次 `IDBObjectStore.get`**（`idx`+24 file+`wrong`+`fav`），耗时 **701.9ms**。

### 渲染链
```
renderQuestions()                    // 7971
 ├─ filteredQuestions = getFiltered()                // 6432
 │    └─ getZoneQuestions(activeZone,'__all__')      // 5550
 │         ├─ 命中 _snap(zone+epoch+fileCount) → 直接返回同一数组
 │         └─ 未命中 → preparedFile(zone,f) 逐文件展开成 {...q} 副本
 │                     → 缓存进 _prepFiles[zone][fileId]
 │                     → 汇总成 _snap.arr
 │    → 逐级 .filter()（模块/题型/关键词/年份/省份/来源/状态/正确率）
 │    → .sort()（默认排序或正确率排序）
 ├─ renderZoneStats()               // 5609，遍历整个分区算「已做/正确/正确率」
 ├─ 只把 PAGE_SIZE=20 题拼成 html → content.innerHTML
 └─ renderZoneTabs / renderModuleBar / updateFilterOptions ...
```

### 常驻大对象
| 变量 | 内容 | 释放时机 |
|---|---|---|
| `index` | 每文件轻量元数据 `{id,fileName,zone,module,uploadTime,size,count}` | 仅整体重建 |
| `db` | **完整题目对象** `{fileName,zone,module,uploadTime,size,questions[],answered{}}` | 仅 `loadAll` / 导入时整体重建 |
| `_prepFiles` | `zone→fileId→[{...q} 浅拷贝 + 派生标量]` | **只在 `bumpDbEpoch()`（题库变更）或单文件失效时清空；`switchZone` 不清** |
| `_snap.arr` | 当前分区快照（引用 `_prepFiles` 里的副本） | `dropSnapshot()` |
| `q._restrictedSearchText` | 受限搜索文本（gk/mk/sy） | `releaseSearchTextCache(zone)`：切分区 / 搜索清空时 |
| `q._searchText` | 全文搜索文本（sl/zy/ms） | 同上 |
| `_gfbMemo` / `_moduleStatsMemo` | 筛选基础集 / 模块统计 memo | 签名变化时 |

---

## 2. 最大内存来源（按实测证据，不用猜测性百分比）

测量条件：真实题库 **24 个文件 / 174,385 题**（gk 行测总库 7 文件 51,917 题、sy 事业单位总库 4 文件 61,288 题、mk 历年粉笔模考 13 文件 61,180 题），桌面 Chrome headless，每次测点均 `HeapProfiler.collectGarbage` 后读取 `Runtime.getHeapUsage`。

| 测点 | JS 堆 | 说明 |
|---|---|---|
| M0 空库 | **1.8 MB** | 基线 |
| M1 只导入 gk（51,917 题） | 111.3 MB | |
| M1 再导入 sy（+61,288 题） | 219.6 MB | |
| M1 再导入 mk（+61,180 题） | **393.5 MB** | 导入态 |
| M2 冷启动完成（`loadAll` + 首屏） | **412.6 MB** | 稳态起点 |

### 归因（清缓存 A/B，实测 Δ）

| 组成 | 实测 | 依据 |
|---|---|---|
| `_prepFiles`（3 个分区展开副本，174,385 份）+ `_snap` | **24.2 MB** | M9：清空 `_prepFiles`+`_snap` 后 432.6 → 408.4 MB |
| **`db`（题目原始对象）** | **≈ 386 MB** | 412.6 − 24.2 − 1.8(基线) |
| `embedderHeapUsed`（DOM/引擎相关） | 15.5 MB | `Runtime.getHeapUsage.embedderHeapUsedSize` |
| DOM | 5,509–9,286 节点；`#content` 恒定 **20 题** | `Document.getElementsByTagName('*')` |
| IndexedDB 磁盘占用 | 131 MB | `navigator.storage.estimate()` |

**`db` 的数据体量**（`JSON.stringify(db[zone])` 字符数）：
`gk 69,005,671` + `sy 71,935,704` + `mk 114,066,623` = **255,007,998 字符 ≈ 243 MB 字符量**。

### 结论
**最大内存来源是 `db`：为了显示当前 20 道题，程序在启动时就把 6 个分区的全部题目对象（174k 题，≈386MB）常驻 JS 堆。**
`_prepFiles` 这份"展开副本"只占 24.2MB，**不是**大头（此前把它当成主因是误判）。
搜索文本缓存（受限）实测峰值约 +21.9MB（M6 453.8MB → M7 清空后 432.6MB），且可释放。

---

## 3. 最大 CPU 来源（页内实测，`--phase=timing`）

| 操作 | 耗时 | 调用链 | 是否可复用缓存 |
|---|---|---|---|
| `loadAll()` IDB 全量读 + 重建 db | **701.9 ms** | 启动一次 | 每次冷启动都要 |
| 展开 mk（61,180 题） | 33.5 ms | `getZoneQuestions→preparedFile→prepareQuestion` | 是（`_prepFiles`） |
| 展开 sy（61,288 题） | 61.4 ms | 同上 | 是 |
| 展开 gk（51,917 题） | 43.5 ms | 同上 | 是 |
| `getFiltered()` 无筛选 gk | **64.5 ms** | 全量 `.sort()` | 否（每次渲染都做） |
| `getFiltered()` 无筛选 mk | **163.6 ms** | 同上（多级 sort 比较器） | 否 |
| **首次搜索 gk（建立 51,917 条受限搜索文本 + 过滤）** | **240.5 ms** | `getZoneSearchText→buildRestrictedSearchText→filter` | 是（第二次 = **22.4 ms**） |
| `releaseSearchTextCache('gk')` | 2.4 ms | — | — |
| `switchZone('gk'→'sy')` | **180.9 ms** | `renderAll()` 全套 | 否 |
| `switchZone('sy'→'mk')` | **220.4 ms** | 同上 | 否 |
| `updateFilterOptions()`（mk） | **83.4 ms** | 遍历全分区 + 每题 3 次 `String.replace` + 1 次正则 | 否 |
| `renderZoneStats()`（mk） | 0.6–1.1 ms | 遍历全分区，但 `_answered===undefined` 早退 | 否（但很便宜） |
| `renderModuleBar()`（mk） | 12.9 ms | 全分区 `qzModule` 计数（有 memo） | 是（签名命中） |
| `goPage()` 翻页 | 首 51.1 ms，其后 18.8–19.8 ms | `renderQuestions()` | 否 |

**主循环内的计数器（整个测量期间，15 步交互累计）**：

| 计数器 | 次数 | 说明 |
|---|---|---|
| `prepareQuestion` | **226,302** | 展开副本（1.3× 总题量） |
| `buildSearchText` / `buildRestrictedSearchText` | 各 **207,668** | 搜索文本构建（含被释放后重建） |
| `getZoneQuestions` | 240 | |
| `getFiltered` | 115 | |
| `renderQuestions` | **94** | |
| `preparedFile` | 44 | |
| `idbGet`（`IDBObjectStore.get`） | **316** | 全部来自启动 + 少量加载，**刷题/翻页/搜索过程 0 次** |
| 大数组 `.filter()`（>1 万） | 19 次 / **1,023,583** 元素 | |
| 大数组 `.sort()`（>1 万） | 92 次 / **4,868,789** 元素 | ← 排序是最贵的重复劳动 |
| Long Task（>50ms） | 11 次，最长 **681 ms** | 全部集中在 `switchZone` / 搜索首次建立 |

**FPS**（翻页 20 次，headless Chrome，仅作趋势参考）：平均 16.57ms/帧，p95 17.2ms，**最长 29.4ms**，无 Long Task。

---

## 4. iPad 卡顿原因

### 已确认（桌面实测 + 代码证据）
1. **常驻内存 ≈ 全部题库对象**：174k 题 = 412.6MB JS 堆，其中 `db` ≈386MB。用户题库若含 sl/zy/ms（申论 105MB + 综应 82MB + 面试 128MB + 2800题 24MB 源 JSON），`db` 还会显著增大 → `需要真实 iPad 验证` 具体数值。
2. **排序是最贵的重复劳动**：92 次大数组 sort / 4.87M 元素；无筛选时 `getFiltered()` 每次渲染都对整个分区重排（gk 64.5ms / mk 163.6ms）。
3. **搜索首字最贵**：240.5ms（给 5 万题现算受限搜索文本）；但缓存命中后 22.4ms。
4. **切分区分区 DOM 全量重渲染**：180–220ms，并伴随 628–681ms 的 Long Task。
5. **`_prepFiles` 不会随切分区释放**：切回 gk 后 `prep = {gk:51917, mk:61180, sy:61288}` —— 三个分区的副本永久常驻（实测只占 24.2MB，属"小而长"的泄漏）。

### 高概率（有代码依据，未在 iPad 复现）
6. **内存压力峰值出现在导入**：`handleFiles` 对每个文件起 `FileReader` 并发 `JSON.parse`（实测 `jsonParse` 252 次 / 1.12 亿字符），峰值远高于稳态。iPad 3GB RAM 上一次性导入 24 个大文件极易触发 safari 杀进程。
7. **Safari 的堆上限远低于桌面 Chrome**：桌面 412.6MB 只是 JS 堆；iPad Safari 同规模会叠加 WebContent 进程、图像 Blob、渲染层 → 到 1.5GB 量级即可解释"崩溃"。

### 尚未确认
8. 具体到 iPad 9 的数值（启动堆、切换耗时、FPS、Long Task）—— `需要真实 iPad 验证`。
9. 用户题库完整规模（含 sl/zy/ms）下的 `db` 实测值 —— 本次只灌了 3 个行测类分区。

---

## 5. Phase A 下一步（最小方案，**待你确认后才动代码**）

### A-0 前置（必做，成本极低）
**先应用 `stash@{0}`**（`IDB_VER=2` + `zoneDataComplete` 守卫），否则：
- 当前代码 `IDB_VER=1`，而真机浏览器的 `qzdb` 若已被 v2 写过 → 打开 v1 会 `VersionError` → `_db=null` → 就是之前修过的"数据全丢"故障；
- `cleanInvalidWrongSilent` 在数据不完整时会误删 wrongSet，没有守卫。
> 注意：`stash@{0}` 是基于旧 main（`91f209e`）的，而当前 main 是 `7e0487f`（多了两个 Bug 修复）。需要在新分支上重做这两处，而不是 `git stash pop` 硬套。

### 第一步（推荐，1 行级，零语义变化）
**在 `switchZone()` 里释放旧分区的展开副本**：
```js
// 与 8718 的 releaseSearchTextCache(activeZone) 同一位置、同一语义
if(_prepFiles[activeZone]) _prepFiles[activeZone] = {};
if(_snap.zone === activeZone) dropSnapshot();
```
- 收益：常驻内存减少"已访问但非当前分区"的副本（本次实测最多 24.2MB；gk+sy+mk 全逛过时约 3 倍于当前分区）。
- 代价：切回该分区需重建（实测 mk 33.5ms / sy 61.4ms / gk 43.5ms）——**远小于切分区本身的 180–220ms**，用户无感。
- 风险：极低。`_prepFiles` 是纯派生缓存，唯一语义约束是"题库变更必须整批作废"，已由 `bumpDbEpoch` 保证。

### 第二步（Phase A 正题：元数据索引 + 按需读取）
1. **先在 IDB v2 升级里建 `meta` store**（当前 `onupgradeneeded` 只建 `kv`）。
2. `meta` 只放**不可变**属性：`zone / fileId / qi / module / subType / leafType / year / province / source / correctRatio / type(单多选) / qid`。
   - ⚠️ **不要放 `answered` / `correct` / 收藏 / 笔记**：它们每次作答都变，放进 meta 会导致"每答一题重写 meta"。它们已经在 `file.answered` / `wrong` / `fav` 里，保持现状。
   - ⚠️ **不要放 `searchText`**：实测受限搜索文本 ≈ 240 字符/题，51,917 题 ≈ +21.9MB；放进 meta 等于把题库正文再复制一份，与"轻量元数据"目标相悖。搜索应继续走"按需构建 + 用完释放"。
3. 把"只依赖元数据"的路径切到 meta：`renderZoneTabs` / `countZoneQuestions` / 模块与年份省份来源下拉 / `getFiltered` 的筛选与排序。
4. 正文按需读：当前页 20 题（或 20±1 页窗口）从 `db`/IDB 取，离开窗口释放。
5. 必须同步改造的**全库扫描函数**（否则会读到空 `db`）：
   `findQuestionByKey`(8793) / `findQuestionByContent`(8813) / `findQuestionByQidPart`(8834) / `findQuestionByKeyDeep`(9178) / `exportBackup`(9274) / `fullDiagnosticScan` / `cleanInvalidWrongSilent`(4323) / 启动期 `category/subType` 补全循环 / `qzLocalValidQuestion`(12465) / 模拟考试 `examFetchQuestions`(15466)。
6. **分阶段灰度**：先让 meta 与 `db` 并存（meta 只做"校验 + 计数 + 下拉选项"），不动正文；确认 meta 与 `db` 逐字段一致后，再切正文按需读。

---

## 6. 风险（若实施第二步）

| 领域 | 影响 | 缓解 |
|---|---|---|
| 数据一致性 | 中：meta 与 `db` 可能不同步（导入/删除/去重刷新时） | 复用 `_dbEpoch` 做版本闸门；meta 只读、由入库路径统一重建 |
| wrongSet | 中：`cleanInvalidWrongSilent` 依赖"全库白名单" | 保留 `zoneDataComplete` 守卫；白名单改由 meta 提供 |
| answered | 高：正文按需读后，"已做/正确率"统计必须走 meta + `file.answered` | 统计口径已在 `isAnsweredCorrect`；改造成"每文件 answered map + meta 索引"即可 |
| 收藏 / 笔记 | 低：独立于题目正文 | 不动 |
| review（复盘） | 中：复盘需要跨题跳转 | 走 meta 定位 → 按需读该题 |
| search | 高：无法只搜 meta（meta 不含正文） | 搜索保持"按需构建 + 释放"；或后续做独立倒排/分片 |
| import / export | 高：导出/导入全量题目 | 导入仍写 `db`（一次性）；导出改为流式遍历 IDB 而非遍历内存 `db` |
| AI | 低：AI 用 `findQuestionByKey` → 需改为 meta 定位 | 同上 |
| essay / 综应材料 | 中：`_materials` / 试卷壳结构复杂 | sl/zy 本轮**不纳入**按需读范围，保持现状 |
| 单选题 / 多选判定 | 无：与本次改动无关 | 不改动 |

---

## 7. 是否值得实施

**值得，但建议分两步走，并先做 A-0。**

| 步骤 | 收益假设 | 依据 | 建议 |
|---|---|---|---|
| A-0 应用 `stash@{0}` 两处 | 修复已知数据丢失风险 | `IDB_VER` 与真机库版本可能不一致 | **强烈建议先做** |
| 第一步 释放旧分区 `_prepFiles` | 常驻内存 −(已访问非当前分区副本)，实测上限 24.2MB | M9 Δ=24.2MB | 低风险，可先落地 |
| 第二步 meta + 按需读正文 | **主收益**：直击 ≈386MB 的 `db` 常驻 | 见 §2 | 需先接受 §6 的改造面 |

**结论**：真正的大头是 `db`（≈386MB / 174k 题），不是 `_prepFiles`（24.2MB）也不是搜索缓存（可释放）。所以：
- 只做第一步 → 收益有限（几十 MB），解决不了 1.5GB 问题；
- 要解决"1.5GB / 崩溃"，**必须做第二步**（让正文不再常驻），但它同时要改造 §5.5 列出的 10 个全库扫描点，属于中大型重构，需要你明确确认范围后再动手。

**当前状态：未修改任何代码，等你确认。**
