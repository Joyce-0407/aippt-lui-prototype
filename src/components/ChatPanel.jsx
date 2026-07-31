// 右侧对话区：消息流（用户气泡 / AI 气泡 / ops 卡 / 追问卡 / 引导 chips）+ 上下文输入框
import { useEffect, useRef, useState } from 'react';

export function AiAvatar() {
  return (
    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ background: 'linear-gradient(135deg, #682aef, #9e75f5)' }}>AI</span>
  );
}

function OpsCard({ card, onLocate, onUndo, onRetry }) {
  return (
    <div className="mt-2 rounded-[14px] border p-3" style={{ borderColor: 'rgba(10,108,255,.25)', background: 'linear-gradient(180deg, rgba(10,108,255,.04), #fff)' }}>
      <div className="mb-1 flex items-center gap-1 text-xs text-brand-blue">⚡ 我理解你想：<b>{card.intent}</b></div>
      <div className="text-[13px]">{card.summary}</div>
      {card.done && (
        <>
          <div className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold">✅ 已完成</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-white btn-sm" onClick={() => onLocate(card)}>📍 定位</button>
            <button className="btn-white btn-sm" onClick={() => onUndo(card)}>↩ 撤销</button>
            <button className="btn-white btn-sm text-ink-46" onClick={() => onRetry(card)}>不对？重新理解</button>
          </div>
        </>
      )}
    </div>
  );
}

function ClarifyCard({ clarify, onPick }) {
  return (
    <div className="mt-2 rounded-[14px] border p-3" style={{ borderColor: 'rgba(230,162,60,.4)', background: 'linear-gradient(180deg, rgba(230,162,60,.06), #fff)' }}>
      <div className="mb-2 text-[13px]">🤔 {clarify.question}</div>
      <div className="flex flex-wrap gap-1.5">
        {clarify.options.map((o, i) => (
          <span key={i} className="chip" onClick={() => onPick(o)}>{o.label}</span>
        ))}
      </div>
    </div>
  );
}

export default function ChatPanel({ messages, onSend, onClarifyPick, onOpsLocate, onOpsUndo, onOpsRetry, placeholder, inputRef, busy, quote }) {
  const [text, setText] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const v = text.trim();
    if (!v || busy) return;
    setText('');
    onSend(v);
  };

  return (
    <div className="flex h-full w-[clamp(300px,26vw,380px)] flex-none flex-col border-l border-ink-06 bg-white">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={`msg-in mb-4 flex ${m.from === 'user' ? 'justify-end' : 'items-start gap-2'}`}>
            {m.from === 'ai' && <AiAvatar />}
            <div className={m.from === 'user'
              ? 'max-w-[85%] rounded-[14px] rounded-tr-sm px-3.5 py-2.5 text-[13px] text-white'
              : 'max-w-[92%] rounded-[14px] rounded-tl-sm bg-page px-3.5 py-2.5 text-[13px] leading-relaxed'}
              style={m.from === 'user' ? { background: '#0d0d0d' } : undefined}>
              <span className={m.streaming ? 'type-cursor' : ''}>{m.text}</span>
              {m.chips && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {m.chips.map((c, i) => <span key={i} className="chip" onClick={() => onSend(c.text || c.label)}>{c.label}</span>)}
                </div>
              )}
              {m.card && <OpsCard card={m.card} onLocate={onOpsLocate} onUndo={onOpsUndo} onRetry={onOpsRetry} />}
              {m.clarify && <ClarifyCard clarify={m.clarify} onPick={onClarifyPick} />}
            </div>
          </div>
        ))}
        {busy && (
          <div className="mb-4 flex items-start gap-2">
            <AiAvatar />
            <div className="rounded-[14px] rounded-tl-sm bg-page px-3.5 py-2.5 text-[13px] text-ink-46">正在理解你的指令…</div>
          </div>
        )}
      </div>
      <div className="border-t border-ink-06 p-3">
        {/* Kimi 式引用 chip：钉住当前选中对象，可删除 */}
        {quote && (
          <div className="quote-chip">
            <span className="flex-none text-brand-blue">❝</span>
            <span className="flex-1 truncate">{quote.text}</span>
            <button className="flex-none text-ink-24 transition-colors hover:text-ink" onClick={quote.onClear} title="取消选中">×</button>
          </div>
        )}
        <div className="rounded-[14px] border border-ink-06 p-3 transition-all focus-within:border-brand-blue">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={placeholder}
            rows={2}
            className="w-full resize-none text-[13px] outline-none placeholder:text-ink-24"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-24">@ 技能</span>
            <button className="btn-black btn-sm" onClick={send} disabled={busy}>发送</button>
          </div>
        </div>
      </div>
    </div>
  );
}
