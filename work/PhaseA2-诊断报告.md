# Phase A-2 诊断报告：Meta Index + 正文按需读取

> **状态：只读诊断。本轮未修改任何业务代码。**
> 基线 worktree：`/Users/helium/qz-worktrees/perf-phaseA-idb2`
> 分支/HEAD：`perf/phaseA-idb2-prepcache` @ `d451ad3`
> `index.html` sha256：`5fc3fe9d80e7f8ec3b26984df97ef1d1235602fd506894639b3376254a7646d8`（与 HEAD 逐字节一致，全程零修改）
> 测试数据：真实全量题库 `174,385 题`（gk 51,917 / mk 61,180 / sy 61,288），origin `http://127.0.0.1:47831`
> 实测环境：Chrome 无头（`--js-flags=--expose-gc`）+ CDP `HeapProfiler.collectGarbage` / `Runtime.getHeapUsage` / `HeapProfiler.takeHeapSnapshot`
> **⚠️ 所有数字来自桌面 Chrome，iPad Safari 的绝对值需按 §13 单独复测。**

---

## 0. 本轮交付物与纪律声明

### 0.1 新增证据文件（全部落盘，可自行打开核对）

| 文件 | 内容 |
|---|---|
| `work/phaseA2_field_profile.js` / `work/phaseA2-field-profile.json` | 全量 77 文件 / 192,356 题 字段级体积剖析 |
| `work/phaseA2_proto.js` / `work/phaseA2-proto.json` / `.log` | 主原型实测（14/14 断言） |
| `work/phaseA2_proto.js --empty` → `work/phaseA2-empty-baseline.json` | 空库基线 |
| `work/phaseA2_heap_attr.js` / `work/phaseA2-heap-attr.json` / `.log` / `-empty.log` | 堆快照按类型归因 |
| `work/phaseA2_retainers.js` / `work/phaseA2-retainers.json` / `.log` | 反向 retainer 归因 + 链追踪 |
| `work/phaseA2_holders_check.js` / `work/phaseA2-holders.log` | **决定性验证**：持有者探针（不依赖堆快照） |
| `work/phaseA2_floor_check.js` / `work/phaseA2-floor.json` / `phaseA2-floor-{nosrc,pos,nosrcarr}.log` | **本轮新增**：目标架构「地板堆」实测 + 4 种 meta 变体对比 |

### 0.2 未触碰项

- `index.html` 零修改（sha256 与 `d451ad3` 一致）
- 未 push / merge / reset / force push / stash pop / stash drop / 删 worktree
- `main`（`7e0487f`）、`perf/phase0-prepfiles-audit`（`91f209e`）、`stash@{0}` / `stash@{1}`、`fix/historical-question-bugs` 均未触碰
- 轮次实测只在 **profile 副本** `$TMPDIR/qz-perf-profile-47831-a2d` 上进行（主 profile 未被写入）

---

## 1. 当前实际架构

### 1.1 冷启动数据流（现状）

```
IndexedDB(qzdb v2, store=kv)
  ├─ key "idx"                    → index{zone:[{id,name,count,...}]}
  └─ key "file:<zone>:<fileId>"   → { id, questions:[...] , answered:{...} , ... }
        │
        │  init() 11552 → await loadAll() 11564
        │  loadAll 3970：对 index 里每个 file 调 idbGet('file:...') 3979-3980
        ▼
   db[zone][fileId] = 原始 file 对象（含全部 questions 正文）      ← 386MB 级
        │
        │  任何渲染/筛选/统计触发
        ▼
   getZoneQuestions(zone,'__all__') 5594
        └─ preparedFile(zone,f) 5555 → prepareQuestion() 5542
              p = { ...q }        ← 浅拷贝展开副本，写入 _key/_qi/_fileId/_zone/_answered
              缓存进 _prepFiles[zone][fileId]                      ← 24.2MB 级
        │
        ▼
   _snap.arr（整分区展开数组快照，带 epoch 校验）                ← 与 _prepFiles 同批对象
   getFilterBaseQuestions 5858 → _gfbMemo.arr（过滤基础集缓存）  ← 与 _snap 同批对象
        │
        ▼
   getFiltered(skipSort) 6476   ← 每次 renderQuestions 全库线性扫 + 排序
        ▼
   filteredQuestions (词法 let, 3575)
   window.filteredQuestions (=filteredQuestions, 7854/8025)      ← ⚠️ 泄漏点，见 §9
        ▼
   renderQuestions 8015 → content.innerHTML = 一页 20 题（PAGE_SIZE=20, 3514）
```

### 1.2 常驻内存结构清单（带真实行号）

| 结构 | 行号 | 内容 | 实测常驻 |
|---|---|---|---|
| `db` | 3571 | 6 个 zone → fileId → file 对象（含全部正文） | **≈ 386MB** |
| `_prepFiles` | 5485 附近 | zone → fileId → 展开副本数组（`{...q}` 浅拷贝） | ≈ 24.2MB |
| `_snap.arr` | 5455 / 5594 | 整分区展开数组快照 | 与 `_prepFiles` **共享同一批对象** |
| `_gfbMemo.arr` | 5824 / 5858 | 过滤基础集缓存 | 同上，共享 |
| `filteredQuestions` | 3575 | 当前筛选结果数组 | 同上，共享 |
| `window.filteredQuestions` | **7854 / 8025** | 与上一行同一个数组，**额外挂到 window** | 同上，共享（但**阻止释放**） |
| `index` | 3570 | 分区 → 文件元信息（24 file） | `indexJsonChars = 3352`，可忽略 |
| `wrongSet` / `favorites` / `reviewState` | 3694 / 3695 / 3715 | 用户状态（按 key 存字符串） | 本 profile 为空 |

**关键结构事实（逐字引用，见 §2.3/§9）**：

```js
// 3989
function saveFile(z,id){ markAnswersDirty(); return idbSet('file:'+z+':'+id, db[z][id]); }    // fire-and-forget
```

```js
// 8576
if(f){ if(!f.answered) f.answered={}; f.answered[key]=letter; saveFile(activeZone, item._fileId); }
```

即：**用户每答一题，都会把整个 file 对象（最多 26,601 题 / 30MB JSON）重新写回 IndexedDB。**

### 1.3 已有的三处 Phase A-1 改动（本轮未改，仅确认）

| 改动 | 行号 | 现状 |
|---|---|---|
| IDB v2 + 建 `meta` store | 3853 `IDB_VER=2`、3857 `IDB_META_STORE='meta'`、3866 `createObjectStore` | 已建表，**零业务依赖**（注释 3854-3856 明确） |
| `zoneDataComplete(zone)` 守卫 | 4336 定义；4348 `cleanInvalidWrongSilent` 内 4354 `if(!zoneDataComplete(zone)) return;` | 生效 |
| `releasePreparedZone(zone)` | 5485 定义；**8763** `switchZone`(8755) 内调用（紧随 8762 `releaseSearchTextCache(activeZone)`） | 生效 |

---

## 2. 最大内存来源

### 2.1 实测堆分解（真实 174,385 题）

| 状态 | JS Heap | 备注 |
|---|---|---|
| 空库基线（全新 origin，无数据） | **1.8MB** | `phaseA2-empty-baseline.json` |
| 冷启动完成（完整 db 常驻） | **409.4 – 409.7MB** | 多次复现，稳定 |
| db 原始 JSON 体积（序列化后） | `255,008,391` 字符 | gk 69,005,784 / mk 114,066,832 / sy 71,935,769 |
| 释放 `db` + `_prepFiles` + `_snap` + `_gfbMemo`（漏清 `window.filteredQuestions`） | **108.4 – 136.0MB** | 见 §9，差值取决于是否已构建 meta |
| **再清 `window.filteredQuestions` ⇒ 目标架构地板（meta 常驻）** | **35.8MB** | 见 §2.4 |

### 2.2 字段级体积剖析（全真实题库：77 文件 / 192,356 题 / 磁盘 781.9MB / 题目 JSON 320,606,032 字符）

**各分区最大字段占比（字面 JSON 字符量）**：

| 分区 | 题数 | JSON 字符 | 头号字段 | 占比 | 次号 | 占比 |
|---|---|---|---|---|---|---|
| gk（行测） | 51,917 | 66,170,836 | `solution` 22,049,228 | **33.3%** | `questionMeta` 6,501,175 | 9.8% |
| mk（模考） | 61,180 | 110,272,065 | `solution` 32,888,354 | **29.8%** | `_materials` 18,060,026 | 16.4% |
| sy（事业单位） | 61,288 | 67,916,273 | `solution` 24,545,954 | **36.1%** | `content` 6,757,352 | 9.9% |
| zy（综应） | 3,417 | 21,747,789 | `solutionAccessories` 13,423,770 | **61.7%** | `_materials` 4,956,674 | 22.8% |
| ms（面试） | 14,554 | 54,499,069 | `solutionAccessories` 48,120,619 | **88.3%** | — | — |
| sl（申论） | **0** | 0 | — （无 `questions[]`，是 `{meta, papers[]}`，papers 48,817,302 字符） | — | — | — |

**meta 候选字段实际体积**：

| 分区 | meta 候选字符 | 占该分区 |
|---|---|---|
| gk | 3,287,754 | 4.97% |
| mk | 4,561,488 | 4.14% |
| sy | 6,172,968 | 9.09% |
| zy | 237,794 | 1.09% |
| ms | 1,189,674 | 2.18% |
| **合计** | **15,449,678** | **4.82%**（相对全量 320.6M 字符） |

**字段真实性（`fieldPresence` 全量统计，决定 meta 能取哪些字段）**：

- gk / mk / sy **100% 都有** `bigCategory`、`subCategory`、`leafCategory`、`source`
- gk / mk / sy **全部没有** `category`、`subType`、`leafType`、`_qid`
  → 证实历史 Bug #1 根因：`category` 是**上传路径派生**出来的运行时字段，不是题库自带
- `correctRatio`：sy 100%（61,288/61,288）；mk 仅 9,105/61,180；gk **完全没有该字段**，正确率在 `q.questionMeta.correctRatio`（已有回退逻辑 `getQuestionCorrectRatio` 5424）
- zy / ms **没有三大分类字段**，只能从文件名 / `_label` / `part` 派生
- `q.id` 100% 覆盖，可作稳定 id

### 2.3 为什么 `db` 是主因（不是 `_prepFiles`）

- 第一阶段已把旧分区 `_prepFiles` 释放成功（WeakRef 14/14 → 0/14，稳态 −23.9MB）。**该方向已到顶，本轮不再重复优化。**
- 本轮剖面显示：`db` 的原始 JSON 是 `255,008,391` 字符（≈ 486MB UTF-16 原始），展开副本 `_prepFiles` 只是**浅拷贝**（`{...q}` 共享大字符串），所以它只贡献对象表头开销 ≈ 24.2MB。
- 决定性对照（§9）：即使把 `_prepFiles` / `_snap` / `_gfbMemo` / 词法 `filteredQuestions` 全清干净，堆仍停在 **108.4–136.0MB** —— 唯一持有者是 `window.filteredQuestions`。所以**第一阶段之后剩下的 100MB+，本质仍是「题目对象没有被真正丢弃」，而不是「缓存没清」**。

### 2.4 【本轮新增 · 决定性】目标架构地板堆实测

用 `work/phaseA2_floor_check.js`，在**已构建 meta** 的前提下释放 `db`/`_prepFiles`/`_snap`/`_gfbMemo`/`filteredQuestions`（词法 + window 两处），显式 GC 后测真实下限：

| meta 变体 | meta JSON 字符 | 构建 ms | 构建时堆增量 | **地板堆（meta 常驻）** | meta 真实独立成本 |
|---|---|---|---|---|---|
| `{f,i,m,s,l,src,r}`（obj 全字段） | 22,949,841 | 46 | +9.9MB | **35.8MB** | 34.0MB |
| `{f,i,m,s,l,r}`（**去掉 src**） | 15,069,899 | 47 | +9.2MB | **20.9MB** | 19.1MB |
| `[f,i,m,s,l,r]`（数组编码，去 src） | 10,884,659 | 44 | +11.2MB | **22.9MB** | 21.1MB |
| `[f,i]`（**纯定位**） | 3,843,385 | 39 | +6.6MB | **8.4MB** | 6.6MB |

配套读数（同一脚本）：

```
A 冷启动:            heap 409.4MB   fq=51917  window.filteredQuestions=51917
B 建 meta(full):     heap 419.3MB   build 46ms  jsonChars 22,949,841
C 释放 db 等(漏清 window): heap 136.0MB   wfq=51917   ← 106MB 卡在 window 上
D 补清 window:       heap  35.8MB   wfq=0        ← 目标架构地板
E 常驻 1 个 500 题窗口: heap 36.8MB   windowHeapDelta +1.0MB
F 释放窗口:          heap  35.8MB   ← 回到地板，无残留
```

**三条必须记住的结论：**

1. **「地板」是 8.4 – 35.8MB，不再是 409MB。** 差距高达 **11–49 倍**。
2. **meta 的真实成本必须「在 db 已释放后」测。** 构建瞬间只 +9.9MB（大字符串与 db 共享/去重），真实独立成本 34.0MB —— **被低估了 3.4 倍**。这是一个方法论教训。
3. **`source` 是 meta 里最贵的单字段：独占 ≈ 14.9MB 堆（34.0 → 19.1）。** 全库 173,473 个几乎全不重复的 source 字符串。→ **第一版 meta 不应无条件带 `source`**；若必须保留来源筛选，需先做截断/归一化/池化设计（属下一轮，本轮只记录）。
4. 数组编码在同族里**不比对象省堆**（21.1 vs 19.1MB），与 S2 的 intern 结论一致。

---

## 3. 最大 CPU 来源

### 3.1 已实测

| 场景 | 实测 | 说明 |
|---|---|---|
| 冷启动 `loadAll()`（冷） | bootSeconds **8** | 读 255MB JSON 全量入库 |
| `loadAll()` 重载（warm，IDB 已热身） | **753ms** | `S10 reload` |
| `getFiltered(skipSort)` 同条件 | **9 – 10.4ms** | 51,917 题线性扫 + 排序 |
| meta 上同条件筛选 | **0.7 – 0.8ms**（`module=判断推理`）/ **2.9 – 3.8ms**（`module+year=2024`，outCount 593） | **比原实现快 ≈ 3 倍** |
| 受限搜索文本构建（全库） | **901ms** / 40,216,489 字符 | 只在搜索会话首次构建 |
| 受限搜索文本构建（sy 单分区） | **261ms** / 14,882,639 字符 / 243 字符每题 | 切分区或搜索结束时释放（4842） |
| chunk 化（sy 500 题/片，54 片） | **312ms**，30,171,826 字符 | 一次性成本 |
| 读单个文件（IDB → JSON） | gk 63ms / mk 156ms / **sy 117ms** | 粒度太粗，见 §7 |

**`renderQuestions()`（8015）每次都会跑一遍 `getFiltered()`（8024）。** 而 `renderQuestions` 被大量纯 UI 操作触发（脚本注释 8016-8022 自己就在说这件事）。这是**翻页/筛选/答题后刷新**路径上的主要 CPU 消耗。

### 3.2 【本轮新增发现】`saveFile` 全量回写 —— 结构性 CPU 热点

```js
// 3989
function saveFile(z,id){ markAnswersDirty(); return idbSet('file:'+z+':'+id, db[z][id]); }    // fire-and-forget
```

- `saveFile` 把**整个 file 对象**（含全部 `questions` 正文）序列化后写回 `kv`。
- 触发点（11 处），其中**答题路径**是高频：
  - 8576（单选/判断）`f.answered[key]=letter; saveFile(activeZone, item._fileId);`
  - 8632（多选）`f.answered[key]=selectedSet.slice(); saveFile(...)`
  - 15549（考试模式）同样整文件回写
  - 8725 `Object.values(db[activeZone]).forEach(f=>{ f.answered={}; saveFile(activeZone, f.id); })`（清空分区作答 ⇒ 回写全分区所有文件）
  - 4399（导入）/ 5303 / 5331 / 7596 / 9819 / 9910（迁移/重建）

**影响推算**：以 sy 最大文件（26,601 题、30,164,458 JSON 字符）为例，用户每点一次答案 ⇒ 约 30M 字符的结构化克隆 + IDB 写入。实测同量级 IDB 写入（sy 搜索索引 14.88M 字符）耗时 **127ms**（`S4b writeMs`），可推知单次答题回写在桌面约 **100–250ms**，iPad 上更差。

**这同时是「正文按需读取」的硬阻塞**（详见 §12.2）：只要 `answered` 还挂在 file 对象里，就**不能**把 file 从内存丢掉。

---

## 4. iPad 卡顿原因分层

### ✅ 已确认（本机 Chrome + 真实题库，可复现）

| # | 原因 | 证据 |
|---|---|---|
| C1 | 冷启动必须把 **255M 字符**题库全部读进内存并展开 ⇒ JS Heap **409.4MB** | `phaseA2-empty-baseline.json`（1.8MB）vs `phaseA2-floor.log` A 步骤（409.4MB） |
| C2 | 每次 `renderQuestions()` 都触发全库 `getFiltered()` 线性扫 + 排序 | 6476 / 8024；同条件 9–10.4ms（桌面） |
| C3 | 答题触发 `saveFile()` **整文件回写** | 3989 + 8576/8632/15549 |
| C4 | `window.filteredQuestions`（7854/8025）长期持有 5 万+ 题对象，**阻碍 GC** | §9 持有者探针：漏清 108.4MB / 补清 2.2MB |

### 🟡 高概率（有间接证据，未在 iPad 上复现）

| # | 原因 | 依据 |
|---|---|---|
| P1 | Safari 因内存压力 kill / 自动 reload ⇒ 用户感知「切出去回来白屏重载」 | 409MB 已接近 iPad Safari 单 tab 实际上限（需 §13 复测） |
| P2 | 一页 20 题重建 `content.innerHTML` 产生长任务 | `S8a contentInnerHtmlChars=67501`；`renderQuestions` 被大量 UI 操作触发 |
| P3 | 切分区瞬间 `_prepFiles` 展开副本的**峰值**高于稳态 24.2MB | 稳态已测 24.2MB；峰值本轮未测 |
| P4 | 大 zone（sy 61,288 题）下筛选/翻页比 gk 更卡 | meta 筛选耗时随 inCount 增长 |

### ⚪ 尚未确认（**必须真实 iPad 实测**）

| # | 待确认 |
|---|---|
| U1 | 用户口中「卡顿」具体指哪一步：滚动 / 翻页 / 切分区 / 搜索输入 / 启动 |
| U2 | IndexedDB 在 iPad Safari 上读写 255MB 的绝对耗时 |
| U3 | 是否已触发 Safari「A problem repeatedly occurred」/ tab reload 阈值 |
| U4 | PWA 独立窗口模式与 Safari 标签页模式的内存表现差异 |
| U5 | 冷启动 + 切分区 3 次 + 搜索 1 次 的峰值曲线 |

---

## 5. 十类全库扫描点逐项审计

> 全部行号来自 `perf-phaseA-idb2/index.html`（sha256 `5fc3fe9d…`），已用 grep 逐条核对。

| # | 扫描点 | 为什么需要完整 `db` | 没有 db 时的最小信息 | meta → 定位 fileId+qi → IDB 只读目标 file？ | 需全量正文？ | 跨 zone？ | 路径类型 |
|---|---|---|---|---|---|---|---|
| 1 | `findQuestionByKey` **8838** | 按 `_key`(`f{fid}_q{qi}`) 在 `db[zone]` 里全 file 全题线性扫；`_key` 只在展开副本上生成 | **解析 `_key` 即得 `fid` + `qi`** | ✅ **完全可以** —— key 自带定位信息，meta 甚至不需要参与 | ❌ | 否（多数传 `activeZone`） | 混合：AI / 笔记 / 考试 / 诊断。10 个调用点：4130、9200、9667、9772、11380、11413、11636、12248、12423… |
| 2 | `findQuestionByContent` **8858** | 无 content 索引，只能逐题比对正文 | 一个「能定位的轻量搜索索引」 | ⚠️ 需专门设计（§8） | ❌（要定位，不要正文） | 否 | AI 导入 / 笔记（调用点 9673） |
| 3 | `findQuestionByQidPart` **8879** | 依赖 `q._qid`，该字段**未持久化**、由 `generateQuestionId` 运行时生成 ⇒ 必须遍历题目对象现算 | 真实数据里 `id` / `globalId` / `tikuPrefix` **100% 覆盖**，放进 meta 即可直查 | ✅ 可以 | ❌ | 否 | AI（调用点 9675、9747） |
| 4 | `findQuestionByKeyDeep` **9223** | `findQuestionByKey` 的补写版 | 同 #1 | ✅ 可以 | ❌ | **是**（补扫其它 zone）→ meta 覆盖全部 zone，反而更省 | AI / 恢复（调用点 9200） |
| 5 | `findQuestionByFingerprint` **9257** | 题干前缀 + 选项前缀 + 答案三重匹配，需 `getOptions` | 搜索索引；或在 meta 存 stem 前缀（**不建议**，等于塞正文） | ⚠️ 走搜索索引 | ❌（只需前缀） | 否 | 笔记导入（调用点 9741） |
| 6 | `exportBackup` **9319** | **导出完整备份的本质就是全量正文** | 无解 —— 这是功能定义 | ❌ 无法避免，**但可以流式**：按 file 逐个读 → 写包 → 立即释放，峰值只剩 1 个 file（现实现是 db 已在内存 + `getZoneQuestions(zone,'__all__')` 二次全库扫 9392） | ✅ | 否 | 导入导出（管理） |
| 7 | `fullDiagnosticScan` **7286** | 现在遍历全 zone 全 file 全题，但实际只统计 `totalQuestions` / `brokenFiles` / `missingCategories` | **只需计数 + 结构，不需要正文** | ✅ 可完全走 meta/index | ❌ | 是 | 诊断（管理）。**另发现 Bug：7292 硬编码 `indexedDB.open('qzdb', 1)`**（当前 `IDB_VER=2` ⇒ 该探测恒失败，属隐藏缺陷；本轮未改） |
| 8 | `cleanInvalidWrongSilent` **4348** | 需要「题目 key 白名单」来判定 wrongSet 里的 key 是否有效 | meta 的 (`fid`,`qi`) 即可还原 key | ✅ 可以，无需正文 | ❌ | 否（单 zone，已有 `zoneDataComplete` 守卫 4354） | 启动 / 管理（已在 Phase A-1 加保护） |
| 9 | 启动期 `category`/`subType` 补全 **11570-11587** | **对每个题目对象就地写入** `q.category` / `q.subType` ⇒ 天然需要完整 db | 两个方向：① 在 meta/index 里**预计算**这两个派生字段；② 干脆取消它们，改用真实存在的 `bigCategory`/`subCategory`/`leafCategory` | ⚠️ 不能简单「按需读」——它要写回 | ❌ | 否 | **启动路径（关键）**。依赖文件名首段；11591 `bumpDbEpoch()` |
| 10 | `qzLocalValidQuestion` **12510** | 现在读 `db` 全库（12520 处调用） | `key → f{fid}_q{qi}` 正则解析后**只查单个 file / 单题** | ✅ **最容易被 meta 替代的一个** | ❌ | 否 | wrongSet 校验 |
| 11 | `examFetchQuestions` **15524** | `examAllQuestions(zone)` 全 zone 全题 `Object.assign` + `examMatchModule` + 政治理论年份过滤（gk/sy 只取 2025-2026）+ 去重 + 排序 | 筛选所需字段（zone / 模块 / 年份 / 来源）**全在 meta 里**；筛出候选后按需读正文 | ✅ 筛选走 meta，正文按需 | ❌（筛选阶段） | 是（多 zone 源） | **考试路径 = 正常刷题路径** |

**额外发现**：`countZoneQuestions`（**5401**）—— gk/mk/sy/ms 走 `index[zone].count`，**只有 sl/zy 扫 `db`**。**不是热点，不需要改。**

**汇总：** 11 个扫描点里，**7 个（#1/#3/#4/#7/#8/#10 + #11 的筛选阶段）可以纯靠 meta 消除全库扫描，完全不需要正文**；2 个（#2/#5）需要轻量搜索索引；只有 1 个（#6 导出备份）真正需要全量正文（但可流式化）；1 个（#9 启动补全）是「写回型」，必须先改写入语义。

---

## 6. Meta 设计

### 6.1 第一版字段清单（**极轻**）

| 字段 | 来源 | 用途 | 是否必需 |
|---|---|---|---|
| `f` fileId | `f.id` | 定位 | ✅ |
| `i` qi | 数组下标 | 定位 | ✅ |
| `m` 模块 | `q.bigCategory` | 模块筛选 / 模块统计条 | ✅ |
| `s` 二级 | `q.subCategory` | 二级筛选 | ✅ |
| `l` 三级 | `q.leafCategory` | 三级筛选 | ✅ |
| `r` 正确率 | `q.correctRatio` → 回退 `q.questionMeta.correctRatio` | 正确率区间筛选 | ✅ |
| `src` 来源 | `q.source` | 来源筛选 | ❌ **第一版建议不要**（独占 14.9MB，见 §2.4） |
| `year` / `region` | `q.year` / `q._year` / `q.region` | 年份 / 省份筛选 | ⚠️ mk 只有 51,395/61,180 有；gk **完全没有** ⇒ 只能从 `source` 或文件名派生。**待定** |
| `key` / `qid` | 派生 / `q.id` | 外部引用 | ❌ 可从 (`f`,`i`) 还原 |

**明确禁止**：复制 `stem` / `content` / `options` / `materials` / `material` / `solution` / `accessories` / `solutionAccessories` / `keypoints` / `questionMeta`。**也不建议把完整 `searchText` 放进 meta**（历史已测：受限搜索文本缓存单 sy 分区即 14.88M 字符 / 29.4MB 常驻）。

### 6.2 编码与内存（实测，见 §2.4 表）

| 编码 | JSON 字符 | 构建 ms | 地板堆 | 结论 |
|---|---|---|---|---|
| obj 8 字段（含 src） | 22,949,841 | 46 | 35.8MB | 可行但偏重 |
| obj 7 字段（去 src） | 15,069,899 | 47 | 20.9MB | **推荐起点** |
| 数组 7 字段 | 10,884,659 | 44 | 22.9MB | JSON 更小，**但堆更大**，不推荐 |
| 纯定位 `[f,i]` | 3,843,385 | 39 | 8.4MB | 作为「最小可用」对照 |

> 历史 S2 还测过 intern（枚举池 + 整数索引）：构建 147ms、meta 9.48M + pool 14.76M 字符、堆 **+13.6MB** —— **比 obj 的 +9.5MB 更差**，去重收益被额外对象开销抵消，**不推荐**。

### 6.3 Meta ↔ 正文一致性闸门（`_dbEpoch` 扩展设计）

**现状可复用的基础设施**：

- `bumpDbEpoch()` **5457**（同时清空所有 `_prepFiles`）；调用点：3986、4402、5302、5330、5343、8708、8719、9909、11591
- `_snap` 已带 `epoch` 校验（5602：`_snap.epoch===_dbEpoch`）
- `invalidatePreparedFile` **5472**、`releasePreparedZone` **5485**
- IDB 侧 store 已就位：`IDB_META_STORE='meta'`（3857 / 3866）

**设计（必须先落地，才能谈释放 db）**：

**(a) 关键切分：结构性写入 vs 状态性写入 —— 必须显式区分**

| 写入类型 | 例子 | 是否 bump | 是否重建 meta |
|---|---|---|---|
| **结构性**（改变题目的存在/归属/派生字段） | 导入 file、替换 file、删除 file、重建 index、启动期 `category`/`subType` 补全、数据迁移 | ✅ bump | ✅ 重建受影响 zone 的 meta |
| **状态性**（只改用户进度） | `answered`、`favorites`、`wrongSet`、`reviewState`、笔记 | ❌ **不 bump** | ❌ 不动 |

> 现状 `saveFile` 3989 里调用了 `markAnswersDirty()` 但**没有** `bumpDbEpoch()` —— 这个切分现状是对的，**必须保留**，否则每答一题都要重建 17 万条 meta（~46ms + 一次 IDB 写入），不可接受。

**(b) meta 失效与重建**

- meta 不可能被「清空后等重建」（否则筛选会立即变空）⇒ 只允许**先建新、后切指针**：
  1. 生成 `meta:<epoch>` 全量写入（分片写，避免单事务过大）→ 记录 `count` / `checksum`
  2. 校验通过后 **最后一步** put `meta:active = { epoch, zoneCounts, builtAt, idbVer, indexDigest }`
  3. 冷启动只读 `meta:active` 指向的那份；旧 epoch 确认无用后删
- **中断安全**：中断只会留下孤儿 `meta:<oldEpoch>`，`meta:active` 仍指向可用版本 ⇒ 不会出现「meta 指向不存在的 file」。
- **meta 必须持久化到 IDB**（硬要求）：因为从 IDB 重建 meta 需要把 255MB JSON 全读一遍（冷启动 8s 量级），比建设 meta 本身的 46ms 贵几个数量级。正常路径必须只读 meta；「meta 丢失 → 重建」只作兜底，且应在导入时顺带生成。

**(c) 必须成立的不变量（建议写成断言 + 开发期自检）**

1. **正不变式**：∀ meta 记录 `m` ⇒ `m.zone` 在 `index` 中，`m.fid` 在 `index[m.zone]` 中，且 `file.questions.length > m.i`。
2. **完备不变式**：∀ 存在于 IDB 的 `(zone,fid,qi)` ⇒ meta 中有且仅有一条对应记录。
3. **序号稳定不变式**：`m.i` 必须等于题目在 `file.questions` 中的**数组下标**（`_key` 格式 `f{fid}_q{qi}` 依赖它，见 5543）。

**(d) 必须覆盖的边界场景（逐条给出结论）**

| 场景 | 处理 | 风险 |
|---|---|---|
| 导入新题库 | 走结构性写入 ⇒ bump ⇒ 只重建受影响的 zone 段，追加 meta | 导入中断 ⇒ meta 不完整；用 `count` 校验 + 重建整个 zone 段 |
| 删除文件 | bump + 删该 `fid` 的 meta 段 + 删 `file:` key（5345 / 8710 / 8717） | 删除中断 ⇒ meta 多指向不存在的 file ⇒ 由不变量 1 在读取时兜底：找不到 file 就**跳过该条并标记脏** |
| 重建 `index` | bump 全部 | — |
| 清空数据库 | bump + 清 `meta:*` + `meta:active` | — |
| 恢复备份 | 按结构性写入处理 ⇒ bump | 备份可能跨版本：`meta:active` 里存 `idbVer` + `schemaVer`，不匹配就重建 |
| 数据迁移（v1→v2→v3） | `onupgradeneeded` 只补表；**新版本必须显式标 meta 为失效** | 若忘记失效 ⇒ meta 格式不兼容 |
| 浏览器刷新 | `meta:active` 持久化 ⇒ 冷启动直接可用 | — |
| **多 tab** | 两个 tab 同时写 ⇒ 后写的 `meta:active` 生效；前一个 tab 内存里的 meta 可能已过期 | 需 `BroadcastChannel` 或 `storage` 事件通知（或最低限度：切 zone 时重读 `meta:active` 的 epoch 比对） |
| 中断写入 | 见 (b)，孤儿 epoch 无害 | — |

---

## 7. 正文按需读取设计

### 7.1 file 的真实结构（**实测，不假设**）

| zone | 顶层结构 | 是否有 `questions[]` | 题数 | 最大单文件 |
|---|---|---|---|---|
| gk | `{bigCategory, questionCount, questions[]}` | ✅ | 6,294 – 14,254 | `判断推理.json` 14,254 题 / 34MB |
| mk | `{name,labelId,subject,exportedAt,part,year,paperCount,questionCount,_zone,_note,paperList[],questions[]}` | ✅ | 585 – 7,293 | `粉笔模考_国省考_2025_part1.json` 7,293 题 |
| sy | **顶层数组** | ✅ | 5,249 – **26,601** | `事业单位_2017-2019_26601道.json` **26,601 题 / 56MB** |
| sl | `{meta, papers[]}` | **❌ 没有 `questions[]`** | 0 | papers 48,817,302 字符 |
| zy | `{part, questions[], materialsByPaper}` | ✅ | 528 – 1,375 | 1,375 题 |
| ms | **顶层数组** | ✅ | 84 – 1,053 | 1,053 题 |

> **结论：`file` 既不等同一道题，也不是固定题数；sl 甚至没有 `questions[]`。任何「按 file 读取 = 读一道题」的假设都是错的。**

### 7.2 按 file 读取的粒度实测 —— **不够**

| zone | 文件 | 题数 | 读取耗时 | 堆增量 |
|---|---|---|---|---|
| gk | 判断推理.json | 14,254 | 63ms | **+25.4MB** |
| mk | 国省考_2025_part1 | 7,293 | 156ms | +16.7MB |
| sy | 2017-2019_26601道 | **26,601** | 117ms | **+47.7MB** |

**单文件峰值 47.7MB ⇒ 按 file 粒度做「按需读取」不可接受。**

### 7.3 chunk 化实测 —— **可行**

| 项 | 实测 |
|---|---|
| chunk 化（sy 500 题/片） | 生成 **54 片**，**312ms**，合计 30,171,826 字符，平均 558,738 字符/片 |
| 单片读取 | **3 – 11ms**，堆 **+0.9 – 1.1MB**（三次采样：11ms/1MB、10ms/0.9MB、4ms/1MB） |
| 翻页定位（第 4 页 = 第 60–80 题）在 meta 上 | **`chunkNeeded = 1`**，解析出真实 `fid = "mujdwxp6y45j"`，`knownFiles = true` |
| 常驻 1 个 500 题窗口（floor 脚本 E 步） | 读取 99–106ms（含读整文件），堆 **+1.0MB** |

**窗口大小不要现在定死。** 实测数据只支持「500 题/片时，一页 20 题最多跨 2 片、常见只跨 1 片」。候选窗口（20/40/100）需要按「滚动流畅度 vs 预取命中率」在 iPad 上实测后再定。

### 7.4 释放窗口时的引用清理清单

离开窗口/切题时必须同时断开（否则「释放」是假的 —— 这是 §9 的教训）：

- [ ] 缓存对象本身（如 `_qrCache[fileId][chunkIdx]`）
- [ ] 任何 closure 捕获（事件 handler 里引用 `q`）
- [ ] `content.innerHTML` 里的 DOM（`contentInnerHtmlChars = 67501` —— 已量化为 ~67KB/页，不是大头但会拖住字符串）
- [ ] `_prepFiles[zone]` 对应项（`invalidatePreparedFile` 5472 已具备）
- [ ] `_snap` / `_gfbMemo`（`dropSnapshot` 5455 / `bumpDbEpoch` 5457 已具备）
- [ ] **`window.filteredQuestions`（7854 / 8025）—— 当前没人清，必须一起处理**
- [ ] 定时器闭包：7636 `checkInterval`、12133 `setInterval(renderProgressPanel,60000)`、13454 `soundUpdateTimer`、14189 `setInterval(updateSidebarTimer,5000)`、14250 面试计时、15540 `examState.timerId`、15629 `setInterval(updateVisibility,500)`

---

## 8. 搜索设计（两个方案，**本轮不选择**）

### 8.1 成本实测基线

| 指标 | 实测 |
|---|---|
| 全库受限搜索文本 | 构建 **898–906ms**，**40,216,489 字符**，平均 231 字符/题，空文本 0 题 |
| 唯一性 | 174,385 题里 **174,344 个唯一文本** ⇒ **几乎全部不重复，intern 去重无收益** |
| sy 单分区 | 14,882,639 字符 / 243 字符/题 / 构建 261ms |
| 写 IDB | 127ms |
| 从 IDB 读回 | **44ms** |
| 内存中线性扫描 | 61,288 条仅 **4.1ms**（命中 452） |
| 常驻堆（载入期间） | **29.4MB** |
| 已有释放机制 | `releaseSearchTextCache` **4842**，调用点 8762（切分区）、10335 / 10368（搜索结束） |

> 关键事实：**现状已经是「临时构建 + 用完释放」**，所以搜索文本缓存**不是**常驻大头。任何新方案必须保持「用完能释放」这个性质，否则反而变差。

### 8.2 方案 A：轻量内存搜索索引

- **做法**：保留 `RESTRICTED_SEARCH_ZONES`（4713）/ `RESTRICTED_SEARCH_FIELD_WHITELIST`（4716）/ `SEARCH_TEXT_FIELD_BLACKLIST`（4653）的受限构建逻辑；仅在**单 zone**范围内构建，构建后保持到「搜索会话结束」，输入防抖后复用。
- **内存**：单 zone ≈ **20–30MB** 期间常驻（sy 实测 14.88M 字符 → 29.4MB 堆）；用完即释放 ⇒ 稳态 0。
- **CPU**：首次 261ms（sy），后续每次查询 4.1ms。
- **搜索速度**：内存线性扫，最快（4.1ms / 6 万条）。
- **实现复杂度**：**低**（现有代码已具备 90%）。
- **一致性**：天然一致（每次构建都读最新 db）。
- **iPad 风险**：中。29.4MB 常驻虽可接受，但**构建期间**已有 409MB db 常驻 ⇒ 叠加后 440MB，反而更容易触发 Safari 压力。

### 8.3 方案 B：IDB 持久化搜索索引

- **做法**：构建后写入独立 store/key（如 `sidx:<zone>`），按 epoch 失效；冷启动只需读回（44ms），无需重建（261ms）。
- **内存**：可做到「仅搜索会话内 29.4MB」，稳态 0（前提：用完必须 `dropSearchIndex` + 显式 GC）。
- **CPU**：构建 261ms + 写 127ms（一次性）；读回 44ms；查询 4.1ms。
- **搜索速度**：与 A 相同（查询阶段都在内存）。
- **实现复杂度**：**中高**（需要 epoch 一致性、需要覆盖「导入/编辑题目时维护索引」、需要 GC 纪律）。
- **数据一致性**：依赖 §6.3 的 epoch 闸门；**必须证明**「题目变了索引也变了」。
- **iPad 风险**：中高。多一份持久化数据（全库 40.2M 字符文本 ⇒ IDB 实际占用可能 80–160MB，**需 iPad 实测**）；IDB 变大后清理/备份/迁移都更重。

### 8.4 对比表（**供选择，本轮不决策**）

| 维度 | 方案 A（内存） | 方案 B（IDB 持久化） |
|---|---|---|
| 内存（稳态） | ~0（用完释放） | ~0（用完释放） |
| 内存（搜索期间） | 20–30MB/zone | 20–30MB/zone |
| 首次搜索 CPU | 261ms（sy） | 261ms + 127ms 写 |
| 冷启动后首次搜索 | 261ms | **44ms 读回** |
| 单次查询 | 4.1ms | 4.1ms |
| 实现复杂度 | **低**（已有 90%） | 中高（epoch + 维护 + 清理） |
| 数据一致性 | 天然一致 | **依赖 epoch 闸门，需证明** |
| 额外 IDB 占用 | 0 | ~80–160MB（待 iPad 实测） |
| 主要风险 | 构建期间与 db 叠加的内存峰值 | 持久化数据膨胀 + 一致性维护 |
| 与「释放 db」的关系 | 构建需要 db ⇒ **不能与释放 db 同时做**（必须改为按 zone 从 IDB 读） | 可完全脱离 db |

---

## 9. 【本轮新发现 · 真实泄漏点】`window.filteredQuestions`

### 9.1 代码事实（逐字引用）

```js
// 3575
let filteredQuestions = [];
```

```js
// 7853-7854（renderReviewQuestions，复盘渲染）
  filteredQuestions=items;
  window.filteredQuestions=items;
```

```js
// 8024-8025（renderQuestions）
  filteredQuestions = getFiltered();
  window.filteredQuestions = filteredQuestions;
```

**`window.filteredQuestions` 只被写、从未被读**（grep 全文件仅 2 处，全为赋值；也确认没有任何内联 `onclick=` 等属性依赖它 ⇒ 删除无功能风险，但**本轮不动代码，仅报告**）。

### 9.2 决定性验证（`work/phaseA2_holders_check.js`，输出原文）

```
A. 冷启动后: {"filteredQuestions":51917,"windowFilteredQuestions":51917,"fqSampleType":"expandedCopy:fmujdwey4ln15_q2383","dbFiles":24,"dbQuestions":"gk:51917 mk:61180 sy:61288 sl:0 zy:0 ms:0","gfbMemo":51917,"snap":51917,"prepKeys":7,"prepItems":0,"activeZone":"gk","currentPage":1} heap=409.5MB
B. 箭头函数内赋值后（漏清 window.filteredQuestions）: {"filteredQuestions":0,"windowFilteredQuestions":51917,...,"dbFiles":0,"dbQuestions":"gk:0 mk:0 sy:0 sl:0 zy:0 ms:0","gfbMemo":0,"snap":0,"prepKeys":0,"prepItems":0} heap=108.4MB
B2. 补清 window.filteredQuestions 后: {"filteredQuestions":0,"windowFilteredQuestions":0,...} heap=2.2MB
C. (0,eval) 全局赋值后: heap=2.2MB
D. 字符串表达式赋值后: heap=2.2MB
E. 再清 DOM 后: heap=2.2MB
```

### 9.3 堆快照 retainer 链（`work/phaseA2-retainers.log` 原文）

```
  ▸ 题干 HTML 片段
     ← via "(string)"  string "<p>从所给的四个选项中，选项最合适的一个填入问号处，使之呈现一定的规律性：</p><p><img " (336B)
       ← via "[element #31755]"  object "Object" (28B)
         ← via "filteredQuestions"  object "Array" (16B)
           ← via "[internal #670657]"  object "Window [JSGlobalObject] / http://127.0.0.1:47831" (24B)
             ← via "[internal #638504]"  native "system / NativeContext / http://127.0.0.1:47831" (1244B)
               ← via "[element #10]"  synthetic "(Global handles)" (0B)
                 ← via "[element #1]"  synthetic "(GC roots)" (0B)
```

同一日志的规模读数：

```
字符串节点 1065718 个，self_size 合计 82.4MB
解析完成。nodes=14643936 edges=28378644 strings=671413 / 节点总数 2440656
最大 Array 节点: self=207676B  元素=51917
```

空库对照（`phaseA2-heap-attr.json`）：**15,094 个字符串 / 1,181,538 字符 / 15.7MB 总量**。

### 9.4 结论

- **根因定论**：`7854` / `8025` 把 5 万+ 题对象显式挂到 `window`。`let filteredQuestions`（3575）是**词法绑定**，清词法绑定**不清 window 属性** ⇒ 108.4MB 无法回收。
- **纯增量收益实测**：在「`db`/`_prepFiles`/`_snap`/`_gfbMemo` 均已清」的前提下，补清 `window.filteredQuestions` 使堆从 **108.4MB → 2.2MB**，**即 106.2MB**。
- **在 Phase A-2 之前这不重要**（db 常驻时它与 `_prepFiles` 共享同一批对象，`S7b→S7c` 只差 0.3MB）；**在 Phase A-2 之后它是决定性的** —— 它是「释放 db 后内存仍停在 100MB+」的唯一原因。
- 推论：**任何「按需读取 + 有界缓存」的架构都必须先在代码里消除这类「隐式全局持有」**，否则释放逻辑全部失效。建议下一步先做一次**全量 `window.*` 持有审计**（本轮只覆盖到 `filteredQuestions`；`6059 window.sourceValues`、`8587/8628 window.recordQuestionAttempt` 等尚未评估）。

---

## 10. 特殊功能风险清单（暂不迁移，先记录）

| 功能 | 行号 / 结构 | 对 `db` 的依赖 | 迁移风险 |
|---|---|---|---|
| 申论 sl | 6 文件 `{meta, papers[]}`，**无 `questions[]`** | `preparedFile` 5560 分支走 `buildEssayPreparedFile` 5619；**materialsByPaper 3,204,564 字符在** file 壳**上 | 🔴 **高**。材料结构不是单选题结构，meta 字段不适用；材料题必须整篇取 |
| 综应 zy | `{part, questions[], materialsByPaper}` | 同上分支；`solutionAccessories` 占 61.7%、`_materials` 22.8% | 🔴 **高**。`_materials` 需按 paper 分组读取 |
| 面试 ms | 顶层数组，43 文件，`solutionAccessories` 占 **88.3%** | `prepareQuestion` 通用分支可用 | 🟡 中。单文件小（≤1,053 题），但 88.3% 集中在 `solutionAccessories` ⇒ meta 绝不能带该字段 |
| AI 对话 | 4862 / 5030 / 10900（`indexedDB.open(AI_HISTORY_DB_NAME,1)`） | `findQuestionByContent` 8858 / `findQuestionByQidPart` 8879 / `findQuestionByFingerprint` 9257 | 🟡 中。依赖「按内容/指纹找题」⇒ 必须等 §8 搜索方案定案 |
| 笔记 / 导入 | 9673 / 9675 / 9741 | 同上 | 🟡 中 |
| 备份恢复 | 9319 `exportBackup` + 9584 / 9593 | 全量正文 + `fileData.answered` | 🟢 低（可流式化），但 9584 `currentFileData.answered[match.key]=qBackup.answer` 会与「拆分 answered」冲突 |
| 全量诊断 | 7286 | 只需计数 | 🟢 低。**但 7292 硬编码 `indexedDB.open('qzdb', 1)` 是隐藏 Bug** |
| 考试模式 | 15520-15549 | `examAllQuestions(zone)` 全 zone + `examSelectOption` 整文件 `saveFile` | 🟡 中 |
| 训练工具（成语/速算/舒尔特等） | 15345-15507 | 与 `db` 无关，独立状态 | 🟢 低 |
| 时政/AI 生成 | 脚本注释含 prompt（`你是公考时政教研员…`） | 独立 | 🟢 低 |

---

## 11. 原型实测结果汇总

### 11.1 断言结果（`phaseA2-proto.json`：13 ✅ / 1 ❌）

| 断言 | 结果 | 实测 |
|---|---|---|
| sy 单分区受限搜索文本即超 1000 万字符 | ✅ | 14,882,639 字符，243 字符/题 |
| 方案 B：从 IDB 读出 sy 全量搜索索引 < 1.5s | ✅ | 44ms |
| 方案 B：内存中扫描 sy 索引 < 120ms | ✅ | 4.1ms，命中 452 |
| sy 存在超大单文件（>20000 题）⇒ 按 file 读取粒度不足 | ✅ | 26,601 题 |
| 单个 file 读取耗时 < 3s | ✅ | 63ms / 156ms / 117ms |
| sy 最大文件读入即带来 >30MB 堆（粒度太粗的直接证据） | ✅ | 47.7MB |
| 单片 500 题 chunk 读取 < 60ms 且堆增量 < 8MB | ✅ | 11ms/1MB、10ms/0.9MB、4ms/1MB |
| 翻页定位解析出的 fileId 真实存在（不是 undefined 假通过） | ✅ | `mujdwxp6y45j` |
| 一页 20 题最多跨 2 片 chunk | ✅ | `chunkNeeded = 1` |
| 释放完整题库后 Heap 至少降 250MB | ✅ | 409.6 → 134.7，降 274.9MB |
| `filteredQuestions`/`_gfbMemo` 与 `_prepFiles` 共享同一批对象 | ✅ | afterDropDb 135 / afterDropAll 134.7，差 0.3MB |
| 显式 GC 后堆不再下降 ⇒ 剩余是真实存活对象 | ✅ | 134.7 → 134.7 |
| 重新加载后题目数与首次一致（未因释放丢数据） | ✅ | 174,385 → 174,385 |
| **反复加载后 Heap 不低于首次基线 +25MB（无泄漏）** | ❌ | **首次 409.6 → 第二次 532.2** |

**❌ 断言解读（重要，不要忽略）**：`S10` 显示释放后重新 `loadAll()`，堆从 409.6MB 升到 **532.2MB**。这**不能**归因于 `loadAll` 本身泄漏 —— 更可能是：① 旧 `window.filteredQuestions` 未被清（本轮已证实其存在）；② 搜索索引 / chunk 残留；③ 展开副本重复生成。**该异常根因尚未定位，必须在实施前单独复测并归因**，否则会削弱「可安全释放」的结论。（这是一个明确标注的**未解决问题**。）

### 11.2 逐项结论表

| 项 | 结论 |
|---|---|
| Prototype A（完整 db 常驻） | **409.4MB** = 现状 |
| Prototype B（只留 meta，正文按需读） | 地板 **8.4 – 35.8MB**（取决于 meta 字段集） |
| Prototype C（meta + 当前题目窗口） | **+1.0MB / 窗口**，即 9.4 – 36.8MB |
| 理论上限收益 | **409.4MB → 8.4MB（≈ −98%）**；保守取 35.8MB 也有 **−91%** |

---

## 12. 迁移路线

### 12.0 推荐的步骤顺序（先决条件链）

```
步骤 0  window.* 持有审计 + 清 window.filteredQuestions          ← 前置卫生，无架构风险
   ↓
步骤 1  结构性写入 / 状态性写入 分离（核心：把 answered 从 file blob 拆出）
   ↓
步骤 2  meta 构建 + 持久化 + epoch 闸门（灰度：只读旁路，不改业务语义）
   ↓
步骤 3  chunk 化 + 正文按需读取 + 有界窗口
   ↓
步骤 4  释放 db（真正的收益兑现）
   ↓
步骤 5  搜索方案 A 或 B（依赖步骤 4 的结论选择）
```

### 12.1 步骤 0：清 `window.filteredQuestions` + 全量 `window.*` 持有审计

| 项 | 内容 |
|---|---|
| **当前架构** | `7854`/`8025` 把 `filteredQuestions` 挂到 `window`（只写不读）；清词法绑定不清 window 属性 |
| **目标架构** | 不再存在任何「只写不读」的全局持有；释放路径可验证为「清空后堆回落」 |
| **中间迁移步骤** | ① grep 出全部 `window.<ident> = <数组/对象>`；② 逐个判断是否有用途；③ 删除无用途赋值；④ 每次删除后用持有者探针复测堆 |
| **风险** | 🟢 **低**。已确认这两行无任何读取方；唯一的保守风险是「用户自己在控制台依赖它调试」（可保留为 `window.__debugFilteredQuestions` 并标注调试用途） |
| **收益** | 单独实施收益 ≈ 0.3MB（db 常驻时它与 `_prepFiles` 共享对象）。**但它是步骤 4 的前置条件** —— 不删这两行，步骤 4 一落地就会有 106.2MB 无法回收 |
| **验证** | 跑一次「释放全部 + 显式 GC」，堆必须回落到 2.2MB（无 meta）/ 8.4–35.8MB（有 meta） |

### 12.2 步骤 1：结构性写入 / 状态性写入分离（**最关键的阻塞点**）

| 项 | 内容 |
|---|---|
| **当前架构** | `answered` 存在 `file.answered`（file 对象内）；`saveFile` 3989 把**整个 file**（含全部正文）写回 IDB；答题触发点 8576 / 8632 / 15549 |
| **目标架构** | 作答数据与题库正文**物理分离**：新增独立 store/key（如 `ans:<zone>:<fid>` 或 `ans:<zone>`），`saveFile` 只写 `answered`；正文 file 只读 |
| **中间迁移步骤** | ① 新增独立作答存储 + 读回合并；② 保留旧 `file.answered` 兼容读取（**先读新、回退旧**）；③ 首次启动做一次迁移（把 `file.answered` 搬到新 key，迁移完成前不删旧数据）；④ `saveFile` 拆成 `saveAnswers(zone,fid)` / `saveFileMeta(zone,fid)`；⑤ 全部 11 个 `saveFile` 调用点逐个核对语义 |
| **风险** | 🔴 **高**。涉及备份恢复（9584 / 9593 `fileData.answered[...]`）、清空作答（8725）、考试模式（15549）。**必须保持 `markAnswersDirty()` 但不引入 `bumpDbEpoch()`** |
| **收益** | ① 单次答题写回从 **30MB 级降到 KB 级**（CPU + IDB 写入双降）；② **解除「必须常驻 file」的硬约束** ⇒ 步骤 4 才有可能 |

### 12.3 步骤 2：meta 构建 + 持久化 + epoch 闸门

| 项 | 内容 |
|---|---|
| **当前架构** | 无 meta。筛选/统计全部基于 `db` 全量扫描（`getFiltered` 6476） |
| **目标架构** | `meta` store 持久化（`meta:<epoch>` + `meta:active`）；第一版字段 `{f,i,m,s,l,r}`（**不含 source**）；结构化筛选走 meta |
| **中间迁移步骤** | ① 先做**只读旁路**：meta 只用于「模块统计条」（`getModuleStatsForBar` 5837 / `renderModuleBar` 5879）与结果集**交叉校验**（meta 结果必须与原 `getFiltered` 逐条一致，否则报警）；② 校验通过后再把 `getFiltered` 的「结构化筛选」段切到 meta，「搜索段」保持原实现；③ 最后才把 meta 持久化写入 |
| **风险** | 🟡 中。风险集中在**一致性**（§6.3 的 9 个边界场景）与**启动补全**（11570-11587 会就地改题 ⇒ 必须 bump 并按 §6.3(a) 归类为结构性写入） |
| **收益** | 结构化筛选 **9–10.4ms → 2.9–3.8ms（快约 3 倍）**；为步骤 3/4 提供「无需 db 的定位能力」 |

### 12.4 步骤 3：chunk 化 + 正文按需读取 + 有界窗口

| 项 | 内容 |
|---|---|
| **当前架构** | `preparedFile` 5555 一次展开**整个 file** 并**永久缓存**在 `_prepFiles`；`getZoneQuestions(zone,'__all__')` 直接物化整个 zone 的展开数组 |
| **目标架构** | file → chunk（首版 500 题/片）；meta 定位 `(fid, qi)` → `chunkIdx = floor(qi/size)`；只保留「当前窗口 ± 预取」的 chunk；离开即释放 |
| **中间迁移步骤** | ① 只对 gk/mk/sy/ms 启用（sl/zy 走原逻辑，材料结构特殊）；② chunk **惰性生成 + 缓存到 IDB**（一次 312ms/zone，不重复）；③ 先把「翻页」路径切过去（`goPage` 8699 / `renderQuestions` 8015），`__all__` 全量路径保留；④ 再逐步替换 §5 表里的 #1/#3/#4/#10 调用点 |
| **风险** | 🟡 中高。chunk 边界必须与 `m.i`（数组下标）严格一致，否则 `_key`(`f{fid}_q{qi}`) 错位 ⇒ 作答/收藏/错题本全乱。必须加断言：`keyOf(metaRec) === file.questions[metaRec.i]._key` |
| **收益** | 单次读取代价 **47.7MB → 1.0MB**；翻页 3–11ms |

### 12.5 步骤 4：释放 `db`

| 项 | 内容 |
|---|---|
| **当前架构** | `db` 常驻 386MB 级，全生命周期不释放 |
| **目标架构** | `db` 只作为「导入/构建期的工作集」；正常运行期只保留 meta + 窗口 |
| **中间迁移步骤** | ① 释放前先跑 §6.3 的全部不变量断言；② 先在**一个 zone**（建议 gk）上开启「离开即释放」，观察 24h；③ 逐步扩到 sy（最大）/mk |
| **风险** | 🔴 **高**。前置依赖：步骤 0（清 window 持有）+ 步骤 1（拆 answered）+ 步骤 2（meta 持久化）+ 步骤 3（按需读取）。**任何一项缺失，释放都会立刻表现为功能故障** |
| **收益** | **409.4MB → 8.4–35.8MB**（本报告最核心的实测结论） |

### 12.6 步骤 5：搜索方案（A / B）

见 §8。**本报告不决策。** 唯一约束：方案 A 的构建需要 `db`，若步骤 4 已落地，A 必须改为「按 zone 从 IDB 读后构建」，否则与释放 db 冲突。

---

## 13. 需要真实 iPad 复测的项（**不要用桌面数据代替**）

| # | 复测项 | 桌面参考值 | 为什么必须在 iPad 上测 |
|---|---|---|---|
| I1 | 冷启动 JS Heap（现状） | 409.4MB | Safari 单 tab 上限与 Chrome 不同 |
| I2 | 是否触发 tab reload / "A problem repeatedly occurred" | 未触发 | 这是用户实际症状的判据 |
| I3 | 一页 20 题渲染 + 滚动帧率 | `contentInnerHtmlChars=67501` | 触摸滚动 vs 桌面滚轮差异大 |
| I4 | 单次答题的写回卡顿（步骤 1 前 / 后） | 桌面推估 100–250ms | IDB 写入速度差异大 |
| I5 | 切分区瞬间 `_prepFiles` 峰值 | 稳态 24.2MB | 峰值本轮未测 |
| I6 | 搜索输入时的卡顿（方案 A/B） | sy 构建 261ms | 输入延迟人工可感知 |
| I7 | IndexedDB 占用与配额（方案 B 额外 80–160MB） | 未测 | Safari 配额策略更紧 |
| I8 | 步骤 4 落地后的稳态堆与「切出去回来」是否还重载 | 8.4–35.8MB（桌面） | **这是验证目标是否达成的唯一方式** |
| I9 | PWA 独立窗口 vs Safari 标签页 | 未测 | 内存策略不同 |

---

## 14. 结论：是否值得实施

### 14.1 值得，但**顺序不能颠倒**

- **收益上限已实测**：`409.4MB → 8.4MB`（纯定位 meta）或 `→ 35.8MB`（7 字段 meta）。**降低 91%–98%。**
- **收益不是理论推演**：地板值来自 `phaseA2_floor_check.js` 的真实读数（D 步骤 35.8MB / 20.9MB / 22.9MB / 8.4MB），且 E/F 步骤证明「窗口可回收、可回到地板」。
- **但直接做「释放 db」必然失败**，因为有三个硬阻塞：

| 阻塞 | 位置 | 不解决会发生什么 |
|---|---|---|
| ① `window.filteredQuestions` 全局持有 | 7854 / 8025 | 释放后仍有 106.2MB 无法回收 |
| ② `saveFile` 全量回写 | 3989 + 8576/8632/15549 | 丢掉 file 后答题直接坏掉 |
| ③ 启动期 `category`/`subType` 补全需就地改题 | 11570-11587 | 丢掉 file 后这两个字段永久缺失 |

### 14.2 三项必须先解决的「元问题」

1. **步骤 1（拆 answered）是最高优先级**，因为它同时是 CPU 热点的解药和内存架构的钥匙。它的收益可以**独立兑现**（不依赖后面任何步骤）。
2. **`source` 不进第一版 meta**（独占 14.9MB）。来源筛选需求另设计。
3. **`S10` 的 409.6 → 532.2MB 异常必须归因**（§11.1 ❌），否则「释放是安全的」这个前提不牢固。

### 14.3 建议的下一步（等确认）

| 选项 | 内容 | 我的建议 |
|---|---|---|
| **甲** | 只做步骤 0（清 `window.*` 持有 + 全量审计）+ `S10` 异常归因 | ✅ **推荐先做这个**。范围最小、零架构风险、且是后续一切的前置条件 |
| 乙 | 步骤 1（拆 `answered`） | 次选。收益最实，但涉及备份恢复/考试模式，需要单独一轮设计 |
| 丙 | 步骤 2（meta 旁路 + 交叉校验） | 可并行，不改业务语义 |
| 丁 | 直接上步骤 3/4 | ❌ **不建议**。会被 ② 直接卡死 |
| 搜索 | 方案 A / B | ⏸ **等步骤 1–3 落地后再定**；届时方案 A 需改为「按 zone 从 IDB 构建」 |

**请明确指示：是否实施、实施哪一步、以及搜索方案的取向。在收到确认前我不会改动 `index.html`。**
