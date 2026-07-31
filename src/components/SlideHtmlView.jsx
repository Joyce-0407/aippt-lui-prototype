// 幻灯片保真渲染器：iframe srcDoc 注入原始 HTML+CSS，1280×720 固定画布按 scale 缩放
// 选中/高亮样式注入已加载 iframe 的 <style>（不改 srcdoc，避免点击时整页重载闪屏）
import { useEffect, useMemo, useRef } from 'react';
import { themeCssOf } from '../core/htmlDeck';

const W = 1280, H = 720;
// 选择阶梯（叶→根）：文字 → 卡片 → 组合；图表单独优先判定；未命中任何层 = 整页
const TEXT_SEL = 'h1,h2,h3,h4,h5,p,li,blockquote,img,.s-sub,.lbl,.v,.lead,.quote,.d,.sign';
const CARD_SEL = '.stat-card,.b,.tl-item,.bar-row,.face-card';
const GROUP_SEL = '.stat-grid,.note,.timeline,.bar-block';
const CHART_SEL = '.echart';

const MOUNT_JS = `(function(){function m(){if(!window.echarts)return;document.querySelectorAll('.echart[data-echart]').forEach(function(el){try{var o=JSON.parse(el.getAttribute('data-echart'));var c=echarts.getInstanceByDom(el)||echarts.init(el,undefined,{renderer:'canvas'});c.setOption(o,true);c.resize()}catch(e){}})}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',m)}else{m()}})();`;

function roleOf(el) {
  if (/^H[1-5]$/.test(el.tagName)) return 'title';
  if (el.tagName === 'IMG') return 'image';
  return 'body';
}

function cssPath(el, doc) {
  const parts = [];
  while (el && el.tagName !== 'HTML' && el !== doc.body) {
    let sel = el.tagName.toLowerCase();
    if (el.id) { parts.unshift(`#${el.id}`); break; }
    const cls = [...el.classList].filter((c) => !c.startsWith('ix')).slice(0, 2);
    if (cls.length) sel += '.' + cls.join('.');
    const parent = el.parentElement;
    if (parent) {
      const same = [...parent.children].filter((c) => c.tagName === el.tagName);
      if (same.length > 1) sel += `:nth-of-type(${same.indexOf(el) + 1})`;
    }
    parts.unshift(sel);
    el = parent;
  }
  return parts.join('>');
}

function composeDoc({ css, themeCss, html, selectable, echartsJs }) {
  const ix = `
    body{margin:0!important;padding:0!important;height:auto!important;display:block!important;background:none!important}
    ${selectable ? '.slide,.slide *{cursor:pointer!important;user-select:none!important}' : ''}
    @keyframes ixBreathe{0%,100%{box-shadow:0 0 0 2px rgba(77,163,255,0)}50%{box-shadow:0 0 0 6px rgba(77,163,255,.85);background:rgba(77,163,255,.08)}}
  `;
  const charts = html.includes('class=\'echart\'') || html.includes('class="echart"');
  // srcdoc 文档以父页面 base URL 解析相对路径，子路径部署下用 BASE_URL 拼字体地址
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="${import.meta.env.BASE_URL}bmy/fonts.css" rel="stylesheet">
<style>${css}</style><style>${themeCss || ''}</style><style>${ix}</style>
</head><body>${html}
${charts ? `<script>${echartsJs}</script>` : ''}
<script>${MOUNT_JS}</script>
</body></html>`;
}

// 选中描边 / diff 高亮 → 动态规则（运行时注入，不触发 iframe 重载）
function dynCss(selPath, diffPath) {
  return `
    ${selPath ? `${selPath}{outline:2px solid #4da3ff!important;outline-offset:3px;border-radius:2px}` : ''}
    ${diffPath ? `${diffPath}{animation:ixBreathe 1s ease-in-out 2;border-radius:4px}` : ''}
  `;
}

export default function SlideHtmlView({ slide, deck, scale, selectable = false, selPath, pageSel = false, diffPath, onSelect }) {
  const ref = useRef(null);
  const themeCss = themeCssOf(deck);
  // srcdoc 只随内容/主题变化，选中与高亮走运行时注入，点击不再触发 iframe 重载
  const srcdoc = useMemo(
    () => composeDoc({ css: deck.css, themeCss, html: slide.html, selectable, echartsJs: deck.echartsJs }),
    [deck.css, themeCss, deck.echartsJs, slide.html, selectable]
  );

  const dynRef = useRef({ selPath, diffPath });
  dynRef.current = { selPath, diffPath };

  const applyDyn = () => {
    const doc = ref.current?.contentDocument;
    if (!doc?.head) return;
    let st = doc.getElementById('ix-dyn');
    if (!st) {
      st = doc.createElement('style');
      st.id = 'ix-dyn';
      doc.head.appendChild(st);
    }
    st.textContent = dynCss(dynRef.current.selPath, dynRef.current.diffPath);
  };

  useEffect(applyDyn, [selPath, diffPath]);

  const handleLoad = () => {
    applyDyn();
    if (!selectable) return;
    const doc = ref.current?.contentDocument;
    if (!doc) return;
    doc.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // iframe 内坐标 → 父页面 client 坐标（乘缩放 + iframe 偏移），供工具条就近锚定
      const rect = ref.current.getBoundingClientRect();
      const client = { x: rect.left + e.clientX * scale, y: rect.top + e.clientY * scale };
      const t = e.target;
      const levels = [];
      const chartEl = t.closest?.(CHART_SEL);
      if (chartEl) {
        levels.push({ role: 'chart', path: cssPath(chartEl, doc), text: '数据图表' });
      } else {
        let textEl = null, cardEl = null, groupEl = null, cur = t;
        while (cur && cur.tagName !== 'SECTION') {
          if (!textEl && cur.matches?.(TEXT_SEL) && cur.textContent.trim()) textEl = cur;
          if (!cardEl && cur.matches?.(CARD_SEL)) cardEl = cur;
          if (!groupEl && cur.matches?.(GROUP_SEL)) groupEl = cur;
          cur = cur.parentElement;
        }
        if (textEl) levels.push({
          role: roleOf(textEl), path: cssPath(textEl, doc), text: textEl.textContent.trim(),
          fontSize: parseFloat(doc.defaultView.getComputedStyle(textEl).fontSize),
        });
        if (cardEl) levels.push({ role: 'card', path: cssPath(cardEl, doc), text: cardEl.textContent.trim() });
        if (groupEl) levels.push({ role: 'group', path: cssPath(groupEl, doc), text: groupEl.textContent.trim() });
      }
      if (!levels.length) {
        onSelect({ slideId: slide.id, levels: null, text: slide.title }, client);
        return;
      }
      onSelect({ slideId: slide.id, levels, levelIdx: 0 }, client);
    });
  };

  return (
    <div className="relative flex-none overflow-hidden rounded-lg" style={{ width: W * scale, height: H * scale, boxShadow: '0 2px 18px rgba(13,13,13,.16)' }}>
      <iframe
        ref={ref}
        title={slide.id}
        srcDoc={srcdoc}
        onLoad={handleLoad}
        width={W}
        height={H}
        tabIndex={-1}
        style={{
          border: 0, display: 'block', width: W, height: H,
          transform: `scale(${scale})`, transformOrigin: 'top left',
          pointerEvents: selectable ? 'auto' : 'none',
        }}
      />
      {selectable && pageSel && (
        <div className="pointer-events-none absolute inset-0 rounded-lg" style={{ outline: '2px solid #0a6cff', outlineOffset: 2 }} />
      )}
    </div>
  );
}

export const SLIDE_W = W;
export const SLIDE_H = H;
