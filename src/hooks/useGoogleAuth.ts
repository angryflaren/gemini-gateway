// src/hooks/useGoogleAuth.ts
import { useState, useEffect, useCallback } from 'react';
import { config } from '../config';
import { UserProfile } from '../types';

declare global {
  interface Window {
    google: any;
    gapi: any;
    tokenClient: any; // Добавляем для хранения token клиента
  }
}

// Новая, более надежная функция для загрузки скрипта GAPI
const loadGapiScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Если скрипт уже загружен, не делаем ничего
    if (document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
      // Даже если скрипт есть, gapi может быть еще не готов
      const checkGapi = () => {
        if (window.gapi && window.gapi.client) {
          resolve();
        } else {
          setTimeout(checkGapi, 100);
        }
      };
      checkGapi();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
       // После загрузки скрипта нужно загрузить сам клиент
       window.gapi.load('client', () => resolve());
    };
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

    // Централизованный useEffect для всей инициализации
    useEffect(() => {
        const initialize = async () => {
            setIsLoading(true);
            try {
                // Шаг 1: Убедиться, что скрипт GSI из index.html загружен
                if (!window.google) {
                    throw new Error("Google Identity Services (GSI) script not loaded.");
                }

                // Шаг 2: Загрузить скрипт GAPI и дождаться его готовности
                await loadGapiScript();

                // Шаг 3: Инициализировать Drive API клиент, но без аутентификации
                await window.gapi.client.init({
                    // clientId БОЛЬШЕ НЕ НУЖЕН ЗДЕСЬ
                    apiKey: undefined, // API Key не нужен для Drive API, но может понадобиться для других
                    discoveryDocs: config.google.discoveryDocs,
                });
                
                // Шаг 4: Инициализировать клиент получения токена из GIS
                window.tokenClient = window.google.accounts.oauth2.initTokenClient({
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

                // Шаг 5: Только теперь вся система готова к работе
                setIsInitialized(true);

            } catch (error) {
                console.error("Critical GAPI/GIS initialization failed:", error);
                setIsInitialized(false); // Явно указываем на сбой
            } finally {
                setIsLoading(false);
            }
        };

        // Запускаем инициализацию, когда скрипт GSI готов (он загружается асинхронно)
        if (window.google) {
            initialize();
        } else {
           // Если GSI еще не загружен, добавляем колбэк в его загрузчик
           const gsiScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
           if (gsiScript) {
             gsiScript.onload = () => initialize();
           } else {
             console.error("Could not find the Google Sign-In script (GSI) in the document.");
             setIsLoading(false);
           }
        }
    }, [fetchUserProfile]);

    const signIn = useCallback(() => {
        if (!isInitialized || !window.tokenClient) {
            console.error("Auth system is not ready or token client is not initialized.");
            alert("Authentication service is not ready, please try again in a moment.");
            return;
        }
        setIsLoading(true);
        // Запрашиваем токен. Коллбэк, определенный в useEffect, обработает результат.
        window.tokenClient.requestAccessToken();
    }, [isInitialized]);

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
