import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OverlayApp } from './sidebar/OverlayApp';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Overlay root element is missing.');

createRoot(rootElement).render(
  <StrictMode>
    <OverlayApp />
  </StrictMode>,
);
