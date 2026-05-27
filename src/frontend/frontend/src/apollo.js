import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { persistCache, LocalStorageWrapper } from 'apollo3-cache-persist';

// Определи URL в зависимости от хоста
const getGraphQLUrl = () => {
    if (typeof window === 'undefined') {
        return 'https://pitifully-holy-turbot.cloudpub.ru/graphql';
    }
    
    const host = window.location.hostname;
    
    // Для локального dev сервера на любом порту
    if (host === 'localhost' || host === '127.0.0.1') {
        return '/graphql'; // Используй прокси из vite.config.js
    }
    
    // Для cloudpub - используй backend cloudpub напрямую
    if (host.includes('cloudpub.ru')) {
        return 'https://pitifully-holy-turbot.cloudpub.ru/graphql';
    }
    
    // Default
    return 'https://pitifully-holy-turbot.cloudpub.ru/graphql';
};

const httpLink = createHttpLink({
    uri: getGraphQLUrl(),
    credentials: 'include',
});

const authLink = setContext((_, { headers }) => {
    const token = localStorage.getItem('jwtToken');
    return {
        headers: {
            ...headers,
            authorization: token ? `Bearer ${token}` : "",
        }
    };
});

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

const link = from([errorLink, authLink, httpLink]);

const cache = new InMemoryCache({
    typePolicies: {
        Task: {
            keyFields: ['id'],
            fields: {
                tags: {
                    merge(_, incoming) { return incoming; }
                },
                assignees: {
                    merge(_, incoming) { return incoming; }
                }
            }
        },
        Query: {
            fields: {
                tasksBySubgroup: {
                    merge(existing = [], incoming = []) {
                        return incoming;
                    }
                },
                tasksByAssigneeAndProject: {
                    merge(existing = [], incoming = []) {
                        return incoming;
                    }
                }
            }
        }
    }
});

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
});

persistCache({
    cache,
    storage: new LocalStorageWrapper(window.localStorage),
    trigger: 'write',
    maxSize: false,
}).catch(error => {
    console.error('Error persisting Apollo cache:', error);
    localStorage.removeItem('apollo-cache-persist');
});
