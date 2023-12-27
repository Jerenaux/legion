// apiService.js
import { firebaseAuth } from './firebaseService'; 

const apiBaseUrl = process.env.PREACT_APP_API_URL;

async function getFirebaseIdToken() {
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

async function apiFetch(endpoint, options: ApiFetchOptions = {}) {
    try {
        const idToken = await getFirebaseIdToken();
        const headers = new Headers(options.headers || {});

        // Automatically set 'Content-Type' to 'application/json' if there is a body
        if (options.body && !headers.has('Content-Type')) {
            headers.append('Content-Type', 'application/json');
            options.body = JSON.stringify(options.body); // Stringify the body if it's an object
        }

        headers.append("Authorization", `Bearer ${idToken}`);

        const response = await fetch(`${apiBaseUrl}/${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorInfo = await response.json();
            throw new Error(errorInfo.message || "API request failed");
        }

        return response.json();
    } catch (error) {
        console.error(`Error in API call to ${endpoint}:`, error);
        throw error;
    }
}

export { apiFetch };
