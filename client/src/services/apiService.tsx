// apiService.js
import firebase from 'firebase/compat/app';
import { firebaseAuth } from './firebaseService'; 
import { errorToast, silentErrorToast } from '../components/utils';

const apiBaseUrl = process.env.API_URL;

const TIMEOUT_DURATION = 10000;

const getTokenWithRetry = async (user: firebase.User, maxAttempts = 3, delay = 100) => {
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await user.getIdToken(true);
        } catch (error) {
            lastError = error;
            if (attempt === maxAttempts - 1) {
                console.error(`Failed to get ID token: ${lastError.message}`);
                silentErrorToast('Failed to get ID token, please refresh the page');
                throw lastError;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

async function getUserWithRetry(maxRetries, interval) {
    for (let i = 0; i < maxRetries; i++) {
        // console.log(`Attempt ${i + 1}/${maxRetries} (${interval}ms): Getting current user...`);
        const user = firebaseAuth.currentUser;
        if (user) {
            return user;
        }
        if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    return null;
}

export async function getFirebaseIdToken() {
    try {
        const user = await getUserWithRetry(35, 200);
        if (!user) {
            errorToast('Cannot get ID token, please refresh the page');
            return;
        }
        return await getTokenWithRetry(user);
    } catch (error) {
        throw error;
    }
}

interface ApiFetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
}

class ApiError extends Error {
    status;
    endpoint;

    constructor(message, status, endpoint) {
        super(message);
        this.status = status;
        this.endpoint = endpoint;
    }
}

function timeoutPromise(duration) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error('Request timed out'));
        }, duration);
    });
}

async function apiFetch(endpoint: string, options: ApiFetchOptions = {}, maxRetries = 1, retryDelay = 300, invisibleErrors = true) {
    let lastError: Error | ApiError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const idToken = await getFirebaseIdToken();
            const headers = new Headers(options.headers || {});

            if (options.body && !headers.has('Content-Type')) {
                headers.append('Content-Type', 'application/json');
                options.body = JSON.stringify(options.body);
            } 

            headers.append("Authorization", `Bearer ${idToken}`);

            const fullEndpoint = `${apiBaseUrl}/${endpoint}`;
            if (process.env.NODE_ENV === 'development') {
                // console.log(`Attempt ${attempt + 1} of ${maxRetries}: Calling ${fullEndpoint}`);
            }
            
            const fetchPromise = fetch(fullEndpoint, {
                ...options,
                headers,
            });

            const response = await Promise.race([
                fetchPromise,
                timeoutPromise(TIMEOUT_DURATION)
            ]) as Response;

            if (!response.ok) {
                const errorBody = await response.text();
                throw new ApiError(`Error ${response.status} from ${endpoint}: ${errorBody}`, response.status, endpoint);
            }

            return response.json();
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error(`Attempt ${attempt + 1} failed for API call to ${endpoint}:`, error);
            }
            lastError = error;

            // If it's the last attempt, throw the error
            if (attempt === maxRetries - 1) {
                if (!invisibleErrors) {
                    errorToast(`${error.message}`);
                } else {
                    console.error(`${error.message}`);
                }
                throw error;
            }

            // Always retry, regardless of error type
            if (process.env.NODE_ENV === 'development') {
                console.log(`Retrying in ${retryDelay}ms...`);
            }
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    // This line should never be reached due to the throw in the loop, but TypeScript doesn't know that
    throw lastError;
}

export { apiFetch };

export function generateVisitorId(): string | undefined {
  // Check for common bot/crawler signatures
  const userAgent = navigator.userAgent.toLowerCase();
  const botPatterns = [
    'bot', 'crawler', 'spider', 'slurp', 'baiduspider',
    'yandexbot', 'facebookexternalhit', 'linkedinbot',
    'twitterbot', 'slackbot', 'telegrambot', 'whatsapp',
    'semrushbot', 'ahrefsbot', 'mj12bot', 'bingbot',
    'googlebot', 'headless','facebook'
  ];

  // Return undefined if it's a bot
  if (botPatterns.some(pattern => userAgent.includes(pattern))) {
    return undefined;
  }

  // Try to get existing visitor ID from localStorage
  const existingId = localStorage.getItem('visitorId');
  if (existingId) {
    return existingId;
  }

  // Generate a new visitor ID based on browser information
  const browserInfo = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    // Add a random component to reduce collision probability
    random: Math.random().toString(36).substring(2, 15)
  };

  // Create a hash of the browser info
  const str = JSON.stringify(browserInfo);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to base36 and ensure it's positive
  const visitorId = Math.abs(hash).toString(36);
  
  // Store in localStorage
  localStorage.setItem('visitorId', visitorId);
  
  return visitorId;
}