// HTML ops 执行器：在 slide HTML 字符串上做 DOM 变换（DOMParser），序列化回写
// 快照 = {themeId, slides:[{id,html,title}]}，天然可撤销/回滚
import { rewriteText } from './variants';
import { findSlide, slideIndex, HTML_THEMES } from './htmlDeck';

const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
const serialize = (doc) => doc.querySelector('section.slide')?.outerHTML || doc.body.innerHTML;

// 结构保留式文本替换：含样式子元素（如 span.accent）时，新文案写入首个文本节点、
// 其余文本清空，类名与标签结构不动（避免 textContent 整体替换破坏原设计）
function setTextPreserve(doc, el, next) {
  const meaningful = [...el.children].filter((c) => c.textContent.trim());
  if (!meaningful.length) {
    el.textContent = next;
    return;
  }
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  if (!nodes.length) { el.textContent = next; return; }
  nodes[0].nodeValue = next;
  nodes.slice(1).forEach((n) => { n.nodeValue = ''; });
}

// 新插入页：复用源设计的 s-head/note/b 类，继承版式风格
function buildNewSlide(topic, n) {
  const id = `px_${Date.now().toString(36)}`;
  const html = `<section class="slide" id="${id}">
<div class='s-head'><span class='eyebrow'><i class='ri-add-line'></i>NEW / LUI</span><h2 class='s-title'>${topic}</h2><div class='s-sub'>added by conversation</div></div>
<div class='s-body'><div class='note' style='max-width:920px'>
<div class='b'><i class='ri-edit-line'></i><div><h5>要点一</h5><p>围绕主题补充关键信息，可继续用指令修改。</p></div></div>
<div class='b'><i class='ri-lightbulb-line'></i><div><h5>要点二</h5><p>结合上下文承接前后内容。</p></div></div>
<div class='b'><i class='ri-flag-line'></i><div><h5>要点三</h5><p>点选本句，说"换个说法"试试。</p></div></div>
</div></div>
<div class="page-num">新 / ${n}</div>
</section>`;
  return { id, html, title: topic };
}

// 整页「调整布局」：注入页内 <style> 覆盖间距/对齐（不破坏原结构，可撤销）
const LAYOUT_CSS = {
  compact: (p) => `${p} .s-body{gap:14px!important}${p} .stat-grid{gap:10px!important}${p} .stat-card{padding:14px 16px!important}${p} .note .b{padding:12px 14px!important}${p} .chart-row{gap:18px!important}${p} .bar-row{margin-bottom:10px!important}`,
  loose: (p) => `${p} .s-body{gap:36px!important}${p} .stat-grid{gap:32px!important}${p} .stat-card{padding:30px 34px!important}${p} .note .b{padding:26px 30px!important}${p} .chart-row{gap:44px!important}${p} .bar-row{margin-bottom:26px!important}`,
  centerTitle: (p) => `${p} .s-head{text-align:center!important}${p} .eyebrow{display:inline-flex!important;justify-content:center!important}`,
};
const LAYOUT_LABEL = { compact: '更紧凑', loose: '更舒展', centerTitle: '标题居中强调' };

const GOLD_PALETTE = ['#c9a44c', '#e0c274', '#a8833a', '#8a6c28'];

// 图表 op：改写 data-echart 配置（类型/配色/强调），重挂载生效
function mutateChart(el, kind) {
  const opt = JSON.parse(el.getAttribute('data-echart'));
  const s = opt.series[0];
  switch (kind) {
    case 'donut':
      s.type = 'pie'; s.radius = ['52%', '78%'];
      delete opt.xAxis; delete opt.yAxis;
      break;
    case 'pie':
      s.type = 'pie'; s.radius = ['0', '68%'];
      delete opt.xAxis; delete opt.yAxis;
      break;
    case 'bar': {
      const names = s.data.map((d) => d.name);
      const vals = s.data.map((d) => ({ value: d.value, itemStyle: d.itemStyle }));
      opt.series = [{ type: 'bar', data: vals, barWidth: '46%', itemStyle: { borderRadius: [6, 6, 0, 0] }, label: { show: true, position: 'top', color: '#ebe0c8', fontSize: 16 } }];
      opt.xAxis = { type: 'category', data: names, axisLabel: { color: '#d8c8a8', fontSize: 16 }, axisLine: { lineStyle: { color: '#d8c8a8' } } };
      opt.yAxis = { type: 'value', axisLabel: { color: '#d8c8a8' }, splitLine: { lineStyle: { color: 'rgba(216,200,168,.15)' } } };
      break;
    }
    case 'gold':
      s.data.forEach((d, i) => { d.itemStyle = { ...(d.itemStyle || {}), color: GOLD_PALETTE[i % GOLD_PALETTE.length] }; });
      break;
    case 'emphasize': {
      let mi = 0;
      s.data.forEach((d, i) => { if (d.value > s.data[mi].value) mi = i; });
      s.data[mi].itemStyle = { ...(s.data[mi].itemStyle || {}), borderColor: '#c9a44c', borderWidth: 4, shadowBlur: 18, shadowColor: 'rgba(201,164,76,.6)' };
      s.data[mi].label = { fontWeight: 900, fontSize: 20, color: '#c9a44c' };
      break;
    }
    default: return false;
  }
  el.setAttribute('data-echart', JSON.stringify(opt));
  return true;
}

// 返回 { deck, changes:[{slideId, path?}], label } 或 null（校验失败）
export function applyOps(deck0, ops) {
  const deck = structuredClone(deck0);
  const changes = [];
  let label = '';

  for (const op of ops) {
    const slide = op.slideId ? findSlide(deck, op.slideId) : null;
    if (op.slideId && !slide) return null;

    switch (op.op) {
      case 'rewrite_text': {
        const doc = parse(slide.html);
        // 卡片级改写时 path 指向容器，fallback 取其内首个段落
        const el = doc.querySelector(op.path) || doc.querySelector(`${op.path} p`);
        if (!el) return null;
        const next = rewriteText(el.textContent.trim(), op.args.mode, op.args.setText);
        setTextPreserve(doc, el, next);
        slide.html = serialize(doc);
        if (el.matches('h1,h2,h3')) slide.title = next;
        const page = slideIndex(deck, slide.id) + 1;
        changes.push({ slideId: slide.id, path: op.path });
        label = label || (op.args.setText ? `改写第 ${page} 页文本` : `${modeLabel(op.args.mode)}第 ${page} 页${op.role === 'title' ? '标题' : '正文'}`);
        break;
      }
      case 'update_style': {
        const doc = parse(slide.html);
        const el = doc.querySelector(op.path);
        if (!el) return null;
        const a = op.args;
        if (a.px) el.style.fontSize = `${a.px}px`;
        if (a.color) el.style.color = a.color;
        if (a.bold !== undefined) el.style.fontWeight = a.bold ? 800 : 400;
        if (a.align) el.style.textAlign = a.align;
        slide.html = serialize(doc);
        changes.push({ slideId: slide.id, path: op.path });
        label = label || `调整第 ${slideIndex(deck, slide.id) + 1} 页${op.role === 'title' ? '标题' : '正文'}样式`;
        break;
      }
      case 'insert_slide': {
        const idx = slideIndex(deck, op.afterSlideId);
        const ns = buildNewSlide(op.args.topic, deck.slides.length + 1);
        deck.slides.splice(idx + 1, 0, ns);
        changes.push({ slideId: ns.id });
        label = label || `在第 ${idx + 1} 页后新增一页`;
        break;
      }
      case 'delete_slide': {
        const idx = slideIndex(deck, op.slideId);
        deck.slides.splice(idx, 1);
        label = label || `删除第 ${idx + 1} 页`;
        break;
      }
      case 'change_theme': {
        deck.themeId = op.args.themeId;
        label = label || `全文主题切换为「${HTML_THEMES[op.args.themeId].name}」`;
        break;
      }
      case 'card_style': {
        const doc = parse(slide.html);
        const el = doc.querySelector(op.path);
        if (!el) return null;
        if (op.args.emphasis) {
          el.style.outline = '1.5px solid var(--gold)';
          el.style.background = 'rgba(201,164,76,.12)';
          el.style.borderRadius = '10px';
        } else {
          el.style.outline = ''; el.style.background = ''; el.style.borderRadius = '';
        }
        slide.html = serialize(doc);
        changes.push({ slideId: slide.id, path: op.path });
        label = label || `${op.args.emphasis ? '强调' : '取消强调'}第 ${slideIndex(deck, slide.id) + 1} 页卡片`;
        break;
      }
      case 'delete_element': {
        const doc = parse(slide.html);
        const el = doc.querySelector(op.path);
        if (!el) return null;
        el.remove();
        slide.html = serialize(doc);
        label = label || `删除第 ${slideIndex(deck, slide.id) + 1} 页卡片`;
        break;
      }
      case 'group_density': {
        const doc = parse(slide.html);
        const el = doc.querySelector(op.path);
        if (!el) return null;
        const compact = op.args.mode === 'compact';
        el.style.gap = compact ? '10px' : '36px';
        el.querySelectorAll('.stat-card,.b,.tl-item,.bar-row').forEach((c) => { c.style.padding = compact ? '12px 14px' : '28px 30px'; });
        slide.html = serialize(doc);
        changes.push({ slideId: slide.id, path: op.path });
        label = label || `第 ${slideIndex(deck, slide.id) + 1} 页组合${compact ? '更紧凑' : '更舒展'}`;
        break;
      }
      case 'group_style': {
        const doc = parse(slide.html);
        const el = doc.querySelector(op.path);
        if (!el) return null;
        el.querySelectorAll('.n,.v,.lbl').forEach((n) => { n.style.color = 'var(--gold)'; });
        slide.html = serialize(doc);
        changes.push({ slideId: slide.id, path: op.path });
        label = label || `第 ${slideIndex(deck, slide.id) + 1} 页组合统一金色`;
        break;
      }
      case 'chart_option': {
        const doc = parse(slide.html);
        const el = doc.querySelector(op.path);
        if (!el || !mutateChart(el, op.args.kind)) return null;
        slide.html = serialize(doc);
        changes.push({ slideId: slide.id, path: op.path });
        const kindLabel = { bar: '换成柱状图', donut: '换成环形图', pie: '换成饼图', gold: '金色配色', emphasize: '突出最大项' }[op.args.kind];
        label = label || `第 ${slideIndex(deck, slide.id) + 1} 页图表${kindLabel}`;
        break;
      }
      case 'adjust_layout': {
        const doc = parse(slide.html);
        const el = doc.querySelector('section.slide');
        if (!el || !LAYOUT_CSS[op.args.mode]) return null;
        el.querySelector('style[data-ix-layout]')?.remove();
        const st = doc.createElement('style');
        st.setAttribute('data-ix-layout', '1');
        st.textContent = LAYOUT_CSS[op.args.mode](`#${el.id}`);
        el.insertBefore(st, el.firstChild);
        slide.html = serialize(doc);
        changes.push({ slideId: slide.id });
        label = label || `第 ${slideIndex(deck, slide.id) + 1} 页布局：${LAYOUT_LABEL[op.args.mode]}`;
        break;
      }
      default:
        return null;
    }
  }
  return { deck, changes, label };
}

export const modeLabel = (m) =>
  ({ polish: '润色', short: '精简', formal: '正式化', alt: '换说法', casual: '口语化', expand: '扩写' }[m] || '改写');
