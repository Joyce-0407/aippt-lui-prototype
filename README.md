# AIPPT · 指哪改哪 可交互原型

基于 AI 生成 PPT + 生成后 LUI（语言用户界面）"指哪改哪"编辑能力的高保真原型。
视觉 1:1 对齐 WPS AIPPT（设计 token 见根目录 `.impeccable.md`）。

> **Demo 聚焦（v1.5）**：整个演示聚焦"生成完成后的 LUI 修改"，打开即进入编辑页；deck 为真实生成稿《沉睡千年的地下军阵_西安兵马俑》10 页 HTML，**像素级保真嵌入**（iframe + 原始 CSS，字体/图表库全部本地化，运行时零外部请求）。首页/生成过程已移出演示范围，作为产品文档保留在 PRD 与线框中。

## 启动

```bash
npm install
npm run dev    # http://localhost:5173
```

构建：`npm run build` → `dist/`（纯静态，可任意托管）。

## 演示脚本（全部发生在编辑页）

1. **引导**：欢迎气泡介绍操作方式（可点 chips 直接体验）
2. **改写**：点击第 3 页标题 → 就近浮出工具条 + **点击处脉冲标记** + 输入区**引用 chip**（Kimi 式锚点）→ 点「改短点」→ 原地更新 + 呼吸高亮 + ops 确认卡
3. **多层级选中**：点击正文后，工具条**层级面包屑**可上钻「正文 › 卡片 › 组合」；不同层级不同预设 chips
4. **图表层**：点击第 4 页饼图 → chips「换成柱状图 / 换成环形图 / 金色配色 / 突出最大项」→ **真改 echarts 配置**重挂载
5. **卡片层**：面包屑切到「卡片」→ chips「强调此卡 / 改写内容 / 删除此卡」（删除有二次确认）
6. **整页**：点击缩略图 → chips「后面加一页 / 删除这页 / **调整布局**」（更紧凑 / 更舒展 / 标题居中强调，页内 CSS 覆盖注入）
7. **全局**：Esc 取消选中 → 输入「整体换成青铜绿」（CSS 变量换肤）
8. **追问**：选中标题 → 输入「改一下」→ AI 歧义追问，点选项即执行
9. **撤销/历史**：顶栏 ↩ 撤销；🕘 打开历史抽屉，任意步可回滚

其他可试：「第 3 页标题改成：地下军阵」「删除这页」「这份 PPT 讲多久合适」（问答分流）「这页换个布局」（诚实降级：精排版式不支持，并引导可用操作）。

## 保真渲染架构

每页 = 源稿原始 HTML 字符串，经 **iframe srcDoc** 渲染（1280×720 固定画布按容器缩放；缩略图 132px）：

- `public/bmy/slides.css`：源稿全部样式（42 万字符，含 base64 内嵌 remixicon 图标字体）
- `public/bmy/slides/p1..p10.html`：每页原始 `<section class="slide">`（封面/时间线/数据卡/echarts 饼图/条形图/工序/金句等 10 种手工版式）
- `public/bmy/echarts.js`：源稿内嵌图表库（仅含图表的页才注入执行）
- `public/bmy/fonts.css` + `fonts/*.woff2`：**本地化字体子集**（Noto Serif SC / Noto Sans SC / Cormorant Garamond，按 demo 用字过滤 unicode-range，142 个文件共 8.7MB）→ 断网/代理异常也能演示
- 管线脚本：`../extract-assets.js`（拆资源）、`../fetch-fonts.js`（字体本地化），源 HTML 更新后可重跑

**选中交互（多层级阶梯）**：点击穿透 iframe 内 DOM → 沿选择阶梯（文字 → 卡片`.stat-card/.b/.tl-item/.bar-row` → 组合`.stat-grid/.note/.timeline` → 图表`.echart` → 整页）解析全部命中层 → 上报 `{slideId, levels[], levelIdx}`；工具条层级面包屑可上下钻；选中描边/diff 高亮 = 运行时注入动态 CSS（不触发 iframe 重载，点击无闪烁）；点击处落脉冲标记，输入区钉引用 chip（Kimi 式锚点）。

**ops 执行**：`DOMParser` 在 HTML 字符串上改写 → 序列化回写 → iframe 重渲染；历史栈快照 = `{themeId, slides[]}`。13 类 op：改写 / 样式 / 增删页 / 换主题 / 卡片强调·删除 / 组合密度·色调 / 图表类型·配色·强调（改 `data-echart` 配置重挂载）/ 页面布局微调（页内 `<style>` 覆盖注入）。

**诚实降级**：「整页重写 / 换图」返回解释性回复并引导到可用操作。

## 架构

```
src/
  core/               # 与 UI 无关的核心层（Mock 引擎，接口与真实 LLM 对齐）
    htmlDeck.js       # deck 加载（fetch 静态资源）+ CSS 变量主题 ×4 + 颜色词映射
    htmlOps.js        # ops 执行器：改写/样式/增删页/换主题（DOMParser 变换 HTML）
    variants.js       # 文案改写语料库（键 = 源稿精确原文）+ 兜底变换
    router.js         # 意图路由器：selection+指令 → ops/追问/问答/降级（PRD §F2 优先级表）
  components/
    SlideHtmlView.jsx # 保真渲染器（iframe srcDoc + 缩放 + 选中/高亮注入 + 图表挂载）
    ChatPanel.jsx     # 右侧对话区（ops 卡/追问卡/引导 chips/上下文输入框）
    Filmstrip.jsx     # 底部缩略图胶片条（整页选中入口）
    HistoryDrawer.jsx
  views/
    Editor.jsx        # P3 编辑页（指哪改哪主战场；demo 唯一页面）
```

> P1 首页 / P2 生成页已移出演示（v1.4），交互设计见 `wireframes/` 与 `PRD.md`。

**执行闭环**：`选中(css path) + 指令 → 意图路由 → ops JSON → DOM 改写 → diff 呼吸高亮 → 快照入历史栈（撤销/重做/回滚）`

**AI 策略**：纯 Mock。意图路由为规则引擎（关键词+选中上下文判别），改写用语料变体库，回复 30~60ms/字假流式。
`core/router.js` 接口签名 `(selection, instruction, deck) => {kind, ops...}` 与真实 LLM function calling 对齐，升级即插即换。

## 范围说明

- 生成页三阶段交互已按需求移出演示，PRD 中保留为产品化方向
- 换布局/整页重写/换图三类 ops 在本 deck 上降级为诚实回复（源稿限制，见上）
- 导出 PPTX / 保存为 mock（toast 提示）
- 移动端不在本期范围
