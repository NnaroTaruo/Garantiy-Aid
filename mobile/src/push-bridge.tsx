import { useEffect, useRef } from 'react';
import { go } from './components';
import { useDemo } from './state';
import { alertNotificationId, clearPhoneAlerts, notificationsModule, resumePhoneAlerts } from './push';

// Connects Android phone alerts to the signed-in account. Alert payloads carry only a notification
// id; details are always loaded through the current account, so another account's alert opens nothing.
export function PushBridge({ navigationReady }: { navigationReady: boolean }) {
  const { accessToken, beneficiary, language, refreshNotifications } = useDemo();
  const current = useRef({ accessToken, beneficiaryId: beneficiary?.id ?? '', language, navigationReady, refreshNotifications });
  current.current = { accessToken, beneficiaryId: beneficiary?.id ?? '', language, navigationReady, refreshNotifications };
  const pending = useRef<string | null>(null);
  const handled = useRef(new Set<string>());
  const previousToken = useRef(accessToken);

  const flush = () => {
    const id = pending.current;
    const session = current.current;
    if (!id || !session.navigationReady) return;
    pending.current = null;
    // Signed out: the app simply opens. Nothing is shown until someone signs in to their own account.
    if (session.accessToken) go('notification-details', { id });
  };

  useEffect(() => {
    const loading = notificationsModule();
    if (!loading) return;
    let active = true;
    const subscriptions: { remove: () => void }[] = [];
    void loading.then(async (N) => {
      if (!active) return;
      N.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
      });
      const open = (response: import('expo-notifications').NotificationResponse) => {
        const request = response.notification.request;
        const id = alertNotificationId(request.content.data);
        if (!id || response.actionIdentifier !== N.DEFAULT_ACTION_IDENTIFIER || handled.current.has(request.identifier)) return;
        handled.current.add(request.identifier);
        pending.current = id;
        flush();
        void N.clearLastNotificationResponseAsync().catch(() => {});
      };
      subscriptions.push(N.addNotificationResponseReceivedListener(open));
      subscriptions.push(N.addNotificationReceivedListener((notification) => {
        if (alertNotificationId(notification.request.content.data) && current.current.accessToken) void current.current.refreshNotifications();
      }));
      // Provider tokens can rotate; re-register only for the account that opted in on this phone.
      subscriptions.push(N.addPushTokenListener(() => {
        const session = current.current;
        if (session.accessToken && session.beneficiaryId) void resumePhoneAlerts(session.accessToken, session.beneficiaryId, session.language);
      }));
      const launch = await N.getLastNotificationResponseAsync().catch(() => null);
      if (active && launch) open(launch);
    });
    return () => { active = false; subscriptions.forEach((subscription) => subscription.remove()); };
  }, []);

  useEffect(() => { flush(); }, [accessToken, navigationReady]);

  useEffect(() => {
    if (previousToken.current && previousToken.current !== accessToken) void clearPhoneAlerts();
    previousToken.current = accessToken;
    if (accessToken && beneficiary?.id) void resumePhoneAlerts(accessToken, beneficiary.id, language);
  }, [accessToken, beneficiary?.id]);

  return null;
}
