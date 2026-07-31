import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 注：不使用 StrictMode —— 其开发模式双调用 effect 会导致欢迎消息/生成计时器重复
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
