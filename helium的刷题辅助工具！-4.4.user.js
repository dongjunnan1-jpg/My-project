// ==UserScript==
// @name         粉笔题库高效刷题辅助工具！
// @namespace    http://tampermonkey.net/
// @version      4.4
// @description  新增评论区。新增兼容考试类型为行测和职测。支持试卷精准搜索与模糊筛选，可按正确率范围、模块类型快速定位题目，轻松收藏重点考题。提供灵活导出功能，可选择导出全部题目解析或仅导出错题，助力针对性复习。新增试卷单页下载与批量下载，一键保存学习资料。优化收藏管理，支持一键清空所有收藏，操作更便捷。全面覆盖各类练习场景，包括AI刷题班、7+1特训、粉刷刷专项及大笔筒练习，无论完成与否均可一键获取，让刷题效率翻倍，备考更轻松！
// @author       Mythical Creature
// @match        https://*.fenbi.com/*
// @connect      tiku.fenbi.com
// @connect      ke.fenbi.com
// @connect      cdn.jsdelivr.net
// @connect      cdnjs.cloudflare.com
// @grant        unsafeWindow
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js
// @require      https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.1.1/jspdf.umd.min.js
// ==/UserScript==

// 引入外部样式，定义工具的UI样式
GM_addStyle(`
   .paper-tool-container {
        position: fixed;          /* 固定定位，悬浮在页面上 */
        top: 20px;               /* 距离顶部20px */
        right: 20px;             /* 距离右侧20px */
        z-index: 9999;           /* 层级最高，确保不被其他元素遮挡 */
        background: white;       /* 白色背景 */
        border-radius: 8px;      /* 圆角边框 */
        box-shadow: 0 2px 10px rgba(0,0,0,0.2); /* 阴影效果 */
        width: 500px;            /* 宽度500px */
        max-height: calc(100vh - 40px); /* 最大高度为视口高度减去40px */
        display: flex;           /* 使用flex布局 */
        flex-direction: column;  /* 垂直方向排列 */
        transition: transform 0.3s ease; /* 变换过渡动画 */
    }
    /* 隐藏状态样式 */
    .paper-tool-container.hidden {
        transform: translateX(calc(100% - 40px)); /* 向右移动，只露出40px宽度 */
    }

    /* 隐藏状态下不显示内容区域 */
    .paper-tool-container.hidden .tool-content,
    .paper-tool-container.hidden .collect-actions,
    .paper-tool-container.hidden .log-area,
    .paper-tool-container.hidden .accuracy-filter,
    .paper-tool-container.hidden .tool-title,
    .paper-tool-container.hidden .search-container,
    .paper-tool-container.hidden .batch-download-container,
     .paper-tool-container.hidden .exam-type-container{
        display: none;
    }

    /* 隐藏状态下不显示头部边框 */
    .paper-tool-container.hidden .tool-header {
        border-bottom: none;
    }

    .exam-type-container {
        padding: 10px 15px;
        border-bottom: 1px solid #eee;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    /* 搜索框样式 */
    .search-container {
        padding: 10px 15px;
        border-bottom: 1px solid #eee;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .search-input {
        flex: 1;
        padding: 6px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
    }

    .search-input:focus {
        border-color: #1890ff;
    }

    .search-btn {
        padding: 6px 12px;
        background-color: #1890ff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
    }

    .search-btn:hover {
        background-color: #096dd9;
    }

    .search-btn.reset-btn {
        background-color: #f5f5f5;
        color: #666;
    }

    .search-btn.reset-btn:hover {
        background-color: #e5e5e5;
    }

    /* 批量下载选项样式 */
    .batch-download-container {
        padding: 10px 15px;
        border-bottom: 1px solid #eee;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .batch-download-label {
        font-size: 13px;
        color: #666;
    }

    .batch-download-pages {
        padding: 4px 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 13px;
        width: 60px;
    }

    .batch-download-btn {
        padding: 5px 10px;
        background-color: #0284c7;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        transition: background-color 0.2s;
    }

    .batch-download-btn:hover {
        background-color: #0369a1;
    }

    .toggle-btn {
        background: none;        /* 无背景 */
        border: none;            /* 无边框 */
        font-size: 18px;         /* 字体大小18px */
        cursor: pointer;         /* 鼠标指针为手型 */
        color: #666;             /* 字体颜色 */
        width: 30px;             /* 宽度30px */
        height: 30px;            /* 高度30px */
        border-radius: 50%;      /* 圆形按钮 */
        display: flex;           /* flex布局 */
        align-items: center;     /* 垂直居中 */
        justify-content: center; /* 水平居中 */
        transition: background-color 0.2s; /* 背景色过渡 */
    }

    .toggle-btn:hover {
        background-color: #f5f5f5; /* 鼠标悬停时背景色 */
    }

    .tool-title {
        margin: 0;               /* 无外边距 */
        color: #333;             /* 字体颜色 */
        font-size: 16px;         /* 字体大小 */
        font-weight: bold;       /* 加粗 */
        flex-grow: 1;            /* 占满剩余空间 */
        text-align: center;      /* 文字居中 */
    }

    .tool-content {
        display: flex;           /* flex布局 */
        flex: 1;                 /* 占满剩余空间 */
        overflow: hidden;        /* 超出部分隐藏 */
    }

    .labels-panel {
        width: 120px;            /* 宽度120px */
        border-right: 1px solid #eee; /* 右侧边框 */
        overflow-y: auto;        /* 垂直方向可滚动 */
    }

    .label-item {
        padding: 10px 15px;      /* 内边距 */
        cursor: pointer;         /* 鼠标指针为手型 */
        color: #666;             /* 字体颜色 */
        font-size: 14px;         /* 字体大小 */
        transition: all 0.2s;    /* 所有属性过渡 */
    }

    .label-item:hover {
        background-color: #f5f5f5; /* 鼠标悬停背景色 */
    }

    .label-item.active {
        background-color: #e6f7ff; /* 选中状态背景色 */
        color: #1890ff;          /* 选中状态字体色 */
        border-left: 3px solid #1890ff; /* 左侧选中边框 */
    }

    .papers-panel {
        flex: 1;                 /* 占满剩余空间 */
        overflow-y: auto;        /* 垂直方向可滚动 */
    }

    .papers-header {
        padding: 10px 15px;      /* 内边距 */
        border-bottom: 1px solid #eee; /* 底部边框 */
        display: flex;           /* flex布局 */
        justify-content: space-between; /* 两端对齐 */
        align-items: center;     /* 垂直居中 */
    }

    .papers-count {
        color: #666;             /* 字体颜色 */
        font-size: 13px;         /* 字体大小 */
    }

    .paper-item {
        padding: 12px 15px;      /* 内边距 */
        border-bottom: 1px solid #f5f5f5; /* 底部边框 */
        cursor: pointer;         /* 鼠标指针为手型 */
        transition: background-color 0.2s; /* 背景色过渡 */
    }

    .paper-item:hover {
        background-color: #fafafa; /* 鼠标悬停背景色 */
    }

    .paper-title {
        margin: 0 0 5px 0;       /* 外边距 */
        font-size: 14px;         /* 字体大小 */
        color: #333;             /* 字体颜色 */
        white-space: nowrap;     /* 不换行 */
        overflow: hidden;        /* 超出部分隐藏 */
        text-overflow: ellipsis; /* 超出部分显示省略号 */
    }

    .paper-meta {
        display: flex;           /* flex布局 */
        justify-content: space-between; /* 两端对齐 */
        font-size: 12px;         /* 字体大小 */
        color: #999;             /* 字体颜色 */
    }

    .pagination {
        padding: 10px 15px;      /* 内边距 */
        display: flex;           /* flex布局 */
        justify-content: center; /* 水平居中 */
        gap: 5px;                /* 元素间距 */
        border-top: 1px solid #eee; /* 顶部边框 */
    }

    .page-btn {
        padding: 3px 10px;       /* 内边距 */
        border: 1px solid #ddd;  /* 边框 */
        border-radius: 4px;      /* 圆角 */
        background: white;       /* 背景色 */
        cursor: pointer;         /* 鼠标指针为手型 */
        font-size: 12px;         /* 字体大小 */
        transition: all 0.2s;    /* 所有属性过渡 */
    }

    .page-btn:disabled {
        opacity: 0.5;            /* 半透明 */
        cursor: not-allowed;     /* 禁止指针 */
    }

    .page-btn.active {
        background-color: #1890ff; /* 激活状态背景色 */
        color: white;            /* 激活状态字体色 */
        border-color: #1890ff;   /* 激活状态边框色 */
    }

    .collect-actions {
        padding: 10px 15px;      /* 内边距 */
        border-top: 1px solid #eee; /* 顶部边框 */
        display: flex;           /* flex布局 */
        gap: 8px;                /* 元素间距 */
    }

    .action-btn {
        flex: 1;                 /* 占满剩余空间 */
        padding: 6px 0;          /* 内边距 */
        border: none;            /* 无边框 */
        border-radius: 4px;      /* 圆角 */
        cursor: pointer;         /* 鼠标指针为手型 */
        font-size: 13px;         /* 字体大小 */
        transition: all 0.2s;    /* 所有属性过渡 */
    }

    .collect-btn {
        background-color: #4F46E5; /* 收藏按钮背景色 */
        color: white;            /* 字体颜色 */
    }

    .collect-btn:hover {
        background-color: #3A32B5; /* 鼠标悬停背景色 */
    }

    .batch-collect-btn {
        background-color: #10B981; /* 批量收藏按钮背景色 */
        color: white;            /* 字体颜色 */
    }

    .batch-collect-btn:hover {
        background-color: #059669; /* 鼠标悬停背景色 */
    }

    .solution-btn {
        background-color: #4A32B5; /* 清空按钮背景色 */
        color: white;            /* 字体颜色 */
    }

    .solution-btn:hover {
        background-color: #4f52B5; /* 清空按钮背景色 */
    }

    .export-error-btn {
        background-color: #e7bb0dff; /* 清空按钮背景色 */
        color: white;            /* 字体颜色 */
    }

    .export-error-btn:hover {
        background-color: #efbb0dff; /* 清空按钮背景色 */
    }

    .clear-btn {
        background-color: #ef4444; /* 清空按钮背景色 */
        color: white;            /* 字体颜色 */
    }

    .clear-btn:hover {
        background-color: #dc2626; /* 鼠标悬停背景色 */
    }

    .log-area {
        height: 180px;           /* 高度180px */
        border-top: 1px solid #eee; /* 顶部边框 */
        overflow-y: auto;        /* 垂直方向可滚动 */
        font-size: 12px;         /* 字体大小 */
    }

    .log-item {
        padding: 3px 15px;       /* 内边距 */
        border-bottom: 1px solid #f9f9f9; /* 底部边框 */
    }

    .log-success {
        color: #10B981;          /* 成功日志颜色 */
    }

    .log-error {
        color: #ef4444;          /* 错误日志颜色 */
    }

    .log-info {
        color: #3B82F6;          /* 信息日志颜色 */
    }

    .log-warning {
        color: #F59E0B;          /* 警告日志颜色 */
    }

    .loading {
        padding: 20px;           /* 内边距 */
        text-align: center;      /* 文字居中 */
        color: #666;             /* 字体颜色 */
        font-size: 13px;         /* 字体大小 */
    }

    .paper-actions {
        display: flex;           /* flex布局 */
        gap: 5px;                /* 元素间距 */
        margin-top: 8px;         /* 上外边距 */
    }

    .paper-action-btn {
        padding: 3px 8px;        /* 内边距 */
        font-size: 12px;         /* 字体大小 */
        border-radius: 3px;      /* 圆角 */
        border: none;            /* 无边框 */
        cursor: pointer;         /* 鼠标指针为手型 */
        transition: all 0.2s;    /* 所有属性过渡 */
    }
    .fb-view-btn {
        background-color: #e6f7ff;/* 查看按钮背景色 */
        color: #4c7bf4;             /* 字体颜色 */
    }

    .fb-view-btn:hover {
        background-color: #d1eaff; /* 鼠标悬停背景色 */
    }

    .view-btn {
        background-color: #f0f0f0; /* 查看按钮背景色 */
        color: #666;             /* 字体颜色 */
    }

    .view-btn:hover {
        background-color: #e0e0e0; /* 鼠标悬停背景色 */
    }

    .download-btn {
        background-color: #e6f7ff; /* 下载按钮背景色 */
        color: #0284c7;          /* 下载按钮字体颜色 */
    }

    .download-btn:hover {
        background-color: #d1eaff; /* 鼠标悬停背景色 */
    }

    .item-collect-btn {
        background-color: #e6f7ff; /* 收藏按钮背景色 */
        color: #1890ff;          /* 字体颜色 */
    }

    .item-collect-btn:hover {
        background-color: #d1eaff; /* 鼠标悬停背景色 */
    }

    .item-dis-collect-btn {
        background-color: #e6f7ff; /* 取消收藏按钮背景色 */
        color: #dd1432ff;          /* 字体颜色 */
    }

    .item-dis-collect-btn:hover {
        background-color: #d1eaff; /* 鼠标悬停背景色 */
    }

    .accuracy-filter {
        padding: 10px 15px;      /* 内边距 */
        border-bottom: 1px solid #eee; /* 底部边框 */
        display: flex;           /* flex布局 */
        align-items: center;     /* 垂直居中 */
        gap: 10px;               /* 元素间距 */
    }

    .accuracy-filter label {
        font-size: 12px;         /* 字体大小 */
        color: #666;             /* 字体颜色 */
    }

    .accuracy-filter input[type="range"] {
        flex: 1;                 /* 占满剩余空间 */
    }

    .accuracy-filter span {
        font-size: 12px;         /* 字体大小 */
        color: #666;             /* 字体颜色 */
        min-width: 50px;         /* 最小宽度50px */
    }

    /* 加载动画样式 */
    .spinner {
        width: 20px;             /* 宽度20px */
        height: 20px;            /* 高度20px */
        border: 2px solid rgba(0, 0, 0, 0.1); /* 边框 */
        border-radius: 50%;      /* 圆形 */
        border-top-color: #1890ff; /* 顶部边框颜色 */
        animation: spin 1s ease-in-out infinite; /* 旋转动画 */
        display: inline-block;   /* 行内块元素 */
        vertical-align: middle;  /* 垂直居中 */
        margin-right: 5px;       /* 右外边距 */
    }

    /* 旋转动画定义 */
    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    /* 按钮加载状态 */
    .action-btn.loading {
        opacity: 0.7;            /* 半透明 */
        cursor: wait;            /* 等待指针 */
    }

    .action-btn.loading .spinner {
        display: inline-block;   /* 显示加载动画 */
    }

    /* 导出选项样式 */
    .export-options {
        margin-top: 15px;
        padding: 10px;
        background-color: #f9f9f9;
        border-radius: 4px;
    }

    .export-option-item {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        font-size: 14px;
    }

    .export-option-item input {
        margin-right: 8px;
    }

    .export-option-label {
        cursor: pointer;
    }

    .no-wrong-questions {
        color: #999;
        font-size: 13px;
        margin-top: 8px;
        padding-left: 24px;
        font-style: italic;
    }

    .no-unanswered-questions {
        color: #999;
        font-size: 13px;
        margin-top: 8px;
        padding-left: 24px;
        font-style: italic;
    }


    /* 题目类别选择弹窗样式 */
    .category-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease;
    }

    .category-modal.show {
        opacity: 1;
        visibility: visible;
    }

    .category-modal-content {
        background-color: white;
        border-radius: 8px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
        transform: translateY(-20px);
        transition: transform 0.3s ease;
    }

    .category-modal.show .category-modal-content {
        transform: translateY(0);
    }

    .category-modal-header {
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .category-modal-title {
        margin: 0;
        font-size: 16px;
        color: #333;
    }

    .category-modal-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #999;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
    }

    .category-modal-close:hover {
        background-color: #f5f5f5;
        color: #333;
    }

    .category-modal-body {
        padding: 20px;
    }

    .category-item {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
    }

    .category-item input {
        margin-right: 10px;
        width: 16px;
        height: 16px;
        cursor: pointer;
    }

    .category-item label {
        font-size: 14px;
        color: #333;
        cursor: pointer;
    }

    .category-modal-footer {
        padding: 10px 20px;
        border-top: 1px solid #eee;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }

    .category-btn {
        padding: 6px 16px;
        border-radius: 4px;
        border: none;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .category-cancel {
        background-color: #f5f5f5;
        color: #666;
    }

    .category-cancel:hover {
        background-color: #e5e5e5;
    }

    .category-confirm {
        background-color: #4F46E5;
        color: white;
    }

    .category-confirm:hover {
        background-color: #3A32B5;
    }

    .category-select-all {
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 1px dashed #eee;
    }

    /* 批量下载进度条样式 */
    .batch-download-progress {
        margin-top: 10px;
        height: 6px;
        background-color: #f0f0f0;
        border-radius: 3px;
        overflow: hidden;
        display: none;
    }

    .batch-download-progress.active {
        display: block;
    }

    .progress-bar {
        height: 100%;
        background-color: #0284c7;
        width: 0%;
        transition: width 0.3s ease;
    }
`);

const SUPPORTED_SUBJECTS = ['xingce', 'syzc', 'shenlun', 'jsjyzhzz'];

/**
 * 主应用类 - FenbiPaperTool
 * 封装了所有功能和状态管理
 */
class FenbiPaperTool {
    /**
     * 构造函数 - 初始化状态和绑定方法
     */
    constructor() {
        // 定义题目类别
        this.questionCategories = [
            { id: 'political', name: '政治理论' },
            { id: 'common-sense', name: '常识判断' },
            { id: 'verbal', name: '言语理解' },
            { id: 'quantity', name: '数量关系' },
            { id: 'logic', name: '判断推理' },
            { id: 'data', name: '资料分析' },
            { id: 'teacher', name: '教育综合知识' }
        ];

        // 状态管理 - 集中存储所有应用状态
        this.state = {
            currentLabelId: null,       // 当前选中的标签ID
            currentPage: 0,             // 当前页码
            totalPages: 1,              // 总页数
            pageSize: 10,               // 每页显示数量
            currenctLabelType: this.detectSubjectFromUrl(window.location.href) || 'xingce',// 当前科目 API 前缀
            allLabels: [],              // 所有标签列表
            allPapersByLabel: {},       // 按标签ID存储所有试卷
            currentPapers: [],          // 当前显示的试卷列表
            isHidden: true,             // 工具是否隐藏
            minAccuracy: 0,             // 最低正确率筛选值
            maxAccuracy: 100,           // 最高正确率筛选值
            isProcessing: false,        // 是否正在处理操作
            globalExerciseId: null,     // 全局存储的练习ID
            globalApiResponseData: null, // 全局存储的API响应数据
            globalWrongQuestionIds: null, //全局存储的错误问题ID列表
            globalUnAsweredQuestionIds: null, //全局存储的未答问题ID列表
            selectedCategories: [],     // 当前选中的类别
            currentPaper: null,         // 当前操作的试卷
            currentAction: null,        // 当前操作类型: 'collect' 或 'view'
            currentChapters: [],         // 当前试卷所有章节简介
            batchCollection: false,     // 是否正在进行批量收藏
            searchQuery: '',            // 搜索关键词
            batchDownloadPages: 1,      // 批量下载的页数
            isBatchDownloading: false,   // 是否正在批量下载
            currentStatus: 0,//当前练习的状态
            questionIds: [],//获取当前页面的问题ID
            questionIdsByType: [],//只用来存储收藏数据或者错题的问题ID，以防被污染
            episodeMap: [],//存储评论所需前置数据
            comments: {},//获取当前页面的评论合集
        };

        // 绑定方法的this上下文，确保在事件回调中this指向当前实例
        this.bindMethods();

        // 初始化应用
        this.init();
    }

    /**
     * 绑定方法的this上下文
     * 确保所有类方法在作为回调函数时，this仍然指向类实例
     */
    bindMethods() {
        this.createContainer = this.createContainer.bind(this);
        this.bindEvents = this.bindEvents.bind(this);
        this.fetchLabels = this.fetchLabels.bind(this);
        this.renderLabels = this.renderLabels.bind(this);
        this.fetchPapers = this.fetchPapers.bind(this);
        this.renderPapers = this.renderPapers.bind(this);
        this.collectPaperQuestions = this.collectPaperQuestions.bind(this);
        this.disCollectPaperQuestions = this.disCollectPaperQuestions.bind(this);
        this.batchCollectAllPapers = this.batchCollectAllPapers.bind(this);
        this.clearAllCollections = this.clearAllCollections.bind(this);
        this.getPaperSolution = this.getPaperSolution.bind(this);
        this.hookRequest = this.hookRequest.bind(this);
        this.pollForValue = this.pollForValue.bind(this);
        this.pushLog = this.pushLog.bind(this);
        this.showLoading = this.showLoading.bind(this);
        this.createCategoryModal = this.createCategoryModal.bind(this);
        this.showCategoryModal = this.showCategoryModal.bind(this);
        this.hideCategoryModal = this.hideCategoryModal.bind(this);
        this.handleCategorySelection = this.handleCategorySelection.bind(this);
        this.toggleSelectAllCategories = this.toggleSelectAllCategories.bind(this);
        this.performCollectionWithCategories = this.performCollectionWithCategories.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.resetSearch = this.resetSearch.bind(this);
        this.filterPapersBySearch = this.filterPapersBySearch.bind(this);
        this.downloadPaperPDF = this.downloadPaperPDF.bind(this);
        this.batchDownloadPapers = this.batchDownloadPapers.bind(this); // 批量下载方法绑定
        this.updateBatchDownloadProgress = this.updateBatchDownloadProgress.bind(this); // 进度更新方法绑定
    }

    /**
     * 初始化应用
     * 设置请求钩子，页面加载完成后初始化UI
     */
    init() {
        // 设置请求钩子，用于拦截特定请求获取数据
        this.hookRequest();

        // 页面加载完成后初始化UI
        window.addEventListener('load', () => {
            // 延迟1秒执行，确保页面完全加载
            setTimeout(() => {
                // 创建工具容器并添加到页面
                this.container = this.createContainer();
                document.body.appendChild(this.container);

                // 创建类别选择弹窗
                this.categoryModal = this.createCategoryModal();
                document.body.appendChild(this.categoryModal);

                // 加载试卷标签，并在完成后启动轮询检查
                this.fetchLabels().then(() => {
                    console.log('✅ 试卷标签加载完成，开始启动检查');
                    // 标签加载完成后再启动轮询检查
                    this.pollForValue();
                })
                    .catch((error) => {
                        console.error('❌ 试卷标签加载失败，仍尝试启动检查:', error);
                        // 即使标签加载失败，也尝试启动检查
                        this.pollForValue();
                    });
            }, 1000);
        });
    }

    /**
     * 创建工具的主界面容器
     * @returns {HTMLElement} 工具容器DOM元素
     */
    createContainer() {
        // 创建容器元素
        const container = document.createElement('div');
        // 设置初始样式类，默认隐藏
        container.className = 'paper-tool-container hidden';

        // 设置容器内部HTML结构，新增搜索框和批量下载区域
        container.innerHTML = `
            <div class="tool-header">
                <h3 class="tool-title">试卷浏览与收藏工具</h3>
                <button class="toggle-btn">+</button>
            </div>

    <!-- 考试类型下拉框 -->
    <div class="exam-type-container">
        <label for="exam-type" class="exam-type-label">考试类型:</label>
        <select id="exam-type" class="exam-type-dropdown">
            <option value="xingce" selected>行测</option>
            <option value="syzc">职测</option>
            <option value="shenlun">申论</option>
            <option value="jsjyzhzz">教师教育综合知识</option>
        </select>
    </div>

    <!-- 搜索区域 -->
    <div class="search-container">
        <input type="text" class="search-input" placeholder="输入试卷名称搜索...">
        <button class="search-btn">搜索</button>
        <button class="search-btn reset-btn">重置</button>
    </div>

    <!-- 批量下载区域 -->
    <div class="batch-download-container">
        <span class="batch-download-label">批量下载页数:</span>
        <input type="number" class="batch-download-pages" min="1" value="1">
        <button class="batch-download-btn">下载搜索结果</button>
        <div class="batch-download-progress">
            <div class="progress-bar"></div>
        </div>
    </div>

            <div class="tool-content">
                <div class="labels-panel"></div>
                <div class="papers-panel">
                    <div class="loading">加载标签中...</div>
                </div>
            </div>
            <div class="accuracy-filter">
                <label for="min-accuracy">最低正确率：</label>
                <input type="range" id="min-accuracy" min="0" max="100" value="${this.state.minAccuracy}">
                <span id="min-accuracy-value">${this.state.minAccuracy}%</span>
                <label for="max-accuracy">最高正确率：</label>
                <input type="range" id="max-accuracy" min="0" max="100" value="${this.state.maxAccuracy}">
                <span id="max-accuracy-value">${this.state.maxAccuracy}%</span>
            </div>
            <div class="collect-actions">
                <button class="action-btn batch-collect-btn">批量收藏</button>
                <button class="action-btn clear-btn">清空收藏</button>
                <button class="action-btn solution-btn">获取当前练习解析</button>
                <button class="action-btn export-error-btn">导出当前错题</button>
            </div>
            <div class="log-area"></div>
        `;

        // 为容器绑定事件处理函数
        this.bindEvents(container);

        return container;
    }

    /**
     * 创建题目类别选择弹窗
     * @returns {HTMLElement} 弹窗DOM元素
     */
    createCategoryModal() {
        const modal = document.createElement('div');
        modal.className = 'category-modal';

        // 构建弹窗HTML
        modal.innerHTML = `
            <div class="category-modal-content">
                <div class="category-modal-header">
                    <h3 class="category-modal-title">选择要收藏的题目类别</h3>
                    <button class="category-modal-close">&times;</button>
                </div>
                <div class="category-modal-body">
                    <div class="category-select-all">
                        <div class="category-item">
                            <input type="checkbox" id="select-all-categories" checked>
                            <label for="select-all-categories">全选</label>
                        </div>
                    </div>
                    ${this.questionCategories.map(category => `
                        <div class="category-item">
                            <input type="checkbox" id="category-${category.id}" checked>
                            <label for="category-${category.id}">${category.name}</label>
                        </div>
                    `).join('')}
                </div>
                <div class="category-modal-footer">
                    <button class="category-btn category-cancel">取消</button>
                    <button class="category-btn category-confirm">确认</button>
                </div>
            </div>
        `;

        // 绑定事件
        modal.querySelector('.category-modal-close').addEventListener('click', this.hideCategoryModal);
        modal.querySelector('.category-cancel').addEventListener('click', this.hideCategoryModal);
        modal.querySelector('.category-confirm').addEventListener('click', this.performCollectionWithCategories);
        modal.querySelector('#select-all-categories').addEventListener('change', this.toggleSelectAllCategories);

        // 绑定类别选择事件
        this.questionCategories.forEach(category => {
            modal.querySelector(`#category-${category.id}`).addEventListener('change', this.handleCategorySelection);
        });

        return modal;
    }

    /**
     * 显示类别选择弹窗
     * @param {Object} paper - 当前操作的试卷，批量收藏时可以为null
     * @param {string} action - 操作类型: 'collect' 或 'view'
     * @param {boolean} isBatch - 是否是批量收藏
     */
    showCategoryModal(paper, action = 'collect', isBatch = false) {

        // 保存当前操作的试卷和操作类型
        this.state.currentPaper = paper;
        this.state.currentAction = action;

        // 记录是否是批量收藏
        this.state.batchCollection = isBatch;
        if (this.state.currentLabelId === `all-${this.state.currenctLabelType}`) {
            this.state.selectedCategories = [...this.questionCategories.map(c => c.id)];
            this.performCollectionWithCategories();
            return;
        }
        // 显示弹窗
        this.categoryModal.classList.add('show');

        // 重置为全选状态
        const checkboxes = this.categoryModal.querySelectorAll('.category-item input:not(#select-all-categories)');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
        this.categoryModal.querySelector('#select-all-categories').checked = true;

        // 记录当前选中的类别
        this.state.selectedCategories = [...this.questionCategories.map(c => c.id)];

        // 根据操作类型修改弹窗标题
        if (action === 'view') {
            this.categoryModal.querySelector('.category-modal-title').textContent =
                '选择要查看的题目类别';
        } else if (isBatch) {
            this.categoryModal.querySelector('.category-modal-title').textContent =
                '选择批量收藏的题目类别';
        } else {
            this.categoryModal.querySelector('.category-modal-title').textContent =
                '选择要收藏的题目类别';
        }


    }

    /**
     * 隐藏类别选择弹窗
     */
    hideCategoryModal() {
        this.categoryModal.classList.remove('show');
        //this.state.currentPaper = null; // 清除当前操作的试卷
    }

    /**
     * 处理类别选择变化
     */
    handleCategorySelection() {
        // 获取所有类别复选框
        const checkboxes = this.categoryModal.querySelectorAll('.category-item input:not(#select-all-categories)');
        const checkedCategories = [];

        // 收集选中的类别
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                const categoryId = checkbox.id.replace('category-', '');
                checkedCategories.push(categoryId);
            }
        });

        // 更新状态
        this.state.selectedCategories = checkedCategories;

        // 更新全选复选框状态
        const selectAllCheckbox = this.categoryModal.querySelector('#select-all-categories');
        selectAllCheckbox.checked = checkedCategories.length === this.questionCategories.length;
    }

    /**
     * 切换全选/取消全选
     */
    toggleSelectAllCategories() {
        const selectAllCheckbox = this.categoryModal.querySelector('#select-all-categories');
        const checkboxes = this.categoryModal.querySelectorAll('.category-item input:not(#select-all-categories)');

        // 全选或取消全选
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });

        // 更新状态
        this.state.selectedCategories = selectAllCheckbox.checked
            ? [...this.questionCategories.map(c => c.id)]
            : [];
    }

    /**
     * 执行带类别的操作（收藏或查看解析）
     */
    async performCollectionWithCategories() {
        // 隐藏弹窗
        this.hideCategoryModal();

        // 记录选中的类别
        const selectedCategoryNames = this.state.selectedCategories
            .map(id => this.questionCategories.find(c => c.id === id)?.name || id)
            .join('、');

        this.pushLog(`已选择${this.state.currentAction === 'view' ? '查看' : '收藏'}类别：${selectedCategoryNames}`, 'info');

        // 根据操作类型执行不同操作
        if (this.state.currentAction === 'view' && this.state.currentPaper) {
            // 执行查看解析操作
            await this.getPaperSolution(this.state.currentPaper);
        } else if (this.state.batchCollection) {
            // 执行批量收藏
            await this.batchCollectAllPapers();
        } else if (this.state.currentPaper) {
            // 执行单份试卷收藏
            await this.collectPaperQuestions(this.state.currentPaper);
        } else {
            this.pushLog('未找到试卷信息，操作失败', 'error');
        }
    }

    /**
     * 为容器绑定事件处理函数
     * @param {HTMLElement} container - 工具容器DOM元素
     */
    bindEvents(container) {
        // 获取DOM元素
        const minAccuracySlider = container.querySelector('#min-accuracy');
        const maxAccuracySlider = container.querySelector('#max-accuracy');
        const minAccuracyValue = container.querySelector('#min-accuracy-value');
        const maxAccuracyValue = container.querySelector('#max-accuracy-value');
        const toggleBtn = container.querySelector('.toggle-btn');
        const batchCollectBtn = container.querySelector('.batch-collect-btn');
        const clearBtn = container.querySelector('.clear-btn');
        const solutionBtn = container.querySelector('.solution-btn');
        const exportErrorBtn = container.querySelector('.export-error-btn');
        const searchInput = container.querySelector('.search-input');
        const searchBtn = container.querySelector('.search-btn:not(.reset-btn)');
        const resetBtn = container.querySelector('.reset-btn');
        const batchDownloadInput = container.querySelector('.batch-download-pages');
        const batchDownloadBtn = container.querySelector('.batch-download-btn');
        const examTypeDropdown = container.querySelector('#exam-type');

        // 绑定下拉框选择事件
        if (examTypeDropdown) {
            examTypeDropdown.addEventListener('change', (e) => {
                const selectedValue = e.target.value;
                const selectedText = e.target.options[e.target.selectedIndex].text;

                if (selectedValue) {
                    // 打印选中的值到控制台
                    console.log(`选中的考试类型: ${selectedText}, 对应值: ${selectedValue}`);
                    this.state.currenctLabelType = selectedValue;
                    // 切换标签时重置搜索
                    this.state.searchQuery = '';
                    const searchInput = this.container.querySelector('.search-input');
                    if (searchInput) searchInput.value = '';
                    // 加载试卷标签
                    this.fetchLabels();
                }
            });
        }

        // 最低正确率滑块事件
        minAccuracySlider.addEventListener('input', () => {
            // 更新状态中的最低正确率值
            this.state.minAccuracy = parseInt(minAccuracySlider.value, 10);
            // 更新显示的数值
            minAccuracyValue.textContent = `${this.state.minAccuracy}%`;
            // 确保最低值不大于最高值
            if (this.state.minAccuracy > this.state.maxAccuracy) {
                this.state.minAccuracy = this.state.maxAccuracy;
                minAccuracySlider.value = this.state.maxAccuracy;
                minAccuracyValue.textContent = `${this.state.maxAccuracy}%`;
            }
        });

        // 最高正确率滑块事件
        maxAccuracySlider.addEventListener('input', () => {
            // 更新状态中的最高正确率值
            this.state.maxAccuracy = parseInt(maxAccuracySlider.value, 10);
            // 更新显示的数值
            maxAccuracyValue.textContent = `${this.state.maxAccuracy}%`;
            // 确保最高值不小于最低值
            if (this.state.maxAccuracy < this.state.minAccuracy) {
                this.state.maxAccuracy = this.state.minAccuracy;
                maxAccuracySlider.value = this.state.minAccuracy;
                maxAccuracyValue.textContent = `${this.state.minAccuracy}%`;
            }
        });

        // 批量收藏按钮点击事件
        batchCollectBtn.addEventListener('click', () => {
            // 如果正在处理操作，则不执行
            if (this.state.isProcessing) {
                this.pushLog('正在处理中，请稍后再试', 'warning');
                return;
            }
            // 显示类别选择弹窗，标记为批量收藏
            if (this.state.currentPapers.length > 0) {
                this.showCategoryModal(null, 'collect', true);
            } else {
                this.pushLog('没有可收藏的试卷', 'error');
            }

        });

        // 清空收藏按钮点击事件
        clearBtn.addEventListener('click', () => {
            // 如果正在处理操作，则不执行
            if (this.state.isProcessing) {
                this.pushLog('正在处理中，请稍后再试', 'warning');
                return;
            }
            // 执行清空收藏
            this.clearAllCollections();
        });

        // 获取解析按钮点击事件
        solutionBtn.addEventListener('click', () => {
            // 如果正在处理操作，则不执行
            if (this.state.isProcessing) {
                this.pushLog('正在处理中，请稍后再试', 'warning');
                return;
            }

            // 执行获取解析
            this.getSolutionByExerciseId();

        });

        // 获取导出错题按钮点击事件
        exportErrorBtn.addEventListener('click', () => {
            // 如果正在处理操作，则不执行
            if (this.state.isProcessing) {
                this.pushLog('正在处理中，请稍后再试', 'warning');
                return;
            }

            const url = window.location.href;
            const id = url.split('/')[10];

            // 用 URL 路径关键词判断类型，替代不可靠的 getPageFromUrl 正则
            let type = null;
            if (url.includes('/error/')) {
                type = 'errors';
            } else if (url.includes('/collect/') || url.includes('/collects/')) {
                type = 'collects';
            }

            console.log(id, type);

            if (type) {
                this.fetchAndParseKeypointTree(type, id);
            } else {
                this.pushLog('没有获取到对应数据，请移步收藏或者错题详情页', 'warning');
            }
        });

        // 切换工具显示/隐藏状态
        toggleBtn.addEventListener('click', () => {
            // 切换状态
            this.state.isHidden = !this.state.isHidden;
            if (this.state.isHidden) {
                // 隐藏状态
                container.classList.add('hidden');
                toggleBtn.textContent = "+";
            } else {
                // 显示状态
                container.classList.remove('hidden');
                toggleBtn.textContent = "-";
            }
        });

        // 搜索相关事件绑定
        searchInput.addEventListener('keyup', (e) => {
            // 按Enter键触发搜索
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });

        searchBtn.addEventListener('click', this.handleSearch);
        resetBtn.addEventListener('click', this.resetSearch);

        // 批量下载相关事件
        batchDownloadInput.addEventListener('change', (e) => {
            let value = parseInt(e.target.value, 10) || 1;
            value = Math.max(1, value); // 确保最小值为1
            this.state.batchDownloadPages = value;
            e.target.value = value;
        });

        batchDownloadBtn.addEventListener('click', this.batchDownloadPapers);
    }

    /**
     * 更新批量下载进度条
     * @param {number} current - 当前下载数量
     * @param {number} total - 总下载数量
     */
    updateBatchDownloadProgress(current, total) {
        const progressContainer = this.container.querySelector('.batch-download-progress');
        const progressBar = this.container.querySelector('.progress-bar');

        if (current === 0) {
            progressContainer.classList.add('active');
            progressBar.style.width = '0%';
        } else {
            const percentage = Math.min(100, Math.round((current / total) * 100));
            progressBar.style.width = `${percentage}%`;

            // 下载完成后隐藏进度条
            if (current === total) {
                setTimeout(() => {
                    progressContainer.classList.remove('active');
                }, 1000);
            }
        }
    }

    /**
     * 处理搜索功能
     */
    handleSearch() {
        const searchInput = this.container.querySelector('.search-input');
        const query = searchInput.value.trim().toLowerCase();
        this.state.searchQuery = query;

        // 如果搜索词为空，直接重置
        if (!query) {
            this.resetSearch();
            return;
        }

        this.pushLog(`搜索试卷: "${query}"`, 'info');
        // 筛选试卷并重新渲染
        this.filterPapersBySearch();
    }

    /**
     * 重置搜索
     */
    resetSearch() {
        const searchInput = this.container.querySelector('.search-input');
        searchInput.value = '';
        this.state.searchQuery = '';
        this.pushLog('搜索已重置', 'info');
        // 重新获取当前标签的试卷列表
        this.updateCurrentPapers();
    }

    /**
     * 根据搜索词筛选试卷（支持顿号分隔的多关键词，要求全部匹配）
     */
    filterPapersBySearch() {
        if (!this.state.searchQuery || !this.state.currentLabelId) {
            // 如果没有搜索词或没有选中标签，显示所有试卷
            this.updateCurrentPapers();
            return;
        }

        // 获取当前标签的所有试卷
        const allPapers = this.state.allPapersByLabel[this.state.currentLabelId] || [];

        // 将搜索词按顿号分割成数组数组，并，并过滤空字符串
        const keywords = this.state.searchQuery
            .toLowerCase()
            .split('、')
            .map(keyword => keyword.trim())
            .filter(keyword => keyword);

        // 如果分割后没有有效关键词，显示所有试卷
        if (keywords.length === 0) {
            this.updateCurrentPapers();
            return;
        }

        // 进行多关键词模糊匹配，要求所有关键词都匹配
        const filteredPapers = allPapers.filter(paper => {
            const paperName = paper.name ?? paper.sheet.name;
            const paperNameLowerCase = paperName.toLowerCase();
            // 关键修改：将 some 改为 every
            return keywords.every(keyword => paperNameLowerCase.includes(keyword));
        });

        // 计算总页数
        this.state.totalPages = Math.ceil(filteredPapers.length / this.state.pageSize) || 1;
        // 确保当前页码有效
        if (this.state.currentPage >= this.state.totalPages) {
            this.state.currentPage = Math.max(0, this.state.totalPages - 1);
        }

        // 应用分页
        const startIndex = this.state.currentPage * this.state.pageSize;
        this.state.currentPapers = filteredPapers.slice(startIndex, startIndex + this.state.pageSize);

        this.pushLog(`找到 ${filteredPapers.length} 个同时匹配"${this.state.searchQuery}"所有关键词的试卷`, 'info');
        this.renderPapers();
    }

    /**
     * 更新当前显示的试卷列表（应用分页）
     */
    updateCurrentPapers() {
        if (!this.state.currentLabelId) return;

        // 获取当前标签的所有试卷
        const allPapers = this.state.allPapersByLabel[this.state.currentLabelId] || [];

        // 计算总页数
        this.state.totalPages = Math.ceil(allPapers.length / this.state.pageSize) || 1;
        // 确保当前页码有效
        if (this.state.currentPage >= this.state.totalPages) {
            this.state.currentPage = Math.max(0, this.state.totalPages - 1);
        }

        // 应用分页
        const startIndex = this.state.currentPage * this.state.pageSize;
        this.state.currentPapers = allPapers.slice(startIndex, startIndex + this.state.pageSize);

        this.renderPapers();
    }

    /**
     * 在试卷面板显示加载状态
     */
    showLoading() {
        const papersPanel = this.container.querySelector('.papers-panel');
        papersPanel.innerHTML = '<div class="loading">加载中...</div>';
    }

    /**
     * 向日志区域添加一条日志
     * @param {string} message - 日志消息
     * @param {string} type - 日志类型：info, success, error, warning
     */
    pushLog(message, type = 'info') {
        const logArea = this.container.querySelector('.log-area');
        // 创建日志项元素
        const logItem = document.createElement('div');
        logItem.className = `log-item log-${type}`;
        // 设置日志内容，包含时间戳
        logItem.innerHTML = `[${new Date().toLocaleTimeString()}] ${message}`;
        // 添加到日志区域
        logArea.appendChild(logItem);
        // 滚动到最新日志
        logArea.scrollTop = logArea.scrollHeight;
    }

    /**
     * HTTP请求封装
     * @param {Object} options - 请求选项
     * @returns {Promise} 返回Promise对象
     */
    httpRequest(options) {
        return new Promise((resolve, reject) => {
            // 使用GM_xmlhttpRequest发送请求，支持跨域
            GM_xmlhttpRequest({
                ...options,
                // 请求成功回调
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        // 成功状态，返回响应内容
                        resolve(response.responseText);
                    } else {
                        // 错误状态，返回错误信息
                        reject(new Error(`HTTP错误: ${response.status}`));
                    }
                },
                // 请求错误回调
                onerror: (error) => reject(error),
                // 请求中止回调
                onabort: () => reject(new Error('请求被中止')),
                // 超时时间15秒
                timeout: 15000
            });
        });
    }

    /**
    * 钩子请求，拦截特定请求获取exerciseId
    */
    detectSubjectFromUrl(url) {
        if (!url) return null;
        return SUPPORTED_SUBJECTS.find(type => url.includes(type)) || null;
    }

    hookRequest() {
        // 保存当前实例的引用
        const self = this;

        // 保存原始的open和send方法
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        // 重写open方法，保存请求URL
        XMLHttpRequest.prototype.open = function (method, url) {
            this._requestUrl = url;
            return originalOpen.apply(this, arguments);
        };

        // 重写send方法，添加事件监听
        XMLHttpRequest.prototype.send = function (body) {
            const url = this._requestUrl;
            const that = this;

            // 检查是否是目标请求combine/exercise/getExercise
            if (url && url.indexOf('/combine/exercise') !== -1) {
                console.log('🎯 拦截到目标请求 URL:', url);
                // 根据URL中的科目前缀动态设置当前科目
                const detectedSubject = self.detectSubjectFromUrl(url);
                if (detectedSubject) {
                    self.state.currenctLabelType = detectedSubject;
                    console.log('📌 检测到科目请求，已设置当前类型为:', detectedSubject);
                }
                // 监听请求状态变化，使用箭头函数保持this指向
                this.addEventListener('readystatechange', () => {
                    if (that.readyState === 4) { // 请求完成
                        if (that.status >= 200 && that.status < 300) { // 成功状态
                            try {
                                const responseText = that.responseText;
                                const data = JSON.parse(responseText);
                                // 提取exerciseId，使用self访问类实例
                                if (data && data.data && data.data.ancientExerciseId && data.data.ancientExerciseId.id) {
                                    self.state.globalExerciseId = data.data.ancientExerciseId.id;
                                    console.log('✅ 提取到的 exerciseId:', self.state.globalExerciseId);
                                } else {
                                    console.warn('⚠️ 返回数据结构不符合预期，未找到 exerciseId');
                                }
                            } catch (e) {
                                console.error('❌ 解析返回内容失败:', e);
                            }
                        } else {
                            console.error('❌ 请求失败，状态码:', that.status);
                        }
                    }
                });
            }

            // 检查是否是目标请求combine/exercise/
            if (url && url.indexOf('/combine/exercise/getSolution') !== -1) {
                console.log('🎯 拦截到目标请求 URL:', url);

                // 监听请求状态变化，使用箭头函数保持this指向
                this.addEventListener('readystatechange', () => {
                    if (that.readyState === 4) { // 请求完成
                        if (that.status >= 200 && that.status < 300) { // 成功状态
                            try {
                                const responseText = that.responseText;
                                const data = JSON.parse(responseText);
                                // 提取status=-1的id，使用self访问类实例
                                if (data && data.data && data.data.userAnswers) {
                                    // 假设 data 是你获取到的 userAnswers 对象
                                    const userAnswers = data.data.userAnswers;
                                    // 筛选出 status 为 -1 的项，并收集它们的 id
                                    const wrongIds = [];
                                    // 筛选出 status 为 10 的项，并收集它们的 id
                                    const unAnsweredIds = [];
                                    for (const key in userAnswers) {
                                        if (userAnswers.hasOwnProperty(key)) {
                                            const item = userAnswers[key];
                                            // 检查 status 是否为 -1
                                            if (item.status === -1) {
                                                wrongIds.push(item.id);
                                            }
                                            // 检查 status 是否为 -1
                                            if (item.status === 10) {
                                                unAnsweredIds.push(item.id);
                                            }
                                        }
                                    }
                                    self.state.globalWrongQuestionIds = wrongIds;
                                    self.state.globalUnAsweredQuestionIds = unAnsweredIds;
                                    console.log('✅ 提取到的错误题目ID:', self.state.globalWrongQuestionIds);
                                    console.log('✅ 提取到的未答题目ID:', self.state.globalUnAsweredQuestionIds);
                                } else {
                                    console.warn('⚠️ 返回数据结构不符合预期，未找到 userAnswers');
                                }
                            } catch (e) {
                                console.error('❌ 解析返回内容失败:', e);
                            }
                        } else {
                            console.error('❌ 请求失败，状态码:', that.status);
                        }
                    }
                });
            }

            // 检查是否是目标请求
            if (url && SUPPORTED_SUBJECTS.some(type => url.indexOf(`api/${type}/questionIds`) !== -1)) {
                console.log('🎯 拦截到目标请求 URL:', url);

                // 根据URL中的关键词动态设置考试类型
                const detectedSubject = self.detectSubjectFromUrl(url);
                if (detectedSubject) {
                    self.state.currenctLabelType = detectedSubject;
                    console.log('📌 检测到科目请求，已设置当前类型为:', detectedSubject);
                }

                // 监听请求状态变化，使用箭头函数保持this指向
                this.addEventListener('readystatechange', () => {
                    if (that.readyState === 4) { // 请求完成
                        if (that.status >= 200 && that.status < 300) { // 成功状态
                            try {
                                const responseText = that.responseText;
                                const data = JSON.parse(responseText);
                                self.state.questionIdsByType = data.results;

                            } catch (e) {
                                console.error('❌ 解析返回内容失败:', e);
                            }
                        } else {
                            console.error('❌ 请求失败，状态码:', that.status);
                        }
                    }
                });
            }

            // 调用原始的send方法
            return originalSend.apply(this, arguments);
        };
    }

    /**
      * 轮询检查特定页面并获取数据
      */
    async pollForValue() {

        // 定义所有需要匹配的前缀
        const TARGET_PATH_PREFIXES = ["/ti/exam/", "/spa/tiku/"];
        // 当前页面路径
        const currentPath = window.location.pathname;
        // 判断是否是目标页面（只要匹配任何一个前缀即可）
        const isTargetPage = TARGET_PATH_PREFIXES.some(prefix =>
            currentPath.startsWith(prefix)
        );

        if (!isTargetPage) {
            console.log(`❌ 当前页面路径（${currentPath}）不是目标页面（需以以下任一前缀开头：${TARGET_PATH_PREFIXES.join('、')}），跳过请求`);
            return;
        }

        if (currentPath.indexOf('/spa/tiku') == -1) {
            const exportErrorBtn = document.querySelector('.export-error-btn');
            exportErrorBtn.hidden = true;
        } else if (currentPath.indexOf('/ti/exam/') == -1) {
            const solutionBtn = document.querySelector('.solution-btn');
            solutionBtn.hidden = true;
        }

        // 如果已获取到WrongQuestionIds，则处理
        if (this.state.globalWrongQuestionIds !== null && this.state.globalWrongQuestionIds !== undefined) {
            console.log('✅ 目标页面+globalWrongQuestionIds 已存在', this.state.globalWrongQuestionIds);
        } else {
            console.log('❌ 目标页面，但 globalWrongQuestionIds 还不存在...');
        }

        // 如果已获取到exerciseId，则处理
        if (this.state.globalExerciseId !== null && this.state.globalExerciseId !== undefined) {
            console.log('✅ 目标页面+globalExerciseId 已存在', this.state.globalExerciseId);
            this.state.questionIds = await this.getExerciseQuestions(this.state.globalExerciseId);
        } else {
            console.log('❌ 目标页面，但 globalExerciseId 还不存在');
        }

        // 如果已获取到exerciseId，则处理
        if (this.state.questionIds !== null && this.state.questionIds !== undefined) {
            console.log('✅ 目标页面+questionIds 已存在', this.state.questionIds);

            const exportErrorBtn = document.querySelector('.export-error-btn');
            const currentPath = window.location.pathname;

            if (this.state.globalExerciseId == null) {
                exportErrorBtn.hidden = false;
            } else {
                const solutionBtn = document.querySelector('.solution-btn');
                this.pushLog('⚠️ 正在获取评论', 'warning');
                let comments = {};
                const qids = this.state.questionIds;
                this.state.episodeMap = await this.getEpisodesByIds(qids);
                // 获取每个题目的评论
                for (let i = 0; i < qids.length; i++) {
                    const qid = qids[i];
                    if (qid) {
                        comments[qid] = await this.getComments(qid);
                    }
                }

                this.state.comments = comments;
                this.pushLog('✅ 已经获取评论完成', 'success');

                if (currentPath.indexOf('/ti/exam/') !== -1) {
                    solutionBtn.hidden = false;
                }
            }
        } else {
            console.log('❌ 目标页面，但 globalExerciseId 还不存在');
        }

    }



    /**
     * 延迟函数
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise} 返回Promise对象
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 渲染标签列表
     */
    renderLabels() {
        const labelsPanel = this.container.querySelector('.labels-panel');
        // 清空现有内容
        labelsPanel.innerHTML = '';

        // 遍历所有标签，创建标签项
        this.state.allLabels.forEach(label => {
            const labelItem = document.createElement('div');
            // 设置样式类，当前选中的标签添加active类
            labelItem.className = `label-item ${this.state.currentLabelId === label.id ? 'active' : ''}`;
            labelItem.textContent = label.name;
            // 绑定点击事件，切换标签
            labelItem.addEventListener('click', () => {
                // 切换标签时重置搜索
                this.state.searchQuery = '';
                const searchInput = this.container.querySelector('.search-input');
                if (searchInput) searchInput.value = '';

                this.state.currentLabelId = label.id;
                this.state.currentPage = 0; // 切换标签时重置到第一页
                this.fetchPapers(); // 获取该标签下的试卷
                this.renderLabels(); // 重新渲染标签列表，更新选中状态
            });
            labelsPanel.appendChild(labelItem);
        });
    }

    /**
     * 渲染试卷列表
     */
    renderPapers() {
        const papersPanel = this.container.querySelector('.papers-panel');
        // 清空现有内容
        papersPanel.innerHTML = '';

        // 创建试卷列表头部
        const header = document.createElement('div');
        header.className = 'papers-header';
        let length = this.state.allPapersByLabel[this.state.currentLabelId]?.length || 0;
        header.innerHTML = `<div class="papers-count">共 ${length} 份试卷</div>`;
        papersPanel.appendChild(header);

        // 创建试卷列表容器
        const papersList = document.createElement('div');
        papersList.className = 'papers-list';

        // 检查是否有试卷数据
        if (this.state.currentPapers.length === 0) {
            papersList.innerHTML = '<div class="loading">没有找到试卷</div>';
        } else {
            // 遍历试卷数据，创建试卷项
            this.state.currentPapers.forEach(paper => {
                const paperItem = document.createElement('div');
                paperItem.className = 'paper-item';
                const paperName = paper.name ?? paper.sheet.name;
                //paper.key != undefined && paper.status == 1
                const isFinish = false;

                // 设置试卷项内容，包含下载按钮
                paperItem.innerHTML = `
                    <h4 class="paper-title">${paperName}</h4>
                    <div class="paper-actions">
                        ${isFinish ? `<button class="paper-action-btn fb-view-btn" data-id="${paper.key}">粉笔解析</button>` : ''}
                        <button class="paper-action-btn item-view-btn" data-id="${paper.id}" data-name="${paperName}">查看解析</button>
                        <button class="paper-action-btn download-btn" data-id="${paper.id}" data-name="${paperName}">下载试卷</button>
                        <button class="paper-action-btn item-collect-btn" data-id="${paper.id}" data-name="${paperName}">收藏题目</button>
                        <button class="paper-action-btn item-dis-collect-btn" data-id="${paper.id}" data-name="${paperName}">取消收藏</button>
                    </div>
                `;

                // 跳转粉笔解析按钮事件
                const viewBtn = paperItem.querySelector('.fb-view-btn');
                if (viewBtn) { // 只有当按钮存在时才绑定事件
                    viewBtn.addEventListener('click', (e) => {
                        e.stopPropagation(); // 阻止事件冒泡

                        const paperId = e.currentTarget.getAttribute('data-id');
                        window.open(`https://spa.fenbi.com/ti/exam/solution/${paperId}?routecs=${this.state.currenctLabelType}`, "_blank");
                    });
                }

                // 查看解析按钮事件 - 点击时显示类别选择弹窗
                paperItem.querySelector('.item-view-btn').addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止事件冒泡
                    // 如果正在处理操作，则不执行
                    if (this.state.isProcessing) {
                        this.pushLog('正在处理中，请稍后再试', 'warning');
                        return;
                    }
                    const paperId = e.currentTarget.getAttribute('data-id');
                    const paperName = e.currentTarget.getAttribute('data-name');
                    // 显示类别选择弹窗，指定操作为查看解析
                    this.showCategoryModal({ id: paperId, name: paperName }, 'view');
                });

                // 下载试卷按钮事件
                paperItem.querySelector('.download-btn').addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止事件冒泡
                    // 如果正在处理操作，则不执行
                    if (this.state.isProcessing || this.state.isBatchDownloading) {
                        this.pushLog('正在处理中，请稍后再试', 'warning');
                        return;
                    }
                    const paperId = e.currentTarget.getAttribute('data-id');
                    const paperName = e.currentTarget.getAttribute('data-name');
                    this.downloadPaperPDF({ id: paperId, name: paperName });
                });

                // 收藏题目按钮事件 - 点击时显示类别选择弹窗
                paperItem.querySelector('.item-collect-btn').addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止事件冒泡
                    // 如果正在处理操作，则不执行
                    if (this.state.isProcessing) {
                        this.pushLog('正在处理中，请稍后再试', 'warning');
                        return;
                    }
                    const paperId = e.currentTarget.getAttribute('data-id');
                    const paperName = e.currentTarget.getAttribute('data-name');
                    // 显示类别选择弹窗
                    this.showCategoryModal({ id: paperId, name: paperName }, 'collect');
                });

                // 取消收藏题目按钮事件
                paperItem.querySelector('.item-dis-collect-btn').addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止事件冒泡
                    // 如果正在处理操作，则不执行
                    if (this.state.isProcessing) {
                        this.pushLog('正在处理中，请稍后再试', 'warning');
                        return;
                    }
                    const paperId = e.currentTarget.getAttribute('data-id');
                    const paperName = e.currentTarget.getAttribute('data-name');
                    this.disCollectPaperQuestions({ id: paperId, name: paperName });
                });

                papersList.appendChild(paperItem);
            });
        }

        papersPanel.appendChild(papersList);

        // 创建分页控件
        const pagination = document.createElement('div');
        pagination.className = 'pagination';

        pagination.innerHTML = `
            <button class="page-btn prev-btn" ${this.state.currentPage === 0 ? 'disabled' : ''}>上一页</button>
            <button class="page-btn page-num active">${this.state.currentPage + 1}/${this.state.totalPages}</button>
            <button class="page-btn next-btn" ${this.state.currentPage >= this.state.totalPages - 1 ? 'disabled' : ''}>下一页</button>
        `;

        // 上一页按钮事件
        pagination.querySelector('.prev-btn').addEventListener('click', () => {
            if (this.state.currentPage > 0) {
                this.state.currentPage--;
                // 应用搜索和分页
                if (this.state.searchQuery) {
                    this.filterPapersBySearch();
                } else {
                    this.updateCurrentPapers();
                }
            }
        });

        // 下一页按钮事件
        pagination.querySelector('.next-btn').addEventListener('click', () => {
            if (this.state.currentPage < this.state.totalPages - 1) {
                this.state.currentPage++;
                // 应用搜索和分页
                if (this.state.searchQuery) {
                    this.filterPapersBySearch();
                } else {
                    this.updateCurrentPapers();
                }
            }
        });

        papersPanel.appendChild(pagination);
    }

    /**
     * 获取标签列表
     */
    async fetchLabels() {
        try {
            // 标签API地址
            const apiUrl = `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/subLabels?app=web&kav=100&av=100&hav=100&version=3.0.0.0`;

            // 发送请求
            const response = await this.httpRequest({
                method: 'GET',
                url: apiUrl,
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': `https://tiku.fenbi.com/${this.state.currenctLabelType}/`,
                    'User-Agent': navigator.userAgent
                }
            });

            // 解析响应数据
            const data = JSON.parse(response);
            // 在标签列表前添加"所有练习"选项
            const allLabels = data || [];
            // 添加写死的"所有练习"标签作为第一个选项
            this.state.allLabels = [{
                id: `all-${this.state.currenctLabelType}`,  // 可以使用特殊ID标识全部练习
                name: '所有练习'  // 写死的名称
            }, {
                id: `all-exam-${this.state.currenctLabelType}`,  // 可以使用特殊ID标识全部试卷
                name: '所有试卷'  // 写死的名称
            }, ...allLabels];

            // 渲染标签列表
            this.renderLabels();

            // 默认选择所有练习标签
            if (this.state.allLabels.length > 0) {
                this.state.currentLabelId = this.state.allLabels[2].id;
                this.fetchPapers(); // 获取第一个标签下的试卷
                this.renderLabels(); // 重新渲染标签列表
            }
        } catch (error) {
            this.pushLog(`获取标签失败: ${error.message}`, 'error');
        }
    }

    /**
   * 获取标签下的所有试卷（包括所有分页）
   */
    async fetchAllPagesForLabel(labelId) {
        if (this.state.allPapersByLabel[labelId] && this.state.allPapersByLabel[labelId][0] == 'isProcessing') {
            return;
        }
        this.state.allPapersByLabel[labelId] = ['isProcessing'];


        let allItems = [];
        let currentPage = 0;
        let totalPages = 1;
        // 扩展判断条件，同时包含"all"和"all-exam"两种情况
        const isAllExercises = labelId === `all-${this.state.currenctLabelType}` || labelId === `all-exam-${this.state.currenctLabelType}`;
        // 提取公共请求配置（所有API请求共用的headers等）
        const requestConfig = {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Referer': `https://tiku.fenbi.com/${this.state.currenctLabelType}/`,
                'User-Agent': navigator.userAgent,
                'Cookie': document.cookie
            }
        };

        try {
            if (isAllExercises) {
                // 【练习数据分支】通过递归+游标获取所有练习
                const baseUrl = `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/category-exercises`;

                // 封装URL构建逻辑：根据游标cursor生成带参数的请求地址
                const buildUrl = (cursor) => {
                    const url = new URL(baseUrl);
                    url.searchParams.append('cursor', cursor); // 分页游标（用于加载下一页）
                    url.searchParams.append('count', 30);      // 每页条数
                    // 动态设置categoryId：all对应2，all-exam对应1
                    const categoryId = labelId === `all-${this.state.currenctLabelType}` ? 2 : 1;
                    url.searchParams.append('categoryId', categoryId);
                    url.searchParams.append('noCacheTag', '409'); // 防缓存标记
                    url.searchParams.append('app', 'web');     // 应用标识
                    url.searchParams.append('kav', '100');     // 版本相关参数
                    url.searchParams.append('av', '100');
                    url.searchParams.append('hav', '100');
                    url.searchParams.append('version', '3.0.0.0');
                    return url.toString();
                };

                // 封装“请求单页练习数据”的逻辑：返回当前页数据 + 下一页游标
                const fetchExerciseData = async (cursor) => {
                    try {
                        const response = await this.httpRequest({
                            ...requestConfig,
                            url: buildUrl(cursor),
                        });
                        const data = JSON.parse(response);
                        return {
                            list: data.datas || [], // 当前页练习列表（兜底空数组避免报错）
                            nextCursor: data.cursor !== undefined ? data.cursor : -1, // 下一页游标（-1 表示无更多数据）
                        };
                    } catch (error) {
                        console.error(`请求 cursor=${cursor} 的练习数据失败:`, error);
                        throw error; // 向上层抛出错误，由调用方统一处理
                    }
                };
                // 递归获取所有练习数据（async 函数自动返回 Promise，确保异步完成后返回全量数据）
                const fetchAllData = async (currentCursor = 0, accumulatedData = []) => {
                    try {

                        // 1. 异步获取“当前页练习数据”
                        const { list, nextCursor } = await fetchExerciseData(currentCursor);
                        // 2. 累积数据（通过函数参数传递，避免依赖 React state 异步更新导致数据丢失）
                        const updatedData = [...accumulatedData, ...list];
                        // 3. 新增：记录“当前已获取的总数据量”
                        this.pushLog(`已获取 ${updatedData.length} 条练习数据`);
                        // 4. 终止条件：没有下一页时，返回最终全量数据
                        if (nextCursor === -1) {
                            console.log('所有练习数据获取完成，共', updatedData.length, '条');
                            this.handleAllDataComplete?.(updatedData); // 可选的“数据完成”回调（若需要）
                            return updatedData; // async 函数会自动将返回值包装为 Promise
                        }
                        // 5. 延迟 800ms 防止请求过于频繁，再递归获取下一页
                        await new Promise((resolve) => setTimeout(resolve, 500));
                        // 递归调用自身，并返回最终结果（递归完成后会自动冒泡到最外层 Promise）
                        return fetchAllData(nextCursor, updatedData);
                    } catch (error) {
                        // 错误处理：更新状态 + 向上层抛出“包含部分数据的错误”
                        const errorMsg = `获取练习数据失败: ${error.message || '未知错误'}`;
                        throw {
                            message: errorMsg,
                            partialData: accumulatedData, // 携带“已获取的部分数据”，方便调用方处理
                        };
                    }
                };
                // 等待递归完成，获取全量练习数据并返回
                allItems = await fetchAllData(0, []);
            } else {
                // 【试卷数据分支】通过“页码分页”获取所有试卷
                const baseUrl = `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/papers`;

                // 封装URL构建逻辑：根据页码page生成带参数的请求地址
                const buildUrl = (page) => {
                    const url = new URL(baseUrl);
                    url.searchParams.append('toPage', page);   // 目标页码
                    url.searchParams.append('pageSize', 100);  // 每页条数
                    url.searchParams.append('labelId', labelId); // 标签ID（筛选试卷）
                    url.searchParams.append('app', 'web');
                    url.searchParams.append('kav', '100');
                    url.searchParams.append('av', '100');
                    url.searchParams.append('hav', '100');
                    url.searchParams.append('version', '3.0.0.0');
                    return url.toString();
                };

                // 封装“请求单页试卷数据”的逻辑：返回当前页列表+总页数
                const fetchPageData = async (page) => {
                    const response = await this.httpRequest({
                        ...requestConfig,
                        url: buildUrl(page)
                    });
                    const data = JSON.parse(response);
                    return {
                        list: data.list || [], // 当前页试卷列表
                        totalPages: data.pageInfo?.totalPage || 1 // 总页数（默认1页）
                    };
                };

                // 1. 请求第一页试卷数据
                const firstPageResult = await fetchPageData(currentPage);
                allItems = allItems.concat(firstPageResult.list); // 拼接第一页数据
                totalPages = firstPageResult.totalPages;          // 获取总页数
                this.pushLog(`开始加载标签下的试卷，共 ${totalPages} 页`, 'info');

                // 2. 循环请求剩余页码的试卷（从第2页开始）
                for (currentPage = 1; currentPage < totalPages; currentPage++) {
                    this.pushLog(`加载第 ${currentPage + 1}/${totalPages} 页`);
                    const pageResult = await fetchPageData(currentPage);
                    allItems = allItems.concat(pageResult.list); // 拼接当前页数据
                    await this.sleep(500); // 延迟500ms，避免请求过于频繁
                }
            }

            // 公共成功逻辑：输出日志+返回全量数据
            this.pushLog(`成功加载 ${allItems.length} 条${isAllExercises ? '练习' : '试卷'}`, 'success');
            console.log('最终获取的所有数据:', allItems);
            return allItems;
        } catch (error) {
            // 错误处理：输出错误日志，返回已获取的部分数据
            this.pushLog(`获取${isAllExercises ? '练习' : '试卷'}失败: ${error.message}`, 'error');
            return allItems;
        }
    }

    /**
     * 获取当前标签的试卷列表（全量数据）
     */
    async fetchPapers() {
        // 如果没有选中的标签，直接返回
        if (!this.state.currentLabelId) return;

        // 检查是否已经加载过该标签的试卷
        if (this.state.allPapersByLabel[this.state.currentLabelId] && this.state.allPapersByLabel[this.state.currentLabelId][0] != 'isProcessing') {
            this.updateCurrentPapers();
            return;
        }

        // 显示加载状态
        this.showLoading();

        try {
            const labelId = this.state.currentLabelId

            // 获取该标签下的所有试卷（所有分页）
            const allPapers = await this.fetchAllPagesForLabel(labelId);

            if (allPapers) {
                // 存储全量数据
                this.state.allPapersByLabel[labelId] = allPapers;

            }

            if (this.state.allPapersByLabel[labelId][0] != 'isProcessing' && labelId == this.state.currentLabelId) {
                // 更新当前显示的试卷（应用分页）
                this.updateCurrentPapers();
            }


        } catch (error) {
            const papersPanel = this.container.querySelector('.papers-panel');
            papersPanel.innerHTML = `<div class="loading">加载失败: ${error.message}</div>`;
            this.pushLog(`获取试卷失败: ${error.message}`, 'error');
        }
    }

    /**
     * 下载试卷PDF
     * @param {Object} paper - 试卷对象
     * @param {boolean} isBatch - 是否是批量下载中的一个
     * @returns {boolean} 是否下载成功
     */
    async downloadPaperPDF(paper, isBatch = false) {

        const paperName = paper.name ?? paper.sheet.name;
        let exerciseId = paper.id;
        if (!isBatch) {
            this.pushLog(`开始下载试卷：《${paperName}》`, 'info');
        }

        if (this.state.currentLabelId != `all-${this.state.currenctLabelType}` && this.state.currentLabelId != `all-exam-${this.state.currenctLabelType}`) {

            // 步骤1：检查并创建练习
            const exerciseCreated = await this.createExercise(paper);
            if (!exerciseCreated || !paper.exercise?.id) {
                this.pushLog('❌ 无法下载，未获取到练习ID', 'error');
                return false;
            }
            exerciseId = paper.exercise.id;
        }


        // 步骤2：构建下载URL并触发下载
        const downloadUrl = `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/exercises/${exerciseId}/pdf`;

        try {
            // 先检查URL是否有效
            await this.httpRequest({
                method: 'HEAD',
                url: downloadUrl,
                headers: {
                    'Cookie': document.cookie,
                    'Referer': `https://tiku.fenbi.com/${this.state.currenctLabelType}/`,
                    'User-Agent': navigator.userAgent
                }
            });

            // 创建隐藏的a标签来触发下载
            const a = document.createElement('a');
            a.href = downloadUrl;
            // 清理文件名中的特殊字符
            const fileName = `${paperName.replace(/[\/:*?"<>|]/g, '-')}.pdf`;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (!isBatch) {
                this.pushLog(`✅ 已开始下载《${paperName}》`, 'success');
            }
            return true;
        } catch (error) {
            if (!isBatch) {
                this.pushLog(`❌ 下载失败：${error.message}`, 'error');
            }
            console.error('下载试卷出错:', error);
            return false;
        }
    }

    /**
     * 批量下载搜索结果中的试卷
     */
    async batchDownloadPapers() {
        // 检查是否正在处理或批量下载中
        if (this.state.isProcessing || this.state.isBatchDownloading) {
            this.pushLog('正在处理中，请稍后再试', 'warning');
            return;
        }

        // 检查是否有搜索结果
        if (this.state.currentPapers.length === 0) {
            this.pushLog('没有可下载的试卷，请先搜索或选择标签', 'error');
            return;
        }

        // 获取要下载的页数
        const pagesToDownload = this.state.batchDownloadPages;
        const totalPages = this.state.totalPages;
        const actualPages = Math.min(pagesToDownload, totalPages);

        // 计算要下载的试卷总数
        let totalPapers = 0;
        const papersToDownload = [];

        // 收集所有要下载的试卷
        for (let page = 0; page < actualPages; page++) {
            const startIndex = page * this.state.pageSize;
            let endIndex = startIndex + this.state.pageSize;
            // 获取当前标签的所有试卷，并应用多关键词全匹配筛选
            const allPapers = this.state.searchQuery
                ? (() => {
                    // 将搜索词按顿号分割成数组，并过滤空字符串
                    const keywords = this.state.searchQuery
                        .toLowerCase()
                        .split('、')
                        .map(keyword => keyword.trim())
                        .filter(keyword => keyword);

                    // 如果没有有效关键词，返回所有试卷
                    if (keywords.length === 0) {
                        return this.state.allPapersByLabel[this.state.currentLabelId] || [];
                    }

                    // 应用多关键词全匹配筛选
                    return this.state.allPapersByLabel[this.state.currentLabelId]?.filter(paper => {
                        const paperName = paper.name.toLowerCase();
                        return keywords.every(keyword => paperName.includes(keyword));
                    }) || [];
                })()
                : this.state.allPapersByLabel[this.state.currentLabelId] || [];

            // 确保不超出范围
            endIndex = Math.min(endIndex, allPapers.length);


            // 添加到下载列表
            papersToDownload.push(...allPapers.slice(startIndex, endIndex));
        }

        totalPapers = papersToDownload.length;

        if (totalPapers === 0) {
            this.pushLog('没有找到符合条件的试卷', 'error');
            return;
        }

        this.state.isBatchDownloading = true;
        this.pushLog(`开始批量下载 ${totalPapers} 份试卷（共 ${actualPages} 页）`, 'info');
        this.updateBatchDownloadProgress(0, totalPapers);

        let successCount = 0;
        let failCount = 0;

        try {
            // 逐个下载试卷
            for (let i = 0; i < totalPapers; i++) {
                // 显示当前进度
                this.pushLog(`正在下载 ${i + 1}/${totalPapers}：${papersToDownload[i].name ?? papersToDownload[i].sheet.name}`, 'info');

                // 下载试卷
                const success = await this.downloadPaperPDF(papersToDownload[i], true);

                // 更新计数
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                    this.pushLog(`❌ 下载失败：${papersToDownload[i].name ?? papersToDownload[i].sheet.name}`, 'error');
                }

                // 更新进度条
                this.updateBatchDownloadProgress(i + 1, totalPapers);

                // 每下载2个试卷后暂停一下，避免请求过于频繁
                if ((i + 1) % 2 === 0) {
                    await this.sleep(2000);
                } else {
                    await this.sleep(1000);
                }
            }

            this.pushLog(`批量下载完成！成功：${successCount} 份，失败：${failCount} 份`, 'success');
        } catch (error) {
            this.pushLog(`批量下载过程出错：${error.message}`, 'error');
        } finally {
            this.state.isBatchDownloading = false;
        }
    }

    /**
     * 创建练习
     * @param {Object} paper - 试卷对象
     * @returns {boolean} 是否创建成功
     */
    async createExercise(paper) {
        const paperId = paper.id;
        const name = paper.name || '未知试卷';

        this.pushLog(`🆕 正在创建试卷 "${name}"的相关练习 ...`);
        // 练习创建表单数据
        const form = {
            type: 1,
            paperId: paperId,
            exerciseTimeMode: 2
        };

        try {
            // 转换表单数据为URLSearchParams格式
            const formData = new URLSearchParams();
            Object.entries(form).forEach(([k, v]) => formData.append(k, v));
            // 发送创建练习请求
            const createExerciseResponse = await this.httpRequest({
                url: `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/exercises?app=web&kav=100&av=100&hav=100&version=3.0.0.0`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': document.cookie,
                    'Referer': `https://tiku.fenbi.com/${this.state.currenctLabelType}/`,
                    'User-Agent': navigator.userAgent
                },
                data: formData.toString()
            });

            // 检查响应是否为空
            if (!createExerciseResponse) {
                this.pushLog(`❌ 创建练习失败，试卷：${name}，响应为空`, 'error');
                return false;
            }

            // 解析响应数据
            let exerciseResponse = JSON.parse(createExerciseResponse);
            let exerciseId = exerciseResponse.id;
            if (exerciseId) {
                // 保存练习ID到试卷对象
                paper.exercise = { id: exerciseId };
                this.pushLog(`✅ 练习创建成功，ID: ${exerciseId}`, 'success');
                return true;
            } else {
                this.pushLog(`❌ 创建练习失败，试卷：${name}`, 'error');
                return false;
            }
        } catch (err) {
            this.pushLog(`❌ 创建练习出错：${err.message}`, 'error');
            return false;
        }
    }

    /**
     * 获取练习中的题目
     * @param {string} exerciseId - 练习ID
     * @returns {Array} 题目ID列表
     */
    async getExerciseQuestions(exerciseId) {
        try {
            // 发送请求获取练习详情
            const response = await this.httpRequest({
                url: `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/exercises/${exerciseId}`,
                method: 'GET',
                headers: {
                    'Cookie': document.cookie,
                    'Referer': `https://tiku.fenbi.com/${this.state.currenctLabelType}/`,
                    'User-Agent': navigator.userAgent
                }
            });

            // 解析响应数据，提取题目ID列表
            const data = JSON.parse(response);
            this.state.currentStatus = data?.status || 0;
            this.state.currentChapters = data?.sheet?.chapters || [];
            return data?.sheet?.questionIds || [];
        } catch (error) {
            this.pushLog(`❌ 获取题目失败：${error.message}`, 'error');
            console.error(error);
            return [];
        }
    }

    /**
     * 获取已收藏的题目ID
     * @param {Array} questionIds - 题目ID列表
     * @returns {Array} 已收藏的题目ID列表
     */
    async getCollectedQuestionIds(questionIds) {
        try {
            // 构建请求URL
            let url = `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/collects`;
            if (questionIds.length > 0) {
                url += `?ids=${questionIds.join(',')}`;
            }

            // 发送请求
            const response = await this.httpRequest({
                url,
                method: 'GET',
                headers: {
                    'Cookie': document.cookie,
                    'Referer': `https://tiku.fenbi.com/${this.state.currenctLabelType}/`,
                    'User-Agent': navigator.userAgent
                }
            });

            // 解析响应数据
            const data = JSON.parse(response);
            const collectedIds = Array.isArray(data) ? data : [];
            this.pushLog(`🔍 已收藏 ${collectedIds.length} 道题目`, 'info');
            return collectedIds;
        } catch (error) {
            this.pushLog(`❌ 查询收藏状态失败：${error.message}`, 'error');
            return [];
        }
    }

    /**
   * 获取题目元数据（包括准确率）【分批版，每次最多200条】
   * @param {Array} questionIds - 题目ID列表
   * @returns {string|Array} 合并后的元数据数组
   */
    async getQuestionMetaByIds(questionIds) {
        const BATCH_SIZE = 200; // 每批最大数量
        const allMeta = [];
        const totalBatches = Math.ceil(questionIds.length / BATCH_SIZE);

        // 循环处理每一批
        for (let i = 0; i < totalBatches; i++) {
            // 计算当前批次的起始和结束索引
            const startIndex = i * BATCH_SIZE;
            const endIndex = startIndex + BATCH_SIZE;
            const batchIds = questionIds.slice(startIndex, endIndex);

            try {
                // 发送请求获取当前批次元数据
                const resText = await this.httpRequest({
                    url: `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/question/meta?ids=${batchIds.join(',')}`,
                    method: "GET",
                    headers: {
                        'Cookie': document.cookie,
                        'Referer': `https://tiku.fenbi.com/${this.state.currenctLabelType}/`,
                        'User-Agent': navigator.userAgent
                    }
                });

                const batchData = JSON.parse(resText);

                // 有数据才合并
                if (Array.isArray(batchData) && batchData.length > 0) {
                    allMeta.push(...batchData);
                }

                // 批次之间延时防风控
                if (i < totalBatches - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

            } catch (error) {
                console.error(`元数据 第 ${i + 1} 批请求失败:`, error);
                this.pushLog(`⚠️ 元数据第${i + 1}批次获取失败`, 'warn');
                // 不中断，继续下一批
            }
        }

        // 返回合并完成的数组，上层JSON.parse可以删掉！！！
        return allMeta;
    }

    /**
     * 根据选中的类别筛选题目
     * @param {Array} questionIds - 题目ID列表
     * @returns {Array} 筛选后的题目ID列表（无匹配时返回空数组表示跳过）
     */
    async filterQuestionsByCategories(questionIds) {
        // 检查是否全选了所有类别
        const isSelectAll = this.state.selectedCategories.length === this.questionCategories.length;
        if (isSelectAll) {
            this.pushLog('已选择全部类别，不进行章节筛选', 'info');
            return questionIds; // 全选时直接返回所有题目
        }

        // 验证章节数据是否存在
        if (!this.state.currentChapters || !Array.isArray(this.state.currentChapters)) {
            this.pushLog('未获取到章节信息，无法按类别筛选，将跳过该试卷', 'warning');
            return []; // 无章节信息时返回空数组表示跳过
        }

        // 筛选出需要处理的类别
        const targetCategories = this.state.selectedCategories;
        if (targetCategories.length === 0) {
            this.pushLog('没有选择任何类别，返回全部题目', 'info');
            return questionIds;
        }

        // 定义类别关键词映射表，用于匹配章节名称
        const categoryKeywords = {
            'political': ['政治', '时政', '政策'],
            'common-sense': ['常识', '基础知识', '公共基础'],
            'verbal': ['言语', '语言', '理解'],
            'quantity': ['数量', '数字', '计算'],
            'logic': ['逻辑', '推理', '科学'],
            'data': ['资料', '数据', '分析'],
            'teacher': ['教育综合', '教育学', '心理学', '教师职业道德', '新课程', '教学设计']
        };

        // 收集符合条件的题目ID
        let result = [];
        let currentPosition = 0; // 记录在总题目列表中的当前位置

        // 遍历所有章节，查找与选中类别匹配的章节
        this.state.currentChapters.forEach(chapter => {
            // 跳过没有题目数量信息的章节
            if (!chapter.questionCount || chapter.questionCount <= 0) {
                return;
            }

            this.pushLog(`分析章节: ${chapter.name}, 题目数量: ${chapter.questionCount}`, 'info');

            // 检查当前章节是否匹配任何选中的类别
            const matchedCategory = targetCategories.find(category => {
                // 检查章节名称是否包含该类别的任何关键词
                return categoryKeywords[category]?.some(keyword =>
                    chapter.name.includes(keyword)
                );
            });

            // 如果找到匹配的类别，提取该章节的题目
            if (matchedCategory) {
                const categoryName = this.questionCategories.find(c => c.id === matchedCategory)?.name;
                this.pushLog(`找到匹配章节: ${chapter.name} -> 类别: ${categoryName}`, 'success');

                // 计算该章节在总题目列表中的起始和结束索引
                const startIndex = currentPosition;
                const endIndex = Math.min(currentPosition + chapter.questionCount, questionIds.length);

                // 提取对应范围的题目ID
                const categoryQuestions = questionIds.slice(startIndex, endIndex);
                result = [...result, ...categoryQuestions];

                this.pushLog(`从章节提取 ${categoryQuestions.length} 道${categoryName}题目`, 'success');
            }

            // 更新当前位置指针
            currentPosition += chapter.questionCount;
        });

        if (result.length === 0) {
            this.pushLog('没有找到与所选类别匹配的章节，将跳过该试卷', 'warning');
            return []; // 没有匹配题目时返回空数组表示跳过
        }

        return result;
    }

    /**
     * 收藏未收藏的题目
     * @param {Array} unCollectedIds - 未收藏的题目ID列表
     * @returns {number} 成功收藏的数量
     */
    async collectUnCollectedQuestions(unCollectedIds) {
        let successCount = 0;
        // 遍历未收藏的题目ID
        for (let j = 0; j < unCollectedIds.length; j++) {
            const qid = unCollectedIds[j];
            try {
                // 发送收藏请求
                await this.httpRequest({
                    url: `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/collects/${qid}`,
                    method: 'POST',
                    headers: {
                        'Cookie': document.cookie,
                        'Referer': `https://tiku.fenbi.com/${this.state.currenctLabelType}/`,
                        'User-Agent': navigator.userAgent
                    }
                });
                successCount++;
                this.pushLog(`✅ 收藏成功：第 ${j + 1}/${unCollectedIds.length} 题 (ID: ${qid})`, 'success');
            } catch (err) {
                this.pushLog(`❌ 收藏失败：第 ${j + 1} 题 (${qid})`, 'error');
                await this.sleep(500); // 延迟500ms后重试
                // 重试一次
                try {
                    await this.httpRequest({
                        url: `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/collects/${qid}`,
                        method: 'POST',
                        headers: {
                            'Cookie': document.cookie,
                            'Referer': `https://tiku.fenbi.com/${this.state.currenctLabelType}/`,
                            'User-Agent': navigator.userAgent
                        }
                    });
                    successCount++;
                    this.pushLog(`✅ 重试成功：第 ${j + 1} 题 (${qid})`, 'success');
                } catch (retryErr) {
                    this.pushLog(`🔁 重试失败：第 ${j + 1} 题 (${qid})`, 'error');
                }
            }
            // 避免请求过于频繁，每个请求间隔300ms
            await this.sleep(300);
        }
        return successCount;
    }

    /**
     * 收藏试卷中的题目
     * @param {Object} paper - 试卷对象
     */
    async collectPaperQuestions(paper) {
        // 设置处理状态为true，防止重复操作
        this.state.isProcessing = true;
        try {
            const paperName = paper.name ?? paper.sheet.name;
            let exerciseId = paper.id;
            this.pushLog(`开始处理试卷：《${paperName}》`, 'info');
            if (this.state.currentLabelId != `all-${this.state.currenctLabelType}` && this.state.currentLabelId != `all-exam-${this.state.currenctLabelType}`) {

                // 步骤1：检查并创建练习
                const exerciseCreated = await this.createExercise(paper);
                if (!exerciseCreated || !paper.exercise?.id) {
                    this.pushLog('❌ 无法继续，未获取到练习ID', 'error');
                    return;
                }
                exerciseId = paper.exercise.id;
            }

            // 步骤2：获取题目
            const questionIds = await this.getExerciseQuestions(exerciseId);
            if (questionIds.length === 0) {
                this.pushLog('ℹ️ 没有找到题目', 'info');
                return;
            }

            // 步骤3：根据选中的类别筛选题目
            const categoryFilteredIds = await this.filterQuestionsByCategories(questionIds);
            if (categoryFilteredIds.length === 0) {
                this.pushLog('ℹ️ 没有找到符合所选类别的题目', 'info');
                return;
            }

            // 步骤4-1：获取题目元数据并按准确率筛选
            let parsedMetaIds = await this.getQuestionMetaByIds(categoryFilteredIds);
            // 兜底：如果返回null就变成空数组
            if (!Array.isArray(parsedMetaIds)) {
                parsedMetaIds = [];
                this.pushLog("⚠️ 元数据请求异常，准确率筛选已跳过", "warn");
            }

            const accuracyFilteredIds = parsedMetaIds
                .filter(q => q.correctRatio >= this.state.minAccuracy && q.correctRatio <= this.state.maxAccuracy)
                .map(q => q.id);

            this.pushLog(`✅ 获取到 ${accuracyFilteredIds.length} 道符合准确率范围的题目`, 'success');

            // 步骤4-2：获取已收藏题目
            const collectedIds = await this.getCollectedQuestionIds(accuracyFilteredIds);

            // 步骤5：收藏未收藏的题目
            const unCollectedIds = accuracyFilteredIds.filter(qid => !collectedIds.includes(qid));
            if (unCollectedIds.length === 0) {
                this.pushLog('✅ 所有题目均已收藏', 'success');
                return;
            }

            this.pushLog(`需要收藏 ${unCollectedIds.length} 道题目`, 'info');
            const successCount = await this.collectUnCollectedQuestions(unCollectedIds);
            this.pushLog(`🎉 收藏完成，成功 ${successCount}/${unCollectedIds.length} 道`, 'success');
        } finally {
            // 无论成功失败，都重置处理状态
            this.state.isProcessing = false;
        }
    }

    /**
     *
     * @param {Array} collectedIds - 已经收藏的题目ID列表
     */
    async disCollecyByCollectedIds(collectedIds) {

        this.pushLog(`🗑️ 开始删除 ${collectedIds.length} 道已收藏题目`, 'info');

        let deleteCount = 0;
        // 遍历删除每个收藏的题目
        for (const qid of collectedIds) {
            try {
                await this.httpRequest({
                    url: `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/collects/${qid}`,
                    method: 'DELETE',
                    headers: {
                        'Cookie': document.cookie,
                        'Referer': `https://tiku.fenbi.com/${this.state.currenctLabelType}/`,
                        'User-Agent': navigator.userAgent
                    }
                });
                deleteCount++;
                this.pushLog(`✅ 已删除：${qid} (${deleteCount}/${collectedIds.length})`, 'success');
            } catch (err) {
                this.pushLog(`❌ 删除失败：${qid}`, 'error');
            }
            // 每个删除请求间隔200ms
            await this.sleep(200);
        }

        this.pushLog(`🎉 清理完成，共删除 ${deleteCount} 道收藏题目`, 'success');
        return deleteCount;
    }

    /**
     * 取消收藏试卷中的题目
     * @param {Object} paper - 试卷对象
     */
    async disCollectPaperQuestions(paper) {

        // 设置处理状态为true，防止重复操作
        this.state.isProcessing = true;
        try {
            const paperName = paper.name ?? paper.sheet.name;
            let exerciseId = paper.id;
            this.pushLog(`开始处理试卷：《${paperName}》`, 'info');
            if (this.state.currentLabelId != `all-${this.state.currenctLabelType}` && this.state.currentLabelId != `all-exam-${this.state.currenctLabelType}`) {

                // 步骤1：检查并创建练习
                const exerciseCreated = await this.createExercise(paper);
                if (!exerciseCreated || !paper.exercise?.id) {
                    this.pushLog('❌ 无法继续，未获取到练习ID', 'error');
                    return;
                }
                exerciseId = paper.exercise.id;
            }
            // 步骤2：获取题目
            const questionIds = await this.getExerciseQuestions(exerciseId);
            if (questionIds.length === 0) {
                this.pushLog('ℹ️ 没有找到题目', 'info');
                return;
            }

            // 步骤4：获取已收藏题目
            const collectedIds = await this.getCollectedQuestionIds(questionIds);

            // 步骤5：取消收藏这些题目
            await this.disCollecyByCollectedIds(collectedIds);

        } finally {
            // 无论成功失败，都重置处理状态
            this.state.isProcessing = false;
        }
    }

    /**
        * 批量收藏当前标签下的所有试卷
        */
    async batchCollectAllPapers() {
        // 检查是否有试卷数据
        if (this.state.currentPapers.length === 0) {
            this.pushLog('❌ 没有可收藏的试卷', 'error');
            return;
        }

        // 如果是批量收藏且没有选择类别，使用默认类别
        if (this.state.batchCollection && this.state.selectedCategories.length === 0) {
            this.state.selectedCategories = [...this.questionCategories.map(c => c.id)];
        }

        // 设置处理状态为true
        this.state.isProcessing = true;
        // 获取批量收藏按钮元素，用于显示加载状态
        const batchBtn = this.container.querySelector('.batch-collect-btn');
        const originalText = batchBtn.textContent;
        batchBtn.innerHTML = '<span class="spinner"></span>处理中';
        batchBtn.disabled = true;

        try {
            let totalSuccess = 0; // 总成功收藏数量
            let totalFailed = 0;  // 总失败试卷数量

            this.pushLog(`开始批量收藏 ${this.state.currentPapers.length} 份试卷`, 'info');

            // 遍历所有试卷
            for (let i = 0; i < this.state.currentPapers.length; i++) {
                const paper = this.state.currentPapers[i];
                const paperName = paper.name ?? paper.sheet.name;
                this.pushLog(`\n处理第 ${i + 1}/${this.state.currentPapers.length} 份：《${paperName}》`, 'info');

                try {
                    let exerciseId = paper.id;
                    if (this.state.currentLabelId != `all-${this.state.currenctLabelType}` && this.state.currentLabelId != `all-exam-${this.state.currenctLabelType}`) {

                        // 步骤1：检查并创建练习
                        const exerciseCreated = await this.createExercise(paper);
                        if (!exerciseCreated || !paper.exercise?.id) {
                            this.pushLog('❌ 跳过此试卷', 'error');
                            totalFailed++;
                            continue;
                        }
                        exerciseId = paper.exercise.id;
                    }
                    // 获取题目
                    const questionIds = await this.getExerciseQuestions(exerciseId);
                    if (questionIds.length === 0) {
                        this.pushLog('ℹ️ 没有找到题目，跳过', 'warning');
                        continue;
                    }

                    // 步骤3：根据选中的类别筛选题目
                    const categoryFilteredIds = await this.filterQuestionsByCategories(questionIds);
                    if (categoryFilteredIds.length === 0) {
                        this.pushLog('ℹ️ 没有找到符合所选类别的题目，跳过', 'info');
                        continue;
                    }


                    // 步骤4-1：获取题目元数据并按准确率筛选
                    let parsedMetaIds = await this.getQuestionMetaByIds(categoryFilteredIds);
                    // 兜底：如果返回null就变成空数组
                    if (!Array.isArray(parsedMetaIds)) {
                        parsedMetaIds = [];
                        this.pushLog("⚠️ 元数据请求异常，准确率筛选已跳过", "warn");
                    }

                    const accuracyFilteredIds = parsedMetaIds
                        .filter(q => q.correctRatio >= this.state.minAccuracy && q.correctRatio <= this.state.maxAccuracy)
                        .map(q => q.id);

                    this.pushLog(`✅ 获取到 ${accuracyFilteredIds.length} 道符合准确率范围的题目`, 'success');

                    // 获取已收藏题目
                    const collectedIds = await this.getCollectedQuestionIds(accuracyFilteredIds);

                    // 收藏未收藏的题目
                    const unCollectedIds = accuracyFilteredIds.filter(qid => !collectedIds.includes(qid));
                    if (unCollectedIds.length === 0) {
                        this.pushLog('✅ 所有题目均已收藏', 'success');
                        continue;
                    }

                    // 执行收藏
                    const successCount = await this.collectUnCollectedQuestions(unCollectedIds);
                    totalSuccess += successCount;
                    this.pushLog(`完成收藏，成功 ${successCount}/${unCollectedIds.length} 道`, 'success');

                } catch (error) {
                    this.pushLog(`❌ 处理试卷时出错：${error.message}`, 'error');
                    totalFailed++;
                }

                // 每处理完一份试卷休息2秒，避免请求过于频繁
                await this.sleep(2000);
            }

            this.pushLog(`\n🎉 批量收藏完成，共成功收藏 ${totalSuccess} 道题目，${totalFailed} 份试卷处理失败`, 'success');
        } finally {
            // 重置处理状态和按钮
            this.state.isProcessing = false;
            this.state.batchCollection = false; // 重置批量收藏状态
            batchBtn.innerHTML = originalText;
            batchBtn.disabled = false;
        }
    }

    /**
     * 清空所有已收藏的题目
     */
    async clearAllCollections() {
        // 确认用户是否真的要执行清空操作
        if (!confirm('确定要清空所有已收藏的题目吗？此操作不可恢复！')) {
            return;
        }

        // 设置处理状态为true
        this.state.isProcessing = true;
        // 获取清空按钮元素，用于显示加载状态
        const clearBtn = this.container.querySelector('.clear-btn');
        const originalText = clearBtn.textContent;
        clearBtn.innerHTML = '<span class="spinner"></span>清理中';
        clearBtn.disabled = true;
        let deleteCounts = 0;

        try {
            // 构建请求URL
            let url = `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/collects/keypoint-tree?timeRange=0&order=desc&app=web&kav=100&av=100&hav=100&version=3.0.0.0`;

            // 发送请求
            const response = await this.httpRequest({
                url,
                method: 'GET',
                headers: {
                    'Cookie': document.cookie,
                    'Referer': `https://tiku.fenbi.com/${this.state.currenctLabelType}/`,
                    'User-Agent': navigator.userAgent
                }
            });

            // 解析响应数据
            const data = JSON.parse(response);
            const collectedIds = [];
            data.forEach(item => {
                collectedIds.push(...item.questionIds);
            });
            if (collectedIds.length === 0) {
                return;
            }
            deleteCounts += await this.disCollecyByCollectedIds(collectedIds);

        } catch (error) {
            this.pushLog(`❌ 批量删除失败：${error.message}`, 'error');
        } finally {
            // 重置处理状态和按钮
            this.state.isProcessing = false;
            clearBtn.innerHTML = originalText;
            clearBtn.disabled = false;
        }
    }

    // 分批请求解决方案数据（每次最多200条）
    async getSolutionsInBatches(questionIds) {
        const BATCH_SIZE = 200; // 每批最大数量
        const allSolutions = [];
        const totalBatches = Math.ceil(questionIds.length / BATCH_SIZE);

        // 循环处理每一批
        for (let i = 0; i < totalBatches; i++) {
            // 计算当前批次的起始和结束索引
            const startIndex = i * BATCH_SIZE;
            const endIndex = startIndex + BATCH_SIZE;
            const batchIds = questionIds.slice(startIndex, endIndex);

            try {
                // 调用原接口获取当前批次数据
                const batchData = await this.getSolutionsByQuestionIds(batchIds);
                const data = JSON.parse(batchData);

                if (data[0] != null) {
                    allSolutions.push(...data);
                }
                // 可选：添加延迟避免请求过于频繁
                if (i < totalBatches - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                console.error(`第 ${i + 1} 批请求失败:`, error);
                // 可根据需求决定是否继续或抛出错误
                // throw new Error(`获取解决方案失败，批次 ${i+1} 出错`);
            }
        }

        return allSolutions;
    }

    /**
     * 请求收藏树形接口，递归解析树，取出目标节点下所有题目qid
     * @param string type 类型 collects是收藏 errors是错题
     * @param {string|number} targetNodeId 你选中的专题/节点id
     */
    async fetchAndParseKeypointTree(type, targetNodeId) {
        // 设置处理状态为true
        this.state.isProcessing = true;
        this.state.questionIdsByType = [];
        const apiUrl = `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/${type}/keypoint-tree?timeRange=0&order=desc&app=web&kav=131&av=130&hav=128&version=3.0.0.0&deviceId=&gav=2&apcId=0`;
        console.log(apiUrl)
        try {
            const response = await fetch(apiUrl, {
                credentials: 'include',
                headers: {
                    'Referer': window.location.href,
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`keypoint-tree 接口返回 ${response.status}`);
            }
            const res = await response.text();
            // 第一步！！字符串转成JSON数组！！漏掉这步必失败
            const treeData = JSON.parse(res);

            // 递归深度优先遍历树形数据
            const dfs = (node) => {
                console.log(node);
                if (!node) return;
                // 命中目标节点
                // 全部转为字符串再对比，忽略类型差异
                if (String(node.id) === String(targetNodeId)) {
                    // ✅字段是 questionIds，不是 questions！！
                    if (Array.isArray(node.questionIds)) {
                        node.questionIds.forEach(qid => {
                            this.state.questionIdsByType.push(qid);
                        });
                    }
                    return;
                }
                // 遍历子节点 children
                if (Array.isArray(node.children)) {
                    node.children.forEach(child => dfs(child));
                }
            };

            // treeData是顶层数组，循环遍历顶层每一个节点
            treeData.forEach(rootNode => {
                dfs(rootNode);
            });

            if (this.state.questionIdsByType.length === 0) {
                alert("该分类下没有找到收藏题目");
                this.pushLog("⚠️ 当前节点未提取到任何题目qid", "warn");
                return;
            }

            this.pushLog(`✅ 从收藏树提取 ${this.state.questionIdsByType.length} 道题`, 'success');

            // 提取完qid，直接调用你原来的导出解析函数
            await this.getSolutionsByType();

        } catch (error) {
            console.error("拉取收藏树失败", error);
            this.pushLog(`❌ 获取收藏树异常：${error.message}`, "error");
            alert(`拉取收藏分类出错：${error.message}`);
        } finally {
            this.state.isProcessing = false;
        }
    }


    /**
  * 根据不同类型返回解析 类型包括：收藏、错题 暂未作区分
  * @returns 
  */
    async getSolutionsByType() {
        this.state.isProcessing = true;
        try {

            const questionIds = this.state.questionIdsByType;
            const solutions = await this.getSolutionsInBatches(questionIds);

            if (solutions.length === 0) {
                alert("没有获取到数据,请检查是否在详情页、检查当前网页显示类型与脚本考试类型是否对应");
                return;
            }

            // 分批版函数直接返回数组，无需JSON.parse
            let parsedMetaIds = await this.getQuestionMetaByIds(questionIds);
            console.log("getQuestionMetaByIds返回结果：", parsedMetaIds);

            // 兜底防护，防止返回null、非数组引发map报错
            if (!Array.isArray(parsedMetaIds)) {
                this.pushLog("⚠️ 题目元数据接口返回异常，元信息缺失", 'warn');
                parsedMetaIds = [];
            }

            const data = this.processingData(solutions, parsedMetaIds, false);

            this.pushLog(`✅ 成功获取 ${data.length} 道题目`, 'success');
            const name = `下载 ${data.length} 道题目`;
            this.showSolutionWindow(data, name, true);
        } catch (error) {
            // 可以在这里处理错误，比如打印日志
            console.error("获取解析失败:", error);
            this.pushLog(`❌ 获取解析失败: ${error.message}`, "error");
        } finally {
            this.state.isProcessing = false;
        }
    }

    /**
     * 获取题目解析
     * @param {Array} questionIds - 题目ID列表
     * @returns {string} 响应数据字符串
     */
    async getSolutionsByQuestionIds(questionIds) {
        try {
            // 发送请求获取题目解析
            let solutions = await this.httpRequest({
                url: `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/solutions?ids=${questionIds.join(',')}`,
                method: "GET",
                headers: {
                    'Cookie': document.cookie,
                    'Referer': `https://tiku.fenbi.com/${this.state.currenctLabelType}/`,
                    'User-Agent': navigator.userAgent
                }
            });

            return solutions;
        } catch (error) {
            this.pushLog(`❌ 获取题目解析失败：${error.message}`, 'error');
            return null;
        }
    }


    /**
     * 根据练习获取解析
     * @param {Integer} exerciseId
     * @param {string} name
     * @returns
     */
    async getSolutionByExerciseId(exerciseId, name) {

        if (!exerciseId && !this.state.globalExerciseId) {
            this.pushLog('❌ 无法继续，未获取到练习ID', 'error');
            return;
        }

        this.state.isProcessing = true;

        if (!exerciseId) {
            exerciseId = this.state.globalExerciseId;
        }
        // 步骤1：获取题号
        const questionIds = await this.getExerciseQuestions(exerciseId);
        if (questionIds.length === 0) {
            this.pushLog('ℹ️ 没有找到题目', 'info');
            this.state.isProcessing = false;
            return;
        }

        // 步骤2：根据选中的类别筛选题目（如果有选择）
        const categoryFilteredIds = await this.filterQuestionsByCategories(questionIds);
        if (categoryFilteredIds.length === 0) {
            this.pushLog('ℹ️ 没有找到符合所选类别的题目', 'info');
            this.state.isProcessing = false;
            return;
        }
        this.state.globalExerciseId = exerciseId;
        this.state.questionIds = categoryFilteredIds;
        // 获取解析
        const questionResponse = await this.getSolutionsByQuestionIds(categoryFilteredIds);
        const data = JSON.parse(questionResponse);

        // 分批接口直接返回数组，移除 JSON.parse
        let parsedMetaIds = await this.getQuestionMetaByIds(categoryFilteredIds);

        // 兜底防护，防止返回null、非数组导致 .map 报错
        if (!Array.isArray(parsedMetaIds)) {
            this.pushLog("⚠️ 题目元数据接口返回异常，元信息缺失", 'warn');
            parsedMetaIds = [];
        }

        // 等待 pollForValue 完成后再处理后续逻辑
        this.pollForValue().then(async () => {
            // 在 pollForValue 完成后执行数据处理
            const filteredData = this.processingData(data, parsedMetaIds, true);

            // 如果已经完成的还需要收集错题
            if (this.state.currentStatus == 1) {
                const reportResponse = await this.getReportByExerciseId(exerciseId);
                if (reportResponse != null) {
                    const report = JSON.parse(reportResponse);

                    const answers = report.answers;
                    // 筛选出所有 status 为 -1 的项
                    this.state.globalWrongQuestionIds = answers.filter(item => item.status === -1)
                        .map(item => item.questionId);
                    // 筛选出所有 status 为 10 的项
                    this.state.globalUnAsweredQuestionIds = answers.filter(item => item.status === 10)
                        .map(item => item.questionId);
                }
            }
            this.pushLog(`✅ 成功获取 ${filteredData.length} 道题目的解析`, 'success');

            if (!name) {
                name = "当前解析";
            }

            // 调用显示解析窗口的方法，传入处理好的解析数据和试卷名称
            this.showSolutionWindow(filteredData, name, true);
        }).finally(() => {
            // 设置处理状态为false
            this.state.isProcessing = false;
        });
    }

    /**
     * 处理数据
     * @param {*} data 
     * @param {*} parsedMetaIds 
     * @param {Boolean} isContainComments 
     * @returns 
     */
    processingData(data, parsedMetaIds, isContainComments) {
        let commentContents = [];
        if (isContainComments) {
            let comments = Object.entries(this.state.comments).map(([key, value]) => {
                return {
                    id: key,
                    // 映射每个评论项，同时保留comment和likeCount
                    comments: value.map(item => ({
                        comment: item.comment,
                        likeCount: item.likeCount // 新增likeCount字段
                    })),
                }
            });
            commentContents = Object.fromEntries(comments.map(item => [item.id, item]));
        }

        // 将数组转换为以id为key的对象（使用Object.fromEntries更简洁）
        const result = Object.fromEntries(parsedMetaIds.map(item => [item.id, item]));

        // 处理解析数据
        return Object.entries(data).map(([key, value]) => {

            const { id, content, accessories, solution, material, source, correctAnswer } = value;

            return {
                key: id,
                content,
                options: accessories?.[0]?.options,
                correctRatio: result[id]?.correctRatio,
                mostWrongAnswer: result[id]?.mostWrongAnswer,
                correctAnswer,
                solution,
                source,
                comments: commentContents[id]?.comments,
                // 条件添加material属性
                ...(material != null && { material })
            };
        });
    }


    /**
     * 获取练习报告
     * @param {Integer} exerciseId
     * @returns
     */
    async getReportByExerciseId(exerciseId) {
        try {
            // 发送请求获取题目解析
            const response = await this.httpRequest({
                url: `https://tiku.fenbi.com/api/${this.state.currenctLabelType}/exercises/${exerciseId}/report/v2`,
                method: "GET",
                headers: {
                    'Cookie': document.cookie,
                    'Referer': `https://tiku.fenbi.com/${this.state.currenctLabelType}/`,
                    'User-Agent': navigator.userAgent
                }
            });

            return response;

        } catch (error) {
            this.pushLog(`❌ 获取练习报告失败：${error.message}`, 'error');
        }
    }

    /**
     * 获取题目评论
     * @param {string} questionId - 题目ID
     * @returns {Array} 评论列表
     */
    async getComments(questionId) {
        try {
            // 获取题目相关的剧集
            let episodeMap = this.state.episodeMap;
            if (!episodeMap || !episodeMap[questionId] || !episodeMap[questionId][0]) {
                return [];
            }

            const str = await this.httpRequest({
                url: `https://ke.fenbi.com/ipad/gwy/v3/comments/episodes/${episodeMap[questionId][0].id}?system=12.4.7&inhouse=0&app=gwy&ua=iPad&av=44&version=6.11.3&kav=22&kav=1&len=600`,
                method: "GET",
                headers: {
                    'Cookie': document.cookie,
                    'Referer': `https://tiku.fenbi.com/${this.state.currenctLabelType}/`,
                    'User-Agent': navigator.userAgent
                }
            });
            let processedDatas = [];
            // 处理评论数据
            try {
                const obj = JSON.parse(str);
                if (Array.isArray(obj.datas)) {
                    processedDatas.push(...obj.datas);
                }
            } catch (error) {
                console.error('JSON解析失败:', error);
            }

            // 筛选并排序评论，取前5条
            return _.orderBy(
                processedDatas.filter(i =>
                    i.likeCount > 1 &&                   // 点赞数大于1
                    !['?', '？'].some(t => i.comment.includes(t)) &&  // 评论不包含问号
                    i.comment.length > 8                 // 评论长度大于8
                ),
                ['likeCount'],                           // 按点赞数排序
                ['desc']                                 // 降序排列
            ).slice(0, 5);                             // 取前10条
        } catch (e) {
            return [];
        }
    }

    /**
     * 获取评论前置数据相关
     * @param {Array} questionIds - 题目ID列表
     * @returns {Object} 数据
     */
    async getEpisodesByIds(questionIds) {
        try {
            // 发送请求获取剧集数据
            let result = await this.httpRequest({
                url: `https://ke.fenbi.com/api/gwy/v3/episodes/tiku_episodes_with_multi_type?tiku_ids=${questionIds.join(',')}&tiku_prefix=${this.state.currenctLabelType}&tiku_type=5`,
                method: "GET",
                headers: {
                    'Cookie': document.cookie,
                    'Referer': 'https://ke.fenbi.com/gwy/',
                    'User-Agent': navigator.userAgent
                }
            });
            return JSON.parse(result).data;
        } catch (error) {
            this.pushLog(`❌ 获取评论前置数据失败：${error.message}`, 'error');
            return {};
        }
    }

    /**
     * 获取试卷解析并在新窗口展示
     * @param {Object} paper - 试卷对象
     */
    async getPaperSolution(paper) {

        try {
            const paperName = paper.name ?? paper.sheet.name;
            let exerciseId = paper.id;
            this.pushLog(`开始获取试卷解析：《${paperName}》`, 'info');
            if (this.state.currentLabelId != `all-${this.state.currenctLabelType}` && this.state.currentLabelId != `all-exam-${this.state.currenctLabelType}`) {

                // 步骤1：检查并创建练习
                const exerciseCreated = await this.createExercise(paper);
                if (!exerciseCreated || !paper.exercise?.id) {
                    this.pushLog('❌ 无法继续，未获取到练习ID', 'error');
                    return;
                }
                exerciseId = paper.exercise.id;
            }
            await this.getSolutionByExerciseId(exerciseId, paperName);

        } catch (error) {
            this.pushLog(`❌ 获取解析失败：${error.message}`, 'error');
        }
    }



    /**
    * 创建并并显示解析窗口，支持按材料分组导出，相同材料材料只显示一次
    * 只有当存在材料时，解析才单独成页
    * @param {Array} solutions - 解析数据数组（所有题目）
    * @param {string} paperName - 试卷名称
    * @param {Boolean} includeSolution - 是否包含解析
    * @returns 
    */
    showSolutionWindow(solutions, paperName, includeSolution) {
        // 1. 验证数据有效性
        if (!solutions || !Array.isArray(solutions) || solutions.length === 0) {
            this.pushLog('❌ 解析数据为空或格式错误', 'error');
            return;
        }

        // 2. 按材料分组 - 相同材料的题目放在一组
        const groupedByMaterial = [];
        const materialMap = new Map();

        solutions.forEach(solution => {
            // 使用材料内容作为键，如果没有材料则使用特殊标识
            const materialKey = solution.material?.id ? solution.material?.id : `__no_material_${Date.now()}_${Math.random()}`;

            if (!materialMap.has(materialKey)) {
                // 创建新的材料组
                const newGroup = {
                    materialKey: materialKey,
                    material: solution.material?.content || null,
                    hasMaterial: !!solution.material?.content, // 标记是否有材料
                    questions: []
                };
                groupedByMaterial.push(newGroup);
                materialMap.set(materialKey, newGroup);
            }

            // 将题目添加到对应的材料组
            materialMap.get(materialKey).questions.push(solution);
        });

        // 3. 创建新弹窗
        const solutionWindow = window.open('', '_blank', 'width=827,height=1169,scrollbars=yes');
        if (!solutionWindow) {
            this.pushLog('❌ 弹窗被浏览器拦截，请请允许弹出窗口后重试', 'error');
            return;
        }

        // 4. 设置弹窗标题
        solutionWindow.document.title = `${paperName} - 题目解析`;

        // 存储导出相关状态 - 包含分页逻辑
        const exportStore = {
            isExporting: false,
            currentPage: 0,
            totalPages: 0, // 后面会计算
            exportOptions: {
                includeMaterial: true,
                includeOptions: true,
                includeSolution: includeSolution,
                quality: 0.95,
                pageOrientation: 'portrait',
                exportType: 'all'
            }
        };

        // 5. 构建基础DOM结构
        const buildBasicDOM = () => {
            const doc = solutionWindow.document;
            doc.open();

            // 创建文档声明
            const doctype = doc.implementation.createDocumentType('html', '', '');
            doc.appendChild(doctype);

            // 创建html元素
            const html = doc.createElement('html');
            html.lang = 'zh-CN';
            doc.appendChild(html);

            // 创建head元素
            const head = doc.createElement('head');
            html.appendChild(head);

            // 添加meta标签
            const metaCharset = doc.createElement('meta');
            metaCharset.charset = 'UTF-8';
            head.appendChild(metaCharset);

            const metaViewport = doc.createElement('meta');
            metaViewport.name = 'viewport';
            metaViewport.content = 'width=device-width, initial-scale=1.0';
            head.appendChild(metaViewport);

            // 添加标题
            const title = doc.createElement('title');
            title.textContent = `${paperName} - 题目解析`;
            head.appendChild(title);

            // 添加样式
            const style = doc.createElement('style');
            style.textContent = `
body { font-family: "Microsoft YaHei", "SimSun", sans-serif; line-height: 1.6; padding: 20px; background-color: #f9f9f9; }
.container { max-width: 794px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #4F46E5; padding-bottom: 10px; }
.loading { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; color: white; font-size: 18px; z-index: 1000; }
.spinner { border: 5px solid rgba(255,255,255,0.3); border-radius: 50%; border-top: 5px solid white; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-right: 15px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.export-btn { background-color: #4F46E5; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
.export-btn:disabled { background-color: #888; cursor: not-allowed; }
.question { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
.question-number { font-weight: bold; font-size: 18px; margin-bottom: 10px; color: #333; }
.material, .content, .solution, .options, .correct-ratio, .source, .choice, .correct, .comments { margin-bottom: 15px; }
.material-title, .content-title, .solution-title, .options-title, .correct-ratio-title, .source-title, .choice-title, .correct-title, .comments-title { font-weight: bold; color: #4F46E5; margin-bottom: 5px; }
.correct, .correct-ratio, .source, .choice { display: flex; align-items: center; gap: 8px; line-height: 1; }
.correct-title, .correct-text, .correct-ratio-title, .correct-ratio-text, .choice-title, .choice-text, .source-title, .source-text { vertical-align: middle; margin: 0; padding: 0;  font-size: 16px; }
.progress-container { position: absolute; bottom: 30px; left: 0; width: 100%; padding: 0 20px; box-sizing: border-box; }
.progress-bar { height: 8px; background-color: rgba(255,255,255,0.3); border-radius: 4px; overflow: hidden; }
.progress-fill { height: 100%; background-color: white; width: 0%; transition: width 0.3s ease; }
.export-preview { padding: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
.resource-progress { margin-top: 10px; font-size: 14px; }
/* 导出选项样式 */
.export-options { margin-top: 15px; padding: 10px; background-color: #f9f9f9; border-radius: 4px; }
.export-option-item { display: flex; align-items: center; margin-bottom: 8px; font-size: 14px; }
.export-option-item input { margin-right: 8px; }
.export-option-label { cursor: pointer; }
.no-wrong-questions { color: #999; font-size: 13px; margin-top: 8px; padding-left: 24px; font-style: italic; }
.no-unanswered-questions { color: #999; font-size: 13px; margin-top: 8px; padding-left: 24px; font-style: italic; }
/* 用于导出时隐藏不需要的部分 */
.hide-section { display: none !important; }
.page-header { margin-bottom: 20px; font-size: 14px; color: #666; }
.material-group { margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
.material-group-title { font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #333; }
.option-item { display: flex; align-items: flex-start; margin-bottom: 8px;}
.option-letter { margin-right: 8px; min-width: 20px;}
.option-content { flex: 1;}

/* 打印导出样式（按文件B方式：浏览器原生打印，速度快） */
@media print {
  @page { size: A4; margin: 15mm; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { background: #fff !important; padding: 0 !important; }
  .container { max-width: none !important; width: 100% !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; }
  .header, .export-btn, .export-options, .loading { display: none !important; }
  .question { page-break-inside: avoid; break-inside: avoid; }
  .material-group { page-break-inside: avoid; break-inside: avoid; }
  .page-number { color: #999 !important; font-size: 10px; }
}

`;
            head.appendChild(style);

            // 创建body元素
            const body = doc.createElement('body');
            html.appendChild(body);

            // 创建内容容器
            const container = doc.createElement('div');
            container.className = 'container';
            container.style.display = 'none';
            body.appendChild(container);

            doc.close();
            return doc;
        };

        // 6. 初始化页面并加载依赖
        const init = () => {
            const doc = buildBasicDOM();
            const container = doc.querySelector('.container');

            // 检查浏览器支持
            const checkBrowserSupport = () => {
                if (!window.Promise) {
                    throw new Error('您的浏览器不支持Promise，无法使用此功能');
                }
                if (!window.Blob) {
                    throw new Error('您的浏览器不支持Blob，无法导出PDF');
                }
                if (!window.URL) {
                    throw new Error('您的浏览器不支持URL API，无法导出PDF');
                }
            };

            try {
                checkBrowserSupport();
            } catch (e) {
                alert(e.message);
                return;
            }

            // 依赖加载完成后执行的函数
            const doShow = () => {
                // 清空容器并填充内容
                container.innerHTML = '';

                // 1. 创建头部（只保留导出按钮）
                const header = doc.createElement('div');
                header.className = 'header';

                // 创建导出按钮
                const exportBtn = doc.createElement('button');
                exportBtn.className = 'export-btn';
                exportBtn.id = 'export-pdf';

                // 创建导出按钮SVG图标
                const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '16');
                svg.setAttribute('height', '16');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', 'currentColor');
                svg.setAttribute('stroke-width', '2');

                const path1 = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
                path1.setAttribute('d', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z');
                svg.appendChild(path1);

                const path2 = doc.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                path2.setAttribute('points', '14 2 14 8 20 8');
                svg.appendChild(path2);

                const path3 = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
                path3.setAttribute('x1', '16');
                path3.setAttribute('y1', '13');
                path3.setAttribute('x2', '8');
                path3.setAttribute('y2', '13');
                svg.appendChild(path3);

                const path4 = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
                path4.setAttribute('x1', '16');
                path4.setAttribute('y1', '17');
                path4.setAttribute('x2', '8');
                path4.setAttribute('y2', '17');
                svg.appendChild(path4);

                const path5 = doc.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                path5.setAttribute('points', '10 9 9 9 8 9');
                svg.appendChild(path5);

                exportBtn.appendChild(svg);
                exportBtn.appendChild(doc.createTextNode(' 导出为PDF'));
                header.appendChild(exportBtn);

                container.appendChild(header);

                // 2. 添加导出选项
                const exportOptions = doc.createElement('div');
                exportOptions.className = 'export-options';

                // 检查是否有错题数据
                const hasWrongQuestions = this.state.globalWrongQuestionIds &&
                    Array.isArray(this.state.globalWrongQuestionIds) &&
                    this.state.globalWrongQuestionIds.length > 0;

                // 筛选出在当前试卷中的错题
                const wrongQuestionIdsInCurrent = hasWrongQuestions
                    ? this.state.globalWrongQuestionIds.filter(id =>
                        solutions.some(s => s.key === id)
                    )
                    : [];

                // 检查是否有错题数据
                const hasUnAsweredQuestions = this.state.globalUnAsweredQuestionIds &&
                    Array.isArray(this.state.globalUnAsweredQuestionIds) &&
                    this.state.globalUnAsweredQuestionIds.length > 0;

                // 筛选出在当前试卷中的错题
                const unAnsweredQuestionIdsInCurrent = hasUnAsweredQuestions
                    ? this.state.globalUnAsweredQuestionIds.filter(id =>
                        solutions.some(s => s.key === id)
                    )
                    : [];


                // 构建选项HTML
                exportOptions.innerHTML = `
                <div class="export-option-item">
                    <input type="radio" id="export-all" name="export-type" value="all" checked>
                    <label for="export-all" class="export-option-label">导出全部题目 (${solutions.length}题)</label>
                </div>
                <div class="export-option-item">
                    <input type="radio" id="export-wrong" name="export-type" value="wrong" ${!hasWrongQuestions ? 'disabled' : ''}>
                    <label for="export-wrong" class="export-option-label">仅导出错题 (${wrongQuestionIdsInCurrent.length}题)</label>
                </div>
                ${!hasWrongQuestions ? '<div class="no-wrong-questions">没有检测到错题数据</div>' : ''}
                  <div class="export-option-item">
                    <input type="radio" id="export-unanswered" name="export-type" value="unanswered" ${!hasUnAsweredQuestions ? 'disabled' : ''}>
                    <label for="export-unanswered" class="export-option-label">仅导出未作答题 (${unAnsweredQuestionIdsInCurrent.length}题)</label>
                </div>
                ${!hasUnAsweredQuestions ? '<div class="no-unanswered-questions">没有检测到未作答题目数据</div>' : ''}
            `;

                container.appendChild(exportOptions);

                // 3. 创建题目容器
                const solutionsContainer = doc.createElement('div');
                solutionsContainer.id = 'solutions-container';
                container.appendChild(solutionsContainer);

                // 4. 按材料组渲染题目
                let questionIndex = 0; // 全局题目索引，用于显示正确的题号
                groupedByMaterial.forEach((materialGroup, groupIndex) => {
                    const groupDiv = doc.createElement('div');
                    groupDiv.className = 'material-group';
                    groupDiv.dataset.groupIndex = groupIndex;
                    groupDiv.dataset.hasMaterial = materialGroup.hasMaterial;

                    const materialKey = Array.from(materialMap.entries())
                        .find(([key, value]) => value === materialGroup)?.[0];

                    if (materialKey) {
                        groupDiv.dataset.materialKey = materialKey;
                    }

                    // 材料组标题
                    const groupTitle = doc.createElement('div');
                    groupTitle.className = 'material-group-title';
                    if (materialGroup.material) {
                        groupTitle.textContent = `材料组 ${groupIndex + 1} (包含 ${materialGroup.questions.length} 题)`
                    }
                    groupDiv.appendChild(groupTitle);

                    // 材料部分（如有）
                    if (exportStore.exportOptions.includeMaterial && materialGroup.material) {
                        const materialDiv = doc.createElement('div');
                        materialDiv.className = 'material';
                        materialDiv.dataset.section = 'material';
                        materialDiv.dataset.groupIndex = groupIndex;

                        const materialTitle = doc.createElement('div');
                        materialTitle.className = 'material-title';
                        materialTitle.textContent = '材料：';
                        materialDiv.appendChild(materialTitle);

                        const materialContent = doc.createElement('div');
                        materialContent.className = 'material-content';
                        materialContent.innerHTML = materialGroup.material;
                        materialDiv.appendChild(materialContent);

                        groupDiv.appendChild(materialDiv);
                    }

                    // 渲染当前材料组下的所有题目
                    materialGroup.questions.forEach((item) => {
                        questionIndex++;

                        const questionDiv = doc.createElement('div');
                        questionDiv.className = 'question';
                        questionDiv.dataset.section = 'question';
                        questionDiv.dataset.questionIndex = questionIndex;
                        questionDiv.dataset.id = item.key;
                        questionDiv.dataset.groupIndex = groupIndex;

                        // 错题标记
                        const isWrongQuestion = hasWrongQuestions &&
                            wrongQuestionIdsInCurrent.includes(item.key);

                        if (isWrongQuestion) {
                            questionDiv.style.borderLeft = '4px solid #ef4444';
                            questionDiv.style.paddingLeft = '15px';
                        }

                        questionDiv.style.display = 'block';

                        // 题目编号
                        const questionNumber = doc.createElement('div');
                        questionNumber.className = 'question-number';
                        questionNumber.textContent = `第 ${questionIndex} 题${isWrongQuestion ? ' (错题)' : ''}`;
                        questionDiv.appendChild(questionNumber);

                        // 题目内容
                        const contentDiv = doc.createElement('div');
                        contentDiv.className = 'content';
                        contentDiv.dataset.section = 'content';

                        const contentTitle = doc.createElement('div');
                        contentTitle.className = 'content-title';
                        contentTitle.textContent = '题目：';
                        contentDiv.appendChild(contentTitle);

                        const contentText = doc.createElement('div');
                        contentText.className = 'content-text';
                        contentText.innerHTML = item.content;
                        contentDiv.appendChild(contentText);
                        questionDiv.appendChild(contentDiv);

                        // 选项部分
                        if (exportStore.exportOptions.includeOptions && item.options && Array.isArray(item.options) && item.options.length > 0) {

                            const optionsDiv = doc.createElement('div');
                            optionsDiv.className = 'options';
                            optionsDiv.dataset.section = 'options';

                            const optionsTitle = doc.createElement('div');
                            optionsTitle.className = 'options-title';
                            optionsTitle.textContent = '选项：';
                            optionsDiv.appendChild(optionsTitle);

                            const optionsText = doc.createElement('div');
                            optionsText.className = 'options-text';

                            const optionLetters = ['A', 'B', 'C', 'D'];

                            item.options.forEach((option, index) => {
                                if (index < 4) {
                                    const optionItem = doc.createElement('div');
                                    optionItem.className = 'option-item';

                                    const letterSpan = doc.createElement('span');
                                    letterSpan.className = 'option-letter';
                                    letterSpan.textContent = `${optionLetters[index]}：`;

                                    const contentContainer = doc.createElement('div');
                                    contentContainer.className = 'option-content';

                                    if (typeof option === 'string') {
                                        let processedOption = option.replace(/^<p>/, '').replace(/<\/p>$/, '');
                                        contentContainer.innerHTML = processedOption;
                                    } else {
                                        contentContainer.textContent = option;
                                    }

                                    optionItem.appendChild(letterSpan);
                                    optionItem.appendChild(contentContainer);
                                    optionsText.appendChild(optionItem);
                                }
                            });

                            optionsDiv.appendChild(optionsText);
                            questionDiv.appendChild(optionsDiv);
                        }

                        // 解析内容
                        if (exportStore.exportOptions.includeSolution && item.solution) {
                            const solutionDiv = doc.createElement('div');
                            solutionDiv.className = 'solution';
                            solutionDiv.dataset.section = 'solution';

                            const solutionTitle = doc.createElement('div');
                            solutionTitle.className = 'solution-title';
                            solutionTitle.textContent = '解析：';
                            solutionDiv.appendChild(solutionTitle);

                            const solutionText = doc.createElement('div');
                            solutionText.className = 'solution-text';
                            solutionText.innerHTML = item.solution;
                            solutionDiv.appendChild(solutionText);

                            questionDiv.appendChild(solutionDiv);
                        }

                        //评论
                        if (exportStore.exportOptions.includeSolution && item.comments) {
                            const commentsDiv = doc.createElement('div');
                            commentsDiv.className = 'comments';
                            commentsDiv.dataset.section = 'comments';

                            const commentsTitle = doc.createElement('div');
                            commentsTitle.className = 'comments-title';
                            commentsTitle.textContent = '评论：';
                            commentsDiv.appendChild(commentsTitle);

                            const commentsText = doc.createElement('div');
                            commentsText.className = 'comments-text';
                            // 假设item.comments是一个包含评论内容的数组
                            let commentsHtml = '';

                            // 循环处理每个评论
                            item.comments.forEach(item => {
                                // 为每个评论内容添加li标签和样式
                                commentsHtml += `<li style="margin-bottom: 10px; border: 1px solid rgba(144, 144, 144, 0.59); padding: 10px;">${item.comment}(${item.likeCount})</li>`;
                            });

                            // 如果没有评论，显示"暂无评论"（同样应用li样式）
                            if (commentsHtml === '') {
                                commentsHtml = '<div>暂无评论</div>';
                            }

                            commentsText.innerHTML = commentsHtml;

                            commentsDiv.appendChild(commentsText);

                            questionDiv.appendChild(commentsDiv);
                        }

                        groupDiv.appendChild(questionDiv);
                    });

                    solutionsContainer.appendChild(groupDiv);
                });

                // 计算总页数：精确控制分页逻辑
                exportStore.totalPages = groupedByMaterial.reduce((total, group) => {
                    const materialPages = group.hasMaterial ? 1 : 0;
                    const questionPages = group.hasMaterial && includeSolution
                        ? group.questions.length * 2  // 有材料：每题2页（题目+解析）
                        : group.questions.length * 1; // 无材料：每题1页（题目+解析）
                    return total + materialPages + questionPages;
                }, 0);

                // 5. 添加交互功能（导出）
                addInteraction(solutionWindow, groupedByMaterial, wrongQuestionIdsInCurrent, unAnsweredQuestionIdsInCurrent, paperName, exportStore, materialMap);

                // 6. 隐藏加载提示，显示内容
                container.style.display = 'block';
            };

            // 显示内容
            doShow();

        };

        // 7. 添加交互功能（PDF导出）
        const addInteraction = (win, materialGroups, wrongQuestionIds, unAnsweredQuestionIds, paperName, exportStore, materialMap) => {
            const doc = win.document;
            const questions = doc.querySelectorAll('.question');
            const groups = doc.querySelectorAll('.material-group');
            const container = doc.querySelector('.container');
            const exportBtn = doc.getElementById('export-pdf');
            const exportTypeRadios = doc.querySelectorAll('input[name="export-type"]');
            let name = "题目";

            // 处理文件名特殊字符
            function getPdfFileName() {
                return paperName.replace(/[\/:*?"<>|]/g, '-') + '_' + name + '解析.pdf';
            }

            // 根据导出类型筛选要导出的题目组和题目
            function getFilteredGroups() {
                const exportType = exportStore.exportOptions.exportType;

                // 如果不是错题也不是未作答，则返回所有题目组
                if (exportType !== 'wrong' && exportType !== 'unanswered') {
                    return [...materialGroups];
                }

                return materialGroups.map(group => {
                    let filteredQuestions;

                    // 根据导出类型筛选题目
                    if (exportType === 'wrong') {
                        // 筛选错题
                        filteredQuestions = group.questions.filter(
                            q => wrongQuestionIds.includes(Number(q.key))
                        );
                        name = "错题";
                    } else {
                        // 筛选未作答题目（假设存在未作答题目ID数组unansweredQuestionIds）
                        filteredQuestions = group.questions.filter(
                            q => unAnsweredQuestionIds.includes(Number(q.key))
                        );
                        name = "未作答题目";
                    }

                    return {
                        ...group,
                        questions: filteredQuestions
                    };
                }).filter(group => group.questions.length > 0); // 过滤掉没有符合条件题目的组
            }

            function updateDisplayByExportType(exportType) {
                const isExportWrong = exportType === 'wrong';
                const isExportUnanswered = exportType === 'unanswered';

                // 1. 控制每个题目是否显示
                questions.forEach(q => {
                    const questionId = q.dataset.id;
                    const isWrong = wrongQuestionIds.includes(Number(questionId));
                    // 假设存在未作答题目ID的数组unansweredQuestionIds
                    const isUnanswered = unAnsweredQuestionIds.includes(Number(questionId));

                    // 根据不同类型显示对应的题目
                    if (isExportWrong) {
                        q.style.display = isWrong ? 'block' : 'none';
                    } else if (isExportUnanswered) {
                        q.style.display = isUnanswered ? 'block' : 'none';
                    } else {
                        // 默认显示所有题目
                        q.style.display = 'block';
                    }
                });

                // 2. 控制每个 group 是否显示，并动态更新标题中的数量
                groups.forEach(group => {
                    const groupQuestions = group.querySelectorAll('.question');
                    const visibleQuestions = Array.from(groupQuestions).filter(q => q.style.display !== 'none');
                    const hasVisibleQuestions = visibleQuestions.length > 0;
                    group.style.display = hasVisibleQuestions ? 'block' : 'none';

                    if (hasVisibleQuestions && (isExportWrong || isExportUnanswered)) {
                        // 统计当前显示的题目数量（错题或未答题目）
                        let visibleCount = 0;
                        visibleQuestions.forEach(q => {
                            const questionId = q.dataset.id;
                            if ((isExportWrong && wrongQuestionIds.includes(Number(questionId))) ||
                                (isExportUnanswered && unAnsweredQuestionIds.includes(Number(questionId)))) {
                                visibleCount++;
                            }
                        });

                        const materialKey = group.getAttribute('data-material-key');
                        if (!materialKey.includes('no')) {
                            // 找到当前 group 的标题并更新，根据类型显示不同文本
                            const groupTitleEl = group.querySelector('.material-group-title');
                            if (groupTitleEl) {
                                if (isExportWrong) {
                                    groupTitleEl.textContent = `材料组 (包含 ${visibleCount} 错题)`;
                                } else if (isExportUnanswered) {
                                    groupTitleEl.textContent = `材料组 (包含 ${visibleCount} 未答题目)`;
                                }
                            }
                        }
                    }
                });
            }

            // 监听导出类型变化
            exportTypeRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    if (radio.checked) {
                        exportStore.exportOptions.exportType = radio.value;
                        updateDisplayByExportType(radio.value);
                    }
                });
            });

            // 重置所有部分的显示状态
            function resetSectionVisibility() {
                const sections = doc.querySelectorAll('[data-section]');
                sections.forEach(section => {
                    section.classList.remove('hide-section');
                });
            }

            // 隐藏指定部分
            function hideSections(sectionsToHide) {
                resetSectionVisibility();
                sectionsToHide.forEach(section => {
                    const elements = doc.querySelectorAll(`[data-section="${section}"]`);
                    elements.forEach(el => el.classList.add('hide-section'));
                });
            }

            // 只显示特定组
            function showOnlyGroup(groupIndex) {
                groups.forEach((group, idx) => {
                    group.style.display = idx === groupIndex ? 'block' : 'none';
                });
            }

            // 只显示特定题目
            function showOnlyQuestion(questionId) {
                questions.forEach(q => {
                    q.style.display = Number(q.dataset.id) === Number(questionId) ? 'block' : 'none';
                });
            }

            function getGroupElementByIndex(filteredGroups, groupIndex) {
                try {
                    const originalGroup = filteredGroups[groupIndex];
                    if (!originalGroup) {
                        console.error(`找不到索引为${groupIndex}的组`);
                        return null;
                    }

                    // 重点修复：无材料组的匹配逻辑
                    if (!originalGroup.hasMaterial) {
                        // 1. 先找DOM中标记为无材料的组
                        const candidateGroups = doc.querySelectorAll('.material-group[data-has-material="false"]');

                        // 2. 通过组内题目ID进行匹配（最可靠的方式）
                        const groupQuestionIds = originalGroup.questions.map(q => q.key.toString());

                        for (const candidate of candidateGroups) {
                            // 获取候选组中的所有题目ID
                            const candidateQuestionIds = Array.from(candidate.querySelectorAll('.question'))
                                .map(q => q.dataset.id);

                            // 检查是否有共同的题目ID（证明是同一个组）
                            const isMatch = groupQuestionIds.some(id =>
                                candidateQuestionIds.includes(id)
                            );

                            if (isMatch) {
                                return candidate; // 找到匹配的组
                            }
                        }

                        // 3. 兜底方案：使用组索引查找
                        return doc.querySelector(`.material-group[data-group-index="${groupIndex}"]`);
                    }

                    // 有材料的组保持原逻辑
                    const entries = Array.from(materialMap.entries());

                    const foundEntry = entries.find(([key, value]) => key === originalGroup.materialKey);


                    if (!foundEntry) {
                        console.error(`找不到与组匹配的 materialMap 条目:`, originalGroup);
                        return doc.querySelector(`.material-group[data-group-index="${groupIndex}"]`);
                    }

                    const [materialKey] = foundEntry;
                    const groupElement = doc.querySelector(`.material-group[data-material-key="${materialKey}"]`);

                    if (!groupElement) {
                        console.warn(`找不到materialKey为${materialKey}的组元素，使用索引查找`);
                        return doc.querySelector(`.material-group[data-group-index="${groupIndex}"]`);
                    }

                    return groupElement;
                } catch (error) {
                    console.error('获取组元素时发生错误:', error);
                    return doc.querySelector(`.material-group[data-group-index="${groupIndex}"]`);
                }
            }


            // PDF导出功能实现 - 一次性截图整个容器,按 A4 高度裁剪分页
            // PDF导出功能实现 - 按文件B方式：浏览器原生打印（window.print），速度快、无需逐题/整页截图
            const exportToPDF = async () => {

                if (exportStore.isExporting) return;
                exportStore.isExporting = true;
                exportBtn.style.display = 'none'; // 直接隐藏按钮

                // 隐藏导出选项卡
                const exportOptionsEl = doc.querySelector('.export-options');
                const originalExportOptionsDisplay = exportOptionsEl ? exportOptionsEl.style.display : '';
                if (exportOptionsEl) exportOptionsEl.style.display = 'none';

                // 获取过滤后的组（导出类型：全部 / 仅错题 / 仅未作答）
                const filteredGroups = getFilteredGroups();

                if (filteredGroups.length === 0) {
                    solutionWindow.alert('没有可导出的题目，请选择其他导出类型');
                    exportStore.isExporting = false;
                    if (exportOptionsEl) exportOptionsEl.style.display = originalExportOptionsDisplay;
                    exportBtn.style.display = '';
                    return;
                }

                const totalQuestions = filteredGroups.reduce((sum, group) => sum + group.questions.length, 0);

                // 创建导出进度提示
                const loading = doc.createElement('div');
                loading.className = 'loading';
                loading.innerHTML = `
                <div class="spinner"></div>
                <div>正在打开打印窗口，请在打印对话框中选择「另存为 PDF」（共 ${totalQuestions} 题）</div>
            `;
                doc.body.appendChild(loading);

                try {
                    // 1. 应用按导出类型的筛选（仅该显示的题目/材料组显示），打印时 display:none 的内容不会输出
                    updateDisplayByExportType(exportStore.exportOptions.exportType);

                    // 2. 准备打印环境：去掉内边距、滚动归零，等待布局稳定
                    container.classList.add('export-preview');
                    container.style.position = 'relative';
                    win.scrollTo(0, 0);
                    await new Promise(resolve => setTimeout(resolve, 300));

                    // 3. 估算页数并插入页码（A4 打印内容宽≈681px，内容高≈1009px/页）
                    //    临时将容器宽度对齐打印内容宽度，使页码估算更准确
                    const prevMaxWidth = container.style.maxWidth;
                    const prevWidth = container.style.width;
                    container.style.maxWidth = '681px';
                    container.style.width = '681px';
                    const pageContentPx = 1009;
                    const totalHeight = container.scrollHeight;
                    const totalPagesEstimate = Math.max(1, Math.ceil(totalHeight / pageContentPx));
                    container.style.maxWidth = prevMaxWidth;
                    container.style.width = prevWidth;

                    // 清除旧页码（避免重复导出时叠加）
                    doc.querySelectorAll('.page-number').forEach(el => el.remove());

                    let pageNum = 1;
                    for (let y = pageContentPx; y < totalHeight; y += pageContentPx) {
                        const marker = doc.createElement('div');
                        marker.className = 'page-number';
                        marker.textContent = `${pageNum} / ${totalPagesEstimate}`;
                        marker.style.position = 'absolute';
                        marker.style.top = `${Math.max(0, y - 20)}px`;
                        marker.style.right = '0';
                        marker.style.left = '0';
                        marker.style.textAlign = 'right';
                        marker.style.fontSize = '10px';
                        marker.style.color = '#999';
                        marker.style.pointerEvents = 'none';
                        container.appendChild(marker);
                        pageNum++;
                    }

                    // 4. 调用浏览器原生打印（文件B方式，速度快）
                    setTimeout(() => {
                        try {
                            solutionWindow.print();
                        } catch (e) {
                            console.error('打印失败：', e);
                        } finally {
                            // 打印对话框关闭后清理并恢复显示
                            if (loading.parentNode) loading.parentNode.removeChild(loading);
                            doc.querySelectorAll('.page-number').forEach(el => el.remove());
                            container.classList.remove('export-preview');
                            container.style.position = '';
                            updateDisplayByExportType(exportStore.exportOptions.exportType);
                            if (exportOptionsEl) exportOptionsEl.style.display = originalExportOptionsDisplay;
                            exportStore.isExporting = false;
                            exportBtn.style.display = '';
                        }
                    }, 200);

                } catch (error) {
                    console.error('导出错误：', error);
                    if (loading.parentNode) loading.parentNode.removeChild(loading);
                    doc.querySelectorAll('.page-number').forEach(el => el.remove());
                    container.classList.remove('export-preview');
                    container.style.position = '';
                    if (exportOptionsEl) exportOptionsEl.style.display = originalExportOptionsDisplay;
                    updateDisplayByExportType(exportStore.exportOptions.exportType);
                    exportStore.isExporting = false;
                    exportBtn.style.display = '';
                    solutionWindow.alert('导出失败：' + (error && error.message ? error.message : error));
                }
            };


            const checkLib = () => {
                // 按文件B方式：浏览器原生打印，无需加载 html2canvas / jsPDF
                exportToPDF();
            };

            // 绑定导出按钮事件
            exportBtn.addEventListener('click', checkLib);

            // 初始化时显示所有题目
            updateDisplayByExportType('all');
        };

        // 启动初始化流程
        init();
    }

}

// 初始化应用
(function () {
    'use strict';
    // 创建应用实例，启动工具
    new FenbiPaperTool();
})();
