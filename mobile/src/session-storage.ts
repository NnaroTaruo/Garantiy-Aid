import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'garantiy-aid.session-token';
let pendingWrite: Promise<void> = Promise.resolve();

export async function getStoredToken(): Promise<string | null> {
  await pendingWrite;
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(SESSION_KEY);
  }
  return SecureStore.getItemAsync(SESSION_KEY);
}

function writeToken(token: string | null): Promise<void> {
  // Preserve login/logout order even when native storage writes are delayed.
  const nextWrite = pendingWrite.then(async () => {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') {
        if (token === null) return;
        throw new Error('Browser storage is unavailable.');
      }
      if (token === null) localStorage.removeItem(SESSION_KEY);
      else localStorage.setItem(SESSION_KEY, token);
    } else if (token === null) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    } else {
      await SecureStore.setItemAsync(SESSION_KEY, token);
    }
  });
  pendingWrite = nextWrite.catch(() => {});
  return nextWrite;
}

export function storeToken(token: string): Promise<void> {
  return writeToken(token);
}

export function clearStoredToken(): Promise<void> {
  return writeToken(null);
}
