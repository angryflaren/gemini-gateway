import { useState, useEffect, useCallback, useRef } from 'react';
import { config } from '../config';
import { UserProfile } from '../types';

declare global {
  interface Window {
    google: any;
    gapi: any;
    tokenClient: any;
  }
}

const GAPI_SCRIPT_URL = config.google.gapiScriptUrl;
const GSI_SCRIPT_URL = config.google.gsiScriptUrl;
const SESSION_STORAGE_KEY = config.google.sessionStorageKey;

interface TokenData {
    access_token: string;
    expires_in: number;
    expires_at: number; 
    [key: string]: any;
}

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
    
    const userEmailRef = useRef<string | null>(null);
    const tokenExpiresAtRef = useRef<number>(0);
    
    const isRefreshingRef = useRef(false);

    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        userEmailRef.current = user?.email || null;
    }, [user]);

    const signOut = useCallback(() => {
        if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
        }

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
        tokenExpiresAtRef.current = 0;
        if (window.gapi?.client) {
            window.gapi.client.setToken(null);
        }
        setUser(null);
    }, []);

    const fetchUserProfile = useCallback(async (token: string) => {
        try {
            const response = await fetch(config.google.userinfoEndpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorBody = await response.json();
                if(errorBody.error?.status === 'UNAUTHENTICATED' || response.status === 401) {
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

    const handleTokenResponse = useCallback(async (tokenResponse: any) => {
        setIsLoading(true);
        if (tokenResponse.error) {
            console.error("OAuth Error:", tokenResponse.error);
            if (tokenResponse.error === 'invalid_grant' || tokenResponse.error === 'interaction_required') {
                signOut();
            }
            setIsLoading(false);
            isRefreshingRef.current = false;
            return;
        }
        
        const expiresAt = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
        
        const tokenData: TokenData = {
            ...tokenResponse,
            expires_at: expiresAt,
        };
        
        tokenExpiresAtRef.current = expiresAt;
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(tokenData));
        window.gapi.client.setToken(tokenResponse);

        isRefreshingRef.current = false; 

        if (!userEmailRef.current) {
             await fetchUserProfile(tokenResponse.access_token);
        }
        
        setIsLoading(false);
        console.log(`Token refreshed successfully. Next expiry in ${((expiresAt - Date.now())/60000).toFixed(1)} min.`);
    }, [fetchUserProfile, signOut]);

    useEffect(() => {
        checkIntervalRef.current = setInterval(() => {
            if (!tokenExpiresAtRef.current || isRefreshingRef.current || !window.tokenClient) return;

            const timeLeftMs = tokenExpiresAtRef.current - Date.now();
            
            if (timeLeftMs < 10 * 60 * 1000) { // Если осталось меньше 10 минут (600000 мс)
                console.log(`Token expires in ${(timeLeftMs/1000).toFixed(0)}s. Triggering auto-refresh...`);
                
                isRefreshingRef.current = true;
                
                const params: any = { prompt: 'none' };
                if (userEmailRef.current) {
                    params.login_hint = userEmailRef.current;
                }

                window.tokenClient.requestAccessToken(params);
            }
        }, 20000); // 20 секунд

        return () => {
            if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        };
    }, []);

    useEffect(() => {
        const initialize = async () => {
            try {
                await loadScript(GSI_SCRIPT_URL, 'gsi-script');
                await loadScript(GAPI_SCRIPT_URL, 'gapi-script');
                
                if (typeof window.gapi?.load === 'undefined') throw new Error("window.gapi undefined");

                await new Promise<void>((resolve, reject) => {
                    window.gapi.load('client', { callback: resolve, onerror: reject });
                });

                await window.gapi.client.init({ discoveryDocs: config.google.discoveryDocs });

                if (typeof window.google?.accounts?.oauth2?.initTokenClient !== 'function') {
                    throw new Error("initTokenClient not available");
                }
            
                window.tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: config.google.clientId,
                    scope: config.google.scope,
                    callback: handleTokenResponse,
                    error_callback: (error: any) => {
                        console.warn("Auth Error:", error);
                        setIsLoading(false); 
                        isRefreshingRef.current = false;
                    }
                });

                const storedTokenString = sessionStorage.getItem(SESSION_STORAGE_KEY);
                if (storedTokenString) {
                    try {
                        const tokenData = JSON.parse(storedTokenString);
                        if (tokenData && tokenData.access_token && tokenData.expires_at > Date.now()) {
                            tokenExpiresAtRef.current = tokenData.expires_at;
                            window.gapi.client.setToken(tokenData);
                            await fetchUserProfile(tokenData.access_token);
                        } else {
                            signOut(); 
                        }
                    } catch (e) {
                        signOut();
                    }
                }
                
                setIsInitialized(true);
            } catch (error) {
                console.error("Init failed:", error);
                signOut();
            } finally {
                setIsLoading(false);
            }
        };

        initialize();
    }, [handleTokenResponse, fetchUserProfile, signOut]);

    const signIn = useCallback(() => {
        if (!isInitialized || !window.tokenClient) return;
        setIsLoading(true);
        window.tokenClient.requestAccessToken({ prompt: '' });
    }, [isInitialized]);

    return { user, signIn, signOut, isInitialized, isLoading };
};