import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { restoreMissingReneaLocalStorage, startReneaStorageMirror } from './utils/resilientStorage';

const startApplication = async () => {
  await restoreMissingReneaLocalStorage();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  startReneaStorageMirror();
};

void startApplication();
