import React from 'react';
import { createRoot } from 'react-dom/client';
import './preview.css';
import UsuariosTab from '../src/components/UsuariosTab';

createRoot(document.getElementById('app-root')!).render(
  <div id="main-tab-viewport" style={{ padding: 28, background: '#fff', minHeight: '100vh' }}>
    <UsuariosTab />
  </div>,
);
