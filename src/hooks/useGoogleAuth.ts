// src/hooks/useGoogleAuth.ts
import { useState, useEffect, useCallback } from 'react';
import { config } from '../config';
import { UserProfile } from '../types';

declare global {
  interface Window {
    google: any;
    gapi: any;
    tokenClient: any;
  }
}

const GAPI_SCRIPT_URL = 'https://apis.google.com/js/api.js';
const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const SESSION_STORAGE_KEY = 'google-auth-token';

// --- Утилиты для загрузки скриптов ---

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
};

// --- Основной хук ---

export const useGoogleAuth = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUserProfile = useCallback(async (token: string) => {
        try {
            const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch user profile.');
            const profile = await response.json();
            setUser({
                id: profile.sub,
                name: profile.name,
                email: profile.email,
                imageUrl: profile.picture,
            });
        } catch (error) {
            console.error("Error fetching user profile:", error);
            // Если профиль не удалось получить, сбрасываем сессию
            signOut();
        }
    }, []);

    const signOut = useCallback(() => {
        const storedToken = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (storedToken) {
            const tokenData = JSON.parse(storedToken);
            if (tokenData.access_token) {
                window.google?.accounts.oauth2.revoke(tokenData.access_token, () => {});
            }
        }
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        if (window.gapi?.client) window.gapi.client.setToken(null);
        setUser(null);
    }, []);


    useEffect(() => {
        const initialize = async () => {
            try {
                // Загружаем оба скрипта параллельно
                await Promise.all([loadScript(GSI_SCRIPT_URL), loadScript(GAPI_SCRIPT_URL)]);

                // Дожидаемся готовности GAPI клиента
                await new Promise<void>((resolve) => window.gapi.load('client', resolve));

                await window.gapi.client.init({
                    discoveryDocs: config.google.discoveryDocs,
                });

                window.tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: config.google.clientId,
                    scope: config.google.scope,
                    callback: async (tokenResponse: any) => {
                        if (tokenResponse.error) {
                             console.error("OAuth Error:", tokenResponse.error);
                             signOut(); // Очищаем всё в случае ошибки
                             return;
                        }
                        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(tokenResponse));
                        window.gapi.client.setToken(tokenResponse);
                        await fetchUserProfile(tokenResponse.access_token);
                        setIsLoading(false);
                    },
                });

                // Проверяем наличие токена в sessionStorage при загрузке
                const storedToken = sessionStorage.getItem(SESSION_STORAGE_KEY);
                if (storedToken) {
                    const tokenData = JSON.parse(storedToken);
                    // Проверяем, не истек ли токен (хотя GIS обычно сам его обновляет)
                    if (tokenData.expires_in > 0) {
                         window.gapi.client.setToken(tokenData);
                         await fetchUserProfile(tokenData.access_token);
                    } else {
                        // Токен истек, чистим
                        signOut();
                    }
                }
                
                setIsInitialized(true);
            } catch (error) {
                console.error("Google Auth initialization failed:", error);
            } finally {
                setIsLoading(false);
            }
        };

        initialize();
    }, [fetchUserProfile, signOut]);

    const signIn = useCallback(() => {
        if (!isInitialized || !window.tokenClient) {
            console.error("Auth system not ready.");
            return;
        }
        setIsLoading(true);
        window.tokenClient.requestAccessToken({ prompt: 'consent' });
    }, [isInitialized]);

    return { user, signIn, signOut, isInitialized, isLoading };
};
