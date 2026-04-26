import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../context/AuthContext';
import { useTelegramLogin } from '../hooks/useTelegramLogin';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/Button';
import { Input, Label } from '../components/ui/Input';

const schema = z
  .object({
    email: z.string().email('Некорректная почта'),
    password: z.string().min(6, 'Минимум 6 символов'),
    confirm: z.string(),
    name: z.string().optional(),
  })
  .refine((d) => d.password === d.confirm, { message: 'Пароли не совпадают', path: ['confirm'] });

export function RegisterPage() {
  const navigate = useNavigate();
  const { registerEmail, loginTelegram } = useAuth();
  const { ready, openTelegramAuth } = useTelegramLogin();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (data) => {
    setErr('');
    setBusy(true);
    try {
      await registerEmail(data.email, data.password, data.name);
      navigate('/admin', { replace: true });
    } catch (e) {
      setErr(e.message || 'Не удалось зарегистрироваться');
    } finally {
      setBusy(false);
    }
  });

  const onTelegram = () => {
    setErr('');
    openTelegramAuth(
      async (idToken) => {
        setBusy(true);
        try {
          await loginTelegram(idToken);
          navigate('/admin', { replace: true });
        } catch (e) {
          setErr(e.message || 'Ошибка Telegram');
        } finally {
          setBusy(false);
        }
      },
      (e) => setErr(e.message),
    );
  };

  return (
    <Layout showNav={false}>
      <div className="max-w-md mx-auto mt-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Регистрация</h1>
          <p className="text-tg-muted text-sm mt-2">Через почту или Telegram за один шаг</p>
        </div>
        <div className="glass-panel rounded-3xl p-6 border border-tg-border space-y-5">
          {err ? (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">
              {err}
            </div>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={busy || !ready}
            onClick={onTelegram}
          >
            Зарегистрироваться через Telegram
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-tg-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide">
              <span className="bg-tg-card px-2 text-tg-muted">или почта</span>
            </div>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Имя (необязательно)</Label>
              <Input autoComplete="name" {...register('name')} />
            </div>
            <div>
              <Label>Почта</Label>
              <Input type="email" autoComplete="email" {...register('email')} />
              {errors.email ? <p className="text-xs text-red-300 mt-1">{errors.email.message}</p> : null}
            </div>
            <div>
              <Label>Пароль</Label>
              <Input type="password" autoComplete="new-password" {...register('password')} />
              {errors.password ? <p className="text-xs text-red-300 mt-1">{errors.password.message}</p> : null}
            </div>
            <div>
              <Label>Повтор пароля</Label>
              <Input type="password" autoComplete="new-password" {...register('confirm')} />
              {errors.confirm ? <p className="text-xs text-red-300 mt-1">{errors.confirm.message}</p> : null}
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Создать аккаунт
            </Button>
          </form>
          <p className="text-center text-sm text-tg-muted">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-[#3390ec] hover:underline">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
