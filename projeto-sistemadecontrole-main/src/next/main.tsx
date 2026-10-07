import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { NextApp } from './app/App';
import { NextAppProviders } from './app/providers';
import './styles/index.css';
import '@fontsource-variable/outfit';

createRoot(document.getElementById('next-root')!).render(
  <StrictMode>
    <NextAppProviders>
      <NextApp />
    </NextAppProviders>
  </StrictMode>,
);
