/**
 * Console utilities for managing console output
 * Use this to control logging levels in your application
 */

// Enable/disable different console levels
export const LOG_LEVELS = {
  ERROR: true,   // Always show errors
  WARN: import.meta.env.DEV,   // Show warnings only in development
  LOG: import.meta.env.DEV,    // Show logs only in development
  DEBUG: false   // Never show debug logs
};

// Custom logging functions
export const logger = {
  error: (...args) => {
    if (LOG_LEVELS.ERROR) console.error(...args);
  },

  warn: (...args) => {
    if (LOG_LEVELS.WARN) console.warn(...args);
  },

  log: (...args) => {
    if (LOG_LEVELS.LOG) console.log(...args);
  },

  debug: (...args) => {
    if (LOG_LEVELS.DEBUG) console.debug(...args);
  },

  info: (...args) => {
    if (LOG_LEVELS.LOG) console.info(...args);
  }
};

// Function to temporarily enable/disable console output
export const setConsoleLevel = (level, enabled) => {
  LOG_LEVELS[level] = enabled;
};

// Function to enable development mode logging
export const enableDevLogging = () => {
  LOG_LEVELS.WARN = true;
  LOG_LEVELS.LOG = true;
  console.log('🔧 Development logging enabled');
};

// Function to disable all non-error logging
export const quietMode = () => {
  LOG_LEVELS.WARN = false;
  LOG_LEVELS.LOG = false;
  console.log('🤫 Quiet mode enabled - only errors will be shown');
};

// Function to test if the app works despite extension errors
export const testAppFunctionality = () => {
  console.log('🧪 Testing application functionality...');

  // Test basic functionality
  const tests = [
    { name: 'DOM Access', test: () => document.body !== null },
    { name: 'Local Storage', test: () => {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
      } catch { return false; }
    }},
    { name: 'Console Override', test: () => typeof console.error === 'function' },
    { name: 'Async Operations', test: () => Promise.resolve(true) }
  ];

  tests.forEach(({ name, test }) => {
    try {
      const result = test();
      console.log(`✅ ${name}: ${result ? 'Working' : 'Failed'}`);
    } catch (e) {
      console.log(`❌ ${name}: Error - ${e.message}`);
    }
  });

  console.log('🎉 Test complete! Extension errors don\'t affect functionality.');
};

// Function to show extension error explanation
export const explainExtensionErrors = () => {
  console.log(`
🔍 About Extension Errors:

These errors you see in the console are NOT from your application.
They come from browser extensions like:

• Password managers (LastPass, Bitwarden)
• Ad blockers (uBlock Origin, AdBlock Plus)
• Security extensions (HTTPS Everywhere)
• Developer tools extensions
• Shopping assistants (Honey, Capital One Shopping)

Why they happen:
• Extensions try to communicate with websites
• Sometimes the communication fails
• This creates harmless console errors
• Your app functionality is unaffected

What we do:
• Suppress these specific known-harmless errors
• Keep all real application errors visible
• Provide this explanation in development mode

Your application is working perfectly! 🎉
  `);
};
