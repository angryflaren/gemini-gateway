// src/hooks/useGoogleAuth.ts

import { useState, useEffect, useCallback } from 'react';
import { config } from '../config';
import { UserProfile } from '../types';

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

export const useGoogleAuth = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    // Функция для получения профиля пользователя после получения токена
    const fetchUserProfile = useCallback(async () => {
        try {
            const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: {
                    'Authorization': `Bearer ${window.gapi.client.getToken().access_token}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch user profile');
            const profile = await response.json();
            setUser({
                id: profile.sub,
                name: profile.name,
                email: profile.email,
                imageUrl: profile.picture,
            });
        } catch (error) {
            console.error("Error fetching user profile:", error);
            setUser(null); // Очищаем пользователя в случае ошибки
        } finally {
            setIsInitialized(true);
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const loadGapiClient = async () => {
            await new Promise((resolve, reject) => {
                if (window.gapi) {
                    window.gapi.load('client', { callback: resolve, onerror: reject });
                } else {
                    reject(new Error("GAPI script not loaded"));
                }
            });
            await window.gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
        };

        loadGapiClient().catch(e => console.error("Error loading GAPI client for Drive:", e));

    }, []);


    const signIn = useCallback(() => {
        setIsLoading(true);
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: config.google.clientId,
            scope: config.google.scope,
            callback: async (tokenResponse: any) => {
                if (tokenResponse.error) {
                    console.error("Token error:", tokenResponse.error);
                    setIsLoading(false);
                    return;
                }
                // Устанавливаем токен для всех последующих запросов GAPI
                window.gapi.client.setToken(tokenResponse);
                await fetchUserProfile();
            },
        });
        tokenClient.requestAccessToken();
    }, [fetchUserProfile]);

    const signOut = useCallback(() => {
        const token = window.gapi.client.getToken();
        if (token) {
            window.google.accounts.oauth2.revoke(token.access_token, () => {
                window.gapi.client.setToken(null);
                setUser(null);
                setIsInitialized(true);
            });
        }
        setUser(null);
    }, []);

    // Проверяем, есть ли активный токен при загрузке
     useEffect(() => {
        // Проверка токена не делается автоматически, как в gapi.auth2
        // Приложение либо запрашивает вход каждый раз, либо сохраняет токен
        // Для простоты, мы считаем пользователя вышедшим из системы при обновлении страницы
        setIsLoading(false);
        setIsInitialized(true);
    }, []);

    return { user, signIn, signOut, isInitialized, isLoading };
};
