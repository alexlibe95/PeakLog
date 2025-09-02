import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
export const functions = getFunctions(app, 'us-central1');

// Environment-based logging (set to false in production to reduce noise)
const IS_DEVELOPMENT = import.meta.env.DEV;

// Browser extension error handling
// Note: These errors are from external extensions and cannot be "fixed" in our code
// They don't affect application functionality, so we suppress them for cleaner console
if (typeof window !== 'undefined') {
  // Only run in browser environment
  const originalConsoleError = console.error;

  console.error = (...args) => {
    const errorMessage = args.join(' ');

    // List of known extension-related errors that are harmless
    const harmlessErrors = [
      'Unchecked runtime.lastError',
      'The message port closed before a response was received',
      'Extension context invalidated',
      'chrome-extension://',
      'net::ERR_BLOCKED_BY_CLIENT',
      'Non-Error promise rejection captured'
    ];

    // Check if this is a harmless extension error
    const isHarmless = harmlessErrors.some(pattern => errorMessage.includes(pattern));

    if (isHarmless) {
      // In development, log these once with explanation
      if (IS_DEVELOPMENT && !window.extensionErrorsLogged) {
        window.extensionErrorsLogged = true;
        originalConsoleError(
          '🔧 Extension-related errors detected and suppressed.\n' +
          'These are harmless and come from browser extensions (password managers, ad blockers, etc.)\n' +
          'They don\'t affect your application functionality.'
        );
      }
      return; // Suppress the error
    }

    // Show all legitimate application errors
    originalConsoleError.apply(console, args);
  };

  // Reduce console noise in production for warnings and logs
  if (!IS_DEVELOPMENT) {
    const originalConsoleWarn = console.warn;
    // const originalConsoleLog = console.log;

    console.warn = (...args) => {
      const message = args.join(' ');
      // Only show important warnings in production
      if (
        message.includes('Firebase') ||
        message.includes('Error') ||
        message.includes('Failed') ||
        message.includes('Auth')
      ) {
        originalConsoleWarn.apply(console, args);
      }
    };

    // console.log override removed
  }
}

export default app;