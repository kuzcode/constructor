export const config = {
  appwriteEndpoint: process.env.REACT_APP_APPWRITE_ENDPOINT || '',
  appwriteProjectId: process.env.REACT_APP_APPWRITE_PROJECT_ID || '',
  databaseId: process.env.REACT_APP_APPWRITE_DB_ID || '',
  appsCollectionId: process.env.REACT_APP_APPWRITE_COL_APPS_ID || 'apps',
  visitorsCollectionId: process.env.REACT_APP_APPWRITE_COL_VISITORS_ID || '',
  ordersCollectionId: process.env.REACT_APP_APPWRITE_COL_ORDERS_ID || '',
  freeFeedbackCollectionId: process.env.REACT_APP_APPWRITE_COL_FREE_FEEDBACK_ID || '',
  walletsCollectionId: process.env.REACT_APP_APPWRITE_COL_WALLETS_ID || '',
  /** Намерения оплаты (pending → бот выставляет счёт → completed) */
  paymentIntentsCollectionId: process.env.REACT_APP_APPWRITE_COL_PAYMENT_INTENTS_ID || '',
  /** Без @ — для ссылки t.me/...?start= */
  telegramBotUsername: process.env.REACT_APP_TELEGRAM_BOT_USERNAME || 'miniapps_constructor_bot',
  /** Короткое имя Mini App в BotFather (меню слева) — для ссылки t.me/bot/SHORT?startapp=slug */
  telegramWebAppShortName: process.env.REACT_APP_TELEGRAM_WEBAPP_SHORT_NAME || '',
  bucketImagesId: process.env.REACT_APP_APPWRITE_BUCKET_IMAGES_ID || '',
  telegramClientId: process.env.REACT_APP_TELEGRAM_CLIENT_ID || '',
  telegramRedirectUri: process.env.REACT_APP_TELEGRAM_REDIRECT_URI || '',
  fnTelegramExchangeId: process.env.REACT_APP_APPWRITE_FN_TELEGRAM_EXCHANGE_ID || '',
  fnOwnerNotifyId: process.env.REACT_APP_APPWRITE_FN_OWNER_NOTIFY_ID || '',
  telegramBotToken: process.env.REACT_APP_TELEGRAM_BOT_TOKEN || '',
};

export function assertConfig() {
  const missing = [];
  if (!config.appwriteEndpoint) missing.push('REACT_APP_APPWRITE_ENDPOINT');
  if (!config.appwriteProjectId) missing.push('REACT_APP_APPWRITE_PROJECT_ID');
  if (!config.databaseId) missing.push('REACT_APP_APPWRITE_DB_ID');
  if (!config.appsCollectionId) missing.push('REACT_APP_APPWRITE_COL_APPS_ID');
  return missing;
}
