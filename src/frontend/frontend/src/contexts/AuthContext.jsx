import React, { createContext, useState, useContext, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_CURRENT_USER } from '../graphql/queries';
import { LOGIN, REGISTER } from '../graphql/mutations';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const { data, refetch } = useQuery(GET_CURRENT_USER, {
        skip: !localStorage.getItem('jwtToken'),
        fetchPolicy: 'network-only',
    });
    const [loginMutation] = useMutation(LOGIN);
    const [registerMutation] = useMutation(REGISTER);

    useEffect(() => {
        if (data !== undefined) {
            if (data?.me) {
                setUser(data.me);
            } else {
                setUser(null);
            }
            setLoading(false);
        }
    }, [data]);

    useEffect(() => {
        const token = localStorage.getItem('jwtToken');
        if (!token) {
            setLoading(false);
        }
    }, []);

    const login = async (email, password) => {
        const { data } = await loginMutation({ variables: { email, password } });
        if (data?.login) {
            const { token, user: userData } = data.login;
            localStorage.setItem('jwtToken', token);
            setUser(userData); // сразу устанавливаем пользователя
            return userData;
        }
        throw new Error('Login failed');
    };

    const register = async (fullName, email, password) => {
        const { data } = await registerMutation({ variables: { fullName, email, password } });
        if (data?.createUser) {
            const { token, user: userData } = data.createUser;
            localStorage.setItem('jwtToken', token);
            setUser(userData);
            return userData;
        }
        throw new Error('Registration failed');
    };

    const logout = () => {
        localStorage.removeItem('jwtToken');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);