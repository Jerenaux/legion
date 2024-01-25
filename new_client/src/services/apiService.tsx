// apiService.js
import { firebaseAuth } from './firebaseService'; 

const apiBaseUrl = process.env.API_URL;

export async function getFirebaseIdToken() {
    try {
        const user = firebaseAuth.currentUser;
        if (!user) throw new Error("No authenticated user found");
        return await user.getIdToken(true);
    } catch (error) {
        console.error("Error getting Firebase ID token", error);
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

async function apiFetch(endpoint, options: ApiFetchOptions = {}, timeoutDuration = 10000) {
    try {
        const idToken = await getFirebaseIdToken();
        const headers = new Headers(options.headers || {});

        // Automatically set 'Content-Type' to 'application/json' if there is a body
        if (options.body && !headers.has('Content-Type')) {
            headers.append('Content-Type', 'application/json');
            options.body = JSON.stringify(options.body); // Stringify the body if it's an object
        }

        headers.append("Authorization", `Bearer ${idToken}`);

        const fetchPromise = fetch(`${apiBaseUrl}/${endpoint}`, {
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
        console.error(`Error in API call to ${endpoint}:`, error);
        throw error;
    }
}

export { apiFetch };
