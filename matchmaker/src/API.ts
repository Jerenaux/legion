interface ApiFetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
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
    return new Promise((_resolve, reject) => {
        setTimeout(() => {
            reject(new Error('Request timed out'));
        }, duration);
    });
}

export function createApiHeaders(
    initialHeaders: Record<string, string>,
    idToken: string,
    apiKey: string | undefined,
): Headers {
    const headers = new Headers(initialHeaders);
    if (idToken) {
        headers.set("Authorization", `Bearer ${idToken}`);
    } else if (apiKey) {
        headers.set("x-api-key", apiKey);
    }
    return headers;
}

export async function apiFetch(endpoint, idToken, options: ApiFetchOptions = {}, timeoutDuration = 10000) {
    try {
        const headers = createApiHeaders(options.headers || {}, idToken, process.env.API_KEY);

        if (options.body && !headers.has('Content-Type')) {
            headers.append('Content-Type', 'application/json');
        }

        const body = options.body == null ? undefined : typeof options.body === "string" ? options.body : JSON.stringify(options.body);

        const fetchPromise = fetch(`${process.env.API_URL}/${endpoint}`, {
            ...options,
            body,
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
