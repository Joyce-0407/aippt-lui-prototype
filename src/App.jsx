// Demo 聚焦（v1.5）：打开即进入"生成完成后的编辑页"
// deck = 用户提供的真实生成稿《西安兵马俑》HTML，像素级保真嵌入
import { useEffect, useState } from 'react';
import Editor from './views/Editor';
import { loadHtmlDeck } from './core/htmlDeck';

export default function App() {
  const [deck, setDeck] = useState(null);

  useEffect(() => {
    loadHtmlDeck().then(setDeck);
  }, []);

  if (!deck) {
    return (
      <div className="flex h-full items-center justify-center bg-page">
        <div className="flex items-center gap-3 text-ink-46">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #682aef, #9e75f5)' }}>AI</span>
          正在加载演示文稿…
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <Editor deck0={deck} />
    </div>
  );
}
