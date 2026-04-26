import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'miniapp-admin-theme';

const AdminThemeContext = createContext({
  light: false,
  toggle: () => {},
  setLight: () => {},
});

export function AdminThemeProvider({ children }) {
  const [light, setLightState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'light';
    } catch {
      return false;
    }
  });

  const setLight = useCallback((v) => {
    setLightState((prev) => {
      const next = typeof v === 'function' ? v(prev) : !!v;
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'light' : 'dark');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggle = useCallback(() => setLight((x) => !x), [setLight]);

  const value = useMemo(() => ({ light, toggle, setLight }), [light, toggle, setLight]);

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
}

export function useAdminTheme() {
  return useContext(AdminThemeContext);
}

/** Sync body class for global surfaces (login, modals). */
export function useAdminBodyClass(enabled) {
  const { light } = useAdminTheme();
  useEffect(() => {
    if (!enabled) return undefined;
    document.body.classList.toggle('admin-light', light);
    return () => document.body.classList.remove('admin-light');
  }, [enabled, light]);
}
