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
    if (LOG_LEVELS.LOG) {
      // console.log removed
    }
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
  // Development logging enabled
};

// Function to disable all non-error logging
export const quietMode = () => {
  LOG_LEVELS.WARN = false;
  LOG_LEVELS.LOG = false;
  // Quiet mode enabled - only errors will be shown
};

// Function to test if the app works despite extension errors
export const testAppFunctionality = () => {
  // Testing application functionality

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
      // Test completed
    } catch (e) {
      // Test failed with error
    }
  });

  // Test complete
};

// Function to show extension error explanation
export const explainExtensionErrors = () => {
  // Extension error explanation functionality removed
};
