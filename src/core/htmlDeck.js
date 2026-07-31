// HTML deck 加载与主题（CSS 变量换肤）
// 每页 = 源文件原始 HTML 字符串，渲染保真；主题 = :root CSS 变量覆盖
export const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;900&family=Noto+Sans+SC:wght@400;700&family=Cormorant+Garamond:wght@500;700&display=swap';

export const SLIDE_TITLES = [
  '地下军团 · 兵马俑', '一口旱井，翻开的帝国', '三坑列阵：地下临战的兵马布局',
  '俑之万面：千人千面，万千形制', '一坑主战，二坑混编', '塑模合烧：陶俑成器四道工序',
  '武器与铠甲：实战的武装配置', '「视之若一一皆活」', '遗址之上的博物馆', '地下不动，已成永恒',
];

// 主题 = 源设计 CSS 变量的覆盖集（--clay/--soil/--cinnabar/--bone/--jade/--gold/--ink）
export const HTML_THEMES = {
  qin: { id: 'qin', name: '秦土原色', css: '' },
  jade: {
    id: 'jade', name: '青铜绿',
    css: ':root{--clay:#5f8a6e;--clay-deep:#3c5c48;--soil:#16241c;--soil-dark:#0b160f;--bone:#e3e9d8;--bone-soft:#bfcbb0;--gold:#b7c98a;--cinnabar:#b8563c}',
  },
  ink: {
    id: 'ink', name: '墨玉黑金',
    css: ':root{--clay:#c9a44c;--clay-deep:#8a6c28;--soil:#131311;--soil-dark:#050504;--cinnabar:#c9a44c;--cinnabar-dark:#8a6c28;--bone:#eee6d2;--bone-soft:#cfc3a4;--gold:#e0c274;--jade:#7a8b6f}',
  },
  indigo: {
    id: 'indigo', name: '靛蓝',
    css: ':root{--clay:#4a7fbf;--clay-deep:#2c5a8f;--soil:#101d2e;--soil-dark:#080f1a;--cinnabar:#d4644f;--cinnabar-dark:#a04030;--bone:#e2eaf4;--bone-soft:#b0c2d8;--gold:#c9a44c;--jade:#5a8d7d}',
  },
};

export const COLOR_WORDS = [
  [/绿|青铜|青玉/, 'jade'],
  [/黑|墨|金/, 'ink'],
  [/蓝|靛/, 'indigo'],
  [/原色|秦|黄土|陶土|默认/, 'qin'],
];

export async function loadHtmlDeck() {
  const B = import.meta.env.BASE_URL; // 子路径部署（GitHub Pages）下也能正确定位静态资源
  const [css, echartsJs, ...htmls] = await Promise.all([
    fetch(`${B}bmy/slides.css`).then((r) => r.text()),
    fetch(`${B}bmy/echarts.js`).then((r) => r.text()),
    ...Array.from({ length: 10 }, (_, i) => fetch(`${B}bmy/slides/p${i + 1}.html`).then((r) => r.text())),
  ]);
  return {
    topic: '西安兵马俑', themeId: 'qin', css, echartsJs,
    slides: htmls.map((html, i) => ({ id: `p${i + 1}`, html, title: SLIDE_TITLES[i] })),
  };
}

export const themeCssOf = (deck) => (HTML_THEMES[deck.themeId] || HTML_THEMES.qin).css;
export const slideIndex = (deck, slideId) => deck.slides.findIndex((s) => s.id === slideId);
export const findSlide = (deck, slideId) => deck.slides.find((s) => s.id === slideId);
