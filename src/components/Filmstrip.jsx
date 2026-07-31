// 底部缩略图胶片条：点击 = 整页选中（页面级意图入口）
import SlideHtmlView, { SLIDE_W } from './SlideHtmlView';

const THUMB_W = 132;

export default function Filmstrip({ deck, current, selection, onPick }) {
  return (
    <div className="flex h-[104px] flex-none items-center gap-2.5 overflow-x-auto border-t border-ink-06 bg-white px-4">
      {deck.slides.map((s, i) => {
        const active = selection?.slideId === s.id;
        const isCurrent = current === s.id;
        return (
          <div key={s.id} className="flex flex-none cursor-pointer flex-col items-center gap-1" onClick={() => onPick(s.id)}>
            <div
              className="overflow-hidden rounded-md transition-all"
              style={{
                width: THUMB_W, height: THUMB_W * 9 / 16,
                outline: active ? '2px solid #0a6cff' : isCurrent ? '2px solid rgba(13,13,13,.3)' : '1px solid rgba(13,13,13,.08)',
                outlineOffset: 1,
              }}
            >
              <SlideHtmlView slide={s} deck={deck} scale={THUMB_W / SLIDE_W} />
            </div>
            <span className={`text-[10px] ${active ? 'font-semibold text-brand-blue' : 'text-ink-46'}`}>{i + 1}</span>
          </div>
        );
      })}
    </div>
  );
}
