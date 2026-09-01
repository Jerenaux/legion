// apiService.js
import { firebaseAuth } from './firebaseService'; 
import { errorToast } from '../components/utils';
import {getTokenWithRetry} from "./firebaseToken";

const apiBaseUrl = process.env.API_URL;

const TIMEOUT_DURATION = 10000;

export async function getFirebaseIdToken(forceRefresh = false) {
    try {
        const user = firebaseAuth.currentUser;
        if (!user) {
            throw new Error("No authenticated desktop session");
        }
        return await getTokenWithRetry(user, forceRefresh);
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
            let idToken = await getFirebaseIdToken();
            const headers = new Headers(options.headers || {});

            if (options.body && !headers.has('Content-Type')) {
                headers.append('Content-Type', 'application/json');
            } 

            headers.set("Authorization", `Bearer ${idToken}`);
            const body = options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body;

            const fullEndpoint = `${apiBaseUrl}/${endpoint}`;
            if (process.env.NODE_ENV === 'development') {
                // console.log(`Attempt ${attempt + 1} of ${maxRetries}: Calling ${fullEndpoint}`);
            }
            
            let fetchPromise = fetch(fullEndpoint, {
                ...options,
                body,
                headers,
            });

            let response = await Promise.race([
                fetchPromise,
                timeoutPromise(TIMEOUT_DURATION)
            ]) as Response;

            if (response.status === 401) {
                idToken = await getFirebaseIdToken(true);
                headers.set("Authorization", `Bearer ${idToken}`);
                fetchPromise = fetch(fullEndpoint, {...options, body, headers});
                response = await Promise.race([fetchPromise, timeoutPromise(TIMEOUT_DURATION)]) as Response;
            }

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
  const userAgent = navigator.userAgent.toLowerCase();
  
  // First check for generic "bot" pattern
  if (/bot/i.test(userAgent)) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Bot detected via regex with user agent: ${userAgent}`);
    }
    return undefined;
  }

  const botPatterns = [
    // Common bot identifiers
    'crawler', 'spider', 'slurp',
    // Search engine bots
    'googlebot', 'bingbot', 'yandexbot', 'baiduspider',
    // Social media bots
    'facebookexternalhit', 'linkedinbot', 'twitterbot', 
    'slackbot', 'telegrambot', 'whatsapp',
    // SEO/Analytics bots
    'semrushbot', 'ahrefsbot', 'mj12bot',
    // Headless browsers (often used by bots)
    'headless', 'phantomjs', 'puppeteer',
    // Additional patterns
    'crawl', 'index', 'archive', 'facebook',
    // Known libraries/frameworks that might be used for automation
    'selenium', 'webdriver', 'cypress'
  ];

  // Return undefined if it's a bot
  if (botPatterns.some(pattern => userAgent.includes(pattern))) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Bot detected via pattern with user agent: ${userAgent}`);
    }
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
