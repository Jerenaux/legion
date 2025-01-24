import fetch, { Headers } from 'node-fetch';

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

const TIMEOUT_DURATION = 15000;

export async function apiFetch(endpoint, idToken, options: ApiFetchOptions = {}, maxRetries = 1, retryDelay = 250) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const headers = new Headers(options.headers || {});

            if (options.body && !headers.has('Content-Type')) {
                headers.append('Content-Type', 'application/json');
                options.body = JSON.stringify(options.body);
            }

            headers.append("Authorization", `Bearer ${idToken}`);

            const fetchPromise = fetch(`${process.env.API_URL}/${endpoint}`, {
                ...options,
                headers,
            });

            const response = await Promise.race([
                fetchPromise,
                timeoutPromise(TIMEOUT_DURATION)
            ]) as Response;

            if (response.ok) {
                console.log(`[API:apiFetch] API call to ${endpoint} succeeded on attempt ${attempt + 1}`);
            } else {
                const errorBody = await response.text();
                throw new ApiError(`Error ${response.status} from ${endpoint}: ${errorBody}`, response.status, endpoint);
            }

            return response.json();
        } catch (error) {
            console.error(`[API:apiFetch] Attempt ${attempt + 1}/${maxRetries} failed for API call to ${endpoint}:`, error);
            
            if (attempt === maxRetries - 1) {
                throw error;
            }

            // Always retry, regardless of error type
            
            console.log(`Retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}
