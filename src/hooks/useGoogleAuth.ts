// src/hooks/useGoogleAuth.ts
import { useState, useEffect, useCallback } from 'react';
import { config } from '../config';
import { UserProfile } from '../types';

// Расширяем глобальный интерфейс Window, чтобы TypeScript знал о gapi, google и tokenClient
declare global {
  interface Window {
    google: any; // Для Google Identity Services (GIS)
    gapi: any;   // Для Google API Client Library (GAPI)
    tokenClient: any; // Для клиента получения токенов от GIS
  }
}

/**
 * Утилита для асинхронной загрузки скрипта Google API Client (GAPI).
 * GAPI нужен для совершения запросов к API, таким как Google Drive.
 * @returns {Promise<void>} Промис, который разрешается после загрузки и инициализации клиента GAPI.
 */
const loadGapiScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Проверяем, не был ли скрипт уже загружен ранее
    if (document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
      // Если скрипт уже есть, просто ждем готовности gapi.client
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
       // После загрузки основного скрипта, нужно явно загрузить 'client' модуль GAPI.
       window.gapi.load('client', resolve);
    };
    script.onerror = () => reject(new Error('Failed to load GAPI script.'));
    document.body.appendChild(script);
  });
};


/**
 * Хук для управления аутентификацией Google.
 * Управляет состоянием пользователя, инициализацией и процессом входа/выхода.
 */
export const useGoogleAuth = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    /**
     * Получает информацию о профиле пользователя с помощью access token.
     */
    const fetchUserProfile = useCallback(async (token: string) => {
        try {
            const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                // Если запрос не удался, выбрасываем ошибку с деталями
                const errorBody = await response.json();
                console.error("User info fetch failed:", errorBody);
                throw new Error('Failed to fetch user profile. Status: ' + response.status);
            }
            const profile = await response.json();
            setUser({
                id: profile.sub,
                name: profile.name,
                email: profile.email,
                imageUrl: profile.picture,
            });
        } catch (error) {
            console.error("Error fetching user profile:", error);
            setUser(null); // Сбрасываем пользователя в случае ошибки
        }
    }, []);

    // Основной useEffect для инициализации всей системы аутентификации
    useEffect(() => {
        const initializeAuth = async () => {
            setIsLoading(true);
            try {
                // ШАГ 1: Параллельно загружаем GAPI скрипт
                await loadGapiScript();

                // ШАГ 2: Инициализируем GAPI клиент для Google Drive API.
                // Этот шаг подготавливает gapi.client для совершения запросов к API.
                // API Key не требуется, так как мы будем использовать OAuth 2.0 токен.
                await window.gapi.client.init({
                    discoveryDocs: config.google.discoveryDocs,
                });
                
                // ШАГ 3: Инициализируем GIS Token Client.
                // Этот клиент отвечает за получение и обновление access token.
                window.tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: config.google.clientId,
                    scope: config.google.scope,
                    callback: async (tokenResponse: any) => {
                        setIsLoading(true);
                        if (tokenResponse.error) {
                            console.error("OAuth Token Error:", tokenResponse.error, tokenResponse.error_description);
                            alert(`Authentication failed: ${tokenResponse.error_description || tokenResponse.error}`);
                            setUser(null);
                            setIsLoading(false);
                            return;
                        }

                        if (tokenResponse.access_token && window.gapi?.client) {
                            // Устанавливаем полученный токен в GAPI-клиент для всех последующих запросов
                            window.gapi.client.setToken({ access_token: tokenResponse.access_token });
                            await fetchUserProfile(tokenResponse.access_token);
                        } else {
                             console.error("GAPI client not ready or access token missing in response.");
                             setUser(null);
                        }
                        setIsLoading(false);
                    },
                });

                // ШАГ 4: Система готова к использованию
                setIsInitialized(true);

            } catch (error) {
                console.error("Critical GAPI/GIS initialization failed:", error);
                alert("Failed to initialize Google services. Please check the console and refresh the page.");
                setIsInitialized(false);
            } finally {
                setIsLoading(false);
            }
        };

        // GSI скрипт загружается асинхронно из index.html. Нам нужно дождаться его загрузки.
        // `window.google` создается этим скриптом.
        if (window.google) {
          initializeAuth();
        } else {
          // Если скрипта еще нет, вешаем на него слушатель события 'load'
          const gsiScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
          if (gsiScript) {
            gsiScript.addEventListener('load', initializeAuth);
          } else {
              console.error("Fatal: Google Sign-In script (GSI) not found in index.html. Make sure it's included.");
              setIsLoading(false);
          }
        }

    }, [fetchUserProfile]); // Зависимость от fetchUserProfile обязательна

    /**
     * Инициирует процесс входа в систему.
     */
    const signIn = useCallback(() => {
        if (!isInitialized || !window.tokenClient) {
            console.error("Auth system is not ready or token client is not initialized.");
            alert("Authentication service is not ready, please try again in a moment.");
            return;
        }
        setIsLoading(true);
        // Запрашиваем токен. Коллбэк, определенный в useEffect, обработает результат.
        // prompt: '' предотвращает автоматический выбор аккаунта без явного согласия пользователя
        window.tokenClient.requestAccessToken({ prompt: '' });
    }, [isInitialized]);

    /**
     * Выполняет выход из системы.
     */
    const signOut = useCallback(() => {
        const token = window.gapi?.client?.getToken();
        if (token?.access_token) {
            // Отзываем токен на стороне Google для повышения безопасности
            window.google.accounts.oauth2.revoke(token.access_token, () => {
                window.gapi.client.setToken(null);
                setUser(null);
            });
        } else {
             // В любом случае выходим из системы на клиенте
            if(window.gapi?.client) window.gapi.client.setToken(null);
            setUser(null);
        }
    }, []);

    return { user, signIn, signOut, isInitialized, isLoading };
};
