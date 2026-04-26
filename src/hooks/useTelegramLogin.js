import { useCallback, useEffect, useState } from 'react';
import { config } from '../config';

const SCRIPT_URL = 'https://oauth.telegram.org/js/telegram-widget.js?22';

export function useTelegramLogin() {
  const [ready, setReady] = useState(typeof window !== 'undefined' && !!window.Telegram?.Login);

  useEffect(() => {
    if (typeof window === 'undefined' || window.Telegram?.Login) {
      setReady(true);
      return;
    }
    const existing = document.querySelector('script[data-telegram-login-sdk]');
    if (existing) {
      existing.addEventListener('load', () => setReady(true));
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.dataset.telegramLoginSdk = '1';
    s.onload = () => setReady(true);
    s.onerror = () => setReady(false);
    document.body.appendChild(s);
  }, []);

  const openTelegramAuth = useCallback((onSuccess, onError) => {
    const clientId = config.telegramClientId;
    if (!clientId) {
      onError?.(new Error('Задайте REACT_APP_TELEGRAM_CLIENT_ID (Client ID из @BotFather → Web Login)'));
      return;
    }
    if (!window.Telegram?.Login?.auth) {
      onError?.(new Error('Telegram Login SDK ещё не загружен'));
      return;
    }
    const nonce =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    window.Telegram.Login.auth(
      {
        client_id: Number(clientId),
        request_access: ['write'],
        lang: 'ru',
        nonce,
      },
      (data) => {
        if (!data) {
          onError?.(new Error('Авторизация отменена'));
          return;
        }
        if (data.error) {
          onError?.(new Error(data.error));
          return;
        }
        if (data.id_token) {
          onSuccess(data.id_token);
          return;
        }
        onError?.(new Error('Нет id_token в ответе Telegram'));
      },
    );
  }, []);

  return { ready, openTelegramAuth };
}
