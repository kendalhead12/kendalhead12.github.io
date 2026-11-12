import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/press-start-2p';
import '@fontsource/vt323';
import './ui/styles.css';
import App from './ui/App';

createRoot(document.getElementById('root')!).render(<App />);
