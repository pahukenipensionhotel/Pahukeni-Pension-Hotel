import { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase/client';
import { registerForPush, unregisterPush, listenForSubscriptionChange, onForegroundMessage } from './services/firebase/messaging';

export default function usePushNotifications(vapidKey?: string) {
  const currentTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let authUnsub: (() => void) | null = null;

    const handleRegister = async () => {
      try {
        const token = await registerForPush(vapidKey);
        if (token) currentTokenRef.current = token;
      } catch (err) {
        console.error('registerForPush failed in hook', err);
      }
    };

    authUnsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User signed in: request permission and register token
        await handleRegister();
      } else {
        // User signed out: remove token
        const t = currentTokenRef.current;
        if (t) await unregisterPush(t);
        currentTokenRef.current = null;
      }
    });

    // Listen for SW subscription change and refresh token when that happens
    listenForSubscriptionChange(async () => {
      await handleRegister();
    });

    // Foreground message handler example: show in-app toast via console by default
    onForegroundMessage((payload) => {
      console.log('Foreground push received (hook):', payload);
    });

    return () => {
      if (authUnsub) authUnsub();
    };
  }, [vapidKey]);
}
