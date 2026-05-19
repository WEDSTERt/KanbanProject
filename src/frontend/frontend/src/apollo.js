import {ApolloClient, InMemoryCache, createHttpLink} from '@apollo/client';
import {setContext} from '@apollo/client/link/context';
import { persistCache, LocalStorageWrapper } from 'apollo3-cache-persist';

const graphqlUri = import.meta.env.VITE_GRAPHQL_URL || '/graphql';

const httpLink = createHttpLink({uri: graphqlUri});

const authLink = setContext((_, {headers}) => {
    const token = localStorage.getItem('jwtToken');
    return {
        headers: {
            ...headers,
            authorization: token ? `Bearer ${token}` : '',
        },
    };
});

const cache = new InMemoryCache({
    typePolicies: {
        Query: {
            fields: {
                tasksBySubgroup: {
                    merge(existing = [], incoming, { args }) {
                        // Кэшируем отдельно для каждой подгруппы
                        return incoming;
                    }
                },
                taskSubTasks: {
                    merge(existing = [], incoming) {
                        return incoming;
                    }
                },
                tasksByIds: {
                    merge(existing = [], incoming) {
                        return incoming;
                    }
                }
            }
        },
        Task: {
            keyFields: ['id'],
            fields: {
                subTasks: {
                    merge(existing = [], incoming) {
                        return incoming;
                    }
                }
            }
        }
    }
});

// Асинхронное восстановление кэша из localStorage
await persistCache({
    cache,
    storage: new LocalStorageWrapper(window.localStorage),
    maxSize: 5242880, // 5MB (ограничение localStorage)
    debug: process.env.NODE_ENV === 'development',
});

export const client = new ApolloClient({
    link: authLink.concat(httpLink),
    cache,
});