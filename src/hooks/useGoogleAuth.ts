import { useState, useEffect } from 'react';
import { gapi } from 'gapi-script';
import { config } from '../config';
import { UserProfile } from '../types';

export const useGoogleAuth = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initClient = () => {
            gapi.client.init({
                clientId: config.google.clientId,
                scope: config.google.scope,
                discoveryDocs: config.google.discoveryDocs,
            }).then(() => {
                const authInstance = gapi.auth2.getAuthInstance();
                
                const updateSignInStatus = (isSignedIn: boolean) => {
                    if (isSignedIn) {
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
                };

                authInstance.isSignedIn.listen(updateSignInStatus);
                updateSignInStatus(authInstance.isSignedIn.get());

            }).catch(error => {
                console.error("Error initializing Google API client:", error);
                setIsInitialized(false);
                setIsLoading(false);
            });
        };

        // Загружаем gapi и только потом вызываем initClient
        gapi.load('client:auth2', initClient); 
    }, []);

    const signIn = async () => {
        try {
            await gapi.auth2.getAuthInstance().signIn();
        } catch (error) {
            console.error("Sign-in error:", error);
        }
    };

    const signOut = async () => {
        await gapi.auth2.getAuthInstance().signOut();
    };

    return { user, signIn, signOut, isInitialized, isLoading };
};
