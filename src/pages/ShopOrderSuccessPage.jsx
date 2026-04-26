import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';

export function ShopOrderSuccessPage() {
  const { slug } = useParams();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] text-white px-6 text-center">
      <p className="text-2xl font-semibold mb-2">Заказ оформлен</p>
      <p className="text-sm text-white/60 max-w-sm mb-8">Спасибо! Магазин получит заявку. Можно вернуться к витрине.</p>
      <Link
        to={`/${slug}`}
        className={clsx(
          'inline-flex items-center justify-center rounded-2xl px-6 py-3 text-[15px] font-semibold',
          'bg-[#3390ec] text-white hover:bg-[#2b7fd4] transition',
        )}
      >
        На витрину
      </Link>
    </div>
  );
}
