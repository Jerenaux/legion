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
