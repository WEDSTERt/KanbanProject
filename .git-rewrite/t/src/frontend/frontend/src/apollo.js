import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { persistCache, LocalStorageWrapper } from 'apollo3-cache-persist';

const httpLink = createHttpLink({
    uri: import.meta.env.VITE_GRAPHQL_URL || '/graphql',
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

// Создаём клиент синхронно
export const client = new ApolloClient({
    link: from([errorLink, authLink, httpLink]),
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

// Асинхронная инициализация персистенции кэша (не блокирует рендеринг)
persistCache({
    cache,
    storage: new LocalStorageWrapper(window.localStorage),
    trigger: 'write',
    maxSize: false,
}).catch(error => {
    console.error('Error persisting Apollo cache:', error);
    localStorage.removeItem('apollo-cache-persist');
});