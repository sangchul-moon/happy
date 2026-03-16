import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { log } from '@/log';

const AUTH_KEY = 'auth_credentials';

// Cache for synchronous access
let credentialsCache: string | null = null;

// MMKV fallback for when SecureStore is unavailable (e.g. simulator without code signing)
const mmkv = Platform.OS !== 'web' ? new MMKV({ id: 'auth-fallback' }) : null;

export interface AuthCredentials {
    token: string;
    secret: string;
}

/** Try SecureStore first, fall back to MMKV on native platforms */
async function nativeGet(key: string): Promise<string | null> {
    try {
        const value = await SecureStore.getItemAsync(key);
        if (value) return value;
    } catch {
        // SecureStore unavailable
    }
    return mmkv?.getString(key) ?? null;
}

async function nativeSet(key: string, value: string): Promise<void> {
    try {
        await SecureStore.setItemAsync(key, value);
        return;
    } catch {
        // SecureStore unavailable, use MMKV fallback
    }
    try {
        mmkv?.set(key, value);
    } catch (e) {
        log.error('MMKV set failed:', e);
        throw e;
    }
}

async function nativeDelete(key: string): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(key);
    } catch {
        // SecureStore unavailable
    }
    mmkv?.delete(key);
}

export const TokenStorage = {
    async getCredentials(): Promise<AuthCredentials | null> {
        if (Platform.OS === 'web') {
            return localStorage.getItem(AUTH_KEY) ? JSON.parse(localStorage.getItem(AUTH_KEY)!) as AuthCredentials : null;
        }
        try {
            const stored = await nativeGet(AUTH_KEY);
            if (!stored) return null;
            credentialsCache = stored;
            return JSON.parse(stored) as AuthCredentials;
        } catch (error) {
            log.error('Error getting credentials:', error);
            return null;
        }
    },

    async setCredentials(credentials: AuthCredentials): Promise<void> {
        if (Platform.OS === 'web') {
            localStorage.setItem(AUTH_KEY, JSON.stringify(credentials));
            return;
        }
        const json = JSON.stringify(credentials);
        await nativeSet(AUTH_KEY, json);
        credentialsCache = json;
    },

    async removeCredentials(): Promise<void> {
        if (Platform.OS === 'web') {
            localStorage.removeItem(AUTH_KEY);
            return;
        }
        await nativeDelete(AUTH_KEY);
        credentialsCache = null;
    },
};