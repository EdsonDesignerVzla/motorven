import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { NotificationProvider } from './context/NotificationContext';
import ModuleErrorBoundary from './components/ModuleErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ModuleErrorBoundary moduleName="SIGNUM MOTORVEN">
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </ModuleErrorBoundary>
  </React.StrictMode>,
);
