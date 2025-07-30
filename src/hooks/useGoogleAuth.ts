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

// FIXED: Made a more reliable script loader
const loadScript = (src: string, id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.id = id;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
};

export const useGoogleAuth = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const signOut = useCallback(() => {
        const storedTokenString = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (storedTokenString && window.google?.accounts?.oauth2) {
            try {
                const tokenData = JSON.parse(storedTokenString);
                if (tokenData.access_token && typeof window.google.accounts.oauth2.revoke === 'function') {
                    window.google.accounts.oauth2.revoke(tokenData.access_token, () => {});
                }
            } catch (e) {
                console.error("Failed to parse or revoke token:", e);
            }
        }
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        if (window.gapi?.client) {
            window.gapi.client.setToken(null);
        }
        setUser(null);
    }, []);

    const fetchUserProfile = useCallback(async (token: string) => {
        try {
            const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                 const errorBody = await response.json();
                 if(errorBody.error?.status === 'UNAUTHENTICATED' || response.status === 401) {
                    console.warn("User token expired or invalid. Signing out.");
                    signOut(); 
                 }
                 throw new Error(errorBody.error?.message || 'Failed to fetch user profile.');
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
            signOut(); 
        }
    }, [signOut]);

    useEffect(() => {
        const initialize = async () => {
            try {
                // FIXED: Load scripts one by one and with IDs
                await loadScript(GSI_SCRIPT_URL, 'gsi-script');
                await loadScript(GAPI_SCRIPT_URL, 'gapi-script');
                
                if (typeof window.gapi === 'undefined' || typeof window.gapi.load === 'undefined') {
                    throw new Error("window.gapi is not defined after script load.");
                }

                // FIXED: Use a Promise for gapi.load for reliability
                await new Promise<void>((resolve, reject) => {
                    // Load 'client' and 'picker' if needed
                    window.gapi.load('client', {
                        callback: resolve,
                        onerror: reject,
                        timeout: 5000, // 5 second timeout
                        ontimeout: reject,
                    });
                });

                await window.gapi.client.init({
                    discoveryDocs: config.google.discoveryDocs,
                });

                if (typeof window.google?.accounts?.oauth2?.initTokenClient !== 'function') {
                    throw new Error("google.accounts.oauth2.initTokenClient is not available.");
                }
            
                window.tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: config.google.clientId,
                    scope: config.google.scope,
                    callback: async (tokenResponse: any) => {
                        setIsLoading(true);
                        if (tokenResponse.error) {
                             console.error("OAuth Error:", tokenResponse.error, tokenResponse.error_description);
                             signOut();
                             setIsLoading(false);
                             return;
                        }
                        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(tokenResponse));
                        window.gapi.client.setToken(tokenResponse);
                        await fetchUserProfile(tokenResponse.access_token);
                        setIsLoading(false);
                    },
                });

                const storedToken = sessionStorage.getItem(SESSION_STORAGE_KEY);
                if (storedToken) {
                    try {
                        const tokenData = JSON.parse(storedToken);
                        if (tokenData && tokenData.access_token) {
                             window.gapi.client.setToken(tokenData);
                             await fetchUserProfile(tokenData.access_token);
                        } else {
                            signOut();
                        }
                    } catch (e) {
                         console.error("Failed to parse stored token", e);
                         signOut();
                    }
                }
                
                setIsInitialized(true);
            } catch (error) {
                console.error("Google Auth initialization failed:", error);
                signOut();
            } finally {
                setIsLoading(false);
            }
        };

        initialize();
    }, [fetchUserProfile, signOut]);

    const signIn = useCallback(() => {
        if (!isInitialized || !window.tokenClient) {
            console.error("Auth system not ready for sign-in.");
            return;
        }
        setIsLoading(true);
        window.tokenClient.requestAccessToken({ prompt: '' });
    }, [isInitialized]);

    return { user, signIn, signOut, isInitialized, isLoading };
};