import { Client, Account, Databases, Storage, Functions, ID, Query, Permission, Role } from 'appwrite';
import { config } from '../config';

const client = new Client();

client.setEndpoint(config.appwriteEndpoint).setProject(config.appwriteProjectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

export { client, ID, Query, Permission, Role };

/** @param {string} secret */
export function setSession(secret) {
  client.setSession(secret);
}

export function clearSession() {
  client.setSession('');
}
