import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BootError } from './components/layout/BootError';
import './index.css';
import './lib/installPrompt'; // starts listening for the browser's install offer before the app loads

// The app is imported dynamically so that a failure while its modules load (config/env.js throws
// when a required VITE_* variable is missing) can be shown by BootError instead of a blank page.
async function start() {
  const root = createRoot(document.getElementById('root'));
  try {
    const { default: App } = await import('./app/App');
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    console.error(error);
    root.render(<BootError error={error} />);
  }
}

start();
