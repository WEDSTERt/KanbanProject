import React, {createContext, useState, useContext, useEffect} from 'react';
import {useQuery, useMutation} from '@apollo/client';
import {GET_CURRENT_USER} from '../graphql/queries';
import {LOGIN, REGISTER, UPDATE_EMAIL_NOTIFICATIONS} from '../graphql/mutations';
import {client} from '../apollo';

const AuthContext = createContext(undefined);

export const AuthProvider = ({children}) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const {data, refetch: refetchUser} = useQuery(GET_CURRENT_USER, {
        skip: !localStorage.getItem('jwtToken'),
        fetchPolicy: 'network-only',
    });
    const [loginMutation] = useMutation(LOGIN);
    const [registerMutation] = useMutation(REGISTER);
    const [updateEmailNotificationsMutation] = useMutation(UPDATE_EMAIL_NOTIFICATIONS);

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
        const {data} = await loginMutation({variables: {email, password}});
        if (data?.login) {
            const {token, user: userData} = data.login;
            localStorage.setItem('jwtToken', token);
            setUser(userData);
            return userData;
        }
        throw new Error('Login failed');
    };

    const register = async (fullName, email, password, turnstileToken) => {
        const {data} = await registerMutation({variables: {fullName, email, password, turnstileToken}});
        if (data?.createUser) {
            const {token, user: userData} = data.createUser;
            localStorage.setItem('jwtToken', token);
            setUser(userData);
            return userData;
        }
        throw new Error('Registration failed');
    };

    const updateEmailNotifications = async (emailNotificationsEnabled) => {
        const {data} = await updateEmailNotificationsMutation({
            variables: {emailNotificationsEnabled}
        });
        if (data?.updateEmailNotifications) {
            // Сохраняем все существующие поля пользователя, обновляем только уведомления
            setUser(prevUser => {
                if (!prevUser) return data.updateEmailNotifications;
                return {
                    ...prevUser,
                    emailNotificationsEnabled: data.updateEmailNotifications.emailNotificationsEnabled
                };
            });
            return data.updateEmailNotifications;
        }
        throw new Error('Failed to update notification settings');
    };

    const logout = () => {
        localStorage.removeItem('jwtToken');
        client.clearStore();
        localStorage.removeItem('apollo-cache-persist');
        setUser(null);
    };

    return (<AuthContext.Provider value={{user, loading, login, register, logout, updateEmailNotifications, refetchUser}}>
        {children}
    </AuthContext.Provider>);
};

export const useAuth = () => useContext(AuthContext);