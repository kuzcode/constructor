import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { account, client, clearSession, setSession, ID } from '../lib/appwriteClient';
import { exchangeTelegramIdToken } from '../services/telegramAuth';

const SESSION_KEY = 'miniapp_appwrite_session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      setSession(stored);
    }
    try {
      const u = await account.get();
      setUser(u);
    } catch {
      setUser(null);
      clearSession();
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const persistSecret = useCallback((secret) => {
    localStorage.setItem(SESSION_KEY, secret);
    client.setSession(secret);
  }, []);

  const loginEmail = useCallback(async (email, password) => {
    const session = await account.createEmailPasswordSession(email, password);
    persistSecret(session.secret);
    const u = await account.get();
    setUser(u);
    return u;
  }, [persistSecret]);

  const registerEmail = useCallback(async (email, password, name) => {
    await account.create(ID.unique(), email, password, name || undefined);
    const session = await account.createEmailPasswordSession(email, password);
    persistSecret(session.secret);
    const u = await account.get();
    setUser(u);
    return u;
  }, [persistSecret]);

  const loginTelegram = useCallback(
    async (idToken) => {
      const { user: u, secret } = await exchangeTelegramIdToken(idToken, null);
      persistSecret(secret);
      setUser(u);
      return u;
    },
    [persistSecret],
  );

  const linkTelegram = useCallback(
    async (idToken) => {
      if (!user) throw new Error('Войдите в аккаунт');
      const { user: u, secret } = await exchangeTelegramIdToken(idToken, user.$id);
      persistSecret(secret);
      setUser(u);
      return u;
    },
    [user, persistSecret],
  );

  const logout = useCallback(async () => {
    try {
      await account.deleteSession('current');
    } catch {
      /* ignore */
    }
    clearSession();
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const u = await account.get();
      setUser(u);
      return u;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      loginEmail,
      registerEmail,
      loginTelegram,
      linkTelegram,
      logout,
      refreshUser,
    }),
    [user, loading, loginEmail, registerEmail, loginTelegram, linkTelegram, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
