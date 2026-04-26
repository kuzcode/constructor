import { Client, Databases, Query } from 'appwrite';
import { config } from '../config';

/** Клиент без сессии — только публичные read из БД (опубликованные страницы). */
function guestDatabases() {
  const c = new Client();
  c.setEndpoint(config.appwriteEndpoint).setProject(config.appwriteProjectId);
  return new Databases(c);
}

export { guestDatabases, Query };
