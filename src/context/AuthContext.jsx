import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { account, client, clearSession, setSession, ID } from '../lib/appwriteClient';
import { readTelegramProfileFromRuntime } from '../utils/telegramWebApp';

const SESSION_KEY = 'miniapp_appwrite_session';
const TG_PROFILE_KEY = 'miniapp_tg_profile';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistProfile = useCallback((p) => {
    if (!p?.userId) return;
    setProfile(p);
    try {
      localStorage.setItem(TG_PROFILE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, []);

  const tgCreds = useCallback((p) => {
    const uid = String(p?.userId || '').trim();
    const pid = (client.config.project || 'miniapp').replace(/[^a-zA-Z0-9_-]/g, '');
    return {
      email: `tg_${uid}@${pid}.miniapp.local`,
      password: `tg-auth-${pid}-${uid}-v1`,
    };
  }, []);

  const upsertTelegramPrefs = useCallback(async (p) => {
    if (!p?.userId) return;
    try {
      await account.updatePrefs({
        telegramUserId: p.userId,
        telegramUsername: p.username || '',
        telegramFirstName: p.firstName || '',
        telegramLastName: p.lastName || '',
        telegramAvatarUrl: p.avatarUrl || '',
      });
    } catch {
      /* ignore */
    }
  }, []);

  const persistSecret = useCallback((secret) => {
    localStorage.setItem(SESSION_KEY, secret);
    client.setSession(secret);
  }, []);

  const hydrate = useCallback(async () => {
    try {
      const cached = localStorage.getItem(TG_PROFILE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.userId) setProfile(parsed);
      }
    } catch {
      /* ignore */
    }
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      setSession(stored);
    }
    try {
      const u = await account.get();
      setUser(u);
    } catch {
      const tgProfile = readTelegramProfileFromRuntime();
      if (tgProfile?.userId) {
        try {
          const c = tgCreds(tgProfile);
          try {
            const session = await account.createEmailPasswordSession(c.email, c.password);
            persistSecret(session.secret);
          } catch {
            await account.create(ID.unique(), c.email, c.password, `${tgProfile.firstName || ''} ${tgProfile.lastName || ''}`.trim() || tgProfile.username || `tg_${tgProfile.userId}`);
            const session = await account.createEmailPasswordSession(c.email, c.password);
            persistSecret(session.secret);
          }
          const u = await account.get();
          if (tgProfile.firstName || tgProfile.lastName || tgProfile.username) {
            const nm = `${tgProfile.firstName || ''} ${tgProfile.lastName || ''}`.trim() || tgProfile.username;
            if (nm && u.name !== nm) {
              try {
                await account.updateName(nm);
              } catch {
                /* ignore */
              }
            }
          }
          await upsertTelegramPrefs(tgProfile);
          setUser(await account.get());
          persistProfile(tgProfile);
        } catch {
          setUser(null);
          clearSession();
          localStorage.removeItem(SESSION_KEY);
        }
      } else {
        setUser(null);
        clearSession();
        localStorage.removeItem(SESSION_KEY);
      }
    } finally {
      setLoading(false);
    }
  }, [tgCreds, upsertTelegramPrefs, persistProfile, persistSecret]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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

  const loginTelegram = useCallback(async () => {
    const tgProfile = readTelegramProfileFromRuntime();
    if (!tgProfile?.userId) {
      throw new Error('Откройте приложение внутри Telegram');
    }
    const c = tgCreds(tgProfile);
    try {
      const session = await account.createEmailPasswordSession(c.email, c.password);
      persistSecret(session.secret);
    } catch {
      await account.create(ID.unique(), c.email, c.password, `${tgProfile.firstName || ''} ${tgProfile.lastName || ''}`.trim() || tgProfile.username || `tg_${tgProfile.userId}`);
      const session = await account.createEmailPasswordSession(c.email, c.password);
      persistSecret(session.secret);
    }
    await upsertTelegramPrefs(tgProfile);
    const u = await account.get();
    setUser(u);
    persistProfile(tgProfile);
    return u;
  }, [tgCreds, persistSecret, upsertTelegramPrefs, persistProfile]);

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
      logout,
      refreshUser,
      profile,
    }),
    [user, loading, loginEmail, registerEmail, loginTelegram, logout, refreshUser, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
