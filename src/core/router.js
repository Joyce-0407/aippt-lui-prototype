// Mock 意图路由器（HTML deck 版）：selection + 指令文本 → ops / 追问 / 问答 / 兜底
// selection = { slideId, path|null, role:'title'|'body'|'image'|'page', text, fontSize }
import { slideIndex, findSlide, COLOR_WORDS, HTML_THEMES } from './htmlDeck';

const has = (t, re) => re.test(t);
const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

function explicitSlideRef(text, deck) {
  const m = text.match(/第\s*([0-9一二三四五六七八九十]+)\s*页/);
  if (!m) return null;
  const n = /^[0-9]+$/.test(m[1]) ? +m[1] : CN_NUM[m[1]];
  return n >= 1 && n <= deck.slides.length ? deck.slides[n - 1] : null;
}

export const ROLE_LABEL = { title: '标题', body: '正文', image: '图片', card: '卡片', group: '组合', chart: '图表' };

export function selectionDesc(sel, deck) {
  if (!sel) return '';
  const s = findSlide(deck, sel.slideId);
  if (!s) return '';
  const page = `第 ${slideIndex(deck, s.id) + 1} 页`;
  if (!sel.path || sel.role === 'page') return `${page}整页`;
  return `${page} · ${ROLE_LABEL[sel.role] || '元素'}`;
}

const STYLE_WORDS = /大点|小点|字号|加粗|变细|颜色|变红|变蓝|变金|红色|蓝色|金色|居中|对齐/;
const CONTENT_VERBS = /改|润色|扩写|精简|缩短|简化|正式|口语|换个说法|重写/;
const PAGE_WORDS = /加一页|新增|插入|删.*页/;
const DEGRADE_WORDS = /重写|重新生成|换图|换一张/;
const GLOBAL_WORDS = /整体|全部|整个|全局|所有页/;
const THEME_WORDS = /主题|配色|色系|颜色|风格|换肤/;
const QA_WORDS = /吗|？|\?|适合什么|多久|多长时间|怎么讲|多少页|建议.*讲/;
const EDIT_VERBS = /改|换|调|删|加|增|润色|优化|写/;

export function routeIntent({ selection: sel, text, deck }) {
  const t = text.trim();

  // P1：纯问答
  if (has(t, QA_WORDS) && !has(t, EDIT_VERBS)) {
    if (/场合|场景/.test(t)) return { kind: 'qa', answer: '这份兵马俑主题 PPT 叙事完整、视觉厚重，适合历史文化类课堂讲解、文旅项目介绍或博物馆主题分享。想调整语气的话，选中标题对我说"更正式"或"口语化"即可。' };
    if (/多久|多长时间|几分钟/.test(t)) return { kind: 'qa', answer: `全文共 ${deck.slides.length} 页，按每页 40~60 秒计算，建议演讲时长约 ${Math.max(3, Math.round(deck.slides.length * 50 / 60))} 分钟。需要精简的话，点选某页后对我说"删除这页"。` };
    return { kind: 'qa', answer: '好的，这个问题我可以直接回答。想修改 PPT 的话，点选页面上的文字，再告诉我怎么改就行。' };
  }

  const setMatch = t.match(/改成[:：]?\s*[「"']?(.+?)[」"']?$/);
  const targetSlide = explicitSlideRef(t, deck);
  const selSlide = sel ? findSlide(deck, sel.slideId) : null;

  // P6：无选中 + 全局词 + 主题词 → change_theme（CSS 变量换肤）
  if (!sel?.path && !targetSlide && has(t, GLOBAL_WORDS) && has(t, THEME_WORDS)) {
    const hit = COLOR_WORDS.find(([re]) => has(t, re));
    if (hit) {
      return {
        kind: 'ops', intent: '全局主题调整',
        summary: `将全文主题切换为「${HTML_THEMES[hit[1]].name}」`,
        ops: [{ op: 'change_theme', args: { themeId: hit[1] } }],
      };
    }
  }

  // P5：页面级（整页选中 或 显式"第N页/这页"）
  const pageSel = (sel && (!sel.path || sel.role === 'page') && selSlide) || (!sel && targetSlide) || (has(t, /这页|本页|当前页/) && selSlide);
  if (pageSel) {
    const slide = sel && (!sel.path || sel.role === 'page') && selSlide ? selSlide : targetSlide || selSlide;
    const page = slideIndex(deck, slide.id) + 1;
    if (/加一页|新增|插入/.test(t)) {
      const m = t.match(/加一页(.+)/);
      return { kind: 'ops', intent: '页面级操作', summary: `在第 ${page} 页后新增一页${m ? `「${m[1]}」` : ''}`, ops: [{ op: 'insert_slide', afterSlideId: slide.id, args: { topic: m?.[1] || '补充说明' } }] };
    }
    if (/删/.test(t)) {
      if (deck.slides.length <= 1) return { kind: 'unknown', answer: '至少保留 1 页，无法继续删除。' };
      return {
        kind: 'confirm', intent: '页面级操作',
        question: `确认删除第 ${page} 页吗？删除后可从历史中回滚。`,
        options: [
          { label: '确认删除', run: { kind: 'ops', intent: '页面级操作', summary: `删除第 ${page} 页`, ops: [{ op: 'delete_slide', slideId: slide.id, args: {} }] } },
          { label: '取消', run: null },
        ],
      };
    }
    // 调整布局：间距密度 / 标题对齐微调（注入页内 CSS 覆盖）
    if (/布局/.test(t)) {
      const mode = /紧凑/.test(t) ? 'compact' : /舒展|宽松/.test(t) ? 'loose' : /居中/.test(t) ? 'centerTitle' : null;
      if (mode) {
        const modeName = { compact: '更紧凑', loose: '更舒展', centerTitle: '标题居中强调' }[mode];
        return { kind: 'ops', intent: '页面布局调整', summary: `第 ${page} 页布局调整为「${modeName}」`, ops: [{ op: 'adjust_layout', slideId: slide.id, args: { mode } }] };
      }
      return {
        kind: 'clarify', question: `想怎么调整第 ${page} 页布局？`,
        options: [
          { label: '更紧凑', text: '布局更紧凑' },
          { label: '更舒展', text: '布局更舒展' },
          { label: '标题居中强调', text: '布局标题居中' },
        ],
      };
    }
    // 手工精排版式：整页重写/换图 → 诚实降级
    if (has(t, DEGRADE_WORDS) || has(t, PAGE_WORDS)) {
      return { kind: 'unknown', answer: `这份模板是手工精排版式（数据图、时间线均为定制设计），不支持整页重写/换图。可以：点选具体文字逐句修改、说"调整布局"微调间距，或"整体换成青铜绿"换主题色。` };
    }
  }

  // 无选中但显式"第N页标题改成XXX"
  if (!sel?.path && targetSlide && setMatch && /标题|题目/.test(t)) {
    const path = 'h2.s-title';
    return { kind: 'ops', intent: '局部文案改写', summary: `将第 ${slideIndex(deck, targetSlide.id) + 1} 页标题改为「${setMatch[1]}」`, ops: [{ op: 'rewrite_text', slideId: targetSlide.id, path, role: 'title', args: { setText: setMatch[1] } }] };
  }

  if (sel?.path) {
    const what = selectionDesc(sel, deck);

    // 图片角色：本套模板无照片素材 → 诚实降级
    if (sel.role === 'image' && has(t, /换|图|去掉/)) {
      return { kind: 'unknown', answer: '这份模板以纯排版与数据图形呈现，没有可替换的照片素材。你可以修改任意文字，或换整体主题色。' };
    }

    // ---- 卡片级：强调 / 删除 / 改写内容 ----
    if (sel.role === 'card') {
      if (/强调|突出|高亮/.test(t)) {
        return { kind: 'ops', intent: '卡片样式调整', summary: `强调${what}`, ops: [{ op: 'card_style', slideId: sel.slideId, path: sel.path, role: 'card', args: { emphasis: true } }] };
      }
      if (/取消/.test(t)) {
        return { kind: 'ops', intent: '卡片样式调整', summary: `取消${what}强调`, ops: [{ op: 'card_style', slideId: sel.slideId, path: sel.path, role: 'card', args: { emphasis: false } }] };
      }
      if (/删|去掉/.test(t)) {
        return {
          kind: 'confirm', intent: '卡片删除',
          question: `确认删除${what}吗？删除后可从历史中回滚。`,
          options: [
            { label: '确认删除', run: { kind: 'ops', intent: '卡片删除', summary: `删除${what}`, ops: [{ op: 'delete_element', slideId: sel.slideId, path: sel.path, role: 'card', args: {} }] } },
            { label: '取消', run: null },
          ],
        };
      }
      if (/改写|精简|换个说法|润色/.test(t)) {
        if (/精简|换个说法/.test(t)) {
          const mode = /精简/.test(t) ? 'short' : 'alt';
          return { kind: 'ops', intent: '局部文案改写', summary: `${mode === 'short' ? '精简' : '换个说法'}${what}内容`, ops: [{ op: 'rewrite_text', slideId: sel.slideId, path: sel.path, role: 'card', args: { mode } }] };
        }
        return { kind: 'clarify', question: `想怎么改写${what}的内容？`, options: [{ label: '精简表述', text: '精简' }, { label: '换个说法', text: '换个说法' }] };
      }
      if (has(t, EDIT_VERBS)) {
        return { kind: 'clarify', question: `想怎么改${what}？`, options: [{ label: '强调此卡', text: '强调此卡' }, { label: '改写内容', text: '改写内容' }, { label: '删除此卡', text: '删除此卡' }] };
      }
    }

    // ---- 组合级：密度 / 色调 ----
    if (sel.role === 'group') {
      if (/紧凑/.test(t)) return { kind: 'ops', intent: '组合样式调整', summary: `${what}更紧凑`, ops: [{ op: 'group_density', slideId: sel.slideId, path: sel.path, role: 'group', args: { mode: 'compact' } }] };
      if (/舒展|宽松/.test(t)) return { kind: 'ops', intent: '组合样式调整', summary: `${what}更舒展`, ops: [{ op: 'group_density', slideId: sel.slideId, path: sel.path, role: 'group', args: { mode: 'loose' } }] };
      if (/色调|颜色|统一/.test(t)) return { kind: 'ops', intent: '组合样式调整', summary: `${what}统一金色`, ops: [{ op: 'group_style', slideId: sel.slideId, path: sel.path, role: 'group', args: { color: 'gold' } }] };
      if (has(t, EDIT_VERBS)) {
        return { kind: 'clarify', question: `想怎么改${what}？`, options: [{ label: '更紧凑', text: '更紧凑' }, { label: '更舒展', text: '更舒展' }, { label: '统一色调', text: '统一色调' }] };
      }
    }

    // ---- 图表级：真改 echarts 配置 ----
    if (sel.role === 'chart') {
      const kind = /柱|条形/.test(t) ? 'bar' : /环/.test(t) ? 'donut' : /饼/.test(t) ? 'pie' : /金|配色|颜色/.test(t) ? 'gold' : /突出|强调|最大/.test(t) ? 'emphasize' : null;
      if (kind) {
        const kindLabel = { bar: '换成柱状图', donut: '换成环形图', pie: '换成饼图', gold: '金色配色', emphasize: '突出最大项' }[kind];
        return { kind: 'ops', intent: '图表调整', summary: `${what}${kindLabel}`, ops: [{ op: 'chart_option', slideId: sel.slideId, path: sel.path, role: 'chart', args: { kind } }] };
      }
      if (has(t, EDIT_VERBS) || /图/.test(t)) {
        return {
          kind: 'clarify', question: `想怎么调整这张图表？`,
          options: [{ label: '换成柱状图', text: '换成柱状图' }, { label: '换成环形图', text: '换成环形图' }, { label: '突出最大项', text: '突出最大项' }],
        };
      }
    }

    // P2：样式调整（px 绝对值由选中时记录的 fontSize 换算）
    if (has(t, STYLE_WORDS)) {
      const args = {};
      if (/大点|调大|大一点/.test(t)) args.px = Math.min(72, (sel.fontSize || 20) + 4);
      if (/小点|调小|小一点/.test(t)) args.px = Math.max(10, (sel.fontSize || 20) - 4);
      if (/加粗/.test(t)) args.bold = true;
      if (/变细|不加粗/.test(t)) args.bold = false;
      if (/金/.test(t)) args.color = '#c9a44c';
      else if (/红|朱砂/.test(t)) args.color = '#c0392b';
      else if (/蓝/.test(t)) args.color = '#4da3ff';
      else if (/白/.test(t)) args.color = '#ebe0c8';
      if (/居中/.test(t)) args.align = 'center';
      if (/左对齐/.test(t)) args.align = 'left';
      return { kind: 'ops', intent: '元素样式调整', summary: `调整${what}样式`, ops: [{ op: 'update_style', slideId: sel.slideId, path: sel.path, role: sel.role, args }] };
    }

    // 改成：XXX
    if (setMatch && has(t, /改成|改为/)) {
      return { kind: 'ops', intent: '局部文案改写', summary: `将${what}改为「${setMatch[1]}」`, ops: [{ op: 'rewrite_text', slideId: sel.slideId, path: sel.path, role: sel.role, args: { setText: setMatch[1] } }] };
    }

    // P3：内容改写
    if (has(t, CONTENT_VERBS)) {
      const mode = /短|精简|简化/.test(t) ? 'short' : /扩写|展开|详细/.test(t) ? 'expand' : /正式/.test(t) ? 'formal' : /口语|大白话|通俗/.test(t) ? 'casual' : /换个说法/.test(t) ? 'alt' : 'polish';
      return { kind: 'ops', intent: '局部文案改写', summary: `${{ short: '精简', expand: '扩写', formal: '正式化', casual: '口语化', alt: '换个说法', polish: '润色' }[mode]}${what}`, ops: [{ op: 'rewrite_text', slideId: sel.slideId, path: sel.path, role: sel.role, args: { mode } }] };
    }

    // P7：歧义追问
    if (has(t, EDIT_VERBS)) {
      const opts = sel.role === 'title'
        ? [{ label: '更简洁', text: '改短点' }, { label: '更正式', text: '更正式' }, { label: '换个说法', text: '换个说法' }]
        : [{ label: '精简', text: '精简' }, { label: '扩写', text: '扩写' }, { label: '字号调大', text: '字号调大' }];
      return { kind: 'clarify', question: `想怎么改「${what}」？`, options: opts };
    }
  }

  // 整页选中但没说清做什么
  if (sel && (!sel.path || sel.role === 'page') && has(t, EDIT_VERBS)) {
    return {
      kind: 'clarify', question: `想怎么改「${selectionDesc(sel, deck)}」？`,
      options: [{ label: '后面加一页', text: '后面加一页' }, { label: '删除这页', text: '删除这页' }],
    };
  }

  // P8：兜底
  return {
    kind: 'unknown',
    answer: '我还不太确定你想怎么改。可以试试：点选页面上的标题或正文后说"改短点"，或直接告诉我"整体换成青铜绿"、"第 3 页标题改成：地下军阵"这样的完整指令。',
  };
}

// 假流式输出：30~60ms/字逐字渲染
export function streamText(text, onChunk, onDone) {
  let i = 0;
  const timer = setInterval(() => {
    i += 1;
    onChunk(text.slice(0, i));
    if (i >= text.length) {
      clearInterval(timer);
      onDone?.();
    }
  }, 30 + Math.random() * 30);
  return () => clearInterval(timer);
}
