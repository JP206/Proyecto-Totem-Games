import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App'; // Asegúrate que este archivo existe

// ESTO ES CRÍTICO: selecciona el div con id="root"
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('No se encontró el elemento con id="root"');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
