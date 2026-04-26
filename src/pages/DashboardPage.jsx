import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Store, LayoutTemplate } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { listMyApps } from '../services/appsService';
import { useTelegramLogin } from '../hooks/useTelegramLogin';

export function DashboardPage() {
  const { user, linkTelegram } = useAuth();
  const { ready, openTelegramAuth } = useTelegramLogin();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tgMsg, setTgMsg] = useState('');
  const [tgBusy, setTgBusy] = useState(false);

  const prefs = user?.prefs || {};
  const telegramLinked = !!(prefs.telegramId || prefs.telegram_id);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      try {
        const res = await listMyApps(user.$id);
        if (!cancelled) setApps(res.documents);
      } catch {
        if (!cancelled) setApps([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const linkTg = () => {
    setTgMsg('');
    openTelegramAuth(
      async (idToken) => {
        setTgBusy(true);
        try {
          await linkTelegram(idToken);
          setTgMsg('Telegram привязан');
        } catch (e) {
          setTgMsg(e.message);
        } finally {
          setTgBusy(false);
        }
      },
      (e) => setTgMsg(e.message),
    );
  };

  return (
    <Layout title="Ваши Mini Apps">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <p className="text-tg-muted text-[15px] max-w-xl">
          бета-версия конструктора
        </p>
        <Link to="/admin/new">
          <Button className="w-full sm:w-auto shrink-0">
            <Plus className="w-4 h-4" />
            Новый проект
          </Button>
        </Link>
      </div>

      {user?.email ? (
        !telegramLinked && (
          <Card className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Привязка Telegram</p>
                <p className="text-xs text-tg-muted mt-1">
                  Будет доступна авторизация через Telegram
                </p>
                {tgMsg ? <p className="text-xs mt-2 text-[#3390ec]">{tgMsg}</p> : null}
              </div>
              <Button type="button" variant="secondary" size="sm" disabled={!ready || tgBusy} onClick={linkTg}>
                Привязать
              </Button>
            </div>
          </Card>
        )
      ) : null}

      {loading ? (
        <p className="text-tg-muted text-sm">Загрузка списка…</p>
      ) : apps.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-tg-muted mb-4">Пока нет проектов</p>
          <Link to="/admin/new">
            <Button>Создать первый</Button>
          </Link>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {apps.map((doc) => (
            <li key={doc.$id}>
              <Card interactive className="!p-4">
                <Link to={`/admin/apps/${doc.$id}`} className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center">
                    {doc.appType === 'shop' ? (
                      <Store className="w-5 h-5 text-[#3390ec]" />
                    ) : (
                      <LayoutTemplate className="w-5 h-5 text-violet-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.title || 'Без названия'}</p>
                    <p className="text-xs text-tg-muted truncate">
                      {doc.slug ? `/${doc.slug}` : 'Черновик — задайте адрес'}
                      {doc.published ? ' · опубликован' : ''}
                    </p>
                  </div>
                  <span className="text-xs text-tg-muted capitalize">{doc.appType === 'shop' ? 'магазин' : 'страница'}</span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
