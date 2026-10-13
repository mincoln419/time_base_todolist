import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installWriteDedupe } from './api/dedupeWrites';
import './index.css';

// 저장 버튼 연속 클릭으로 같은 요청이 두 번 저장되지 않도록 모든 쓰기 요청을 한 곳에서 거른다
installWriteDedupe();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
