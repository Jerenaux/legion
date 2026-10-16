import {userError} from '../i18n/core';
import {firebaseAuth} from './firebaseService';
import {silentErrorToast} from '../components/utils';
import {getTokenWithRetry} from './firebaseToken';
import {captureException} from '../telemetry';
import {telemetryConfig} from '../telemetryConfig';

const apiBaseUrl = process.env.API_URL;

export async function getFirebaseIdToken(forceRefresh = false) {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('No authenticated desktop session');
    return getTokenWithRetry(user, forceRefresh);
}

interface ApiFetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    timeoutMs?: number;
    expectedUid?: string;
}

class ApiError extends Error {
    constructor(message: string, public status: number, public endpoint: string) { super(message); }
}

async function apiFetch(endpoint: string, options: ApiFetchOptions = {}, maxRetries = 1, retryDelay = 300, invisibleErrors = true) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const headers = new Headers(options.headers || {});
            if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
            headers.set('X-Store-Build', String(telemetryConfig.storeBuild));
            const {timeoutMs = 30000, expectedUid, ...fetchOptions} = options;
            const body = options.body == null ? undefined : typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
            for (let refresh = 0; refresh < 2; refresh++) {
                headers.set('Authorization', `Bearer ${await getFirebaseIdToken(refresh === 1)}`);
                if (expectedUid && firebaseAuth.currentUser?.uid !== expectedUid) throw new ApiError('No authenticated desktop session', 401, endpoint);
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);
                try {
                    const response = await fetch(`${apiBaseUrl}/${endpoint}`, {...fetchOptions, body, headers, signal: controller.signal});
                    if (response.status === 401 && refresh === 0) {
                        await response.body?.cancel();
                        continue;
                    }
                    // Include response-body decoding in the deadline as well as connection setup.
                    if (!response.ok) throw new ApiError(await response.text(), response.status, endpoint);
                    return await response.json();
                } catch (error) {
                    if (controller.signal.aborted) throw new Error('Request timed out');
                    throw error;
                } finally { clearTimeout(timer); }
            }
        } catch (error) {
            const retryable = !(error instanceof ApiError) || error.status >= 500 || error.status === 429;
            if (!retryable || attempt === maxRetries - 1) {
                if (retryable) {
                    const failure = error instanceof ApiError ? new Error(`API request failed (${error.status})`) : error;
                    captureException(failure, {tags: {operation: 'api', endpoint: endpoint.split(/[?#]/)[0]}});
                }
                if (!invisibleErrors) silentErrorToast(userError(error));
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    throw new Error('Request timed out');
}

const pendingMutations = new Map<string, ReturnType<typeof apiFetch>>();
// Only endpoints with atomic server receipts may be retried after an ambiguous response.
export function apiMutation(endpoint: 'purchaseItem' | 'purchaseCharacter' | 'claimChest' | 'inventoryTransaction', body: Record<string, unknown>) {
    const uid = firebaseAuth.currentUser?.uid;
    if (!uid) return Promise.reject(new Error('No authenticated desktop session'));
    const key = `pendingMutation:${uid}:${endpoint}:${JSON.stringify(body)}`;
    const pending = pendingMutations.get(key);
    if (pending) return pending;
    const run = async () => {
        // Fail before sending if durable storage is unavailable: losing this ID makes retries unsafe.
        const requestId = localStorage.getItem(key) || crypto.randomUUID();
        localStorage.setItem(key, requestId);
        try {
            const result = await apiFetch(endpoint, {method: 'POST', body: {...body, requestId}, timeoutMs: 45000, expectedUid: uid}, 2, 1000);
            localStorage.removeItem(key);
            return result;
        } catch (error) {
            if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) localStorage.removeItem(key);
            throw error;
        }
    };
    const result = run().finally(() => pendingMutations.delete(key));
    pendingMutations.set(key, result);
    return result;
}

export {apiFetch};
