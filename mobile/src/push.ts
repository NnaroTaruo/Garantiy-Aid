import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { getPushDevice, registerPushDevice, removePushDevice, type PushDeviceState } from './api';

// Android remote push needs a development or release build with an EAS project ID and FCM V1
// credentials (Expo SDK 57). Expo Go and the browser keep using the in-app inbox only.
export const PUSH_CHANNEL_ID = 'account-updates';
export const PUSH_DATA_KIND = 'garantiyaid.notification';
const OPT_IN_KEY = 'garantiy-aid.push-opt-in';

export type PushAvailability = 'web' | 'unsupported' | 'expo-go' | 'unconfigured' | 'ready';
export type PushLanguage = 'en' | 'bs';
export type PushPermission = 'granted' | 'ask' | 'blocked';
export type PushSetupReason = 'denied' | 'blocked' | 'token' | 'unavailable';

export class PushSetupError extends Error {
  constructor(public readonly reason: PushSetupReason) {
    super(`Phone alerts could not be set up (${reason}).`);
  }
}

export function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const id = extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

export function pushAvailability(): PushAvailability {
  if (Platform.OS === 'web') return 'web';
  if (Platform.OS !== 'android') return 'unsupported';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expo-go';
  return easProjectId() ? 'ready' : 'unconfigured';
}

type NotificationsModule = typeof import('expo-notifications');
let notifications: Promise<NotificationsModule> | null = null;

// Loaded lazily and only where remote push can work, so Expo Go and web never import it.
export function notificationsModule(): Promise<NotificationsModule> | null {
  if (pushAvailability() !== 'ready') return null;
  return (notifications ??= import('expo-notifications'));
}

export function alertNotificationId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const { kind, notificationId } = data as { kind?: unknown; notificationId?: unknown };
  return kind === PUSH_DATA_KIND && typeof notificationId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notificationId) ? notificationId : null;
}

async function storedOptIn() {
  try { return await SecureStore.getItemAsync(OPT_IN_KEY); } catch { return null; }
}
async function rememberOptIn(beneficiaryId: string) {
  try { await SecureStore.setItemAsync(OPT_IN_KEY, beneficiaryId); } catch { /* resume is a convenience only */ }
}
async function forgetOptIn() {
  try { await SecureStore.deleteItemAsync(OPT_IN_KEY); } catch { /* nothing else depends on it */ }
}

async function prepareChannel(N: NotificationsModule, language: PushLanguage) {
  // Android 13+ shows the permission prompt only after a channel exists, and tokens need it too.
  await N.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
    name: language === 'bs' ? 'Mga update sa account' : 'Account updates',
    importance: N.AndroidImportance.HIGH,
    lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
  });
}

export async function pushPermission(): Promise<PushPermission | null> {
  const loading = notificationsModule();
  if (!loading) return null;
  const status = await (await loading).getPermissionsAsync();
  return status.granted ? 'granted' : status.canAskAgain ? 'ask' : 'blocked';
}

// The token stays in memory: it is sent once in a request body and never stored or logged here.
async function deviceToken(N: NotificationsModule, language: PushLanguage, prompt: boolean) {
  await prepareChannel(N, language);
  let permission = await N.getPermissionsAsync();
  if (!permission.granted && prompt && permission.canAskAgain) permission = await N.requestPermissionsAsync();
  if (!permission.granted) throw new PushSetupError(permission.canAskAgain ? 'denied' : 'blocked');
  try {
    return (await N.getExpoPushTokenAsync({ projectId: easProjectId() as string })).data;
  } catch {
    throw new PushSetupError('token');
  }
}

// Only called from an explicit "Turn on phone alerts" action, so this is the only place that
// can show Android's notification permission prompt.
export async function enablePhoneAlerts(accessToken: string, beneficiaryId: string, language: PushLanguage): Promise<PushDeviceState> {
  const loading = notificationsModule();
  if (!loading) throw new PushSetupError('unavailable');
  const token = await deviceToken(await loading, language, true);
  const state = await registerPushDevice(accessToken, { token, platform: 'android', language });
  await rememberOptIn(beneficiaryId);
  return state;
}

export async function disablePhoneAlerts(accessToken: string): Promise<PushDeviceState> {
  const state = await removePushDevice(accessToken);
  await forgetOptIn();
  return state;
}

// A new session for the beneficiary who opted in on this phone resumes alerts without a prompt.
// Another account signing in on the same phone never inherits them.
export async function resumePhoneAlerts(accessToken: string, beneficiaryId: string, language: PushLanguage): Promise<boolean> {
  const loading = notificationsModule();
  if (!loading || await storedOptIn() !== beneficiaryId) return false;
  try {
    const current = await getPushDevice(accessToken);
    if (current.status === 'on' || current.status === 'unavailable') return current.status === 'on';
    const token = await deviceToken(await loading, language, false);
    return (await registerPushDevice(accessToken, { token, platform: 'android', language })).enabled;
  } catch {
    return false;
  }
}

// Removes alerts already shown for a previous account after logout or an account change.
export async function clearPhoneAlerts() {
  const loading = notificationsModule();
  if (!loading) return;
  try {
    const N = await loading;
    await N.dismissAllNotificationsAsync();
    await N.setBadgeCountAsync(0);
  } catch { /* the in-app inbox remains authoritative */ }
}
