import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

// Suppress Chrome extension errors that are outside of our control
// These errors typically come from user-installed extensions and don't affect app functionality
const suppressChromeExtensionErrors = () => {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const errorString = args.join(' ');
    
    // Filter out known Chrome extension errors
    const suppressedErrors = [
      'The message port closed before a response was received',
      'Unchecked runtime.lastError',
      'Could not establish connection',
      'Receiving end does not exist',
      'Extension context invalidated',
      'Cannot access contents of url "chrome-extension://"',
      'Failed to execute \'postMessage\' on \'DOMWindow\'',
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'ResizeObserver loop completed with undelivered notifications',
      'Error in invocation of tabs.executeScript',
      'Error in invocation of scripting.executeScript',
      'The extensions gallery cannot be scripted',
      'chrome.runtime.connect',
      'chrome.runtime.sendMessage',
      // PDF-specific extension errors
      'PDF.js',
      'PDF Viewer',
      'Adobe Acrobat',
      'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai', // Chrome PDF Viewer
      'chrome-extension://oemmndcbldboiebfnladdacbdfmadadm', // Adobe Acrobat
      'chrome-extension://efaidnbmnnnibpcajpcglclefindmkaj', // Adobe Acrobat Reader
    ];
    
    const shouldSuppress = suppressedErrors.some(error => 
      errorString.includes(error)
    );
    
    if (!shouldSuppress) {
      originalConsoleError.apply(console, args);
    }
  };

  // Also handle unhandled promise rejections related to extensions
  window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || event.reason?.toString() || '';
    
    const suppressedRejectionPatterns = [
      'message port closed',
      'Extension context',
      'chrome-extension://',
      'Could not establish connection',
      'Receiving end does not exist',
      'Unchecked runtime.lastError',
      'chrome.runtime.connect',
      'chrome.runtime.sendMessage',
      'scripting.executeScript',
    ];
    
    const shouldSuppress = suppressedRejectionPatterns.some(pattern => 
      errorMessage.includes(pattern)
    );
    
    if (shouldSuppress) {
      event.preventDefault();
    }
  });

  // Handle runtime errors related to Chrome extensions
  window.addEventListener('error', (event) => {
    const errorMessage = event.message || event.error?.message || '';
    const errorSource = event.filename || '';
    
    const suppressedErrorPatterns = [
      'Could not establish connection',
      'Receiving end does not exist',
      'Unchecked runtime.lastError',
      'Extension context invalidated',
      'chrome-extension://',
      'chrome.runtime',
    ];
    
    const shouldSuppress = suppressedErrorPatterns.some(pattern => 
      errorMessage.includes(pattern) || errorSource.includes(pattern)
    );
    
    if (shouldSuppress) {
      event.preventDefault();
      return true; // Prevent default error handling
    }
  });
};

// Apply error suppression
suppressChromeExtensionErrors();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)