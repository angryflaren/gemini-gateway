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

// Утилита для загрузки скрипта GAPI
const loadGapiScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
      // Если скрипт уже есть, дожидаемся готовности gapi.client
      const interval = setInterval(() => {
        if (window.gapi?.client) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
       // После загрузки скрипта нужно явно загрузить сам "client" модуль.
       window.gapi.load('client', resolve);
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

    useEffect(() => {
        const initializeAuth = async () => {
            setIsLoading(true);
            try {
                // Шаг 1: Дожидаемся загрузки скрипта Google Identity Services (GSI) из index.html
                if (!window.google) {
                    console.error("Google Identity Services (GSI) script not loaded.");
                    // Можно добавить таймаут или обработчик, если скрипт не загрузился
                    return;
                }

                // Шаг 2: Параллельно загружаем Google API Client (GAPI)
                await loadGapiScript();

                // Шаг 3: Инициализируем GAPI клиент.
                // БЕЗ clientId. GAPI теперь отвечает только за вызовы API, не за аутентификацию.
                await window.gapi.client.init({
                    apiKey: undefined, // API Key не требуется для Google Drive API
                    discoveryDocs: config.google.discoveryDocs,
                });
                
                // Шаг 4: Инициализируем GSI Token Client, который будет запрашивать токен.
                window.tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: config.google.clientId,
                    scope: config.google.scope,
                    callback: async (tokenResponse: any) => {
                        setIsLoading(true); // Начинаем загрузку при получении ответа
                        if (tokenResponse.error) {
                            console.error("OAuth Token Error:", tokenResponse.error, tokenResponse.error_description);
                            alert(`Authentication failed: ${tokenResponse.error_description || tokenResponse.error}`);
                            setUser(null);
                            setIsLoading(false);
                            return;
                        }
                        // Устанавливаем полученный токен в GAPI-клиент для всех последующих запросов
                        window.gapi.client.setToken({ access_token: tokenResponse.access_token });
                        await fetchUserProfile(tokenResponse.access_token);
                        setIsLoading(false);
                    },
                });

                // Шаг 5: Система готова к использованию
                setIsInitialized(true);

            } catch (error) {
                console.error("Critical GAPI/GIS initialization failed:", error);
                // Corrected line 110
                alert("Failed to initialize Google services. Please check the console and refresh the page.");
                setIsInitialized(false);
            } finally {
                setIsLoading(false);
            }
        };

        // GSI скрипт загружается асинхронно, поэтому его надо дождаться.
        // `window.google` создается этим скриптом.
        if (window.google) {
          initializeAuth();
        } else {
          const gsiScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
          if (gsiScript) {
            gsiScript.addEventListener('load', initializeAuth);
          } else {
              // Corrected line 164
              console.error("Fatal: Google Sign-In script (GSI) not found in index.html.");
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
        window.tokenClient.requestAccessToken({ prompt: '' }); // prompt: '' предотвращает автовыбор аккаунта
    }, [isInitialized]);

    const signOut = useCallback(() => {
        const token = window.gapi.client.getToken();
        if (token?.access_token) {
            window.google.accounts.oauth2.revoke(token.access_token, () => {
                window.gapi.client.setToken(null);
                setUser(null);
            });
        }
        setUser(null); // В любом случае выходим из системы на клиенте
    }, []);

    return { user, signIn, signOut, isInitialized, isLoading };
};
