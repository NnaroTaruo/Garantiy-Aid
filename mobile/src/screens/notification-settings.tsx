import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';
import { Button, Card, go, Notice, styles, Txt } from '../components';
import { ApiRequestError, getNotificationPreferences, updateNotificationPreferences, IS_SHARED_BACKEND, type NotificationPreferences } from '../api';
import { useDemo } from '../state';
import { colors as c } from '../theme';
import { PhoneAlerts } from './phone-alerts';

export function NotificationSettings() {
  const { accessToken, t } = useDemo();
  if (!accessToken) return <Notice>{t('Sign in to manage your notifications.', 'Pag-sign in aron madumala ang imong mga pahibalo.')}</Notice>;
  if (!IS_SHARED_BACKEND) return <>
    <Notice>{t('Notification preferences are not available on this server yet.', 'Wala pa magamit ang mga setting sa pahibalo niining server.')}</Notice>
    <Button variant="outline" onPress={() => go('notifications')}>{t('Open notifications', 'Ablihi ang mga pahibalo')}</Button>
  </>;
  return <SavedNotificationSettings key={accessToken} />;
}

export function SavedNotificationSettings() {
  const { accessToken, reset, t } = useDemo();
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [stored, setStored] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const mounted = useRef(true), busy = useRef(false), request = useRef(0);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; ++request.current; }; }, []);
  async function failed(cause: unknown) {
    if (!mounted.current) return;
    if (cause instanceof ApiRequestError && cause.status === 401) { await reset(); return; }
    setError(cause instanceof ApiRequestError && cause.status === 404 ? 'unavailable' : 'connection');
  }
  async function load() {
    if (busy.current) return;
    const id = ++request.current; setLoading(true); setError('');
    try {
      const value = await getNotificationPreferences(accessToken);
      if (mounted.current && id === request.current) { setDraft(value); setStored(value); }
    } catch (cause) { if (id === request.current) await failed(cause); }
    finally { if (mounted.current && id === request.current) setLoading(false); }
  }
  async function save() {
    if (!draft || busy.current || loading) return;
    busy.current = true; setSaving(true); setError(''); setSaved(false);
    try {
      const value = await updateNotificationPreferences(accessToken, draft);
      if (mounted.current) { setDraft(value); setStored(value); setSaved(true); }
    } catch (cause) { await failed(cause); }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  }
  const fields: { key: keyof NotificationPreferences; label: string }[] = [
    { key: 'enrollmentUpdates', label: t('Enrollment updates', 'Mga update sa enrollment') },
    { key: 'scheduleUpdates', label: t('Schedule updates', 'Mga update sa iskedyul') },
    { key: 'claimUpdates', label: t('Claim and release updates', 'Mga update sa claim ug paghatag') },
  ];
  const changed = !!draft && fields.some(({ key }) => draft[key] !== stored?.[key]);
  const toggle = (key: keyof NotificationPreferences) => {
    if (draft && !busy.current && !loading) { setDraft({ ...draft, [key]: !draft[key] }); setSaved(false); }
  };
  return <>
    <Txt variant="title">{t('Your in-app updates', 'Imong mga update sa app')}</Txt>
    <Txt>{t('Choose which automatic updates appear in Notifications and, if you turn them on, as phone alerts. Your saved messages remain available.', 'Pilia kung unsang awtomatikong update ang makita sa Mga pahibalo ug, kon imong i-on, isip alerto sa cellphone. Magpabilin ang imong natipig nga mga mensahe.')}</Txt>
    {loading && <View accessibilityRole="alert" accessibilityLiveRegion="polite"><Notice>{t('Loading your settings…', 'Gikuha ang imong mga setting…')}</Notice></View>}
    {!!error && <View accessibilityRole="alert" accessibilityLiveRegion="polite"><Notice tone="error">{error === 'unavailable'
      ? t('These settings are not available on this server yet. Try again after staff update the service.', 'Wala pa magamit kining mga setting niining server. Sulayi pag-usab human ma-update sa staff ang serbisyo.')
      : draft ? t('Your changes could not be confirmed. They are kept below; try saving again.', 'Wala makumpirma ang imong mga kausaban. Gipabilin kini sa ubos; sulayi og tipig pag-usab.')
        : t('Your settings could not be loaded. Check your connection and try again.', 'Wala makuha ang imong mga setting. Susihon ang koneksyon ug sulayi pag-usab.')}</Notice></View>}
    {!draft && !loading && <Button onPress={() => void load()}>{t('Try again', 'Sulayi pag-usab')}</Button>}
    {draft && <>
      <Card>{fields.map(({ key, label }) => <Pressable key={key} accessibilityRole="switch" accessibilityLabel={label}
        aria-checked={draft[key]} aria-disabled={saving || loading}
        accessibilityState={{ checked: draft[key], disabled: saving || loading }} disabled={saving || loading}
        onPress={() => toggle(key)}
        {...(Platform.OS === 'web' ? { onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === ' ') { event.preventDefault(); if (!event.repeat) toggle(key); }
        } } : {})}
        style={[styles.row, { justifyContent: 'space-between', minHeight: 48 }]}>
        <Txt variant="label" style={{ flex: 1 }}>{label}</Txt>
        <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Switch value={draft[key]} disabled trackColor={{ false: c.outline, true: c.primary }} thumbColor={c.card} />
        </View>
      </Pressable>)}</Card>
      <Button loading={saving} disabled={loading || !changed} onPress={() => void save()}>{t('Save preferences', 'Tipigi ang mga setting')}</Button>
      {saved && <View accessibilityRole="alert" accessibilityLiveRegion="polite"><Notice tone="success">{t('Preferences saved to your account.', 'Natipig sa imong account ang mga setting.')}</Notice></View>}
    </>}
    <PhoneAlerts />
    <Notice>{t('SMS reminders are not connected yet. Phone alerts follow the update types saved above. Sign-in codes are unaffected.', 'Wala pa makonektar ang mga pahinumdom sa SMS. Ang mga alerto sa cellphone mosunod sa mga klase sa update nga natipig sa ibabaw. Dili maapektuhan ang mga code sa pag-sign in.')}</Notice>
    <Button variant="outline" onPress={() => go('notifications')}>{t('Open notifications', 'Ablihi ang mga pahibalo')}</Button>
  </>;
}
