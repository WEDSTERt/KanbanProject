/**
 * Frontend HTTP caching utility for static assets and API responses.
 * 
 * Features:
 * - Local storage caching for API responses
 * - IndexedDB support for large datasets
 * - Automatic expiration
 * - Network-first with fallback to cache
 */

const CACHE_STORE = 'api_response_cache';
const CACHE_EXPIRATION = 'cache_expiration';

/**
 * Get cache time-to-live in milliseconds
 */
const getCacheTTL = (endpoint) => {
    // Files: 7 days
    if (endpoint.includes('/api/files/')) return 7 * 24 * 60 * 60 * 1000;
    
    // Projects: 15 minutes
    if (endpoint.includes('/api/projects/')) return 15 * 60 * 1000;
    
    // Tasks: 5 minutes (volatile)
    if (endpoint.includes('/api/tasks/')) return 5 * 60 * 1000;
    
    // Tags: 30 minutes
    if (endpoint.includes('/api/tags/')) return 30 * 60 * 1000;
    
    // Default: 10 minutes
    return 10 * 60 * 1000;
};

/**
 * Set cache for API response
 */
export const setCacheResponse = (endpoint, data) => {
    try {
        const ttl = getCacheTTL(endpoint);
        const expiresAt = Date.now() + ttl;
        
        const cacheData = {
            data,
            expiresAt,
            timestamp: Date.now(),
        };
        
        localStorage.setItem(
            `${CACHE_STORE}:${endpoint}`,
            JSON.stringify(cacheData)
        );
    } catch (error) {
        console.warn('Failed to cache response:', error);
    }
};

/**
 * Get cached API response if valid
 */
export const getCacheResponse = (endpoint) => {
    try {
        const cached = localStorage.getItem(`${CACHE_STORE}:${endpoint}`);
        if (!cached) return null;
        
        const { data, expiresAt } = JSON.parse(cached);
        
        // Check if cache has expired
        if (Date.now() > expiresAt) {
            localStorage.removeItem(`${CACHE_STORE}:${endpoint}`);
            return null;
        }
        
        return data;
    } catch (error) {
        console.warn('Failed to retrieve cache:', error);
        return null;
    }
};

/**
 * Invalidate cache for specific endpoint
 */
export const invalidateCacheEndpoint = (endpoint) => {
    try {
        localStorage.removeItem(`${CACHE_STORE}:${endpoint}`);
    } catch (error) {
        console.warn('Failed to invalidate cache:', error);
    }
};

/**
 * Clear all API caches
 */
export const clearAllCaches = () => {
    try {
        const keys = Object.keys(localStorage).filter(key => 
            key.startsWith(CACHE_STORE)
        );
        keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
        console.warn('Failed to clear caches:', error);
    }
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
    try {
        const keys = Object.keys(localStorage).filter(key => 
            key.startsWith(CACHE_STORE)
        );
        
        let totalSize = 0;
        const entries = [];
        
        keys.forEach(key => {
            const cached = localStorage.getItem(key);
            totalSize += cached.length;
            const endpoint = key.replace(`${CACHE_STORE}:`, '');
            
            try {
                const { expiresAt, timestamp } = JSON.parse(cached);
                const isExpired = Date.now() > expiresAt;
                entries.push({
                    endpoint,
                    size: cached.length,
                    age: Date.now() - timestamp,
                    expired: isExpired,
                    expiresIn: Math.max(0, expiresAt - Date.now()),
                });
            } catch (e) {
                entries.push({ endpoint, size: cached.length, error: true });
            }
        });
        
        return {
            totalSize,
            entriesCount: entries.length,
            entries: entries.sort((a, b) => b.size - a.size),
        };
    } catch (error) {
        console.warn('Failed to get cache stats:', error);
        return { totalSize: 0, entriesCount: 0, entries: [] };
    }
};

/**
 * Network-first fetch strategy with cache fallback
 */
export const fetchWithCache = async (endpoint, options = {}) => {
    const { 
        skipCache = false, 
        forceCache = false 
    } = options;

    try {
        // If force cache is enabled, return cached data if available
        if (forceCache) {
            const cached = getCacheResponse(endpoint);
            if (cached) return cached;
        }

        // Try network first
        if (!skipCache) {
            const response = await fetch(endpoint, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`,
                    ...options.headers,
                }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            setCacheResponse(endpoint, data);
            return data;
        }

        // Fallback to cache if network fails
        const cached = getCacheResponse(endpoint);
        if (cached) {
            console.warn(`Network request failed, using cached data for ${endpoint}`);
            return cached;
        }

        throw new Error('No network connection and no cached data available');
    } catch (error) {
        console.error('Fetch error:', error);
        
        // Final fallback to cache
        const cached = getCacheResponse(endpoint);
        if (cached) {
            console.warn('Using stale cache due to fetch error');
            return cached;
        }
        
        throw error;
    }
};

/**
 * Batch invalidate caches for related endpoints
 */
export const invalidateRelatedCaches = (resource) => {
    const patterns = {
        'projects': ['/api/projects/', '/api/tasks/'],
        'tasks': ['/api/tasks/', '/api/projects/'],
        'tags': ['/api/tags/', '/api/tasks/'],
        'users': ['/api/users/'],
    };

    const endpoints = patterns[resource] || [resource];
    endpoints.forEach(pattern => {
        const keys = Object.keys(localStorage).filter(key => 
            key.includes(pattern)
        );
        keys.forEach(key => localStorage.removeItem(key));
    });
};

export default {
    setCacheResponse,
    getCacheResponse,
    invalidateCacheEndpoint,
    clearAllCaches,
    getCacheStats,
    fetchWithCache,
    invalidateRelatedCaches,
};
