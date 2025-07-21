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

// --- Новая, более надежная функция для загрузки скриптов ---
const loadGapiScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Если скрипт уже загружен, не делаем ничего
    if (window.gapi) {
      return resolve();
    }
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load GAPI script.'));
    document.body.appendChild(script);
  });
};


export const useGoogleAuth = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    const fetchUserProfile = useCallback(async (token: string) => {
        try {
            const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { 'Authorization': `Bearer ${token}` }
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
            setUser(null);
        }
    }, []);

    // --- Централизованный useEffect для всей инициализации ---
    useEffect(() => {
        const initialize = async () => {
            setIsLoading(true);
            try {
                // Шаг 1: Загрузить скрипт GAPI и дождаться его готовности
                await loadGapiScript();

                // Шаг 2: Загрузить клиентскую библиотеку GAPI
                await new Promise<void>((resolve, reject) => {
                    window.gapi.load('client', { callback: resolve, onerror: reject });
                });

                // Шаг 3: Инициализировать Drive API клиент
                await window.gapi.client.init({
                    clientId: config.google.clientId,
                    scope: config.google.scope,
                    discoveryDocs: config.google.discoveryDocs,
                });
                
                // Шаг 4: Только теперь вся система готова к работе
                setIsInitialized(true);

            } catch (error) {
                console.error("Critical GAPI initialization failed:", error);
                // В случае ошибки, мы все равно "инициализированы", но в состоянии ошибки
                setIsInitialized(false);
            } finally {
                setIsLoading(false);
            }
        };

        // Запускаем инициализацию только когда GSI клиент готов (из index.html)
        if (window.google) {
            initialize();
        } else {
           // Если GSI еще не загружен, ждем загрузки страницы
           window.onload = () => {
             if(window.google) initialize();
             else console.error("Google Sign-In script (GSI) failed to load.");
           }
        }
    }, []);

    const signIn = useCallback(() => {
        if (!isInitialized || !window.google) {
            console.error("Auth system is not ready.");
            return;
        }

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
                await fetchUserProfile(tokenResponse.access_token);
                setIsLoading(false);
            },
        });
        tokenClient.requestAccessToken();
    }, [isInitialized, fetchUserProfile]);

    const signOut = useCallback(() => {
        const token = window.gapi.client.getToken();
        if (token) {
            window.google.accounts.oauth2.revoke(token.access_token, () => {
                window.gapi.client.setToken(null);
                setUser(null);
            });
        } else {
             setUser(null);
        }
    }, []);

    return { user, signIn, signOut, isInitialized, isLoading };
};
