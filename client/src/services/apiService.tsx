// apiService.js
import firebase from 'firebase/compat/app';
import { firebaseAuth } from './firebaseService'; 

const apiBaseUrl = process.env.API_URL;

const getTokenWithRetry = async (user: firebase.User, maxAttempts = 3, delay = 100) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await user.getIdToken(true);
        } catch (error) {
            if (attempt === maxAttempts - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

export async function getFirebaseIdToken() {
    try {
        const user = firebaseAuth.currentUser;
        if (!user) {
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

async function apiFetch(endpoint, options: ApiFetchOptions = {}, timeoutDuration = 15000, maxRetries = 3, retryDelay = 250) {
    let lastError;

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
                console.log(`Attempt ${attempt + 1} of ${maxRetries}: Calling ${fullEndpoint}`);
            }
            
            const fetchPromise = fetch(fullEndpoint, {
                ...options,
                headers,
            });

            const response = await Promise.race([
                fetchPromise,
                timeoutPromise(timeoutDuration)
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