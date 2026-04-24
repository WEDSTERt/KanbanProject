import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const graphqlUri = import.meta.env.VITE_GRAPHQL_URL || '/graphql';

const httpLink = createHttpLink({ uri: graphqlUri });

const authLink = setContext((_, { headers }) => {
    const token = localStorage.getItem('jwtToken');
    return {
        headers: {
            ...headers,
            authorization: token ? `Bearer ${token}` : '',
        },
    };
});

export const client = new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
});