import React, { useEffect } from 'react';import { createRoot } from 'react-dom/client';
import Dashboard from './components/dashboard';

const App = () => {
  useEffect(() => {
    document.title = 'Legion Dashboard';
  }, []);

  return (
    <div>
      <Dashboard />
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}