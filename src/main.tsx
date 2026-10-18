import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { OverlayWheelView } from './components/OverlayWheelView';
import './index.css';

const isOverlay = window.location.search.includes('overlay=1');
if (isOverlay) {
  document.documentElement.classList.add('overlay-mode');
  document.body.classList.add('overlay-mode');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isOverlay ? <OverlayWheelView /> : <App />}
  </React.StrictMode>
);
