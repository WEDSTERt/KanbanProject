import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';

/**
 * Apollo Client конфигурация для подключения к GraphQL серверу
 */

// Получить токен из localStorage
const getToken = (): string | null => {
  return localStorage.getItem('authToken');
};

// Auth Link - добавляет JWT токен в заголовки
const authLink = new ApolloLink((operation, forward) => {
  const token = getToken();

  operation.setContext({
    headers: {
      authorization: token ? `Bearer ${token}` : '',
    },
  });

  return forward(operation);
});

// HTTP Link - подключение к GraphQL серверу
const httpLink = new HttpLink({
  uri: process.env.REACT_APP_GRAPHQL_URL || 'http://localhost:8080/graphql',
  credentials: 'include', // Отправлять cookies
});

// Объединить links
const link = authLink.concat(httpLink);

// Apollo Client
const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
    query: {
      fetchPolicy: 'cache-first',
    },
  },
});

export default client;
