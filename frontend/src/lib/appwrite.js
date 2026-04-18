import { Client, TablesDB, Account, Functions, ID, Query } from 'appwrite';

const client = new Client()
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_NAME);

export const tables = new TablesDB(client);
export const account = new Account(client);
export const functions = new Functions(client);
export const DB_ID = import.meta.env.VITE_APPWRITE_DB;
export const PROFILES_TABLE = import.meta.env.VITE_APPWRITE_TABLE_PROFILES || import.meta.env.VITE_APPWRITE_COLLECTION_PROFILES;
export const DISCOVERY_FUNCTION_ID = import.meta.env.VITE_DISCOVERY_FUNCTION_ID;
export { ID, Query };
