/**
 * Fetch Request Instance Wrapper
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface RequestOptions extends RequestInit {
    params?: Record<string, string>;
    data?: any;
}

class RequestClient {
    private baseURL: string;

    constructor(baseURL: string) {
        this.baseURL = baseURL;
    }

    private async request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
        const { params, data, ...rest } = options;

        // 1. Handle Query Params
        let queryString = '';
        if (params) {
            const searchParams = new URLSearchParams(params);
            queryString = `?${searchParams.toString()}`;
        }

        const fullUrl = `${this.baseURL}${url}${queryString}`;

        // 2. Handle Body and Headers
        const headers = new Headers(rest.headers);
        let body = rest.body;

        if (data && !body) {
            headers.set('Content-Type', 'application/json');
            body = JSON.stringify(data);
        }

        // 3. Execution
        try {
            const response = await fetch(fullUrl, {
                ...rest,
                headers,
                body,
            });

            // 4. Response Interception / Handling
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Request failed with status ${response.status}`);
            }

            // For 204 No Content
            if (response.status === 204) {
                return {} as T;
            }

            return await response.json();
        } catch (error) {
            console.error('[Request Error]:', error);
            throw error;
        }
    }

    get<T = any>(url: string, params?: Record<string, string>, options?: RequestInit) {
        return this.request<T>(url, { ...options, method: 'GET', params });
    }

    post<T = any>(url: string, data?: any, options?: RequestInit) {
        return this.request<T>(url, { ...options, method: 'POST', data });
    }

    put<T = any>(url: string, data?: any, options?: RequestInit) {
        return this.request<T>(url, { ...options, method: 'PUT', data });
    }

    delete<T = any>(url: string, params?: Record<string, string>, options?: RequestInit) {
        return this.request<T>(url, { ...options, method: 'DELETE', params });
    }
}

const request = new RequestClient(BASE_URL);

export default request;
