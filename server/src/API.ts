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

export async function apiFetch(endpoint, idToken, options: ApiFetchOptions = {}, timeoutDuration = 15000) {
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
            timeoutPromise(timeoutDuration) // Make sure this utility is implemented
        ]) as Response;

        if (!response.ok) {
            const errorBody = await response.text();
            throw new ApiError(`Error ${response.status} from ${endpoint}: ${errorBody}`, response.status, endpoint);
        }

        return response.json();
    } catch (error) {
        console.error(`Error in API call to ${endpoint}:`, error);
        throw error;
    }
}

export async function getRemoteConfig() {
    try {
        const response = await apiFetch('getRemoteConfig', ''); // TODO: API key
        return response;
    } catch (error) {
        console.error('Error fetching remote config:', error);
        return {};
    }
}
