import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SidebarApp } from './sidebar/SidebarApp';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Sidebar root element is missing.');

createRoot(rootElement).render(
  <StrictMode>
    <SidebarApp />
  </StrictMode>,
);
