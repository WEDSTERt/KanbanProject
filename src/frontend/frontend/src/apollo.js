import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { persistCache, LocalStorageWrapper } from 'apollo3-cache-persist';
import { createMonitoringLink, queryMonitor } from './utils/queryPerformanceMonitor';

// ==================== GRAPHQL URL RESOLUTION ====================
const getGraphQLUrl = () => {
    if (typeof window === 'undefined') {
        return 'https://pitifully-holy-turbot.cloudpub.ru/graphql';
    }
    
    const host = window.location.hostname;
    
    // Local development
    if (host === 'localhost' || host === '127.0.0.1') {
        return '/graphql';
    }
    
    // Production (cloudpub)
    if (host.includes('cloudpub.ru')) {
        return 'https://pitifully-holy-turbot.cloudpub.ru/graphql';
    }
    
    return 'https://pitifully-holy-turbot.cloudpub.ru/graphql';
};

// ==================== HTTP LINK CONFIGURATION ====================
const httpLink = createHttpLink({
    uri: getGraphQLUrl(),
    credentials: 'include',
    batchInterval: 10,
    batchMax: 5,
});

// ==================== AUTHENTICATION LINK ====================
const authLink = setContext((_, { headers }) => {
    const token = localStorage.getItem('jwtToken');
    return {
        headers: {
            ...headers,
            authorization: token ? `Bearer ${token}` : "",
        }
    };
});

// ==================== ERROR HANDLING ====================
const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors) {
        graphQLErrors.forEach(({ message, locations, path }) => {
            console.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`);
        });
    }
    if (networkError) {
        console.error(`[Network error]: ${networkError}`);
    }
});

// ==================== PERFORMANCE MONITORING ====================
const monitoringLink = createMonitoringLink();

// Link composition: monitoring → error → auth → http
const link = from([monitoringLink, errorLink, authLink, httpLink]);

// ==================== APOLLO CACHE CONFIGURATION ====================
const cache = new InMemoryCache({
    typePolicies: {
        Query: {
            fields: {
                tasksBySubgroup: {
                    merge(existing = [], incoming = []) {
                        return incoming;
                    }
                },
                tasksBySubgroupLite: {
                    merge(existing = [], incoming = []) {
                        return incoming;
                    }
                },
                tasksByAssigneeAndProject: {
                    merge(existing = [], incoming = []) {
                        return incoming;
                    }
                },
                tasksByAssigneeAndProjectLite: {
                    merge(existing = [], incoming = []) {
                        return incoming;
                    }
                },
                currentUser: {
                    merge(existing, incoming) {
                        return { ...existing, ...incoming };
                    }
                },
                projectMembers: {
                    merge(existing = [], incoming = []) {
                        return incoming;
                    }
                },
            }
        },
        Task: {
            keyFields: ['id'],
            fields: {
                tags: {
                    merge(existing = [], incoming = []) {
                        return incoming.length ? incoming : existing;
                    }
                },
                assignees: {
                    merge(existing = [], incoming = []) {
                        return incoming.length ? incoming : existing;
                    }
                },
                attachments: {
                    merge(existing = [], incoming = []) {
                        return incoming.length ? incoming : existing;
                    }
                }
            }
        },
        Project: {
            keyFields: ['id'],
            fields: {
                members: {
                    merge(existing = [], incoming = []) {
                        return incoming.length ? incoming : existing;
                    }
                }
            }
        },
        Subgroup: {
            keyFields: ['id'],
        }
    }
});

// ==================== APOLLO CLIENT INITIALIZATION ====================
export const client = new ApolloClient({
    link,
    cache,
    defaultOptions: {
        watchQuery: {
            fetchPolicy: 'cache-and-network',
            nextFetchPolicy: 'cache-first',
            errorPolicy: 'all',
        },
        query: {
            fetchPolicy: 'cache-first',
            errorPolicy: 'all',
        },
        mutate: {
            errorPolicy: 'all',
        },
    },
    devtools: {
        enabled: true,
    },
});

// ==================== CACHE PERSISTENCE ====================
localStorage.removeItem('apollo-cache-persist');

persistCache({
    cache,
    storage: new LocalStorageWrapper(window.localStorage),
    trigger: 'write',
    maxSize: false,
    key: 'apollo-cache-persist',
    serialize: true,
}).catch(error => {
    console.error('Error persisting Apollo cache:', error);
    localStorage.removeItem('apollo-cache-persist');
});

// ==================== CACHE UTILITIES ====================
export const invalidateCache = (typeName, id = null) => {
    if (id) {
        cache.evict({ id: cache.identify({ __typename: typeName, id }) });
    } else {
        cache.evict({ id: 'ROOT_QUERY' });
    }
    cache.gc();
};

export const clearCache = () => {
    cache.reset();
    localStorage.removeItem('apollo-cache-persist');
};

export const getCacheStats = () => {
    return {
        size: JSON.stringify(cache.data.data).length,
        entries: Object.keys(cache.data.data).length,
    };
};

// ==================== PERFORMANCE MONITORING UTILITIES ====================
/**
 * Получить отчет о производительности запросов
 */
export const getQueryPerformanceReport = () => {
    return queryMonitor.getReport();
};

/**
 * Вывести красивый отчет в консоль
 */
export const printQueryReport = () => {
    queryMonitor.printReport();
};

/**
 * Получить статистику кэша
 */
export const getQueryCacheStats = () => {
    return queryMonitor.getCacheStats();
};

/**
 * Сбросить статистику производительности
 */
export const resetQueryStats = () => {
    queryMonitor.reset();
};

// Глобально доступно в консоли для отладки
if (typeof window !== 'undefined') {
    window.__graphqlStats = {
        report: () => queryMonitor.getReport(),
        print: () => queryMonitor.printReport(),
        cache: () => queryMonitor.getCacheStats(),
        reset: () => queryMonitor.reset(),
    };
}
