import '@fontsource-variable/inter/wght.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { captureUrlSecrets } from './lib/url-secrets';
import './index.css';
import './styles/tokens.css';
import './styles/animations.css';
import './styles/globals.css';

// The service worker is registered by vite-plugin-pwa's injected
// /registerSW.js (production builds only), so there is exactly one
// registration path and dev builds do not request a non-existent /sw.js.

// Move reset tokens / invite codes out of the address bar before the app
// makes its first request (see lib/url-secrets).
captureUrlSecrets();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
