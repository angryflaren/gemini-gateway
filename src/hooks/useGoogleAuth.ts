// src/hooks/useGoogleAuth.ts

import { useState, useEffect, useCallback } from 'react';
import { config } from '../config';
import { UserProfile } from '../types';

// Объявляем gapi как глобальную переменную, чтобы TypeScript не ругался
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export const useGoogleAuth = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const updateSignInStatus = useCallback((isSignedIn: boolean) => {
        if (isSignedIn) {
            const authInstance = window.gapi.auth2.getAuthInstance();
            const googleUser = authInstance.currentUser.get();
            const profile = googleUser.getBasicProfile();
            setUser({
                id: profile.getId(),
                name: profile.getName(),
                email: profile.getEmail(),
                imageUrl: profile.getImageUrl(),
            });
        } else {
            setUser(null);
        }
        setIsInitialized(true);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const initClient = () => {
            window.gapi.client.init({
                clientId: config.google.clientId,
                scope: config.google.scope,
                discoveryDocs: config.google.discoveryDocs,
            }).then(() => {
                const authInstance = window.gapi.auth2.getAuthInstance();
                // Устанавливаем слушатель и сразу проверяем текущий статус
                authInstance.isSignedIn.listen(updateSignInStatus);
                updateSignInStatus(authInstance.isSignedIn.get());
            }).catch((error: any) => {
                console.error("Error initializing Google API client:", error);
                setIsInitialized(false);
                setIsLoading(false);
            });
        };

        if (window.gapi) {
          window.gapi.load('client:auth2', initClient);
        } else {
          // Если gapi еще не загрузился, это указывает на проблему с загрузкой скрипта в index.html
          console.error("gapi script not loaded yet!");
          setIsLoading(false);
        }
    }, [updateSignInStatus]);

    const signIn = async () => {
        try {
            await window.gapi.auth2.getAuthInstance().signIn();
        } catch (error) {
            console.error("Sign-in error:", error);
        }
    };

    const signOut = async () => {
        try {
            await window.gapi.auth2.getAuthInstance().signOut();
        } catch (error) {
            console.error("Sign-out error:", error);
        }
    };

    return { user, signIn, signOut, isInitialized, isLoading };
};
