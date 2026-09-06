    // 粉笔题库申论真题批量提取脚本（浏览器控制台版）
    // 使用：在 https://tiku.fenbi.com 页面登录后，粘贴并执行本文件。
    // 结果通过浏览器下载；进度保存在当前站点 localStorage 中。
    (() => {
        'use strict';

        const PROVINCES = {
            102: '安徽', 103: '北京', 104: '福建', 105: '甘肃', 106: '广东',
            107: '广西', 108: '贵州', 109: '海南', 110: '河北', 111: '河南',
            112: '黑龙江', 113: '湖北', 114: '湖南', 115: '吉林', 116: '江苏',
            117: '江西', 119: '内蒙古', 120: '宁夏', 121: '青海', 122: '山东',
            123: '山西', 124: '陕西', 125: '上海', 126: '四川', 127: '天津',
            129: '新疆', 130: '云南', 131: '浙江', 132: '重庆', 133: '广州', 134: '深圳'
        };

        const STORAGE_KEY = 'fenbi-shenlun-extraction-v1';
        const REQUEST_INTERVAL = 2000;
        const SEARCH_PAUSE_EVERY = 20;
        const SEARCH_PAUSE = 60000;
        let lastRequestAt = 0;
        let searchCount = 0;

        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

        function loadProgress() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            } catch (error) {
                console.warn('断点记录损坏，将从头开始：', error);
                return {};
            }
        }

        function saveProgress(progress) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
        }

        async function requestJson(url, options = {}) {
            const wait = Math.max(0, REQUEST_INTERVAL - (Date.now() - lastRequestAt));
            if (wait > 0) await sleep(wait);

            const response = await fetch(url, {
                ...options,
                credentials: 'include'
            });
            lastRequestAt = Date.now();

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${url}`);
            }
            return response.json();
        }

        function normalize(text) {
            return String(text || '')
                .replace(/[《》“”‘’「」\s　]/g, '')
                .replace(/[：:、，。！？!?（）()【】\[\]]/g, '');
        }

        async function getPapers(labelId) {
            const papers = [];
            let page = 0;
            let totalPages = 1;

            while (page < totalPages) {
                const params = new URLSearchParams({
                    labelId, toPage: page, pageSize: 100,
                    app: 'web', kav: '131', av: '134', hav: '128',
                    version: '3.0.0.0', gav: '2', apcId: '0', examcatid: '1000183'
                });
                const data = await requestJson(
                    `https://tiku.fenbi.com/api/shenlun/papers/v2?${params}`
                );
                papers.push(...(data.list || []));
                totalPages = data.pageInfo?.totalPage || data.totalPage || 1;
                page += 1;
            }
            return papers;
        }

        async function searchQuestionIds(paperName) {
            const cleanName = String(paperName || '')
                .replace(/[《》题（）、，。]/g, ' ')
                .trim();
            const params = new URLSearchParams({
                q: cleanName,
                coursePrefix: 'shenlun',
                app: 'web', kav: '131', av: '134', hav: '128',
                version: '3.0.0.0', gav: '2', apcId: '0'
            });
            const data = await requestJson(
                `https://algo.fenbi.com/api/fenbi-question-search/question?${params}`
            );
            searchCount += 1;
            if (searchCount % SEARCH_PAUSE_EVERY === 0) {
                console.warn(`⏸️ 已搜索 ${searchCount} 次，暂停 60 秒`);
                await sleep(SEARCH_PAUSE);
            }

            const items = data.data?.items || [];
            const wanted = normalize(paperName);
            const matches = items.filter(item => {
                const source = normalize(item.source);
                return source === wanted || source.includes(wanted) || wanted.includes(source);
            });
            const candidates = matches.length ? matches : items;
            return [...new Set(candidates.map(item => item.questionId).filter(Boolean))];
        }

        async function getSolutions(questionIds) {
            if (!questionIds.length) return {};
            const params = new URLSearchParams({ ids: questionIds.join(',') });
            return requestJson(
                `https://tiku.fenbi.com/api/shenlun/solutions?${params}`
            );
        }

        function downloadJson(fileName, value) {
            const blob = new Blob(
                [JSON.stringify(value, null, 2)],
                { type: 'application/json;charset=utf-8' }
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileName}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        async function extractProvince(labelId, provinceName) {
            console.log(`📚 ${provinceName}：获取试卷列表`);
            const papers = await getPapers(labelId);
            const result = {
                meta: {
                    province: provinceName,
                    labelId,
                    totalPapers: papers.length,
                    extractedAt: new Date().toISOString()
                },
                papers: []
            };

            for (let index = 0; index < papers.length; index += 1) {
                const paper = papers[index];
                const paperName = paper.name || paper.sheet?.name || `试卷-${paper.id}`;
                console.log(`[${index + 1}/${papers.length}] ${provinceName}：${paperName}`);

                try {
                    const questionIds = await searchQuestionIds(paperName);
                    const fullData = await getSolutions(questionIds);
                    result.papers.push({
                        paperId: paper.id,
                        paperName,
                        paperDate: paper.date,
                        questionIds,
                        fullData
                    });
                    console.log(`  ✅ ${questionIds.length} 道题`);
                } catch (error) {
                    console.error(`  ❌ ${paperName}：${error.message}`);
                    result.papers.push({
                        paperId: paper.id,
                        paperName,
                        paperDate: paper.date,
                        questionIds: [],
                        fullData: null,
                        error: error.message
                    });
                }

            }
            return result;
        }

        async function main() {
            const progress = loadProgress();
            const pending = Object.entries(PROVINCES)
                .filter(([labelId]) => !progress[labelId]);

            if (!pending.length) {
                console.log('✅ 所有省份都已完成。如需重跑，执行：localStorage.removeItem(\'' + STORAGE_KEY + '\')');
                return;
            }

            console.log(`🎯 待处理 ${pending.length} 个省份；已完成省份将跳过`);
            for (const [labelId, provinceName] of pending) {
                try {
                    const result = await extractProvince(Number(labelId), provinceName);
                    downloadJson(`${provinceName}申论真题`, result);
                    progress[labelId] = {
                        province: provinceName,
                        completedAt: new Date().toISOString(),
                        paperCount: result.papers.length
                    };
                    saveProgress(progress);
                    console.log(`✅ ${provinceName} 完成，已下载 JSON`);
                } catch (error) {
                    console.error(`❌ ${provinceName} 失败；未标记为完成，下次会重试：`, error);
                }
            }
            console.log('🎉 批量任务结束');
        }

    main().catch(error => console.error('❌ 批量任务异常：', error));
})();