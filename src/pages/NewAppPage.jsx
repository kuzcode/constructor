import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, LayoutTemplate } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Label } from '../components/ui/Input';
import { newMiniAppDraft } from '../models/defaults';
import { createAppDocument } from '../services/appsService';

export function NewAppPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [appType, setAppType] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const create = async () => {
    if (!appType || !user) return;
    setErr('');
    setBusy(true);
    try {
      const draft = newMiniAppDraft(user.$id, appType, title);
      const doc = await createAppDocument(user.$id, draft);
      navigate(appType === 'shop' ? `/admin/apps/${doc.$id}/shop` : `/admin/apps/${doc.$id}/free`, {
        replace: true,
      });
    } catch (e) {
      setErr(e.message || 'Ошибка создания');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Новый проект">
      <p className="text-tg-muted text-[15px] mb-6 max-w-xl">
        Выберите тип: магазин с каталогом или свободная страница из блоков.
      </p>
      {err ? (
        <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">
          {err}
        </div>
      ) : null}
      <div className="mb-6">
        <Label>Название проекта</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, Цветочная лавка" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <Card
          interactive
          className={appType === 'shop' ? 'ring-2 ring-[#3390ec]/50' : ''}
          onClick={() => setAppType('shop')}
        >
          <Store className="w-8 h-8 text-[#3390ec] mb-3" />
          <h2 className="text-lg font-semibold mb-1">Магазин</h2>
          <p className="text-sm text-tg-muted">Идеальное решение для продаж</p>
        </Card>
        <Card
          interactive
          className={appType === 'free' ? 'ring-2 ring-violet-400/50' : ''}
          onClick={() => setAppType('free')}
        >
          <LayoutTemplate className="w-8 h-8 text-violet-400 mb-3" />
          <h2 className="text-lg font-semibold mb-1">Свободная страница</h2>
          <p className="text-sm text-tg-muted">Текст, картинки, кнопки — на ваш вкус</p>
        </Card>
      </div>
      <div className="flex gap-3">
        <Button disabled={!appType || busy} onClick={create}>
          Создать и перейти к редактору
        </Button>
        <Button variant="ghost" type="button" onClick={() => navigate('/admin')}>
          Отмена
        </Button>
      </div>
    </Layout>
  );
}
