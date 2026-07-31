// 修改历史抽屉：从预览区右缘滑出，每步可单独回滚
export default function HistoryDrawer({ entries, currentIdx, onRollback, onClose }) {
  return (
    <div className="drawer-in absolute bottom-3 right-3 top-3 z-30 flex w-[250px] flex-col rounded-[14px] bg-white p-3.5"
      style={{ boxShadow: '0 10px 40px rgba(13,13,13,.18)' }}>
      <div className="mb-1 flex items-center justify-between">
        <h5 className="text-[13px] font-semibold">修改历史</h5>
        <button className="text-ink-46 hover:text-ink" onClick={onClose}>✕</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {[...entries].map((e, i) => ({ ...e, idx: i })).reverse().map((e) => (
          <div key={e.idx} className={`flex items-center gap-2 border-b border-dashed border-ink-06 py-2.5 text-xs ${e.idx === currentIdx ? 'font-semibold' : ''}`}>
            <span className="flex-none text-ink-24">{e.time}</span>
            <span className="flex-1">{e.label}</span>
            {e.idx > 0 && e.idx !== currentIdx && (
              <span className="flex-none cursor-pointer text-brand-blue hover:underline" onClick={() => onRollback(e.idx)}>回滚</span>
            )}
            {e.idx === currentIdx && <span className="flex-none text-ink-24">当前</span>}
          </div>
        ))}
      </div>
      <div className="pt-2 text-[11px] text-ink-24">「生成完成」为基线快照，不可删除</div>
    </div>
  );
}
