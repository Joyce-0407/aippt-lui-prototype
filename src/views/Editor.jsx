// P3 编辑页（指哪改哪 · HTML 保真版）：左预览区（iframe 画布 + 底部缩略图胶片条）+ 右对话区 380px
// 执行闭环：selection(css path) + 指令 → 意图路由 → ops → DOM 改写 → diff 高亮 → 历史栈
import { useEffect, useRef, useState } from 'react';
import SlideHtmlView, { SLIDE_W, SLIDE_H } from '../components/SlideHtmlView';
import Filmstrip from '../components/Filmstrip';
import HistoryDrawer from '../components/HistoryDrawer';
import ChatPanel from '../components/ChatPanel';
import { applyOps } from '../core/htmlOps';
import { routeIntent, selectionDesc, streamText, ROLE_LABEL } from '../core/router';
import { findSlide } from '../core/htmlDeck';

const now = () => new Date().toTimeString().slice(0, 5);

const CHIPS_BY_ROLE = {
  title: ['润色一下', '改短点', '更正式', '换个说法'],
  body: ['精简', '扩写', '换个说法', '字号调大'],
  image: [],
  card: ['强调此卡', '改写内容', '删除此卡'],
  group: ['更紧凑', '更舒展', '统一色调'],
  chart: ['换成柱状图', '换成环形图', '金色配色', '突出最大项'],
  page: ['后面加一页', '删除这页', '调整布局'],
  none: ['整体换成青铜绿', '整体换成墨玉黑金', '整体换成靛蓝'],
};

export default function Editor({ deck0 }) {
  // ---- 历史栈：快照式 ----
  const [snaps, setSnaps] = useState([deck0]);
  const [entries, setEntries] = useState([{ time: now(), label: `生成完成（${deck0.slides.length} 页）` }]);
  const [idx, setIdx] = useState(0);
  const deck = snaps[idx];

  const [currentId, setCurrentId] = useState(deck.slides[0].id);
  // selection = { slideId, levels:[{role,path,text,fontSize?}]|null, levelIdx }
  // levels=null 表示整页选中；levels 按 叶→根 排列，levelIdx 为当前层级
  const [selection, setSelection] = useState(null);
  const [selPos, setSelPos] = useState(null);
  const [tbText, setTbText] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [diffTargets, setDiffTargets] = useState([]); // [{slideId, path}]
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastCmd, setLastCmd] = useState('');
  const [canvasScale, setCanvasScale] = useState(0.6);

  const mid = useRef(0);
  const inputRef = useRef(null);
  const previewRef = useRef(null);
  const diffTimer = useRef(null);
  const toastTimer = useRef(null);

  const current = findSlide(deck, currentId) || deck.slides[0];

  // 当前层级（叶→根）；flatSel = 打平给 router/描述的兼容结构
  const curLevel = selection?.levels ? selection.levels[selection.levelIdx ?? 0] : null;
  const flatSel = selection
    ? { slideId: selection.slideId, path: curLevel?.path ?? null, role: curLevel?.role ?? 'page', text: curLevel?.text ?? selection.text, fontSize: curLevel?.fontSize }
    : null;

  // 画布缩放自适应预览区（按实际 padding 计算可用空间）
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      setCanvasScale(Math.max(0.3, Math.min((r.width - padX) / SLIDE_W, (r.height - padY) / SLIDE_H)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 小窗提示：固定壳层占比过高时提醒放大窗口
  const [smallWin, setSmallWin] = useState(() => window.innerWidth < 1100);
  useEffect(() => {
    const fn = () => setSmallWin(window.innerWidth < 1100);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  // ---- 欢迎引导 ----
  useEffect(() => {
    pushAi('PPT 已生成完成 🎉\n点哪里，说一句话就能改：点标题改文案、点缩略图改整页、或直接说"整体换主题色"。', {
      chips: [
        { label: '整体换主题色', text: '整体换成青铜绿' },
        { label: '这份 PPT 讲多久合适', text: '这份 PPT 讲多久合适' },
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fn = (e) => e.key === 'Escape' && setSelection(null);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const pushAi = (text, extra = {}) => {
    const id = ++mid.current;
    setMessages((ms) => [...ms, { id, from: 'ai', text: '', streaming: true, ...extra }]);
    streamText(text, (partial) => {
      setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, text: partial } : m)));
    }, () => {
      setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, streaming: false } : m)));
      extra.onDone?.(id);
    });
  };

  const showToast = (text, action) => {
    clearTimeout(toastTimer.current);
    setToast({ text, action });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  const fireDiff = (changes) => {
    clearTimeout(diffTimer.current);
    setDiffTargets(changes);
    diffTimer.current = setTimeout(() => setDiffTargets([]), 2200);
  };

  // ---- 应用 ops ----
  const commitOps = (result, onApplied) => {
    const r = applyOps(deck, result.ops);
    if (!r) {
      pushAi('这条指令我没完全理解，能换个说法吗？比如指明要改哪一页、哪句话。');
      return;
    }
    const ni = idx + 1;
    setSnaps((s) => [...s.slice(0, ni), r.deck]);
    setEntries((e) => [...e.slice(0, ni), { time: now(), label: r.label }]);
    setIdx(ni);
    if (r.changes.length) {
      fireDiff(r.changes);
      const target = r.changes[0]?.slideId;
      if (target && findSlide(r.deck, target)) setCurrentId(target);
    }
    if (result.ops.some((o) => o.op === 'delete_slide' || o.op === 'delete_element')) {
      setSelection(null);
      if (result.ops.some((o) => o.op === 'delete_slide')) {
        setCurrentId((cid) => (findSlide(r.deck, cid) ? cid : r.deck.slides[r.deck.slides.length - 1].id));
      }
    }
    onApplied?.(r);
  };

  // ---- 发送指令 ----
  const onSend = (text) => {
    setLastCmd(text);
    setMessages((ms) => [...ms, { id: ++mid.current, from: 'user', text }]);
    setBusy(true);
    setTimeout(() => {
      const result = routeIntent({ selection: flatSel, text, deck });
      setBusy(false);
      handleResult(result);
    }, 500);
  };

  const handleResult = (result) => {
    switch (result.kind) {
      case 'ops': {
        const id = ++mid.current;
        setMessages((ms) => [...ms, {
          id, from: 'ai', text: '', streaming: true,
          card: { intent: result.intent, summary: result.summary, done: false, changes: [] },
        }]);
        streamText(`我理解你想：${result.summary}`, (partial) => {
          setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, text: partial } : m)));
        }, () => {
          setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, streaming: false } : m)));
          commitOps(result, (r) => {
            setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, card: { ...m.card, done: true, changes: r.changes } } : m)));
          });
        });
        break;
      }
      case 'confirm':
      case 'clarify': {
        const id = ++mid.current;
        setMessages((ms) => [...ms, { id, from: 'ai', text: '', streaming: true, clarify: { question: result.question, options: result.options } }]);
        streamText('让我确认一下：', (partial) => {
          setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, text: partial } : m)));
        }, () => setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, streaming: false } : m))));
        break;
      }
      case 'qa':
      case 'unknown':
      default:
        pushAi(result.answer);
    }
  };

  const onClarifyPick = (opt) => {
    if (opt.text) return onSend(opt.text);
    if (opt.run) return handleResult(opt.run);
    pushAi('好的，已取消，PPT 保持原样。');
  };

  // ---- ops 卡动作 ----
  const onOpsLocate = (card) => {
    const t = card.changes[0];
    if (!t) return;
    setCurrentId(t.slideId);
    fireDiff(card.changes);
  };
  const undo = () => {
    if (idx === 0) return;
    const label = entries[idx]?.label || '上一步';
    setIdx(idx - 1);
    setSelection(null);
    showToast(`已撤销：${label}`, idx > 1 ? { label: '再撤一步', run: () => undo() } : null);
  };
  const redo = () => { if (idx < snaps.length - 1) setIdx(idx + 1); };
  const onOpsUndo = () => undo();
  const onOpsRetry = () => {
    const role = flatSel?.path ? flatSel.role : 'none';
    const opts = (CHIPS_BY_ROLE[role] || CHIPS_BY_ROLE.none).slice(0, 3).map((c) => ({ label: c, text: c }));
    const id = ++mid.current;
    setMessages((ms) => [...ms, { id, from: 'ai', text: '好的，我重新理解。你想：', clarify: { question: '重新选择你的意图：', options: opts } }]);
  };

  const rollback = (i) => {
    setIdx(i);
    setSelection(null);
    setHistoryOpen(false);
    showToast(`已回滚到：${entries[i]?.label}`);
  };

  // ---- 选中处理（client 坐标已由 iframe 换算为父页面坐标） ----
  const handleSelect = (sel, client) => {
    setSelection(sel);
    if (sel.slideId !== currentId) setCurrentId(sel.slideId);
    if (client && previewRef.current) {
      const r = previewRef.current.getBoundingClientRect();
      setSelPos({ x: client.x - r.left, y: client.y - r.top });
    } else {
      setSelPos(null);
    }
  };

  // 工具条位置
  const TB_W = 440, TB_H = 92;
  let tbStyle;
  if (selPos && previewRef.current) {
    const cw = previewRef.current.clientWidth;
    const x = Math.min(Math.max(selPos.x - TB_W / 2, 8), Math.max(8, cw - TB_W - 8));
    const above = selPos.y > TB_H + 48;
    tbStyle = { left: x, top: above ? selPos.y - TB_H - 16 : selPos.y + 28, width: TB_W };
  } else {
    tbStyle = { left: '50%', top: 16, width: TB_W, transform: 'translateX(-50%)' };
  }

  const tbSend = () => {
    const v = tbText.trim();
    if (!v || busy) return;
    setTbText('');
    onSend(v);
  };

  // ---- 选中上下文 ----
  const chipKey = !flatSel ? 'none' : flatSel.path ? flatSel.role : 'page';
  const chips = CHIPS_BY_ROLE[chipKey] || [];
  const placeholder = flatSel
    ? `选中了「${selectionDesc(flatSel, deck)}」，说句话就能改…`
    : '提问、选择技能或试试 @';
  const curDiff = diffTargets.find((d) => d.slideId === current.id);

  // Kimi 式引用 chip：选中内容的摘要钉在输入区
  const quoteText = flatSel
    ? flatSel.path
      ? (flatSel.text || '').replace(/\s+/g, ' ').slice(0, 30) + ((flatSel.text || '').length > 30 ? '…' : '')
      : selectionDesc(flatSel, deck)
    : null;

  return (
    <div className="flex h-full flex-col bg-white" onClick={() => setSelection(null)}>
      {/* Header */}
      <header className="flex h-[56px] flex-none items-center gap-3 border-b border-ink-06 px-4" onClick={(e) => e.stopPropagation()}>
        <span className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #682aef, #9e75f5)' }}>AI</span>
        <span className="text-sm font-semibold">{deck.topic}.pptx</span>
        <span className="flex-1" />
        <button className={`rounded-lg px-2 py-1 text-sm transition-colors ${idx === 0 ? 'text-ink-24' : 'text-ink hover:bg-ink-06'}`} onClick={undo} disabled={idx === 0} title="撤销">↩</button>
        <button className={`rounded-lg px-2 py-1 text-sm transition-colors ${idx >= snaps.length - 1 ? 'text-ink-24' : 'text-ink hover:bg-ink-06'}`} onClick={redo} disabled={idx >= snaps.length - 1} title="重做">↪</button>
        <button className={`rounded-lg px-2 py-1 text-sm transition-colors hover:bg-ink-06 ${historyOpen ? 'bg-ink-06' : ''}`} onClick={() => setHistoryOpen((v) => !v)} title="历史">🕘</button>
        <button className="btn-white btn-sm" onClick={() => showToast('已保存（原型演示自动保存）')}>保存</button>
        <button className="btn-black btn-sm" onClick={() => showToast('原型演示版，导出功能敬请期待')}>导出 PPTX</button>
      </header>

      {/* 小窗提示条 */}
      {smallWin && (
        <div className="flex flex-none items-center justify-center gap-2 border-b border-[#f0e0b8] bg-[#fdf6e3] px-4 py-1.5 text-xs text-[#8a6d1f]">
          当前窗口较小，画布已自适应缩放；建议放大浏览器窗口（或全屏）获得最佳演示效果
          <button className="text-[#b0945a] hover:text-[#8a6d1f]" onClick={() => setSmallWin(false)}>×</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* 左：预览区 */}
        <div className="flex flex-1 flex-col bg-page">
          <div ref={previewRef} className="relative flex flex-1 items-center justify-center overflow-hidden p-5">
            {/* 点击位置的脉冲标记（Kimi 式位置锚点） */}
            {selection && selPos && (
              <div className="marker-dot" style={{ left: selPos.x, top: selPos.y }} />
            )}
            {/* 选中浮动工具条 */}
            {selection && (
              <div className="float-chips" style={tbStyle} onClick={(e) => e.stopPropagation()}>
                {/* 层级面包屑：文字 / 卡片 / 组合 可上钻下钻 */}
                {selection.levels && selection.levels.length > 1 && (
                  <div className="mb-1.5 flex items-center gap-1">
                    {selection.levels.map((lv, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-[10px] text-ink-24">›</span>}
                        <button
                          className={`lv-btn ${i === (selection.levelIdx ?? 0) ? 'lv-btn-on' : ''}`}
                          onClick={() => setSelection({ ...selection, levelIdx: i })}
                        >{ROLE_LABEL[lv.role] || lv.role}</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 text-xs text-ink-46">{selectionDesc(flatSel, deck)}</span>
                  {chips.map((c) => (
                    <span key={c} className="chip" onClick={() => onSend(c)}>{c}</span>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    className="tb-input"
                    value={tbText}
                    onChange={(e) => setTbText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tbSend(); } }}
                    placeholder="或直接输入修改指令，Enter 发送"
                    autoFocus
                  />
                  <button className="btn-black btn-sm h-8" onClick={tbSend} disabled={busy}>发送</button>
                </div>
              </div>
            )}
            <div data-testid="canvas" onClick={(e) => e.stopPropagation()}>
              <SlideHtmlView
                slide={current} deck={deck} scale={canvasScale} selectable
                selPath={selection?.slideId === current.id ? curLevel?.path : undefined}
                pageSel={selection?.slideId === current.id && !curLevel}
                diffPath={curDiff?.path}
                onSelect={handleSelect}
              />
            </div>
            {historyOpen && (
              <div onClick={(e) => e.stopPropagation()} className="absolute inset-0">
                <HistoryDrawer entries={entries} currentIdx={idx} onRollback={rollback} onClose={() => setHistoryOpen(false)} />
              </div>
            )}
            {toast && (
              <div className="toast-in absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-4 py-2 text-xs text-white"
                style={{ boxShadow: '0 6px 24px rgba(13,13,13,.3)' }} onClick={(e) => e.stopPropagation()}>
                {toast.text}
                {toast.action && <b className="cursor-pointer text-[#8ec5ff]" onClick={toast.action.run}>{toast.action.label}</b>}
              </div>
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Filmstrip deck={deck} current={current.id} selection={selection}
              onPick={(sid) => { setCurrentId(sid); setSelection({ slideId: sid, levels: null, text: findSlide(deck, sid)?.title }); setSelPos(null); }} />
          </div>
        </div>

        {/* 右：对话区 */}
        <div onClick={(e) => e.stopPropagation()} className="h-full">
          <ChatPanel
            messages={messages}
            onSend={onSend}
            onClarifyPick={onClarifyPick}
            onOpsLocate={onOpsLocate}
            onOpsUndo={onOpsUndo}
            onOpsRetry={onOpsRetry}
            placeholder={placeholder}
            inputRef={inputRef}
            busy={busy}
            quote={quoteText ? { text: quoteText, onClear: () => setSelection(null) } : null}
          />
        </div>
      </div>
    </div>
  );
}
