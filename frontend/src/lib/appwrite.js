import { Client, TablesDB, Account, Functions, Storage, ID, Query, Permission, Role } from 'appwrite';

const client = new Client()
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_NAME);

export const tables = new TablesDB(client);
export const account = new Account(client);
export const functions = new Functions(client);
export const storage = new Storage(client);
export const DB_ID = import.meta.env.VITE_APPWRITE_DB;
export const PROFILES_TABLE = import.meta.env.VITE_APPWRITE_TABLE_PROFILES || import.meta.env.VITE_APPWRITE_COLLECTION_PROFILES;
export const DISCOVERY_FUNCTION_ID = import.meta.env.VITE_DISCOVERY_FUNCTION_ID;
export const CONNECTION_GATEWAY_FUNCTION_ID = import.meta.env.VITE_CONNECTION_GATEWAY_FUNCTION_ID || 'connectionGateway';
export const MESSAGE_GATEWAY_FUNCTION_ID = import.meta.env.VITE_MESSAGE_GATEWAY_FUNCTION_ID || 'messageGateway';
export const PROFILE_PHOTOS_BUCKET_ID = import.meta.env.VITE_APPWRITE_PROFILE_PHOTOS_BUCKET_ID || 'profilePhotos';
export { ID, Query, Permission, Role };
