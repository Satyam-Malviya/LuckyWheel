import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { OverlayWheelView } from './components/OverlayWheelView';
import { ScreenSnipStudio } from './components/ScreenSnipStudio';
import './index.css';

const params = new URLSearchParams(window.location.search);
const isOverlay = params.get('overlay') === '1';
const isSnip = params.get('snip') === '1';

if (isOverlay) {
  document.documentElement.classList.add('overlay-mode');
  document.body.classList.add('overlay-mode');
}

const currentDir = params.get('dir') || '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isSnip ? (
      <ScreenSnipStudio
        currentDir={currentDir}
        isStandaloneWindow={true}
        onClose={() => {
          const api = (window as unknown as { orbitAPI?: Record<string, any> }).orbitAPI;
          api?.closeSnipWindow?.();
        }}
      />
    ) : isOverlay ? (
      <OverlayWheelView />
    ) : (
      <App />
    )}
  </React.StrictMode>
);
